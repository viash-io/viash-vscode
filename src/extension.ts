import * as vscode from "vscode";
import { activateViashSchema } from "./activateViashSchema";
import { activateViashTestController } from "./viashTestAdapter";
import { activateVlint, deactivateVlint } from "./activateVlint";

export async function activate(context: vscode.ExtensionContext) {
  activateViashSchema(context);
  activateViashTestController(context);
  await activateVlint(context);
}

export async function deactivate() {
  await deactivateVlint();
}
