import * as vscode from 'vscode';
import {
  TestLoadStartedEvent,
  TestLoadFinishedEvent,
  TestRunStartedEvent,
  TestRunFinishedEvent,
  TestSuiteEvent,
  TestEvent,
  RetireEvent,
  TestSuiteInfo,
} from 'vscode-test-adapter-api';
import * as cp from 'child_process';
import * as util from 'util';

type NsListResult = {
  name: string;
  namespace?: string;
  resources: {
    type?: string;
    path?: string;
    text?: string;
    [key: string]: any;
  }[];
  test_resources: {
    type?: string;
    path?: string;
    text?: string;
    [key: string]: any;
  };
  build_info: {
    config: string;
    [key: string]: any;
  };
  [key: string]: any;
};

export class ViashTestAdapter implements vscode.Disposable {

  private disposables: { dispose(): void }[] = [];

  private readonly testsEmitter = new vscode.EventEmitter<TestLoadStartedEvent | TestLoadFinishedEvent>();
  private readonly testStatesEmitter = new vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>();
  private readonly retireEmitter = new vscode.EventEmitter<RetireEvent>();

  private isLoading = false;
  private runningTestProcess?: cp.ChildProcess;

  get tests(): vscode.Event<TestLoadStartedEvent | TestLoadFinishedEvent> {
    return this.testsEmitter.event;
  }
  get testStates(): vscode.Event<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent> {
    return this.testStatesEmitter.event;
  }
  get retire(): vscode.Event<RetireEvent> {
    return this.retireEmitter.event;
  }

  constructor(
    public readonly workspaceFolder: vscode.WorkspaceFolder
  ) {
    this.disposables.push(this.testsEmitter);
    this.disposables.push(this.testStatesEmitter);
    this.disposables.push(this.retireEmitter);

    this.disposables.push(vscode.workspace.onDidChangeConfiguration(configChange => {
      if (configChange.affectsConfiguration('viash.testFiles', this.workspaceFolder.uri)) {
        this.load();
      }
    }));

    this.disposables.push(vscode.workspace.onDidSaveTextDocument(document => {
      if (this.isViashConfigFile(document.uri)) {
        this.load();
      } else if (this.isSourceFile(document.uri)) {
        this.retireEmitter.fire({});
      }
    }));
  }

  private isViashConfigFile(uri: vscode.Uri): boolean {
    return uri.fsPath.endsWith('.vsh.yaml');
  }

  private isSourceFile(uri: vscode.Uri): boolean {
    return uri.fsPath.endsWith('.ts') || uri.fsPath.endsWith('.js') || uri.fsPath.endsWith('.py');
  }

  async load(): Promise<void> {
    if (this.isLoading) return;

    this.isLoading = true;
    this.testsEmitter.fire({ type: 'started' });

    try {
      const suite = await this.loadViashComponents();
      this.testsEmitter.fire({ type: 'finished', suite });

    } catch (e) {
      this.testsEmitter.fire({ type: 'finished', errorMessage: util.inspect(e) });
    }

    this.retireEmitter.fire({});
    this.isLoading = false;
  }


  private async loadViashComponents(): Promise<TestSuiteInfo | undefined> {
    const viashConfigs = await this.getViashConfigs();

    if (!viashConfigs || viashConfigs.length === 0) {
      return undefined;
    }

    const rootSuite: TestSuiteInfo = {
      type: "suite",
      id: "root",
      label: "Viash Components",
      children: [],
    };

    for (const viashConfig of viashConfigs) {
      const fullName = viashConfig.namespace
        ? `${viashConfig.namespace}/${viashConfig.name}`
        : viashConfig.name;

      const componentSuite: TestSuiteInfo = {
        type: "suite",
        id: fullName,
        label: fullName, // Or extract a more friendly name from the path if possible
        file: viashConfig.build_info.config,
        children: [
          {
            type: "test",
            id: `${fullName}/test`,
            label: `Test`,
            file: viashConfig.build_info.config,
          },
        ],
      };
      rootSuite.children.push(componentSuite);
    }
    return rootSuite;
  }

  private async getViashConfigs(): Promise<NsListResult[] | undefined> {
    return new Promise<NsListResult[] | undefined>((resolve, reject) => {
      const process = cp.spawn("viash", ["ns", "list", "--format", "json"], {
        cwd: this.workspaceFolder.uri.fsPath,
      });
      let stdout = "";
      let stderr = "";

      process.stdout.on("data", (data) => {
        stdout += data;
      });

      process.stderr.on("data", (data) => {
        stderr += data;
      });

      process.on("close", (code) => {
        if (code === 0) {
          // Parse the JSON output
          let namespaces: NsListResult[] = [];

          try {
            namespaces = JSON.parse(stdout);
          } catch (e) {
            console.error("Error parsing viash ns list output:", e);
            reject(e);
            return;
          }

          resolve(namespaces);
        } else {
          console.error(`Error listing Viash namespaces: ${stderr}`);
          reject(
            new Error(`viash ns list failed with code ${code}: ${stderr}`)
          );
        }
      });

      process.on("error", (err) => {
        console.error("Failed to start viash process:", err);
        reject(err);
      });
    });
  }

  async run(testsToRun: string[]): Promise<void> {
    if (this.runningTestProcess) return;

    this.testStatesEmitter.fire({ type: 'started', tests: testsToRun });

    for (const testId of testsToRun) {
      if (testId === 'root') {
        const allTests = await this.loadViashComponents();
        if (allTests) {
          for (const child of allTests.children) {
            if (child.type === 'suite') {
              for (const test of child.children) {
                  await this.runTest(test.id);
              }
            }
          }
        }
      } else {
        await this.runTest(testId);
      }
    }

    this.testStatesEmitter.fire({ type: 'finished' });
  }

  private async findTest(testId: string): Promise<string | null> {
    const viashConfigs = await this.getViashConfigs();
    if (!viashConfigs) {
      return null;
    }

    for (const config of viashConfigs) {
       const fullName = config.namespace ? `${config.namespace}/${config.name}` : config.name;
        if (testId === `${fullName}/test`)
        {
            return config.build_info.config
        }
    }

    return null;
  }


  private async runTest(testId: string): Promise<void> {
    this.testStatesEmitter.fire({ type: 'test', test: testId, state: 'running' });

    try {
       const filePath = await this.findTest(testId);
        if (!filePath) {
            throw new Error(`Test with ID "${testId}" not found or has an invalid configuration.`);
        }
      await this.executeViashTest(filePath);
      this.testStatesEmitter.fire({ type: 'test', test: testId, state: 'passed' });
    } catch (error) {
      const err = error as Error;
      this.testStatesEmitter.fire({
        type: 'test',
        test: testId,
        state: 'failed',
        message: err.message,
      });
    }
  }

  private async executeViashTest(filePath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.runningTestProcess = cp.spawn('viash', ['test', filePath], { cwd: this.workspaceFolder.uri.fsPath });

      let stdout = '';
      let stderr = '';

      this.runningTestProcess.stdout?.on('data', (data) => {
        stdout += data;
        this.testStatesEmitter.fire({
          type: 'test',
          test: filePath,
          state: 'running',
          message: data.toString(),
        });
      });

      this.runningTestProcess.stderr?.on('data', (data) => {
        stderr += data;
        this.testStatesEmitter.fire({
          type: 'test',
          test: filePath,
          state: 'running',
          message: data.toString(),
        });
      });

      this.runningTestProcess.on('close', (code) => {
        this.runningTestProcess = undefined;
        if (code === 0) {
          resolve();
        } else {
          console.error(`viash test ${filePath} failed:\n${stderr}`);
          reject(new Error(`viash test failed with code ${code}:\n${stderr}\n${stdout}`));
        }
      });

      this.runningTestProcess.on('error', (err) => {
        this.runningTestProcess = undefined;
        console.error('Failed to start viash process:', err);
        reject(err);
      });
    });
  }

  cancel(): void {
    if (this.runningTestProcess) {
      this.runningTestProcess.kill();
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
