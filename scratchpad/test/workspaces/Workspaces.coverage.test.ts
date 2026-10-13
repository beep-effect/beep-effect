import { assert, it, vi } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { LocalExec } from "../../effected/commands/index.ts";
import { PackageManagerDetector } from "../../effected/workspaces/PackageManagerName.ts";
import { WorkspaceRoot, WorkspaceRootNotFoundError } from "../../effected/workspaces/WorkspaceRoot.ts";
import { Workspaces } from "../../effected/workspaces/Workspaces.ts";

const calls: Array<string> = [];
it.layer(
  Workspaces.localExecLayer().pipe(
    Layer.provide(
      Layer.succeed(WorkspaceRoot, {
        find: Effect.fn("WorkspaceRoot.find")((cwd: string) => {
          calls.push(cwd);
          return Effect.fail(WorkspaceRootNotFoundError.make({ searchPath: cwd, markers: [] }));
        }),
      }),
    ),
    Layer.provide(PackageManagerDetector.layerTest()),
  ),
  { timeout: "30 seconds" },
)((it) => {
  it.effect("ambient cwd and absent process use the documented fallback", () =>
    Effect.gen(function* () {
      const exec = yield* LocalExec;
      const process = globalThis.process;
      const cwd = process.cwd();
      assertNone(yield* exec.context);
      // The ambient process boundary has no injected service seam.
      yield* Effect.gen(function* () {
        vi.stubGlobal("process", {});
        assertNone(yield* exec.context);
        vi.stubGlobal("process", undefined);
        assertNone(yield* exec.context);
      }).pipe(Effect.ensuring(Effect.sync(() => vi.stubGlobal("process", process))));
      assert.deepStrictEqual(calls, [cwd, "/", "/"]);
    }),
  );
});
it.effect("JavaScript construction keeps the static facade available", () =>
  Effect.sync(() => {
    assert.isTrue(Reflect.construct(Workspaces, []) instanceof Workspaces);
  }),
);
