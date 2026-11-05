import { cwdOf, findLayerRoot } from "@beep/repo-workspaces/internal/layerRoot";
import { assert, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import type { FindWorkspaceRootOptions, WorkspaceRootShape } from "@beep/repo-workspaces/WorkspaceRoot";

it.effect("defers root lookup and forwards ambient cwd, explicit cwd and the optional ceiling", () =>
  Effect.gen(function* () {
    const calls: Array<readonly [string, FindWorkspaceRootOptions.Encoded | undefined]> = [];
    const roots: WorkspaceRootShape = {
      find: dual(
        (args) => P.isString(args[0]),
        (cwd: string, options?: FindWorkspaceRootOptions.Encoded) => {
          calls.push([cwd, options]);
          return Effect.succeed(cwd);
        }
      ),
    };
    const ambient = findLayerRoot(roots, undefined);
    assert.deepStrictEqual(calls, []);
    const ambient1 = yield* ambient;
    assert.strictEqual(ambient1, process.cwd());
    const value = yield* findLayerRoot({})(roots);
    assert.strictEqual(value, process.cwd());
    const foundLayerRoot = yield* findLayerRoot(roots, { cwd: "/repo/child" });
    assert.strictEqual(foundLayerRoot, "/repo/child");
    const foundLayerRoot2 = yield* findLayerRoot(roots, { cwd: "/repo/child", stopAt: "/repo" });
    assert.strictEqual(foundLayerRoot2, "/repo/child");
    assert.deepStrictEqual(calls, [
      [process.cwd(), undefined],
      [process.cwd(), undefined],
      ["/repo/child", undefined],
      ["/repo/child", { stopAt: "/repo" }],
    ]);
  })
);

it("reads a host directory and reports a host without one as None, never a / fallback", () => {
  assertSome(cwdOf({ cwd: () => "/repo" }), "/repo");
  assertNone(cwdOf({}));
  assertNone(cwdOf(undefined));
});
