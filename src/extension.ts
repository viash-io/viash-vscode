import * as vscode from "vscode";
import { activateViashSchema } from "./activateViashSchema";
import { activateViashTestController } from "./viashTestAdapter";

export async function activate(context: vscode.ExtensionContext) {
  activateViashSchema(context);
  activateViashTestController(context);
}

export function deactivate() {}
