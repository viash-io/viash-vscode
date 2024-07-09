import * as vscode from "vscode";
import { getViashVersion } from "./getViashVersion";
import { getViashSchemaFile } from "./getViashSchemaFile";

export async function activate(context: vscode.ExtensionContext) {
  activateViashSchema(context);
}

export function deactivate() {}

export async function activateViashSchema(context: vscode.ExtensionContext) {
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
  if (
    schemas[schemaPath] &&
    schemas[schemaPath].length == 1 &&
    schemas[schemaPath][0] === "*.vsh.yaml"
  ) {
    // nothing needs to be done
    return;
  }

  schemas[schemaPath] = ["*.vsh.yaml"];
  config.update("schemas", schemas, vscode.ConfigurationTarget.Workspace);
  vscode.window.showInformationMessage(
    `Viash ${version} detected. Set schema to '${schemaPath}'.`
  );
}
