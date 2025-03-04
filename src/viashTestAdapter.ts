import * as vscode from "vscode";
import * as cp from "child_process";
import * as util from "util";
import { Log } from "vscode-test-adapter-util";
import { Component, nsList } from "./viash/nsList";

export function activateViashTestController(context: vscode.ExtensionContext) {
  const workspaceFolder = (vscode.workspace.workspaceFolders || [])[0];
  if (!workspaceFolder) {
    // No open workspace, don't activate
    return;
  }

  const controller = vscode.tests.createTestController(
    "viashTest",
    "Viash Test"
  );
  context.subscriptions.push(controller);

  const adapter = new ViashTestAdapter(workspaceFolder, controller);
  context.subscriptions.push(adapter);

  // Initial load (important for first activation, and handles cases where the Test Explorer isn't immediately visible)
  adapter.load();
}

class ViashTestAdapter {
  private disposables: { dispose(): void }[] = [];
  private runningTestProcess?: cp.ChildProcess;
  private isLoading = false;

  constructor(
    public readonly workspace: vscode.WorkspaceFolder,
    private readonly controller: vscode.TestController,
    private readonly log: Log = new Log(
      "viash",
      workspace,
      "Viash Test Adapter Log"
    )
  ) {
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((configChange) => {
        if (
          configChange.affectsConfiguration(
            "viash.testFiles",
            this.workspace.uri
          )
        ) {
          this.load();
        }
      })
    );

    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((document) => {
        if (this.isViashConfigFile(document.uri)) {
          this.load();
        }
      })
    );

    // Create Test Run Profiles
    this.controller.createRunProfile(
      "Run",
      vscode.TestRunProfileKind.Run,
      (request, token) => this.runHandler(false, request, token)
    );
    this.controller.createRunProfile(
      "Debug",
      vscode.TestRunProfileKind.Debug,
      (request, token) => this.runHandler(true, request, token)
    );

    // Set up the resolveHandler
    this.controller.resolveHandler = async (test) => {
      if (!test) {
        // Initial load or refresh of all tests.
        await this.load();
      } else {
        // Potentially handle expanding individual test items if needed.
        // For now, we re-parse the whole thing on changes to be safe. Could optimize.
        await this.load();
      }
    };
  }

  private isViashConfigFile(uri: vscode.Uri): boolean {
    return uri.fsPath.endsWith(".vsh.yaml");
  }

  async load(): Promise<void> {
    if (this.isLoading) return;

    this.isLoading = true;
    this.log.info("Loading Viash tests...");

    try {
      const suite = await this.loadSuite();
      if (suite) {
        this.controller.items.replace(suite);
      } else {
        this.controller.items.replace([]);
      }
      this.log.info("Viash tests loaded.");
    } catch (e) {
      this.log.error("Error loading Viash tests:", e);
      vscode.window.showErrorMessage(`Error loading tests: ${util.inspect(e)}`);
    } finally {
      this.isLoading = false;
    }
  }

  private async getViashConfigs() {
    return await nsList(this.workspace.uri.fsPath);
  }

  private createNestedSuite(
    arr: { keys: string[]; component: Component }[]
  ): (vscode.TestItem | vscode.TestItem)[] {
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
      const testUri = vscode.Uri.joinPath(
        this.workspace.uri,
        c.build_info.config
      );
      return this.controller.createTestItem(c.fullName, c.name, testUri);
    });

    return [...namespaceSuites, ...componentTests];
  }

  private async loadSuite(): Promise<vscode.TestItem[] | undefined> {
    const viashConfigs = await this.getViashConfigs();

    if (viashConfigs.length === 0) {
      return undefined;
    }

    const arr = viashConfigs.map((c) => {
      const keys = c.fullName.split("/").slice(0, -1);
      return { keys, component: c };
    });

    return this.createNestedSuite(arr);
  }

  async runHandler(
    shouldDebug: boolean,
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
        // It might be a suite, add children to queue
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

    try {
      const process = cp.spawn("viash", ["test", testItem.uri!.path], {
        cwd: this.workspace.uri.fsPath,
      });
      this.runningTestProcess = process;

      let stdout = "";
      let stderr = "";

      process.stdout?.on("data", (data) => {
        stdout += data;
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
        run.failed(testItem, new vscode.TestMessage(stderr), Date.now() - start);
        return;
      }

      run.passed(testItem, Date.now() - start);
    } catch (error) {
      const err = error as Error;
      this.log.error("Test failed:", testItem.id, err);
      run.failed(testItem, new vscode.TestMessage(err.message), Date.now() - start);
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
