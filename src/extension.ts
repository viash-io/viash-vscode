import * as vscode from "vscode";
import { activateViashSchema } from "./activateViashSchema";
import { testExplorerExtensionId, TestHub } from "vscode-test-adapter-api";
import { TestAdapterRegistrar } from "vscode-test-adapter-util";
import { ViashTestAdapter } from "./viashTestAdapter";

export async function activate(context: vscode.ExtensionContext) {
  activateViashSchema(context);

  const testExplorerExtension = vscode.extensions.getExtension<TestHub>(testExplorerExtensionId);

  if (testExplorerExtension) {
    const testHub = testExplorerExtension.exports;

    // Register the Test Adapter
    context.subscriptions.push(new TestAdapterRegistrar(
      testHub,
      workspaceFolder => new ViashTestAdapter(workspaceFolder)
    ));
  }
}

export function deactivate() {}
