import { WorkspaceRoot } from "@beep/repo-workspaces/WorkspaceRoot";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { platformWith } from "./support/fixtures.ts";

describe("WorkspaceRoot test-layer boundary semantics", () => {
  it.layer(Path.layer, { timeout: "30 seconds" })((it) => {
    it.effect("exact and slash-terminated ceilings admit the configured root", () =>
      Effect.gen(function* () {
        const roots = yield* WorkspaceRoot.makeTest("/repo/member");
        const found = yield* roots.find("/repo/member", { stopAt: "/repo/member" });
        assert.strictEqual(found, "/repo/member");
        const found1 = yield* roots.find("/repo/member", { stopAt: "/" });
        assert.strictEqual(found1, "/repo/member");
        const windows = yield* WorkspaceRoot.makeTest("\\repo\\member");
        const found2 = yield* windows.find("ignored", { stopAt: "/" });
        assert.strictEqual(found2, "\\repo\\member");
      })
    );
  });
  it.layer(WorkspaceRoot.layerTest("/repo"), { timeout: "30 seconds" })((it) => {
    it.effect("the layer exposes the configured root", () =>
      Effect.gen(function* () {
        const roots = yield* WorkspaceRoot;
        const found3 = yield* roots.find("/repo/app");
        assert.strictEqual(found3, "/repo");
      })
    );
  });
});

for (const [label, tree, options] of [
  [
    "probe failures",
    { "/repo/package.json": "{}" },
    { unreadableExists: ["/repo/pnpm-workspace.yaml", "/repo/package.json"] },
  ],
  ["read failures", { "/repo/package.json": "{}" }, { unreadableFiles: ["/repo/package.json"] }],
  ["invalid JSON", { "/repo/package.json": "{" }, {}],
] as const) {
  it.layer(WorkspaceRoot.layer.pipe(Layer.provide(platformWith(options)(tree))), { timeout: "30 seconds" })((it) => {
    it.effect(`${label} cannot invent a workspace root`, () =>
      Effect.gen(function* () {
        const roots = yield* WorkspaceRoot;
        const error = yield* Effect.flip(roots.find("/repo", { stopAt: "/repo" }));
        assert.strictEqual(error.searchPath, "/repo");
      })
    );
  });
}
