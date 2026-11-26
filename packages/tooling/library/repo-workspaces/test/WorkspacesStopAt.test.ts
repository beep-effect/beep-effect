import { LocalExec, ScriptedSpawner } from "@beep/commands";
import { Git, LsTreeEntry } from "@beep/git";
import { $RepoWorkspacesId } from "@beep/identity/packages";
import {
  ConfigDependencyHooks,
  LockfileReader,
  WorkspaceCatalogs,
  WorkspaceDiscovery,
  WorkspaceRoot,
  WorkspaceRootNotFoundError,
  WorkspaceSnapshots,
  Workspaces,
} from "@beep/repo-workspaces";
import { assert, describe, layer, vi } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { manifest, platform } from "./support/fixtures.ts";
import type { LocalExecShape } from "@beep/commands";
import type { Tree } from "./support/fixtures.ts";

const $I = $RepoWorkspacesId.create("test/WorkspacesStopAt.test");

const CWD = "/outer/checkout";

const outerWorkspaceYaml = "packages:\n  - 'pkgs/*'\ncatalog:\n  effect: ^4.0.0\n";
const outerLockfile = A.join(
  [
    "lockfileVersion: '9.0'",
    "catalogs:",
    "  default:",
    "    effect:",
    "      specifier: ^4.0.0",
    "      version: 4.0.0",
    "importers:",
    "  .:",
    "    dependencies: {}",
    "  pkgs/other:",
    "    dependencies: {}",
    "",
  ],
  "\n"
);
const outerRootManifest = Result.getOrThrowWith(
  S.encodeUnknownResult(S.fromJsonString(S.Unknown))({ name: "outer-root", version: "0.0.0", private: true }),
  identity
);

const nestedCheckout: Tree = {
  "/outer/pnpm-workspace.yaml": outerWorkspaceYaml,
  "/outer/pnpm-lock.yaml": outerLockfile,
  "/outer/package.json": outerRootManifest,
  "/outer/pkgs/other/package.json": manifest("other"),
  "/outer/checkout/package.json": manifest("checkout"),
};

const outerWorkspaceAtHeadRootRelative: Readonly<Record<string, string>> = {
  "pnpm-workspace.yaml": outerWorkspaceYaml,
  "pnpm-lock.yaml": outerLockfile,
  "package.json": outerRootManifest,
  "pkgs/other/package.json": manifest("other"),
};

const scriptedOuterGitAtHead: Layer.Layer<Git> = Git.layerTest({
  show: (_cwd: string, _ref: string, path: string) => {
    const content = outerWorkspaceAtHeadRootRelative[Str.startsWith("./")(path) ? Str.slice(2)(path) : path];
    return Effect.succeed(content === undefined ? O.none() : O.some(content));
  },
  lsTree: () =>
    Effect.succeed(
      A.map(R.keys(outerWorkspaceAtHeadRootRelative), (path) =>
        LsTreeEntry.make({ mode: "100644", type: "blob", oid: Str.repeat(40)("0"), path })
      )
    ),
});

const refusesOuterCarryingCeiling = Effect.fn("refusesOuterCarryingCeiling")(function* <A, E, R>(
  effect: Effect.Effect<A, E, R>
) {
  const error = yield* Effect.flip(effect);
  assert.instanceOf(error, WorkspaceRootNotFoundError);
  assert.strictEqual(error.searchPath, CWD);
  assert.strictEqual(error.stopAt, CWD);
});

const unboundedCore = Workspaces.layer({ cwd: CWD });

describe("stopAt — the unbounded controls resolve the OUTER workspace", () => {
  const snapshots = WorkspaceSnapshots.layer({ cwd: CWD }).pipe(
    Layer.provide(scriptedOuterGitAtHead),
    Layer.provide(ConfigDependencyHooks.layerNoop),
    Layer.provide(unboundedCore)
  );
  layer(Layer.mergeAll(unboundedCore, snapshots).pipe(Layer.provideMerge(platform(nestedCheckout))), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("discovery, lockfile, catalogs and snapshots all answer from /outer", () =>
      Effect.gen(function* () {
        const info = yield* (yield* WorkspaceDiscovery).info;
        assert.strictEqual(info.root, "/outer");
        const lockfile = yield* (yield* LockfileReader).read;
        assert.include(
          A.map(lockfile.importers, (importer) => importer.path),
          "pkgs/other"
        );
        const catalogs = yield* (yield* WorkspaceCatalogs).set;
        assert.strictEqual(catalogs.entries.default?.effect, "^4.0.0");
        const snapshot = yield* (yield* WorkspaceSnapshots).at("HEAD");
        assert.isTrue(HashMap.has(snapshot.versions, "other"));
      })
    );
  });
});

describe("stopAt — LockfileReader honours its own ceiling over an unbounded core, so ignoring it would resolve /outer", () => {
  const lockfiles = LockfileReader.layer({ cwd: CWD, stopAt: CWD }).pipe(Layer.provide(unboundedCore));
  layer(lockfiles.pipe(Layer.provideMerge(platform(nestedCheckout))), { timeout: "30 seconds" })((it) => {
    it.effect("read() refuses the enclosing workspace", () =>
      Effect.gen(function* () {
        yield* refusesOuterCarryingCeiling((yield* LockfileReader).read);
      })
    );
  });
});

describe("stopAt — WorkspaceCatalogs honours its own ceiling over an unbounded core, so ignoring it would resolve /outer", () => {
  const catalogs = WorkspaceCatalogs.layer({ cwd: CWD, stopAt: CWD }).pipe(Layer.provide(unboundedCore));
  layer(catalogs.pipe(Layer.provideMerge(platform(nestedCheckout))), { timeout: "30 seconds" })((it) => {
    it.effect("set() refuses the enclosing workspace", () =>
      Effect.gen(function* () {
        yield* refusesOuterCarryingCeiling((yield* WorkspaceCatalogs).set);
      })
    );
  });
});

describe("stopAt — WorkspaceSnapshots honours its own ceiling over an unbounded core, so ignoring it would resolve /outer", () => {
  const snapshots = WorkspaceSnapshots.layer({ cwd: CWD, stopAt: CWD }).pipe(
    Layer.provide(scriptedOuterGitAtHead),
    Layer.provide(ConfigDependencyHooks.layerNoop),
    Layer.provide(unboundedCore)
  );
  layer(snapshots.pipe(Layer.provideMerge(platform(nestedCheckout))), { timeout: "30 seconds" })((it) => {
    it.effect("at(ref) refuses the enclosing workspace", () =>
      Effect.gen(function* () {
        yield* refusesOuterCarryingCeiling((yield* WorkspaceSnapshots).at("HEAD"));
      })
    );
  });
});

const everyCoreReadRefusesOuter = Effect.gen(function* () {
  yield* refusesOuterCarryingCeiling((yield* WorkspaceDiscovery).listPackages);
  yield* refusesOuterCarryingCeiling((yield* LockfileReader).read);
  yield* refusesOuterCarryingCeiling((yield* WorkspaceCatalogs).set);
});

const bounded = { cwd: CWD, stopAt: CWD } as const;

const gitFreeComposites = {
  layer: Workspaces.layer(bounded),
  layerWithConfigDependencies: Workspaces.layerWithConfigDependencies(bounded),
} as const;

for (const [name, composite] of R.toEntries(gitFreeComposites)) {
  describe(`stopAt — Workspaces.${name} forwards one ceiling: every service refuses, never a split`, () => {
    layer(composite.pipe(Layer.provideMerge(platform(nestedCheckout))), { timeout: "30 seconds" })((it) => {
      it.effect("discovery, lockfile and catalogs all refuse the enclosing workspace", () => everyCoreReadRefusesOuter);
    });
  });
}

const recordingSpawner = () => ScriptedSpawner.make(() => ({}));

describe("stopAt — Workspaces.layerWithConfigDependenciesSubprocess forwards one ceiling: every service refuses, never a split", () => {
  const spawner = recordingSpawner();
  const composite = Workspaces.layerWithConfigDependenciesSubprocess(bounded).pipe(
    Layer.provide(spawner.layer),
    Layer.provideMerge(platform(nestedCheckout))
  );
  layer(composite, { timeout: "30 seconds" })((it) => {
    it.effect("discovery, lockfile and catalogs all refuse the enclosing workspace, spawning nothing", () =>
      Effect.gen(function* () {
        yield* everyCoreReadRefusesOuter;
        assert.strictEqual(
          spawner.spawns.length,
          0,
          "a root refusal happens before anything runs, so a forwarded ceiling spawns nothing"
        );
      })
    );
  });
});

const gitComposites = {
  layerWithGit: Workspaces.layerWithGit(bounded),
  layerWithGitAndConfigDependencies: Workspaces.layerWithGitAndConfigDependencies(bounded),
  layerWithGitAndConfigDependenciesSubprocess: Workspaces.layerWithGitAndConfigDependenciesSubprocess(bounded),
  layerWithGitAndHooks: Workspaces.layerWithGitAndHooks(ConfigDependencyHooks.layerNoop, bounded),
} as const;

for (const [name, composite] of R.toEntries(gitComposites)) {
  describe(`stopAt — Workspaces.${name} forwards one ceiling: every service refuses, never a split`, () => {
    const spawner = recordingSpawner();
    layer(composite.pipe(Layer.provide(spawner.layer), Layer.provideMerge(platform(nestedCheckout))), {
      timeout: "30 seconds",
    })((it) => {
      it.effect("discovery, lockfile, catalogs and at(ref) all refuse the enclosing workspace", () =>
        Effect.gen(function* () {
          yield* everyCoreReadRefusesOuter;
          yield* refusesOuterCarryingCeiling((yield* WorkspaceSnapshots).at("HEAD"));
          assert.strictEqual(
            spawner.spawns.length,
            0,
            "refused before git ran: an unforwarded ceiling would have resolved /outer and spawned git to read the ref"
          );
        })
      );
    });
  });
}

describe("stopAt — Workspaces.localExecLayer reads a refused root as None", () => {
  class UnboundedLocalExec extends Context.Service<UnboundedLocalExec, LocalExecShape>()($I`UnboundedLocalExec`) {}
  const unboundedLocal = Layer.effect(UnboundedLocalExec, LocalExec).pipe(
    Layer.provide(Workspaces.localExecLayer({ cwd: CWD }))
  );
  const localContexts = Layer.mergeAll(Workspaces.localExecLayer(bounded), unboundedLocal).pipe(
    Layer.provide(unboundedCore),
    Layer.provideMerge(platform(nestedCheckout))
  );
  layer(localContexts, { timeout: "30 seconds" })((it) => {
    it.effect("bounded: no project-local launcher; unbounded: the outer workspace's pnpm", () =>
      Effect.gen(function* () {
        const context1 = yield* (yield* LocalExec).context;
        assertNone(context1);
        const unbounded = yield* (yield* UnboundedLocalExec).context;
        assertSome(
          O.map(unbounded, (context) => context.directory),
          "/outer"
        );
      })
    );
  });
});

const processCwdSpiedForSuite = Layer.effectDiscard(
  Effect.acquireRelease(
    Effect.sync(() => vi.spyOn(process, "cwd").mockReturnValue(CWD)),
    (spy) => Effect.sync(() => spy.mockRestore())
  )
);

const relative = { stopAt: "." } as const;

describe("stopAt — a relative ceiling with no cwd resolves against the spied process cwd at lookup (memfs has no chdir)", () => {
  const discovery = WorkspaceDiscovery.layer(relative).pipe(
    Layer.provide(WorkspaceRoot.layer),
    Layer.provideMerge(platform(nestedCheckout)),
    Layer.provide(processCwdSpiedForSuite)
  );
  layer(discovery, { timeout: "30 seconds" })((it) => {
    it.effect(
      "WorkspaceDiscovery.layer({ stopAt: '.' }) refuses the enclosing workspace like the absolute ceiling",
      () =>
        Effect.gen(function* () {
          yield* refusesOuterCarryingCeiling((yield* WorkspaceDiscovery).listPackages);
        })
    );
  });

  const core = Workspaces.layer(relative).pipe(
    Layer.provideMerge(platform(nestedCheckout)),
    Layer.provide(processCwdSpiedForSuite)
  );
  layer(core, { timeout: "30 seconds" })((it) => {
    it.effect(
      "Workspaces.layer({ stopAt: '.' }) fails every root-resolving read with the absolute ceiling",
      () => everyCoreReadRefusesOuter
    );
  });

  const spawner = recordingSpawner();
  const git = Workspaces.layerWithGit(relative).pipe(
    Layer.provide(spawner.layer),
    Layer.provideMerge(platform(nestedCheckout)),
    Layer.provide(processCwdSpiedForSuite)
  );
  layer(git, { timeout: "30 seconds" })((it) => {
    it.effect("Workspaces.layerWithGit({ stopAt: '.' }) refuses at(ref) too, spawning nothing", () =>
      Effect.gen(function* () {
        yield* everyCoreReadRefusesOuter;
        yield* refusesOuterCarryingCeiling((yield* WorkspaceSnapshots).at("HEAD"));
        assert.strictEqual(spawner.spawns.length, 0);
      })
    );
  });
});
