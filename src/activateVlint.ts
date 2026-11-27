import * as vscode from "vscode";
import * as cp from "child_process";
import {
  ExecuteCommandRequest,
  LanguageClient,
  State,
} from "vscode-languageclient/node";

const CONFIG_SECTION = "viash.vlint";

let client: LanguageClient | undefined;
let output: vscode.LogOutputChannel | undefined;
let restartPromise: Promise<void> | undefined;
let restartQueued = false;

/**
 * Start the Viash Lint language server (`vlint server`) for YAML files.
 * The server decides which files are Viash configs or fragments.
 */
export async function activateVlint(context: vscode.ExtensionContext) {
  // vscode-languageclient 11 needs a log output channel
  output = vscode.window.createOutputChannel("Viash Lint", { log: true });
  context.subscriptions.push(output);

  // The palette commands run the server commands for the active document.
  // The client also registers the server commands (`vlint.applyFixes`), but
  // those get no document from the palette.
  const fixCommand = (serverCommand: string) => async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    // The palette hides these commands when the server is not running, but a
    // keybinding can still run them
    if (!client?.isRunning()) {
      const show = "Show output";
      const choice = await vscode.window.showInformationMessage(
        "Viash Lint is not running.",
        show
      );
      if (choice === show) {
        output?.show();
      }
      return;
    }
    await client.sendRequest(ExecuteCommandRequest.type, {
      command: serverCommand,
      arguments: [{ uri: editor.document.uri.toString() }],
    });
  };
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "viash.vlint.fixAll",
      fixCommand("vlint.applyFixes")
    ),
    vscode.commands.registerCommand(
      "viash.vlint.fixAllUnsafe",
      fixCommand("vlint.applyUnsafeFixes")
    ),
    vscode.commands.registerCommand("viash.vlint.restart", restartClient),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration(`${CONFIG_SECTION}.enable`) ||
        event.affectsConfiguration(`${CONFIG_SECTION}.path`)
      ) {
        restartClient();
      }
    })
  );

  // The first start also goes through restartClient, because the
  // configuration listener above can already request a restart
  await restartClient();
}

export async function deactivateVlint() {
  await restartPromise;
  await stopClient();
}

async function startClient() {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  if (!config.get<boolean>("enable", true)) {
    output?.info("Viash Lint is disabled");
    return;
  }

  const configuredPath = config.get<string>("path", "");
  const command = configuredPath || "vlint";

  // Check the binary before starting the client, so that a missing vlint
  // gives one clear message and not a failing client
  const check = cp.spawnSync(command, ["--version"], { timeout: 5000 });
  if (check.error || check.status !== 0) {
    const message = `Cannot run '${command} --version'. Viash Lint is not started.`;
    output?.warn(message);
    if (configuredPath) {
      // Only show a message if the user set the path. vlint is optional.
      vscode.window.showWarningMessage(
        `${message} Check the setting '${CONFIG_SECTION}.path'.`
      );
    }
    return;
  }
  output?.info(`Starting ${check.stdout.toString().trim()} (${command} server)`);

  client = new LanguageClient(
    CONFIG_SECTION,
    "Viash Lint",
    { command, args: ["server"] },
    {
      documentSelector: [{ scheme: "file", language: "yaml" }],
      outputChannel: output,
    }
  );
  // Also covers a server that crashes or stops after it started
  client.onDidChangeState((event) =>
    setRunning(event.newState === State.Running)
  );

  try {
    await client.start();
  } catch (error) {
    output?.error(`Cannot start Viash Lint: ${error}`);
    client = undefined;
    setRunning(false);
  }
}

/** Set the context key that shows the fix commands in the palette. */
function setRunning(running: boolean) {
  vscode.commands.executeCommand("setContext", "viash.vlint.running", running);
}

async function stopClient() {
  if (!client) {
    return;
  }
  const oldClient = client;
  client = undefined;
  try {
    await oldClient.stop();
  } catch (error) {
    output?.error(`Cannot stop Viash Lint: ${error}`);
  }
  setRunning(false);
}

/**
 * Stop the client and start a new one. Only one restart runs at a time.
 * Requests that come while a restart runs give one more restart after it,
 * so that two restarts close together cannot leave a client that is never
 * stopped.
 */
async function restartClient(): Promise<void> {
  if (restartPromise) {
    restartQueued = true;
    return restartPromise;
  }
  restartPromise = (async () => {
    try {
      do {
        restartQueued = false;
        await stopClient();
        await startClient();
      } while (restartQueued);
    } finally {
      restartPromise = undefined;
    }
  })();
  return restartPromise;
}
