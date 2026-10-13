import { assert, it } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { WorkspacePackage } from "../../../effected/workspaces/WorkspacePackage.ts";
import { closureOf, consumerFiles, versionOf } from "../../../effected/workspaces/internal/packedInstallPlan.ts";

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
