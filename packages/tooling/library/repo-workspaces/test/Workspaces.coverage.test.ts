import { LocalExec } from "@beep/commands";
import { PackageManagerDetector } from "@beep/repo-workspaces/PackageManagerName";
import { WorkspaceRoot, WorkspaceRootNotFoundError } from "@beep/repo-workspaces/WorkspaceRoot";
import { Workspaces } from "@beep/repo-workspaces/Workspaces";
import { assert, it, vi } from "@effect/vitest";
import { assertExitFailure, assertNone } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";

const calls: Array<string> = [];
it.layer(
  Workspaces.localExecLayer().pipe(
    Layer.provide(
      Layer.succeed(WorkspaceRoot, {
        find: dual(
          (args) => P.isString(args[0]),
          Effect.fn("WorkspaceRoot.find")((cwd: string) => {
            calls.push(cwd);
            return Effect.fail(WorkspaceRootNotFoundError.make({ searchPath: cwd, markers: [] }));
          })
        ),
      })
    ),
    Layer.provide(PackageManagerDetector.layerTest())
  ),
  { timeout: "30 seconds" }
)((it) => {
  it.effect("ambient cwd is read per call and a runtime without one dies instead of searching from /", () =>
    Effect.gen(function* () {
      const exec = yield* LocalExec;
      const process = globalThis.process;
      const cwd = process.cwd();
      const context1 = yield* exec.context;
      assertNone(context1);
      const noAmbientCwd = Cause.die("repo-workspaces: no ambient current directory; pass an explicit cwd");
      // The ambient process boundary has no injected service seam.
      yield* Effect.gen(function* () {
        vi.stubGlobal("process", {});
        const exit2 = yield* Effect.exit(exec.context);
        assertExitFailure(exit2, noAmbientCwd);
        vi.stubGlobal("process", undefined);
        const exit3 = yield* Effect.exit(exec.context);
        assertExitFailure(exit3, noAmbientCwd);
      }).pipe(Effect.ensuring(Effect.sync(() => vi.stubGlobal("process", process))));
      assert.deepStrictEqual(calls, [cwd]);
    })
  );
});
it.effect("JavaScript construction keeps the static facade available", () =>
  Effect.sync(() => {
    assert.isTrue(Reflect.construct(Workspaces, []) instanceof Workspaces);
  })
);
