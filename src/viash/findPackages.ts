import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export interface ViashPackage {
  /** Absolute path to the _viash.yaml file */
  configPath: string;
  /** Absolute path to the directory containing _viash.yaml */
  rootDir: string;
  /** Package name from the config */
  name?: string;
  /** Viash version specified in the config */
  viashVersion?: string;
}

/**
 * Find all _viash.yaml files in the workspace and parse basic info from them.
 */
export async function findViashPackages(): Promise<ViashPackage[]> {
  const packages: ViashPackage[] = [];

  // Search for _viash.yaml files across all workspace folders
  const files = await vscode.workspace.findFiles(
    "**/_viash.{yaml,yml}",
    "**/node_modules/**"
  );

  for (const file of files) {
    const configPath = file.fsPath;
    const rootDir = path.dirname(configPath);

    try {
      const content = fs.readFileSync(configPath, "utf-8");
      const parsed = parseViashYaml(content);

      packages.push({
        configPath,
        rootDir,
        name: parsed.name,
        viashVersion: parsed.viashVersion,
      });
    } catch (error) {
      console.error(`Error reading ${configPath}:`, error);
      // Still add the package even if we can't parse it
      packages.push({
        configPath,
        rootDir,
      });
    }
  }

  return packages;
}

/**
 * Simple YAML parser to extract name and viash_version fields.
 * We use a simple regex approach to avoid adding a YAML parsing dependency.
 */
function parseViashYaml(content: string): {
  name?: string;
  viashVersion?: string;
} {
  const nameMatch = content.match(/^name:\s*(.+)$/m);
  const versionMatch = content.match(/^viash_version:\s*(.+)$/m);

  return {
    name: nameMatch?.[1]?.trim().replace(/^["']|["']$/g, ""),
    viashVersion: versionMatch?.[1]?.trim().replace(/^["']|["']$/g, ""),
  };
}

/**
 * Get unique viash versions from a list of packages.
 * Returns versions sorted in descending order (newest first).
 */
export function getUniqueVersions(packages: ViashPackage[]): string[] {
  const versions = new Set<string>();

  for (const pkg of packages) {
    if (pkg.viashVersion) {
      versions.add(pkg.viashVersion);
    }
  }

  return Array.from(versions).sort((a, b) => {
    // Sort semver-like versions in descending order
    return b.localeCompare(a, undefined, { numeric: true });
  });
}
