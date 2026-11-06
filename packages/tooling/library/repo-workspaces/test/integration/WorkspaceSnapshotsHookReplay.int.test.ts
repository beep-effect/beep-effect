// `WorkspaceSnapshots.at(ref)` through the REAL composites, over a real git
// repository: two commits that declare two different versions of one config
// dependency, with the older version installed under `.pnpm-config` and the
// newer one present only in a (fake) pnpm store.
//
// Pins the two composite-level truths at once:
// - `layerWithGitAndConfigDependencies` replays each ref's hook at THAT ref's
//   declared version — so the config-dependency bump between the refs is a
//   visible catalog change, on `at(ref)` alone, with no seed.
// - `layerWithGit` (the default) executes no config-dependency code on the
//   ref side either: the marker the pnpmfile would write stays absent and the
//   hook-only catalog stays unresolved.

import { ConfigDependencyHooks, WorkspaceSnapshots, WorkspaceStateSnapshot, Workspaces } from "@beep/repo-workspaces";
import { dirname, join } from "@beep/utils/Path";
import { afterAll, assert, beforeAll, describe, it, vi } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { installConfigDependency, storeConfigDependency, writeModulesYaml } from "./utils/configDependencyFixtures.ts";
import { gitIn, makeNodeFixture, nodeHost } from "./utils/nodeFixture.ts";

const NAME = "cfg-replay";

let root: string;
let store: string;
let markerPath: string;

/** A pnpmfile injecting `hooked-dep` at `range`, and touching `HOOK_MARKER` so execution is observable. */
const markingPnpmfile = (range: string): string =>
  A.join(
    [
      'import { writeFileSync } from "node:fs";',
      "export const hooks = {",
      "\tupdateConfig(config) {",
      "\t\tconst marker = process.env.HOOK_MARKER;",
      `\t\tif (marker) writeFileSync(marker, "${range}");`,
      `\t\treturn { ...config, catalog: { ...(config.catalog ?? {}), "hooked-dep": "${range}" } };`,
      "\t},",
      "};",
      "",
    ],
    "\n"
  );

const workspaceYaml = (spec: string): string =>
  A.join(
    ["packages:", "  - packages/*", "catalog:", "  effect: ^4.0.0", "configDependencies:", `  ${NAME}: '${spec}'`, ""],
    "\n"
  );

const fixture = makeNodeFixture();

beforeAll(() =>
  fixture.runtime.runPromise(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      root = yield* fixture.tempDirectory("effected-replay-repo-");
      const tempDirectory1 = yield* fixture.tempDirectory("effected-replay-store-");
      store = join(tempDirectory1, "v11");
      markerPath = join(dirname(store), "marker.txt");

      // 1.0.0 installed under .pnpm-config; 2.0.0 only in the store.
      yield* writeModulesYaml(root, store);
      yield* installConfigDependency(root, NAME, "1.0.0", ["pnpmfile.mjs", markingPnpmfile("^1.0.0")]);
      yield* storeConfigDependency(store, NAME, "2.0.0", Str.repeat(64)("f"), [
        "pnpmfile.mjs",
        markingPnpmfile("^2.0.0"),
      ]);

      yield* fs.writeFileString(join(root, "package.json"), '{"name":"root","version":"0.0.0","private":true}');
      yield* fs.makeDirectory(join(root, "packages", "a"), { recursive: true });
      yield* fs.writeFileString(
        join(root, "packages", "a", "package.json"),
        '{"name":"@x/a","version":"1.0.0","dependencies":{"effect":"catalog:","hooked-dep":"catalog:"}}'
      );
      yield* fs.writeFileString(join(root, ".gitignore"), "node_modules\n");

      const git = gitIn(root);
      yield* git("init", "-q");
      yield* git("config", "user.email", "test@example.com");
      yield* git("config", "user.name", "Test");
      // `before`: declares 1.0.0 (with the integrity suffix pnpm writes).
      yield* fs.writeFileString(join(root, "pnpm-workspace.yaml"), workspaceYaml("1.0.0+sha512-before"));
      yield* git("add", "-A");
      yield* git("commit", "-q", "-m", "before");
      yield* git("tag", "before");
      // `after`: bumps the config dependency to 2.0.0 (bare spec), nothing else.
      yield* fs.writeFileString(join(root, "pnpm-workspace.yaml"), workspaceYaml("2.0.0"));
      yield* git("add", "-A");
      yield* git("commit", "-q", "-m", "after");
      yield* git("tag", "after");
    })
  )
);

afterAll(() => fixture.close());

describe("Workspaces.layerWithGitAndConfigDependencies — at(ref) replays the ref's pinned config dependency", () => {
  it.layer(
    Layer.unwrap(
      Effect.sync(() => {
        const Live = Workspaces.layerWithGitAndConfigDependencies({ cwd: root }).pipe(Layer.provideMerge(nodeHost));
        return Live;
      })
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("a config-dependency bump between two refs is a visible catalog change, with no seed", () =>
      Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots;
        const before = yield* snapshots.at("before");
        const after = yield* snapshots.at("after");
        // `before` declares 1.0.0 → the INSTALLED pnpmfile; `after` declares
        // 2.0.0 → the STORE pnpmfile. Each ref's OWN catalogs carry its range.
        assertSome(before.catalogs.rangeOf("hooked-dep", O.none()), "^1.0.0");
        assertSome(after.catalogs.rangeOf("hooked-dep", O.none()), "^2.0.0");
        // The diff shape a consumer reads: cross-seeding does not blur it.
        const [seededBefore, seededAfter] = WorkspaceStateSnapshot.crossSeed(before, after);
        assertSome(seededBefore.resolve("hooked-dep", "catalog:"), "^1.0.0");
        assertSome(seededAfter.resolve("hooked-dep", "catalog:"), "^2.0.0");
        // The control: the committed inline catalog reads the same on both.
        assertSome(before.resolve("effect", "catalog:"), "^4.0.0");
        assertSome(after.resolve("effect", "catalog:"), "^4.0.0");
        // And each side records WHICH version it replayed (the installed copy
        // answered 1.0.0, the store 2.0.0 — that rung is live provenance on the
        // injection, not on the snapshot).
        assert.deepStrictEqual(before.hookReplays, { [NAME]: "1.0.0" });
        assert.deepStrictEqual(after.hookReplays, { [NAME]: "2.0.0" });
      })
    );
  });

  it.layer(
    Layer.unwrap(
      Effect.sync(() => {
        const Live = Workspaces.layerWithGitAndConfigDependencies({ cwd: root }).pipe(Layer.provideMerge(nodeHost));
        return Live;
      })
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("worktree() and at(HEAD) agree — the same hooks layer serves both sides", () =>
      Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots;
        const head = yield* snapshots.at("HEAD");
        const live = yield* snapshots.worktree;
        assertSome(head.resolve("hooked-dep", "catalog:"), "^2.0.0");
        assertSome(live.resolve("hooked-dep", "catalog:"), "^2.0.0");
        // worktree() carries the record too, off WorkspaceCatalogs' one memo.
        assert.deepStrictEqual(live.hookReplays, { [NAME]: "2.0.0" });
        assert.deepStrictEqual(live.hookReplays, head.hookReplays);
      })
    );
  });
});

describe("Workspaces.layerWithGitAndHooks — the hermetic seam reaches at(ref) without rebuilding the git graph", () => {
  it.layer(
    Layer.unwrap(
      Effect.sync(() => {
        const installed = join(root, "node_modules", ".pnpm-config", NAME, "pnpmfile.mjs");
        const stored = join(store, "links", NAME, "2.0.0", Str.repeat(64)("f"), "node_modules", NAME, "pnpmfile.mjs");
        const hooks = ConfigDependencyHooks.layerFrom({ [`${NAME}@1.0.0`]: stored, [`${NAME}@2.0.0`]: installed });
        const Live = Workspaces.layerWithGitAndHooks(hooks, { cwd: root }).pipe(Layer.provideMerge(nodeHost));
        return Live;
      })
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("layerFrom decides what each ref replays, and the disk is never consulted", () =>
      Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots;
        const before = yield* snapshots.at("before");
        const after = yield* snapshots.at("after");
        assertSome(before.catalogs.rangeOf("hooked-dep", O.none()), "^2.0.0");
        assertSome(after.catalogs.rangeOf("hooked-dep", O.none()), "^1.0.0");
        // The record still carries the DECLARED version — provenance is on the
        // injection (`supplied`), never on the snapshot.
        assert.deepStrictEqual(before.hookReplays, { [NAME]: "1.0.0" });
        assert.deepStrictEqual(after.hookReplays, { [NAME]: "2.0.0" });
        // And worktree() runs through the same supplied map as at(HEAD).
        const live = yield* snapshots.worktree;
        assertSome(live.resolve("hooked-dep", "catalog:"), "^1.0.0");
      })
    );
  });
});

describe("Workspaces.layerWithGit — the default composite executes no config-dependency code at a ref", () => {
  it.layer(
    Layer.unwrap(
      Effect.sync(() => {
        const Default = Workspaces.layerWithGit({ cwd: root }).pipe(Layer.provideMerge(nodeHost));
        return Default;
      })
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("at(ref) never writes the marker and abstains on the hook-only catalog", () => {
      vi.stubEnv("HOOK_MARKER", markerPath);
      return Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots;
        const before = yield* snapshots.at("before");
        const after = yield* snapshots.at("after");
        const live = yield* snapshots.worktree;
        // Assembly ran — the committed catalog is there on every side.
        assertSome(before.resolve("effect", "catalog:"), "^4.0.0");
        // ...and no pnpmfile executed on any side: the ref reads, or the live one.
        const exists2 = yield* (yield* FileSystem.FileSystem).exists(markerPath);
        assert.isFalse(exists2);
        assertNone(before.resolve("hooked-dep", "catalog:"));
        assertNone(after.resolve("hooked-dep", "catalog:"));
        assertNone(live.resolve("hooked-dep", "catalog:"));
        // Empty on every side: the no-op layer resolved nothing.
        assert.deepStrictEqual(before.hookReplays, {});
        assert.deepStrictEqual(live.hookReplays, {});
      }).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            vi.unstubAllEnvs();
          })
        )
      );
    });
  });
});
