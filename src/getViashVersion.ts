import * as vscode from "vscode";
import * as cp from "child_process";

/**
 * Get the installed Viash version by running `viash --version`.
 * @param cwd - Directory to run the command from. If provided, Viash may use
 *              version management based on the project's _viash.yaml.
 */
export function getViashVersion(cwd?: string): string | undefined {
  try {
    const result = cp.spawnSync("viash", ["--version"], {
      cwd: cwd ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    });
    
    if (result.error) {
      // viash command not found
      return undefined;
    }
    
    if (result.status !== 0) {
      return undefined;
    }
    
    // stdout format: 'viash <version> (c) <year> <author>'
    const version = result.stdout.toString().trim().split(" ")[1];
    return version || undefined;
  } catch (error) {
    vscode.window.showErrorMessage(`Error getting Viash version: ${error}`);
    return undefined;
  }
}
