import { getViashVersion } from "./getViashVersion";

export function getViashSchemaFile(
  version: string | undefined = undefined,
  objectType: string = "config"
): string {
  if (!version) {
    version = getViashVersion();
  }

  return `https://raw.githubusercontent.com/viash-io/viash-schemas/refs/heads/main/json_schemas/${version}/${objectType}.schema.json`;
}
