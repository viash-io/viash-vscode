import { getViashVersion } from "./getViashVersion";

export function getViashSchemaFile(
  version: string | undefined = undefined,
  objectType: string = "config"
): string | undefined {
  if (!version) {
    version = getViashVersion();
  }
  
  if (!version) {
    return undefined;
  }

  return `https://raw.githubusercontent.com/viash-io/viash-schemas/refs/heads/main/json_schemas/${version}/${objectType}.schema.json`;
}
