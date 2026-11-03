import { Git, LsTreeEntry } from "@beep/git";
import { ConfigDependencyHooks } from "@beep/repo-workspaces/ConfigDependencyHooks";
import { CatalogSet, WorkspaceCatalogs } from "@beep/repo-workspaces/WorkspaceCatalogs";
import { WorkspaceDiscovery } from "@beep/repo-workspaces/WorkspaceDiscovery";
import { WorkspaceRoot } from "@beep/repo-workspaces/WorkspaceRoot";
import { WorkspaceSnapshots } from "@beep/repo-workspaces/WorkspaceSnapshots";
import { WorkspaceStateSnapshot } from "@beep/repo-workspaces/WorkspaceStateSnapshot";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Scheduler from "effect/Scheduler";
import * as Str from "effect/String";

const snapshot = WorkspaceStateSnapshot.make({ packages: [], catalogs: CatalogSet.empty() });
const atLayer = (files: Readonly<Record<string, string>>) =>
  WorkspaceSnapshots.layer({ cwd: "/repo" }).pipe(
    Layer.provide(
      Git.layerTest({
        show: (_cwd, _ref, path) => Effect.succeed(R.get(files, path)),
        lsTree: () =>
          Effect.succeed(
            A.map(R.keys(files), (path) =>
              LsTreeEntry.make({ path: Str.slice(2)(path), type: "blob", mode: "100644", oid: Str.repeat(40)("0") })
            )
          ),
      })
    ),
    Layer.provide(WorkspaceRoot.layerTest("/repo")),
    Layer.provide(WorkspaceDiscovery.layerTest()),
    Layer.provide(WorkspaceCatalogs.layerTest()),
    Layer.provide(ConfigDependencyHooks.layerNoop)
  );

describe("WorkspaceSnapshots explicit doubles and historical fallbacks", () => {
  it.effect("unstubbed double methods die instead of inventing a snapshot", () =>
    Effect.gen(function* () {
      const double = WorkspaceSnapshots.makeTest();
      const check = (method: string, exit: Exit.Exit<WorkspaceStateSnapshot, unknown>): void => {
        if (Exit.isFailure(exit)) {
          assertExitFailure(exit, exit.cause);
          assert.include(Cause.pretty(exit.cause), `${method}() was called but not stubbed`);
        } else {
          assert.fail("unstubbed methods must fail");
        }
      };
      const exit1 = yield* Effect.exit(double.at("HEAD"));
      check("at", exit1);
      const exit2 = yield* Effect.exit(double.worktree);
      check("worktree", exit2);
    })
  );
  it.layer(WorkspaceSnapshots.layerTest({ at: () => Effect.succeed(snapshot), worktree: Effect.succeed(snapshot) }), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("test layer carries both overrides", () =>
      Effect.gen(function* () {
        const service = yield* WorkspaceSnapshots;
        const at3 = yield* service.at("HEAD");
        assert.strictEqual(at3, snapshot);
        const worktree4 = yield* service.worktree;
        assert.strictEqual(worktree4, snapshot);
      })
    );
  });
  it.layer(atLayer({}), { timeout: "30 seconds" })((it) => {
    it.effect("concurrent misses reuse one cache cell even with scheduler preemption", () =>
      Effect.gen(function* () {
        const service = yield* WorkspaceSnapshots;
        for (let boundary = 1; boundary <= 60; boundary++) {
          const counts = MutableHashMap.empty<number, number>();
          const base = new Scheduler.MixedScheduler();
          const scheduler: Scheduler.Scheduler = {
            executionMode: base.executionMode,
            makeDispatcher: () => base.makeDispatcher(),
            shouldYield: (fiber) => {
              const count = O.getOrElse(MutableHashMap.get(counts, fiber.id), () => 0) + 1;
              MutableHashMap.set(counts, fiber.id, count);
              return count === boundary;
            },
          };
          const ref = `racing-ref-${boundary}`;
          const [first, second] = yield* Effect.all([service.at(ref), service.at(ref)], { concurrency: 2 }).pipe(
            Effect.provideService(Scheduler.Scheduler, scheduler)
          );
          assert.strictEqual(first, second);
          const at5 = yield* service.at(ref);
          assert.strictEqual(at5, first);
        }
      })
    );
    it.effect("a ref without a root manifest is empty", () =>
      Effect.gen(function* () {
        const service = yield* WorkspaceSnapshots;
        assert.deepStrictEqual((yield* service.at("HEAD")).packages, []);
      })
    );
  });
  it.layer(
    atLayer({
      "./pnpm-workspace.yaml": "catalog:\n  effect: '^4.0.0'\n",
      "./package.json": '{"name":"root","workspaces":["packages/*"]}',
      "./packages/a/package.json":
        '{"name":"a","version":"","peerDependencies":{"p":"1"},"optionalDependencies":{"o":"2"}}',
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("empty pnpm patterns use manifest patterns and empty versions stay absent", () =>
      Effect.gen(function* () {
        const service = yield* WorkspaceSnapshots;
        const state = yield* service.at("HEAD");
        const member = O.getOrThrow(state.package("a"));
        assert.isUndefined(member.version);
        assert.deepStrictEqual(member.peerDependencies, { p: "1" });
        assert.deepStrictEqual(member.optionalDependencies, { o: "2" });
      })
    );
  });
  it.layer(atLayer({ "./package.json": `{"name":"root","workspaces":["${Str.repeat(65537)("a")}"]}` }), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("a malformed historical pattern fails with its source", () =>
      Effect.gen(function* () {
        const service = yield* WorkspaceSnapshots;
        const error = yield* Effect.flip(service.at("HEAD"));
        assert.strictEqual(error._tag, "CatalogAssemblyError");
      })
    );
  });
  for (const [label, files] of [
    ["malformed lockfile", { "./package.json": '{"name":"root","workspaces":[]}', "./bun.lock": "{" }],
    ["invalid workspace YAML", { "./pnpm-workspace.yaml": "[" }],
  ] as const) {
    it.layer(atLayer(files), { timeout: "30 seconds" })((it) => {
      it.effect(label, () =>
        Effect.gen(function* () {
          const service = yield* WorkspaceSnapshots;
          if (label === "invalid workspace YAML") {
            const error = yield* Effect.flip(service.at("HEAD"));
            assert.strictEqual(error._tag, "CatalogAssemblyError");
          } else {
            assert.deepStrictEqual((yield* service.at("HEAD")).importerVersions, {});
          }
        })
      );
    });
  }
  it.layer(
    WorkspaceSnapshots.layer({ cwd: "/repo" }).pipe(
      Layer.provide(
        Git.layerTest({
          show: () => Effect.succeedNone,
          lsTree: () =>
            Effect.succeed([
              LsTreeEntry.make({ path: "package.json", type: "blob", mode: "100644", oid: Str.repeat(40)("0") }),
            ]),
        })
      ),
      Layer.provide(WorkspaceRoot.layerTest("/repo")),
      Layer.provide(WorkspaceDiscovery.layerTest()),
      Layer.provide(WorkspaceCatalogs.layerTest()),
      Layer.provide(ConfigDependencyHooks.layerNoop)
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("missing ref manifests yield no captured packages", () =>
      Effect.gen(function* () {
        const service = yield* WorkspaceSnapshots;
        assert.deepStrictEqual((yield* service.at("HEAD")).packages, []);
      })
    );
  });
});

it.layer(
  WorkspaceSnapshots.layer({ cwd: "/repo" }).pipe(
    Layer.provide(
      Git.layerTest({
        show: () => Effect.succeedNone,
        lsTree: () =>
          Effect.succeed([
            LsTreeEntry.make({ path: "package.json", type: "tree", mode: "040000", oid: Str.repeat(40)("0") }),
          ]),
      })
    ),
    Layer.provide(WorkspaceRoot.layerTest("/repo")),
    Layer.provide(WorkspaceDiscovery.layerTest()),
    Layer.provide(WorkspaceCatalogs.layerTest()),
    Layer.provide(ConfigDependencyHooks.layerNoop)
  ),
  { timeout: "30 seconds" }
)((it) => {
  it.effect("tree entries named package.json are not treated as manifests", () =>
    Effect.gen(function* () {
      const service = yield* WorkspaceSnapshots;
      assert.deepStrictEqual((yield* service.at("HEAD")).packages, []);
    })
  );
});
