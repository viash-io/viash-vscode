import * as cp from "child_process";
import * as path from "path";

export type NsListResult = {
  name: string;
  namespace?: string;
  resources: {
    type?: string;
    path?: string;
    text?: string;
    [key: string]: any;
  }[];
  test_resources: {
    type?: string;
    path?: string;
    text?: string;
    [key: string]: any;
  };
  build_info: {
    config: string;
    [key: string]: any;
  };
  package_config?: {
    name?: string;
  };
  [key: string]: any;
};

export type Component = NsListResult & {
  /** Full component name including package and namespace prefixes */
  fullName: string;
  /** Absolute path to the component config file */
  absoluteConfigPath: string;
  /** Root directory of the Viash package this component belongs to */
  packageRoot: string;
};

/**
 * Run `viash ns list` from the specified directory (should be a Viash package root).
 * @param packageRoot - Directory containing _viash.yaml
 */
export async function nsList(packageRoot: string): Promise<Component[]> {
  return new Promise<Component[]>((resolve, reject) => {
    const process = cp.spawn("viash", ["ns", "list", "--format", "json"], {
      cwd: packageRoot,
    });
    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (data) => {
      stdout += data;
    });

    process.stderr.on("data", (data) => {
      stderr += data;
    });

    process.on("close", (code) => {
      if (code === 0) {
        // Parse the JSON output
        let results: Component[] = [];

        try {
          const parsed = stdout.trim() ? JSON.parse(stdout) : [];
          results = parsed.map((x: NsListResult) => {
            const packagePrefix = x.package_config?.name
              ? `${x.package_config.name}/`
              : "";
            const namespacePrefix = x.namespace ? `${x.namespace}/` : "";
            const fullName = `${packagePrefix}${namespacePrefix}${x.name}`;
            // build_info.config is relative to packageRoot
            const absoluteConfigPath = path.join(packageRoot, x.build_info.config);
            return { ...x, fullName, absoluteConfigPath, packageRoot };
          });
        } catch (e) {
          console.error("Error parsing viash ns list output:", e);
          reject(e);
          return;
        }

        resolve(results);
      } else {
        console.error(`Error listing Viash namespaces: ${stderr}`);
        reject(new Error(`viash ns list failed with code ${code}: ${stderr}`));
      }
    });

    process.on("error", (err) => {
      console.error("Failed to start viash process:", err);
      reject(err);
    });
  });
}
