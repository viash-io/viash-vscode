import * as vscode from "vscode";
import * as cp from "child_process";
import * as util from "util";
import { Log } from "vscode-test-adapter-util";
import { Component, nsList } from "./viash/nsList";
import { findViashPackages } from "./viash/findPackages";

export function activateViashTestController(context: vscode.ExtensionContext) {
  if (!vscode.workspace.workspaceFolders?.length) {
    // No open workspace, don't activate
    return;
  }

  const controller = vscode.tests.createTestController(
    "viashTest",
    "Viash Test"
  );
  context.subscriptions.push(controller);

  const adapter = new ViashTestAdapter(controller);
  context.subscriptions.push(adapter);

  // Initial load
  adapter.load();
}

/** Map from test item ID to component info for running tests */
interface TestItemData {
  component: Component;
}

class ViashTestAdapter {
  private disposables: { dispose(): void }[] = [];
  private runningTestProcess?: cp.ChildProcess;
  private isLoading = false;
  /** Store component data for each test item */
  private testItemData = new Map<string, TestItemData>();
  private log: Log;

  constructor(private readonly controller: vscode.TestController) {
    // Log is used for debugging
    this.log = new Log("viash", undefined, "Viash Test Adapter Log");

    // Watch for _viash.yaml and *.vsh.yaml changes
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((document) => {
        if (this.isViashFile(document.uri)) {
          this.load();
        }
      })
    );

    // Watch for file creation/deletion
    const watcher = vscode.workspace.createFileSystemWatcher(
      "**/{_viash.yaml,_viash.yml,*.vsh.yaml,*.vsh.yml}"
    );
    this.disposables.push(watcher);
    this.disposables.push(watcher.onDidCreate(() => this.load()));
    this.disposables.push(watcher.onDidDelete(() => this.load()));

    // Create Test Run Profile
    this.controller.createRunProfile(
      "Run",
      vscode.TestRunProfileKind.Run,
      (request, token) => this.runHandler(request, token)
    );

    // Set up the resolveHandler
    this.controller.resolveHandler = async (test) => {
      if (!test) {
        await this.load();
      }
    };
  }

  private isViashFile(uri: vscode.Uri): boolean {
    const path = uri.fsPath;
    return (
      path.endsWith(".vsh.yaml") ||
      path.endsWith(".vsh.yml") ||
      path.endsWith("_viash.yaml") ||
      path.endsWith("_viash.yml")
    );
  }

  async load(): Promise<void> {
    if (this.isLoading) return;

    this.isLoading = true;
    this.log.info("Loading Viash tests...");
    this.testItemData.clear();

    try {
      const items = await this.loadAllPackages();
      this.controller.items.replace(items);
      this.log.info("Viash tests loaded.");
    } catch (e) {
      this.log.error("Error loading Viash tests:", e);
      vscode.window.showErrorMessage(`Error loading tests: ${util.inspect(e)}`);
    } finally {
      this.isLoading = false;
    }
  }

  private async loadAllPackages(): Promise<vscode.TestItem[]> {
    const packages = await findViashPackages();

    if (packages.length === 0) {
      return [];
    }

    // Load components from each package
    const allComponents: Component[] = [];

    for (const pkg of packages) {
      try {
        const components = await nsList(pkg.rootDir);
        allComponents.push(...components);
      } catch (e) {
        this.log.error(`Error loading package at ${pkg.rootDir}:`, e);
        // Continue with other packages
      }
    }

    if (allComponents.length === 0) {
      return [];
    }

    // Build hierarchical test structure
    return this.buildTestHierarchy(allComponents);
  }

  private buildTestHierarchy(components: Component[]): vscode.TestItem[] {
    // Group by full path: package/namespace/component
    const arr = components.map((c) => {
      const keys = c.fullName.split("/").slice(0, -1);
      return { keys, component: c };
    });

    return this.createNestedSuite(arr);
  }

  private createNestedSuite(
    arr: { keys: string[]; component: Component }[]
  ): vscode.TestItem[] {
    const currentComponents = arr
      .filter((c) => c.keys.length === 0)
      .map((c) => c.component);

    const groupedNsComponents = Object.groupBy(
      arr.filter((c) => c.keys.length > 0),
      (c) => c.keys[0]
    );

    const namespaceSuites: vscode.TestItem[] = Object.entries(
      groupedNsComponents
    ).map(([key, value]) => {
      const newArr = value!.map((c) => ({
        keys: c.keys.slice(1),
        component: c.component,
      }));

      const suite = this.controller.createTestItem(key, key);
      suite.children.replace(this.createNestedSuite(newArr));

      return suite;
    });

    const componentTests: vscode.TestItem[] = currentComponents.map((c) => {
      const testUri = vscode.Uri.file(c.absoluteConfigPath);
      const testItem = this.controller.createTestItem(c.fullName, c.name, testUri);

      // Store component data for test execution
      this.testItemData.set(c.fullName, { component: c });

      return testItem;
    });

    return [...namespaceSuites, ...componentTests];
  }

  async runHandler(
    request: vscode.TestRunRequest,
    token: vscode.CancellationToken
  ): Promise<void> {
    const run = this.controller.createTestRun(request);

    const queue: vscode.TestItem[] = [];

    if (request.include) {
      request.include.forEach((test) => queue.push(test));
    } else {
      this.controller.items.forEach((test) => queue.push(test));
    }

    while (queue.length > 0 && !token.isCancellationRequested) {
      const test = queue.pop()!;

      // Skip tests the user asked to exclude
      if (request.exclude?.includes(test)) {
        continue;
      }

      if (test.uri) {
        // It's a test case, run it
        await this.runTest(test, run, token);
      } else {
        // It's a suite, add children to queue
        test.children.forEach((child) => queue.push(child));
      }
    }
    run.end();
  }

  private async runTest(
    testItem: vscode.TestItem,
    run: vscode.TestRun,
    token: vscode.CancellationToken
  ): Promise<void> {
    run.started(testItem);
    const start = Date.now();

    const data = this.testItemData.get(testItem.id);
    if (!data) {
      run.failed(
        testItem,
        new vscode.TestMessage("Component data not found"),
        Date.now() - start
      );
      return;
    }

    try {
      // Run viash test from the package root directory
      const process = cp.spawn("viash", ["test", data.component.absoluteConfigPath], {
        cwd: data.component.packageRoot,
      });
      this.runningTestProcess = process;

      let stderr = "";

      process.stdout?.on("data", (data) => {
        run.appendOutput(
          data.toString().replace(/\n/g, "\r\n"),
          undefined,
          testItem
        );
      });
      process.stderr?.on("data", (data) => {
        stderr += data;
        run.appendOutput(
          data.toString().replace(/\n/g, "\r\n"),
          undefined,
          testItem
        );
      });

      token.onCancellationRequested(() => {
        process.kill();
      });

      const code = await new Promise<number>((resolve) => {
        process.on("close", resolve);
      });

      if (code !== 0) {
        run.failed(
          testItem,
          new vscode.TestMessage(stderr || `Test exited with code ${code}`),
          Date.now() - start
        );
        return;
      }

      run.passed(testItem, Date.now() - start);
    } catch (error) {
      const err = error as Error;
      this.log.error("Test failed:", testItem.id, err);
      run.failed(
        testItem,
        new vscode.TestMessage(err.message),
        Date.now() - start
      );
    } finally {
      this.runningTestProcess = undefined;
    }
  }

  cancel(): void {
    if (this.runningTestProcess) {
      this.log.info("Cancelling test run");
      this.runningTestProcess.kill();
      this.runningTestProcess = undefined;
    }
  }

  dispose(): void {
    this.cancel();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }
}
