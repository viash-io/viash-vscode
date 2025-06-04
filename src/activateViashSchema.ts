import * as vscode from "vscode";
import { getViashVersion } from "./viash/version";

export function getViashSchemaFile(
  version: string,
  objectType: string = "config"
): string {
  return `https://raw.githubusercontent.com/viash-io/viash-schemas/refs/heads/main/json_schemas/${version}/${objectType}.schema.json`;
}

export function helper(projectConfigPath: string) {
  if (!projectConfigPath) {
    return;
  }
  if (!projectConfigPath.match(/\/_viash\.ya?ml$/)) {
    return;
  }

  const dir = projectConfigPath.replace(/\/_viash\.ya?ml$/, "");
  
  const version = getViashVersion(dir);

  updateSchemas(version, dir);

  vscode.window.showInformationMessage(
    `Viash schema updated for version: ${version} at ${dir}`
  );
}

export async function activateViashSchema(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      vscode.window.showInformationMessage(
        `Checking if Viash schema needs to be updated for ${document.uri.fsPath}`
      );

      helper(document.uri.fsPath);
    })
  );

  // recurse current workspace folders and look for _viash.yaml files
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    for (const folder of workspaceFolders) {
      const dir = folder.uri.fsPath;
      const version = getViashVersion(dir);
      if (version !== "unknown") {
        updateSchemas(version, dir);
      }
    }
  }
}

function updateSchemas(version: string, folder?: string) {
  vscode.window.showInformationMessage(`Updating Viash schemas for version: ${version}`);

  // Ensure viashVersion is not "unknown" here, or handle it gracefully in getViashSchemaFile
  if (version === "unknown") {
    vscode.window.showErrorMessage("updateSchemas called with 'unknown' Viash version. Aborting schema update.");
    return;
  }

  const configSchemaPath = getViashSchemaFile(version, "config");
  const packageSchemaPath = getViashSchemaFile(version, "package");

  const config = vscode.workspace.getConfiguration("yaml");
  const schemas = config.get<any>("schemas") || {};
  const origSchemas = { ...schemas };

  // remove entries for old schemas
  // TODO: need to fix this because with multiple workspaces, this will remove schemas from other workspaces
  for (const schemaPath of Object.keys(schemas)) {
    if (schemaPath.startsWith("https://raw.githubusercontent.com/viash-io/viash-schemas")) {
      delete schemas[schemaPath];
    }
  }
  
  if (folder) {
    schemas[configSchemaPath] = [
      `${folder}/*.vsh.yaml`,
      `${folder}/*.vsh.yml`,
    ];
    schemas[packageSchemaPath] = [
      `${folder}/_viash.yaml`,
      `${folder}/_viash.yml`,
    ];
  } else {
    schemas[configSchemaPath] = ["*.vsh.yaml", "*.vsh.yml"];
    schemas[packageSchemaPath] = ["_viash.yaml", "_viash.yml"];
  }

  if (JSON.stringify(schemas) === JSON.stringify(origSchemas)) {
    return;
  }

  config.update("schemas", schemas, vscode.ConfigurationTarget.Workspace);
  vscode.window.showInformationMessage(
    `Viash ${version} schemas updated. Config: '${configSchemaPath}', Package: '${packageSchemaPath}'.`
  );
}
