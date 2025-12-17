import * as vscode from "vscode";
import * as path from "path";
import { getViashVersion } from "./getViashVersion";
import { getViashSchemaFile } from "./getViashSchemaFile";
import { findViashPackages, ViashPackage } from "./viash/findPackages";

/**
 * Get the effective Viash version for a package.
 * Uses viash_version from config, or falls back to running `viash --version`.
 */
function getPackageVersion(pkg: ViashPackage): string | undefined {
  if (pkg.viashVersion) {
    return pkg.viashVersion;
  }
  return getViashVersion(pkg.rootDir);
}

/**
 * Get workspace-relative glob pattern for a package directory.
 */
function getPackageGlob(pkg: ViashPackage, pattern: string): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return pattern;
  }

  // Find which workspace folder contains this package
  for (const folder of workspaceFolders) {
    const folderPath = folder.uri.fsPath;
    if (pkg.rootDir.startsWith(folderPath)) {
      // Get relative path from workspace folder to package root
      const relativePath = path.relative(folderPath, pkg.rootDir);
      if (relativePath === "") {
        // Package is at workspace root
        return pattern;
      }
      // Convert to forward slashes for glob pattern
      const globPath = relativePath.split(path.sep).join("/");
      return `${globPath}/${pattern}`;
    }
  }

  return pattern;
}

export async function activateViashSchema(context: vscode.ExtensionContext) {
  // Initial schema configuration
  await updateSchemas();

  // Watch for _viash.yaml changes to update schemas
  const watcher = vscode.workspace.createFileSystemWatcher(
    "**/_viash.{yaml,yml}"
  );
  context.subscriptions.push(watcher);
  context.subscriptions.push(watcher.onDidCreate(() => updateSchemas()));
  context.subscriptions.push(watcher.onDidDelete(() => updateSchemas()));
  context.subscriptions.push(watcher.onDidChange(() => updateSchemas()));
}

const VIASH_SCHEMA_URL_PREFIX = "https://raw.githubusercontent.com/viash-io/viash-schemas/";

async function updateSchemas(): Promise<void> {
  // Find all Viash packages
  const packages = await findViashPackages();

  const config = vscode.workspace.getConfiguration("yaml");
  const schemas = config.get<Record<string, string[]>>("schemas") || {};
  const origSchemas = JSON.stringify(schemas);

  // Remove existing Viash schema entries to avoid stale mappings
  for (const key of Object.keys(schemas)) {
    if (key.startsWith(VIASH_SCHEMA_URL_PREFIX)) {
      delete schemas[key];
    }
  }

  // Build schema mappings scoped to each package
  const configSchemaToGlobs = new Map<string, string[]>();
  const packageSchemaToGlobs = new Map<string, string[]>();

  for (const pkg of packages) {
    const version = getPackageVersion(pkg);
    if (!version) {
      continue;
    }

    const configSchemaPath = getViashSchemaFile(version, "config");
    const packageSchemaPath = getViashSchemaFile(version, "package");

    if (!configSchemaPath || !packageSchemaPath) {
      continue;
    }

    // Add globs scoped to this package's directory
    const configGlobs = configSchemaToGlobs.get(configSchemaPath) || [];
    configGlobs.push(getPackageGlob(pkg, "**/*.vsh.yaml"));
    configGlobs.push(getPackageGlob(pkg, "**/*.vsh.yml"));
    configSchemaToGlobs.set(configSchemaPath, configGlobs);

    const packageGlobs = packageSchemaToGlobs.get(packageSchemaPath) || [];
    packageGlobs.push(getPackageGlob(pkg, "_viash.yaml"));
    packageGlobs.push(getPackageGlob(pkg, "_viash.yml"));
    packageSchemaToGlobs.set(packageSchemaPath, packageGlobs);
  }

  // If no packages found, fall back to global patterns with installed version
  if (packages.length === 0) {
    const version = getViashVersion();
    if (version) {
      const configSchemaPath = getViashSchemaFile(version, "config");
      const packageSchemaPath = getViashSchemaFile(version, "package");

      if (configSchemaPath) {
        schemas[configSchemaPath] = ["**/*.vsh.yaml", "**/*.vsh.yml"];
      }
      if (packageSchemaPath) {
        schemas[packageSchemaPath] = ["**/_viash.yaml", "**/_viash.yml"];
      }
    }
  } else {
    // Apply scoped schemas
    for (const [schemaPath, globs] of configSchemaToGlobs) {
      schemas[schemaPath] = globs;
    }
    for (const [schemaPath, globs] of packageSchemaToGlobs) {
      schemas[schemaPath] = globs;
    }
  }

  // Don't update if the schemas are the same
  if (JSON.stringify(schemas) === origSchemas) {
    return;
  }

  // Update the schema setting
  config.update("schemas", schemas, vscode.ConfigurationTarget.Workspace);

  // Show appropriate message
  const versions = [...new Set(packages.map(getPackageVersion).filter(Boolean))];
  if (versions.length === 1) {
    vscode.window.showInformationMessage(
      `Viash ${versions[0]} schema configured for ${packages.length} package(s).`
    );
  } else if (versions.length > 1) {
    vscode.window.showInformationMessage(
      `Viash schemas configured for ${packages.length} package(s) with versions: ${versions.join(", ")}.`
    );
  }
}
