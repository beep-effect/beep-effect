import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import type { FindWorkspaceRootOptions, WorkspaceRootShape } from "../../../effected/workspaces/WorkspaceRoot.ts";
import { findLayerRoot } from "../../../effected/workspaces/internal/layerRoot.ts";

it.effect("defers root lookup and forwards ambient cwd, explicit cwd and the optional ceiling", () => Effect.gen(function* () {
  const calls: Array<readonly [string, FindWorkspaceRootOptions | undefined]> = [];
  const roots: WorkspaceRootShape = {
    find: (cwd, options) => {
      calls.push([cwd, options]);
      return Effect.succeed(cwd);
    },
  };
  const ambient = findLayerRoot(roots, undefined);
  assert.deepStrictEqual(calls, []);
  assert.strictEqual(yield* ambient, process.cwd());
  assert.strictEqual(yield* findLayerRoot({})(roots), process.cwd());
  assert.strictEqual(yield* findLayerRoot(roots, { cwd: "/repo/child" }), "/repo/child");
  assert.strictEqual(yield* findLayerRoot(roots, { cwd: "/repo/child", stopAt: "/repo" }), "/repo/child");
  assert.deepStrictEqual(calls, [
    [process.cwd(), undefined], [process.cwd(), undefined],
    ["/repo/child", undefined], ["/repo/child", { stopAt: "/repo" }],
  ]);
}));
