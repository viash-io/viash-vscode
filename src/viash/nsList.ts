import * as cp from "child_process";

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
  fullName: string;
};

export async function nsList(cwd: string): Promise<Component[]> {
  return new Promise<Component[]>((resolve, reject) => {
    const process = cp.spawn("viash", ["ns", "list", "--format", "json"], {
      cwd: cwd,
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
          results = JSON.parse(stdout).map((x: NsListResult) => {
            const packagePrefix = x.package_config?.name
              ? `${x.package_config.name}/`
              : "";
            const namespacePrefix = x.namespace ? `${x.namespace}/` : "";
            const fullName = `${packagePrefix}${namespacePrefix}${x.name}`;
            return { ...x, fullName };
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
