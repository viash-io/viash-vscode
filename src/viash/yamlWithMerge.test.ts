import { describe, it, before, after } from "mocha";
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { parseYamlWithMerge, readYamlWithMerge } from "./yamlWithMerge";

describe("yamlWithMerge", () => {
  let tempDir: string;

  before(() => {
    // Create a temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "viash-yaml-merge-test-"));
  });

  after(() => {
    // Clean up temporary directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("basic merge functionality", () => {
    it("should parse YAML without merge", () => {
      const content = `
name: test-package
viash_version: 0.9.0
`;
      const result = parseYamlWithMerge(content, tempDir, tempDir);
      expect(result.name).to.equal("test-package");
      expect(result.viash_version).to.equal("0.9.0");
    });

    it("should merge with a single file", () => {
      // Create a base file to merge
      const baseFile = path.join(tempDir, "base.yaml");
      fs.writeFileSync(
        baseFile,
        `
a: 1
b: 2
`
      );

      const content = `
__merge__: base.yaml
c: 3
`;
      const result = parseYamlWithMerge(content, tempDir, tempDir);
      expect(result.a).to.equal(1);
      expect(result.b).to.equal(2);
      expect(result.c).to.equal(3);
    });

    it("should merge with multiple files", () => {
      const file1 = path.join(tempDir, "obj1.yaml");
      const file2 = path.join(tempDir, "obj2.yaml");
      fs.writeFileSync(file1, "a:\n  - 1");
      fs.writeFileSync(file2, "a:\n  - 2");

      const content = `
__merge__: [obj1.yaml, obj2.yaml]
a:
  - 3
`;
      const result = parseYamlWithMerge(content, tempDir, tempDir);
      expect(result.a).to.deep.equal([1, 2, 3]);
    });

    it("should handle '.' placeholder for self", () => {
      const baseFile = path.join(tempDir, "base-dot.yaml");
      fs.writeFileSync(baseFile, "a: 1\nb: 2");

      const content = `
__merge__: [".", base-dot.yaml]
a: 3
`;
      const result = parseYamlWithMerge(content, tempDir, tempDir);
      // '.' comes first, then base-dot.yaml overrides, so we expect base-dot.yaml values
      expect(result.a).to.equal(1);
      expect(result.b).to.equal(2);
    });

    it("should append '.' if not explicitly specified", () => {
      const baseFile = path.join(tempDir, "base-implicit.yaml");
      fs.writeFileSync(baseFile, "a: 1");

      const content = `
__merge__: base-implicit.yaml
a: 3
b: 4
`;
      const result = parseYamlWithMerge(content, tempDir, tempDir);
      // base-implicit.yaml comes first (a:1), then self (a:3, b:4)
      expect(result.a).to.equal(3);
      expect(result.b).to.equal(4);
    });
  });

  describe("path resolution", () => {
    it("should resolve paths starting with '/' relative to package root", () => {
      const subDir = path.join(tempDir, "sub");
      fs.mkdirSync(subDir, { recursive: true });

      const rootFile = path.join(tempDir, "root-config.yaml");
      fs.writeFileSync(rootFile, "root_value: from-root");

      const content = `
__merge__: /root-config.yaml
local_value: from-local
`;
      // Current file is in subDir, but merge path starts with '/'
      const result = parseYamlWithMerge(content, subDir, tempDir);
      expect(result.root_value).to.equal("from-root");
      expect(result.local_value).to.equal("from-local");
    });

    it("should resolve relative paths relative to current file", () => {
      const subDir = path.join(tempDir, "nested");
      fs.mkdirSync(subDir, { recursive: true });

      const relFile = path.join(subDir, "relative.yaml");
      fs.writeFileSync(relFile, "relative_value: from-relative");

      const content = `
__merge__: relative.yaml
main_value: from-main
`;
      const result = parseYamlWithMerge(content, subDir, tempDir);
      expect(result.relative_value).to.equal("from-relative");
      expect(result.main_value).to.equal("from-main");
    });

    it("should handle nested directory structures", () => {
      const dir1 = path.join(tempDir, "dir1");
      const dir2 = path.join(tempDir, "dir1", "dir2");
      fs.mkdirSync(dir1, { recursive: true });
      fs.mkdirSync(dir2, { recursive: true });

      const parentFile = path.join(dir1, "parent.yaml");
      fs.writeFileSync(parentFile, "parent: true");

      const content = `
__merge__: ../parent.yaml
child: true
`;
      const result = parseYamlWithMerge(content, dir2, tempDir);
      expect(result.parent).to.equal(true);
      expect(result.child).to.equal(true);
    });
  });

  describe("nested and recursive merges", () => {
    it("should handle nested __merge__ in child files", () => {
      const grandparent = path.join(tempDir, "grandparent.yaml");
      const parent = path.join(tempDir, "parent.yaml");

      fs.writeFileSync(grandparent, "level: grandparent\nvalue: 1");
      fs.writeFileSync(
        parent,
        `
__merge__: grandparent.yaml
level: parent
value: 2
`
      );

      const content = `
__merge__: parent.yaml
level: child
value: 3
`;
      const result = parseYamlWithMerge(content, tempDir, tempDir);
      expect(result.level).to.equal("child");
      expect(result.value).to.equal(3);
    });

    it("should handle __merge__ at nested object levels", () => {
      const baseConfig = path.join(tempDir, "base-nested.yaml");
      fs.writeFileSync(
        baseConfig,
        `
inner_value: from-base
`
      );

      const content = `
top_level: value
nested:
  __merge__: base-nested.yaml
  local: data
`;
      const result = parseYamlWithMerge(content, tempDir, tempDir);
      expect(result.top_level).to.equal("value");
      expect(result.nested.inner_value).to.equal("from-base");
      expect(result.nested.local).to.equal("data");
    });

    it("should handle __merge__ in arrays", () => {
      const arrayItem = path.join(tempDir, "array-item.yaml");
      fs.writeFileSync(arrayItem, "merged: true");

      const content = `
items:
  - name: first
  - __merge__: array-item.yaml
    name: second
`;
      const result = parseYamlWithMerge(content, tempDir, tempDir);
      expect(result.items).to.be.an("array");
      expect(result.items[0].name).to.equal("first");
      expect(result.items[1].merged).to.equal(true);
      expect(result.items[1].name).to.equal("second");
    });
  });

  describe("deep merge behavior", () => {
    it("should deep merge nested objects", () => {
      const base = path.join(tempDir, "base-deep.yaml");
      fs.writeFileSync(
        base,
        `
config:
  a: 1
  b: 2
  nested:
    x: 10
`
      );

      const content = `
__merge__: base-deep.yaml
config:
  b: 20
  c: 3
  nested:
    y: 20
`;
      const result = parseYamlWithMerge(content, tempDir, tempDir);
      expect(result.config.a).to.equal(1);
      expect(result.config.b).to.equal(20);
      expect(result.config.c).to.equal(3);
      expect(result.config.nested.x).to.equal(10);
      expect(result.config.nested.y).to.equal(20);
    });

    it("should concatenate arrays, not override them", () => {
      const base = path.join(tempDir, "base-array.yaml");
      fs.writeFileSync(base, "items:\n  - 1\n  - 2\n  - 3");

      const content = `
__merge__: base-array.yaml
items:
  - 4
  - 5
`;
      const result = parseYamlWithMerge(content, tempDir, tempDir);
      expect(result.items).to.deep.equal([1, 2, 3, 4, 5]);
    });
  });

  describe("merge order", () => {
    it("should apply merges in the specified order", () => {
      const file1 = path.join(tempDir, "order1.yaml");
      const file2 = path.join(tempDir, "order2.yaml");
      const file3 = path.join(tempDir, "order3.yaml");

      fs.writeFileSync(file1, "value: first\na: 1");
      fs.writeFileSync(file2, "value: second\nb: 2");
      fs.writeFileSync(file3, "value: third\nc: 3");

      const content = `
__merge__: [order1.yaml, order2.yaml, order3.yaml]
value: final
d: 4
`;
      const result = parseYamlWithMerge(content, tempDir, tempDir);
      expect(result.value).to.equal("final");
      expect(result.a).to.equal(1);
      expect(result.b).to.equal(2);
      expect(result.c).to.equal(3);
      expect(result.d).to.equal(4);
    });
  });

  describe("cycle detection", () => {
    it("should prevent infinite loops from circular merges", () => {
      const cycle1 = path.join(tempDir, "cycle1.yaml");
      const cycle2 = path.join(tempDir, "cycle2.yaml");

      fs.writeFileSync(
        cycle1,
        `
__merge__: cycle2.yaml
from_cycle1: true
`
      );
      fs.writeFileSync(
        cycle2,
        `
__merge__: cycle1.yaml
from_cycle2: true
`
      );

      const content = `
__merge__: cycle1.yaml
root: true
`;
      // Should not throw, should handle gracefully
      const result = parseYamlWithMerge(content, tempDir, tempDir);
      expect(result.root).to.equal(true);
      // Depending on implementation, one of these should be true
      expect(result.from_cycle1 || result.from_cycle2).to.be.true;
    });
  });

  describe("error handling", () => {
    it("should handle missing files gracefully", () => {
      const content = `
__merge__: nonexistent.yaml
value: present
`;
      // Should not throw, should log error and continue
      const result = parseYamlWithMerge(content, tempDir, tempDir);
      expect(result.value).to.equal("present");
    });

    it("should handle invalid YAML in merged files gracefully", () => {
      const invalidFile = path.join(tempDir, "invalid.yaml");
      fs.writeFileSync(invalidFile, "one: foo\n/wqwqws");

      const content = `
__merge__: invalid.yaml
value: present
`;
      // Should log error but continue with local values
      const result = parseYamlWithMerge(content, tempDir, tempDir);
      expect(result.value).to.equal("present");
    });
  });

  describe("readYamlWithMerge", () => {
    it("should read and merge from file", () => {
      const baseFile = path.join(tempDir, "read-base.yaml");
      fs.writeFileSync(baseFile, "base: value");

      const mainFile = path.join(tempDir, "read-main.yaml");
      fs.writeFileSync(
        mainFile,
        `
__merge__: read-base.yaml
main: value
`
      );

      const result = readYamlWithMerge(mainFile, tempDir);
      expect(result.base).to.equal("value");
      expect(result.main).to.equal("value");
    });
  });

  describe("edge cases", () => {
    it("should handle empty merge spec", () => {
      const content = `
__merge__: []
value: test
`;
      const result = parseYamlWithMerge(content, tempDir, tempDir);
      expect(result.value).to.equal("test");
    });

    it("should handle null values", () => {
      const base = path.join(tempDir, "null-base.yaml");
      fs.writeFileSync(base, "a: null\nb: 2");

      const content = `
__merge__: null-base.yaml
c: 3
`;
      const result = parseYamlWithMerge(content, tempDir, tempDir);
      expect(result.a).to.be.null;
      expect(result.b).to.equal(2);
      expect(result.c).to.equal(3);
    });

    it("should preserve types correctly", () => {
      const base = path.join(tempDir, "types-base.yaml");
      fs.writeFileSync(
        base,
        `
string: "text"
number: 42
boolean: true
array:
  - 1
  - 2
  - 3
object:
  key: value
`
      );

      const content = `
__merge__: types-base.yaml
`;
      const result = parseYamlWithMerge(content, tempDir, tempDir);
      expect(result.string).to.be.a("string");
      expect(result.number).to.be.a("number");
      expect(result.boolean).to.be.a("boolean");
      expect(result.array).to.be.an("array");
      expect(result.object).to.be.an("object");
    });
  });
});
