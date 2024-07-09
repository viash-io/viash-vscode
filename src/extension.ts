import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const versionCachedDir = path.join(os.homedir(), '.viash', 'releases');

function getViashSchemaFile(version: string | undefined = undefined): string | undefined {
    if (!version) {
      version = getViashVersion();
    }
    const schemaPath = path.join(versionCachedDir, version, 'schema.json');

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
							return undefined;
					}
          console.log(`Schema file created at: ${schemaPath}`);
			} catch (error) {
					vscode.window.showErrorMessage(`Error getting Viash schema: ${error}`);
					return undefined;
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

export async function activateViashSchema(
  context: vscode.ExtensionContext
) {
  const version = getViashVersion();
  if (!version) {
    return;
  }

  const schemaPath = getViashSchemaFile(version);
  if (!schemaPath) {
    return;
  }

  const config = vscode.workspace.getConfiguration("yaml");
  const schemas = config.get<any>("schemas") || {};
  if (schemas[schemaPath] && schemas[schemaPath].length > 0 && schemas[schemaPath][0] === "*.vsh.yaml") {
    // nothing needs to be done
    return;
  }
  
  schemas[schemaPath] = ["*.vsh.yaml"];
  config.update("schemas", schemas, vscode.ConfigurationTarget.Workspace);
  vscode.window.showInformationMessage(`Viash ${version} detected. Set schema to '${schemaPath}'.`);
}