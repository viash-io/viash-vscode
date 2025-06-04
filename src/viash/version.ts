import * as vscode from "vscode";
import * as cp from "child_process";

export function getViashVersion(
  folder: string
): string {
  try {
    const { stdout } = cp.spawnSync("viash", ["--version"], {
      cwd: folder,
    });
    // stdout format: 'viash <version> (c) <year> <author>'
    return stdout.toString().trim().split(" ")[1];
  } catch (error) {
    vscode.window.showErrorMessage(`Error getting Viash version: ${error}`);
    return "unknown";
  }
}
