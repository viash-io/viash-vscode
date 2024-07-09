import * as vscode from "vscode";
import * as cp from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getViashVersion } from "./getViashVersion";

const versionCachedDir = path.join(os.homedir(), ".viash", "releases");

export function getViashSchemaFile(
  version: string | undefined = undefined
): string | undefined {
  if (!version) {
    version = getViashVersion();
  }
  const schemaPath = path.join(versionCachedDir, version, "schema.json");

  if (!fs.existsSync(schemaPath)) {
    try {
      fs.mkdirSync(path.dirname(schemaPath), { recursive: true }); // Ensure directory exists

      const { status, stderr } = cp.spawnSync(
        "viash",
        ["export", "json_schema", "--format", "json", "--output", schemaPath],
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

  return schemaPath;
}
