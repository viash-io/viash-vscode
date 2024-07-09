import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const versionCachedDir = path.join(os.homedir(), '.viash', 'releases');

function getViashSchemaFile(): string | null {
    const version = getViashVersion();
    console.log(`Viash version: ${version}`);

    const schemaPath = path.join(versionCachedDir, version, 'schema.json');
    console.log(`Schema path: ${schemaPath}`);

		if (!fs.existsSync(schemaPath)) {
			try {
					fs.mkdirSync(path.dirname(schemaPath), { recursive: true }); // Ensure directory exists

					const { status, stderr } = cp.spawnSync(
            'viash',
            ['export', 'json_schema', '--format', 'json', '--output', schemaPath],
            { cwd: vscode.workspace.workspaceFolders?.[0].uri.fsPath }
          );
					if (status) {
							vscode.window.showErrorMessage(`Error getting Viash schema: ${stderr}`);
							return null;
					}
          console.log(`Schema file created at: ${schemaPath}`);
			} catch (error) {
					vscode.window.showErrorMessage(`Error getting Viash schema: ${error}`);
					return null;
			}
		}

		return schemaPath
}

function getViashVersion(): string {
  try {
    const { stdout } = cp.spawnSync(
      "viash",
      ["--version"],
      { cwd: vscode.workspace.workspaceFolders?.[0].uri.fsPath }
    );
		// stdout format: 'viash <version> (c) <year> <author>'
    return stdout.toString().trim().split(' ')[1];
  } catch (error) {
    vscode.window.showErrorMessage(`Error getting Viash version: ${error}`);
    return "unknown";
  }
}

export async function activate(context: vscode.ExtensionContext) {
  // set schema
  activateViashSchema(context);
}

// This method is called when your extension is deactivated
export function deactivate() {}

function isViashComponent(document: vscode.TextDocument) {
  return document.fileName.endsWith(".vsh.yaml");
}

export function activateViashSchema(
  context: vscode.ExtensionContext
) {
  const ensureViashSchema = async (doc: vscode.TextDocument) => {
    if (isViashComponent(doc)) {
      const schemaPath = getViashSchemaFile();
      if (schemaPath) {
        const config = vscode.workspace.getConfiguration("yaml");
        const schemas = config.get<any>("schemas") || {};
        schemas[schemaPath] = ["*.vsh.yaml"];
        config.update(
          "schemas",
          schemas,
          vscode.ConfigurationTarget.Workspace
        );
        vscode.window.showInformationMessage(`Viash schema set: ${schemaPath}`);
      }
    }
  };
  vscode.window.onDidChangeActiveTextEditor((editor) => { if (editor) ensureViashSchema(editor.document); });
  vscode.workspace.onDidOpenTextDocument(ensureViashSchema);
  vscode.workspace.onDidSaveTextDocument(ensureViashSchema);
}