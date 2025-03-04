import * as vscode from "vscode";
import { getViashVersion } from "./getViashVersion";
import { getViashSchemaFile } from "./getViashSchemaFile";

export async function activateViashSchema(context: vscode.ExtensionContext) {
  const version = getViashVersion();
  if (!version) {
    return;
  }

  const configSchemaPath = getViashSchemaFile(version, "config");
  const packageSchemaPath = getViashSchemaFile(version, "package");

  const config = vscode.workspace.getConfiguration("yaml");
  const schemas = config.get<any>("schemas") || {};
  const origSchemas = { ...schemas };
  
  schemas[configSchemaPath] = ["*.vsh.yaml", "*.vsh.yml"];
  schemas[packageSchemaPath] = ["_viash.yaml", "_viash.yml"];

  // Don't update if the schemas are the same
  if (JSON.stringify(schemas) === JSON.stringify(origSchemas)) {
    return;
  }

  // Update the schema setting
  config.update("schemas", schemas, vscode.ConfigurationTarget.Workspace);
  vscode.window.showInformationMessage(
    `Viash ${version} detected. Set schema to '${configSchemaPath}'.`
  );
}
