import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { platform } from "./fixtures.ts";
import * as Path from "effect/Path";
import { WorkspaceRoot } from "../../effected/workspaces/WorkspaceRoot.ts";

describe("WorkspaceRoot test-layer boundary semantics", () => {
  it.layer(Path.layer, { timeout: "30 seconds" })((it) => {
    it.effect("exact and slash-terminated ceilings admit the configured root", () =>
      Effect.gen(function* () {
        const roots = yield* WorkspaceRoot.makeTest("/repo/member");
        assert.strictEqual(yield* roots.find("/repo/member", { stopAt: "/repo/member" }), "/repo/member");
        assert.strictEqual(yield* roots.find("/repo/member", { stopAt: "/" }), "/repo/member");
        const windows = yield* WorkspaceRoot.makeTest("\\repo\\member");
        assert.strictEqual(yield* windows.find("ignored", { stopAt: "/" }), "\\repo\\member");
      }),
    );
  });
  it.layer(WorkspaceRoot.layerTest("/repo"), { timeout: "30 seconds" })((it) => {
    it.effect("the layer exposes the configured root", () =>
      Effect.gen(function* () {
        const roots = yield* WorkspaceRoot;
        assert.strictEqual(yield* roots.find("/repo/app"), "/repo");
      }),
    );
  });
});

for (const [label, tree, options] of [
  ["probe failures", { "/repo/package.json": "{}" }, { unreadableExists: new Set(["/repo/pnpm-workspace.yaml", "/repo/package.json"]) }],
  ["read failures", { "/repo/package.json": "{}" }, { unreadableFiles: new Set(["/repo/package.json"]) }],
  ["invalid JSON", { "/repo/package.json": "{" }, {}],
] as const) {
  it.layer(WorkspaceRoot.layer.pipe(Layer.provide(platform(tree, options))), { timeout: "30 seconds" })((it) => {
    it.effect(`${label} cannot invent a workspace root`, () =>
      Effect.gen(function* () {
        const roots = yield* WorkspaceRoot;
        const error = yield* Effect.flip(roots.find("/repo", { stopAt: "/repo" }));
        assert.strictEqual(error.searchPath, "/repo");
      }),
    );
  });
}
