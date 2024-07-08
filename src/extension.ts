import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const schemaCacheDir = path.join(os.homedir(), '.viash', 'releases');

async function getViashSchemaFile(): Promise<string | null> {
    const version = await getViashVersion();
    const schemaPath = path.join(schemaCacheDir, version, 'schema.json');

		if (!fs.existsSync(schemaCacheDir)) {
			try {
					fs.mkdirSync(path.dirname(schemaPath), { recursive: true }); // Ensure directory exists

					const { stderr } = cp.spawnSync('viash', ['export', 'json_schema', '--format', 'json', '--output', schemaPath]);
					if (stderr) {
							vscode.window.showErrorMessage(`Error getting Viash schema: ${stderr}`);
							return null;
					}
			} catch (error) {
					vscode.window.showErrorMessage(`Error getting Viash schema: ${error}`);
					return null;
			}
		}

		return schemaPath
}

async function getViashVersion(): Promise<string> {
  try {
    const { stdout } = cp.spawnSync("viash", ["--version"]);
		// stdout format: 'viash <version> (c) <year> <author>'
    return stdout.toString().trim().split(' ')[1];
  } catch (error) {
    vscode.window.showErrorMessage(`Error getting Viash version: ${error}`);
    return "unknown";
  }
}

export async function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      if (
        document.languageId === "yaml" &&
        document.fileName.endsWith(".vsh.yaml")
      ) {
        const schemaPath = await getViashSchemaFile();
        if (schemaPath) {
          await setViashSchema(document.uri, schemaPath);
          vscode.commands.executeCommand(
            "vscode.executeDocumentSymbolProvider",
            document.uri
          );
        }
      }
    })
  );
}

async function setViashSchema(uri: vscode.Uri, schemaPath: string): Promise<void> {
  const config = vscode.workspace.getConfiguration("yaml", uri);
  const schemas = config.get<any>("schemas") || {};
  schemas[schemaPath] = ["*.vsh.yaml"];
  await config.update(
    "schemas",
    schemas,
    vscode.ConfigurationTarget.WorkspaceFolder
  );
}
