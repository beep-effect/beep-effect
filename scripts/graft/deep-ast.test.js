// Structural parser regressions only; no graph writes or model calls.
// GRAFT_EXTRACT_MODULE must refer to a full disposable patched Graft package.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const modulePath =
  process.env.GRAFT_EXTRACT_MODULE ??
  join(
    execFileSync("npm", ["root", "-g", "--prefix", join(homedir(), ".local")], { encoding: "utf8" }).trim(),
    "@nanonets/graft/dist/graph/extract.js"
  );
const { extractFile } = await import(pathToFileURL(modulePath).href);

test("a realistic generated IAM union traverses all extraction passes without overflowing", () => {
  const source =
    "// Generated IAM action fixture.\nexport type IamAction =\n" +
    Array.from({ length: 20000 }, (_, i) => `  | "service:Action${i}"`).join("\n") +
    "\n  | (string & {});\n";
  const result = extractFile("actions.generated.ts", source, "typescript");
  assert.deepEqual(
    result.nodes.map(({ id, kind }) => ({ id, kind })),
    [
      { id: "actions.generated.ts", kind: "file" },
      { id: "actions.generated.ts#IamAction", kind: "type" },
    ]
  );
  assert.equal(result.nodes[1].span, "L2-L20003");
  assert.ok(source.length > 400000);
  assert.equal(result.nodes[0].chars, source.length);
  assert.deepEqual(result.rawEdges, [
    {
      source: "actions.generated.ts",
      relation: "contains",
      targetId: "actions.generated.ts#IamAction",
      file: "actions.generated.ts",
    },
  ]);
});

test("TypeScript aliases, method bindings, and duplicate ids retain document order", () => {
  const source = `import { Service as Base } from './service';
export class Thing { method() { const local = new Base(); local.run(); } }
function same() { Thing(); }
function same() { Base(); }
export type Flags = 'a' | 'b' | 'c';`;
  const result = extractFile("fixture.ts", source, "typescript");
  assert.deepEqual(
    result.nodes.map((node) => node.id),
    [
      "fixture.ts",
      "fixture.ts#Thing",
      "fixture.ts#Thing.method",
      "fixture.ts#same",
      "fixture.ts#same~2",
      "fixture.ts#Flags",
    ]
  );
  assert.deepEqual(
    result.rawEdges
      .filter((edge) => edge.relation === "calls")
      .map(({ source, name, recvType }) => [source, name, recvType]),
    [
      ["fixture.ts#Thing.method", "run", "Service"],
      ["fixture.ts#same", "Thing", undefined],
      ["fixture.ts#same~2", "Base", undefined],
    ]
  );
  assert.deepEqual(
    result.rawEdges.filter((edge) => edge.relation === "references"),
    [
      {
        source: "fixture.ts#Thing.method",
        relation: "references",
        name: "Service",
        specifier: "./service",
        file: "fixture.ts",
      },
    ]
  );
});

test("Python import aliases and nested function scopes retain their receivers", () => {
  const source = `from pkg import Engine as Driver
class Outer:
    def method(self):
        obj = Driver()
        obj.run()
        def nested():
            Driver()
        nested()
`;
  const result = extractFile("fixture.py", source, "python");
  assert.deepEqual(
    result.nodes.map((node) => node.id),
    ["fixture.py", "fixture.py#Outer", "fixture.py#Outer.method", "fixture.py#Outer.method.nested"]
  );
  assert.deepEqual(
    result.rawEdges
      .filter((edge) => edge.relation === "calls")
      .map(({ source, name, recvType }) => [source, name, recvType]),
    [
      ["fixture.py#Outer.method", "Driver", undefined],
      ["fixture.py#Outer.method", "run", "Engine"],
      ["fixture.py#Outer.method.nested", "Driver", undefined],
      ["fixture.py#Outer.method", "nested", undefined],
    ]
  );
});

test("PHP enum recovery keeps enum methods and following definitions in their own scopes", () => {
  const source = `<?php enum Color { case Red; public function render() { ping(); } }
function ping() {}
class Outer { public function run() { ping(); } }`;
  const result = extractFile("fixture.php", source, "php");
  assert.deepEqual(
    result.nodes.map(({ id, kind }) => ({ id, kind })),
    [
      { id: "fixture.php", kind: "file" },
      { id: "fixture.php#Color", kind: "enum" },
      { id: "fixture.php#Color.render", kind: "method" },
      { id: "fixture.php#ping", kind: "function" },
      { id: "fixture.php#Outer", kind: "class" },
      { id: "fixture.php#Outer.run", kind: "method" },
    ]
  );
  assert.deepEqual(
    result.rawEdges.filter((edge) => edge.relation === "calls").map(({ source, name }) => [source, name]),
    [
      ["fixture.php#Color.render", "ping"],
      ["fixture.php#Outer.run", "ping"],
    ]
  );
});
