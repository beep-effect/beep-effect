import { WorkspaceDiscovery, WorkspaceRoot, WorkspaceRootNotFoundError } from "@beep/repo-workspaces";
import { assert, describe, it, layer } from "@effect/vitest";
import { assertExitFailure, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { manifest, platform, rootManifest } from "./support/fixtures.ts";
import type { Tree } from "./support/fixtures.ts";

const primaryAndDivergedWorktree: Tree = {
  "/primary/package.json": rootManifest(["packages/*"]),
  "/primary/packages/alpha/package.json": manifest("@x/alpha", { version: "1.0.0" }),
  "/primary/packages/beta/package.json": manifest("@x/beta", { version: "1.0.0" }),

  "/worktree/package.json": rootManifest(["packages/*"]),
  "/worktree/packages/alpha/package.json": manifest("@x/alpha", { version: "2.0.0" }),
  "/worktree/packages/gamma/package.json": manifest("@x/gamma", { version: "2.0.0" }),
};

const discoveryBoundToPrimary = (tree: Tree) => {
  const base = platform(tree);
  const roots = WorkspaceRoot.layer.pipe(Layer.provide(base));
  return Layer.mergeAll(
    roots,
    WorkspaceDiscovery.layer({ cwd: "/primary" }).pipe(Layer.provide(roots), Layer.provide(base))
  ).pipe(Layer.provideMerge(base));
};

const names = (packages: ReadonlyArray<{ readonly name: string }>): ReadonlyArray<string> =>
  [...A.map(packages, (pkg) => pkg.name)].sort();

describe("WorkspaceDiscovery.listPackagesIn — a root the layer was not bound to", () => {
  layer(discoveryBoundToPrimary(primaryAndDivergedWorktree), { timeout: "30 seconds" })((it) => {
    it.effect("reads the named root's own membership, not the layer-bound root's", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;

        const primary = yield* discovery.listPackages;
        assert.deepStrictEqual(names(primary), ["@x/alpha", "@x/beta", "root"]);

        const worktree = yield* discovery.listPackagesIn("/worktree");
        assert.deepStrictEqual(
          names(worktree),
          ["@x/alpha", "@x/gamma", "root"],
          "the roots disagree on membership: re-rooting the layer's list would report beta here and never gamma"
        );
      })
    );

    it.effect("reads versions from the named root's manifests", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const worktree = yield* discovery.listPackagesIn("/worktree");
        const alpha = O.getOrUndefined(A.findFirst(worktree, (pkg) => pkg.name === "@x/alpha"));
        assert.strictEqual(
          alpha?.version,
          "2.0.0",
          "re-rooting rewrote paths but kept the layer-bound root's manifest names and versions"
        );
      })
    );

    it.effect("roots every discovered package at the named root", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const worktree = yield* discovery.listPackagesIn("/worktree");
        const alpha = O.getOrUndefined(A.findFirst(worktree, (pkg) => pkg.name === "@x/alpha"));
        assert.strictEqual(alpha?.workspaceRoot, "/worktree");
        assert.strictEqual(alpha?.path, "/worktree/packages/alpha");
        assert.strictEqual(alpha?.relativePath, "packages/alpha");
      })
    );

    it.effect("leaves the layer-bound methods answering about the layer-bound root", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        yield* discovery.listPackagesIn("/worktree");
        const info = yield* discovery.info;
        assert.strictEqual(
          info.root,
          "/primary",
          "a per-call root leaking into the shared memo would change the host's own workspace between calls"
        );
        const listPackages1 = yield* discovery.listPackages;
        assert.deepStrictEqual(names(listPackages1), ["@x/alpha", "@x/beta", "root"]);
      })
    );

    it.effect("accepts a directory INSIDE the workspace, not only its root", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const fromSubdirectory = yield* discovery.listPackagesIn("/worktree/packages/gamma");
        assert.deepStrictEqual(names(fromSubdirectory), ["@x/alpha", "@x/gamma", "root"]);
      })
    );

    it.effect("returns the same memoized array for two directories in one workspace", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const fromRoot = yield* discovery.listPackagesIn("/worktree");
        const fromSubdirectory = yield* discovery.listPackagesIn("/worktree/packages/alpha");
        assert.strictEqual(
          fromRoot,
          fromSubdirectory,
          "identity, not equality: a memo keyed on the caller's path re-discovers per subdirectory yet deep-equals"
        );
      })
    );

    it.effect("keeps distinct roots in distinct memo cells", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const worktree = yield* discovery.listPackagesIn("/worktree");
        const primary = yield* discovery.listPackagesIn("/primary");
        assert.notStrictEqual(worktree, primary);
        assert.deepStrictEqual(names(primary), ["@x/alpha", "@x/beta", "root"]);
      })
    );

    it.effect("fails typed when the directory is in no workspace at all", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const error = yield* Effect.flip(discovery.listPackagesIn("/nowhere"));
        assert.instanceOf(error, WorkspaceRootNotFoundError);
      })
    );
  });
});

describe("WorkspaceDiscovery.infoIn", () => {
  layer(discoveryBoundToPrimary(primaryAndDivergedWorktree), { timeout: "30 seconds" })((it) => {
    it.effect("reports the named root and its own patterns", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const info = yield* discovery.infoIn("/worktree/packages/gamma");
        assert.strictEqual(info.root, "/worktree");
        assert.deepStrictEqual([...info.patterns], ["packages/*"]);
      })
    );

    it.effect("shares one discovery with listPackagesIn for the same root", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const first = yield* discovery.listPackagesIn("/worktree");
        yield* discovery.infoIn("/worktree");
        const listPackagesIn2 = yield* discovery.listPackagesIn("/worktree");
        assert.strictEqual(listPackagesIn2, first);
      })
    );
  });
});

describe("WorkspaceDiscovery.refresh — with per-root memos live", () => {
  layer(discoveryBoundToPrimary(primaryAndDivergedWorktree), { timeout: "30 seconds" })((it) => {
    it.effect("drops the per-root memos too, not only the layer-bound one", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const before = yield* discovery.listPackagesIn("/worktree");
        yield* discovery.refresh;
        const after = yield* discovery.listPackagesIn("/worktree");
        assert.notStrictEqual(
          before,
          after,
          "clearing only the layer-bound memo leaves a long-lived host serving stale worktree state"
        );
        assert.deepStrictEqual(names(after), names(before));
      })
    );
  });
});

describe("WorkspaceDiscovery.refreshIn", () => {
  layer(discoveryBoundToPrimary(primaryAndDivergedWorktree), { timeout: "30 seconds" })((it) => {
    it.effect("drops only the named root's memo", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const worktreeBefore = yield* discovery.listPackagesIn("/worktree");
        const primaryBefore = yield* discovery.listPackagesIn("/primary");

        yield* discovery.refreshIn("/worktree");

        const listPackagesIn3 = yield* discovery.listPackagesIn("/worktree");
        assert.notStrictEqual(listPackagesIn3, worktreeBefore, "the named root re-discovers");
        const listPackagesIn4 = yield* discovery.listPackagesIn("/primary");
        assert.strictEqual(
          listPackagesIn4,
          primaryBefore,
          "its siblings do not; clearing the whole map would be refresh and pass the line above"
        );
      })
    );

    it.effect("accepts a directory inside the workspace", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const before = yield* discovery.listPackagesIn("/worktree");
        yield* discovery.refreshIn("/worktree/packages/gamma");
        const listPackagesIn5 = yield* discovery.listPackagesIn("/worktree");
        assert.notStrictEqual(listPackagesIn5, before);
      })
    );

    it.effect("leaves the layer-bound memo alone", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const before = yield* discovery.listPackages;
        yield* discovery.listPackagesIn("/worktree");
        yield* discovery.refreshIn("/worktree");
        const listPackages6 = yield* discovery.listPackages;
        assert.strictEqual(listPackages6, before);
      })
    );

    it.effect("is a no-op, not an error, for a root with no memo", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        yield* discovery.refresh;
        yield* discovery.refreshIn("/worktree");
        const listPackagesIn7 = yield* discovery.listPackagesIn("/worktree");
        assert.deepStrictEqual(
          names(listPackagesIn7),
          ["@x/alpha", "@x/gamma", "root"],
          "holds after this test's own refresh: layer(...) shares one service, so sibling order must not make it vacuous"
        );
      })
    );

    it.effect("fails typed on a directory in no workspace, like the other per-root methods", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const error = yield* Effect.flip(discovery.refreshIn("/nowhere"));
        assert.instanceOf(error, WorkspaceRootNotFoundError);
      })
    );
  });
});

describe("WorkspaceDiscovery.makeTest — the per-root methods", () => {
  it.effect("dies unstubbed rather than deriving from listPackages", () =>
    Effect.gen(function* () {
      const double = WorkspaceDiscovery.makeTest({
        listPackages: Effect.suspend(() => Effect.succeed([])),
      });
      const exit = yield* Effect.exit(double.listPackagesIn("/anywhere"));
      assertExitFailure(
        exit,
        O.getOrElse(Exit.getCause(exit), () => Cause.empty)
      );
      assert.isTrue(
        Cause.hasDies(exit.cause),
        "a DIE: deriving would model every root as identical, and a typed failure could be absorbed by a catch"
      );
      const infoExit = yield* Effect.exit(double.infoIn("/anywhere"));
      assertExitFailure(
        infoExit,
        O.getOrElse(Exit.getCause(infoExit), () => Cause.empty)
      );
      assert.isTrue(Cause.hasDies(infoExit.cause));
    })
  );

  it.effect(
    "uses the override when one is supplied; refreshIn defaults to a no-op since a double memoizes nothing",
    () =>
      Effect.gen(function* () {
        const double = WorkspaceDiscovery.makeTest({
          listPackagesIn: () => Effect.succeed([]),
        });
        const listPackagesIn8 = yield* double.listPackagesIn("/anywhere");
        assert.deepStrictEqual(listPackagesIn8, []);
        yield* WorkspaceDiscovery.makeTest({}).refreshIn("/anywhere");
      })
  );
});

describe("WorkspaceDiscovery.resolveFile — unchanged by the per-root memos", () => {
  layer(discoveryBoundToPrimary(primaryAndDivergedWorktree), { timeout: "30 seconds" })((it) => {
    it.effect("still answers against the layer-bound root", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        yield* discovery.listPackagesIn("/worktree");
        const owner = yield* discovery.resolveFile("/primary/packages/beta/src/index.ts");
        assertSome(owner, O.getOrThrow(owner));
        assert.strictEqual(O.getOrThrow(owner).name, "@x/beta");
      })
    );
  });
});
