import { assert, it } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { WorkspacePackage } from "../../../effected/workspaces/WorkspacePackage.ts";
import { binTargetOf, closureOf, consumerFiles, readPackedManifest, versionOf } from "../../../effected/workspaces/internal/packedInstallPlan.ts";

it.effect("accepts version lines amid noise and handles a Yarn version lacking a minor component", () => Effect.sync(() => {
  assert.strictEqual(versionOf("notice\r\nv1.2.3-beta.1\r\n"), "1.2.3-beta.1");
  assert.isUndefined(versionOf("notice only"));
  const files = consumerFiles({ manager: "yarn", version: "4", carrier: { name: "carrier", tarball: "/carrier.tgz" }, dependencies: {}, overrides: {} });
  assert.deepStrictEqual(files.map((file) => file.file), ["package.json", ".yarnrc.yml"]);
  assert.strictEqual(files.find((file) => file.file === ".yarnrc.yml")?.content,
    "nodeLinker: node-modules\nenableImmutableInstalls: false\nenableScripts: false\nenableTelemetry: false\n");
}));

it.effect("auto closure visits appended dependencies breadth first and terminates on cycles", () => Effect.sync(() => {
  const a = WorkspacePackage.make({ name: "a", path: "/a", packageJsonPath: "/a/package.json", workspaceRoot: "/", relativePath: "a", dependencies: { c: "*", b: "*" } });
  const b = WorkspacePackage.make({ name: "b", path: "/b", packageJsonPath: "/b/package.json", workspaceRoot: "/", relativePath: "b", dependencies: { a: "*", d: "*" } });
  const c = WorkspacePackage.make({ name: "c", path: "/c", packageJsonPath: "/c/package.json", workspaceRoot: "/", relativePath: "c" });
  const d = WorkspacePackage.make({ name: "d", path: "/d", packageJsonPath: "/d/package.json", workspaceRoot: "/", relativePath: "d" });
  assertSuccess(closureOf([d, c, b, a], "a", "auto"), [a, b, c, d]);
}));

it.effect("JSON codecs retain quoting, final newlines and tolerant packed-manifest inspection", () => Effect.sync(() => {
  const files = consumerFiles({ manager: "pnpm", version: "12.0.0", carrier: { name: "carrier", tarball: "/carrier.tgz" }, dependencies: {}, overrides: { ['@x/a"\n']: '/a"\n.tgz' } });
  assert.strictEqual(files.find((file) => file.file === "pnpm-workspace.yaml")?.content,
    'minimumReleaseAge: 0\noverrides:\n  "@x/a\\"\\n": "file:/a\\"\\n.tgz"\n');
  const manifest = files.find((file) => file.file === "package.json")?.content ?? "";
  assert.isTrue(manifest.endsWith("}\n"));
  assert.isFalse(manifest.endsWith("}\n\n"));
  assert.strictEqual(manifest, '{\n  "name": "packed-install-pnpm",\n  "version": "0.0.0",\n  "private": true,\n  "devEngines": {\n    "packageManager": {\n      "name": "pnpm",\n      "version": "12.0.0",\n      "onFail": "ignore"\n    }\n  },\n  "dependencies": {\n    "carrier": "file:/carrier.tgz"\n  }\n}\n');
  assertSuccess(readPackedManifest('{"name":42,"bin":{"tool":null},"dependencies":["workspace:*"]}'),
    { name: undefined, bins: ["tool"], unresolved: ["dependencies.0: workspace:*"] });
  const malformed = readPackedManifest("{");
  assert.instanceOf(malformed.pipe(Result.flip, Result.getOrThrow), S.SchemaError);
  for (const text of ["{", "42", "[]", "null"]) assert.isUndefined(binTargetOf(text, "tool"));
  assert.isUndefined(binTargetOf('{"bin":{"tool":42}}', "tool"));
  assert.strictEqual(binTargetOf('{"bin":{"tool":"./tool.js"},"extra":42}', "tool"), "./tool.js");
}));
