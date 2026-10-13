import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { PublishabilityDetector } from "../../effected/workspaces/Publishability.ts";
import { WorkspacePackage } from "../../effected/workspaces/WorkspacePackage.ts";

const pkg = (options: Partial<Pick<WorkspacePackage, "private" | "publishConfig">> = {}) => WorkspacePackage.make({
  name: "@scope/tool", version: "1.2.3", path: "/repo/tool", packageJsonPath: "/repo/tool/package.json",
  relativePath: "tool", workspaceRoot: "/repo", ...options,
});
it.layer(PublishabilityDetector.layerNpm, { timeout: "10 seconds" })((it) => {
it.effect("npm publishing defaults and the private-package veto are observable through the service", () => Effect.gen(function* () {
  const detector = yield* PublishabilityDetector;
  assert.deepStrictEqual(yield* detector.detect(pkg({ private: true })), []);
  const targets = yield* detector.detect(pkg());
  assert.deepStrictEqual(targets.map((target) => ({ name: target.name, registry: target.registry, directory: target.directory, access: target.access, provenance: target.provenance })), [
    { name: "@scope/tool", registry: "https://registry.npmjs.org/", directory: ".", access: "public", provenance: false },
  ]);
}));
});
it.effect("explicit access overrides private and registry and directory overrides are retained", () => Effect.gen(function* () {
  const targets = yield* PublishabilityDetector.npm.detect(pkg({ private: true, publishConfig: {
    access: "restricted", registry: "https://registry.example/", directory: "dist",
  } }));
  assert.strictEqual(targets.length, 1);
  assert.strictEqual(targets[0]?.registry, "https://registry.example/");
  assert.strictEqual(targets[0]?.directory, "dist");
  assert.strictEqual(targets[0]?.access, "restricted");
  assert.strictEqual(targets[0]?.provenance, false);
}));
it.layer(PublishabilityDetector.layerNone, { timeout: "10 seconds" })((it) => {
it.effect("the disabled policy publishes nowhere regardless of package configuration", () => Effect.gen(function* () {
  const detector = yield* PublishabilityDetector;
  assert.deepStrictEqual(yield* detector.detect(pkg({ publishConfig: { access: "public" } })), []);
}));
});
