/**
 * YAML parsing with __merge__ support, based on Viash's RichJson.inherit() implementation.
 * 
 * Reference: https://github.com/viash-io/viash/blob/main/src/main/scala/io/viash/helpers/circe/RichJson.scala
 * 
 * Supports:
 *
 * - Single string or array of strings for __merge__
 * - '.' placeholder representing the current document
 * - Paths starting with '/' are relative to package root
 * - Other paths are relative to the current YAML file
 * - Recursive merging at any nesting level
 * - Deep merge of objects, concatenation of arrays
 * - Cycle detection to prevent infinite loops
 * 
 * Note: This is a simplified implementation for the purpose of this VSCode plugin.
 * It differs from Viash's strict implementation in several ways:
 *
 * - Always strips __merge__ from output (no stripInherits parameter)
 * - Silently filters invalid merge specs instead of throwing exceptions
 * - No validation for deprecated __includes__ field
 * - Uses simple file path resolution instead of URI handling
 * 
 * These differences are acceptable since we're parsing for content reading, not viash build/run.
 */

import * as fs from "fs";
import * as path from "path";
import { parse as yamlParse } from "yaml";

export function parseYamlWithMerge(
  content: string,
  baseDir: string,
  packageRoot: string
): any {
  const doc = yamlParse(content) ?? {};
  return resolveMerge(doc, baseDir, packageRoot);
}

export function readYamlWithMerge(entryFile: string, packageRoot: string): any {
  const content = fs.readFileSync(entryFile, "utf-8");
  return parseYamlWithMerge(content, path.dirname(entryFile), packageRoot);
}

function resolveMerge(
  doc: any,
  baseDir: string,
  packageRoot: string,
  seen: Set<string> = new Set()
): any {
  // Arrays and non-objects: just recurse into nested values
  if (!isPlainObject(doc)) {
    return recurseNested(doc, baseDir, packageRoot, seen);
  }

  const { __merge__, ...current } = doc || {};

  // Build list of sources, ensuring '.' (self) is included once at the end if not specified
  let sources = normalizeMergeSpec(__merge__);
  const hasSelf = sources.includes(".");
  if (!hasSelf) {
    sources = [...sources, "."];
  }

  // Prepare a version of current with nested merges resolved as well
  const selfResolved = recurseNested(current, baseDir, packageRoot, seen);

  // Merge all sources in order
  let merged: any = {};
  for (const src of sources) {
    if (src === ".") {
      merged = deepMerge(merged, selfResolved);
      continue;
    }

    const absPath = resolveSourcePath(src, baseDir, packageRoot);
    if (!absPath) {
      // Could not resolve path
      continue;
    }
    if (seen.has(absPath)) {
      continue; // prevent cycles
    }
    try {
      const yamlText = fs.readFileSync(absPath, "utf-8");
      seen.add(absPath);
      const childDoc = yamlParse(yamlText) ?? {};
      const childEffective = resolveMerge(
        childDoc,
        path.dirname(absPath),
        packageRoot,
        seen
      );
      merged = deepMerge(merged, childEffective);
    } catch (e) {
      // Note: Viash throws ConfigYamlException for parse errors.
      // We silently skip failed merges for graceful IDE operation.
      // This allows partial content to be used even if some merge targets are missing/invalid.
    }
  }

  return merged;
}

function recurseNested(
  value: any,
  baseDir: string,
  packageRoot: string,
  seen: Set<string>
): any {
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        isPlainObject(v) || Array.isArray(v)
          ? resolveMerge(v, baseDir, packageRoot, seen)
          : v,
      ])
    );
  }
  if (Array.isArray(value)) {
    return value.map((v) =>
      isPlainObject(v) || Array.isArray(v)
        ? resolveMerge(v, baseDir, packageRoot, seen)
        : v
    );
  }
  return value;
}

function resolveSourcePath(
  src: string,
  baseDir: string,
  packageRoot: string
): string | null {
  if (src.startsWith("/")) {
    // Relative to project config root
    const rel = src.replace(/^\/+/, "");
    return path.join(packageRoot, rel);
  }
  // Relative to current YAML file
  return path.join(baseDir, src);
}

function normalizeMergeSpec(spec: any): string[] {
  // Note: Viash throws ConfigParserMergeException for invalid types.
  // We silently filter non-strings for graceful IDE parsing.
  if (!spec) return [];
  if (typeof spec === "string") return [spec];
  if (Array.isArray(spec)) return spec.filter((x) => typeof x === "string");
  return [];
}

function deepMerge(target: any, source: any): any {
  if (isPlainObject(target) && isPlainObject(source)) {
    const out: any = { ...target };
    for (const key of Object.keys(source)) {
      const tVal = out[key];
      const sVal = source[key];
      if (isPlainObject(tVal) && isPlainObject(sVal)) {
        out[key] = deepMerge(tVal, sVal);
      } else if (Array.isArray(tVal) && Array.isArray(sVal)) {
        out[key] = deepMerge(tVal, sVal);
      } else {
        out[key] = sVal;
      }
    }
    return out;
  }
  // If both are arrays, concatenate them
  if (Array.isArray(target) && Array.isArray(source)) {
    return [...target, ...source];
  }
  // Otherwise, source overrides target
  return source;
}

function isPlainObject(val: any): val is Record<string, any> {
  return !!val && typeof val === "object" && !Array.isArray(val);
}
