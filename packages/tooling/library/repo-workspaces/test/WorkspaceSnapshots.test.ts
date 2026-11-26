import { Git, GitCommandError, LsTreeEntry } from "@beep/git";
import { CatalogAssemblyError } from "@beep/npm-spec/CatalogAssemblyError";
import { CatalogResolver } from "@beep/npm-spec/CatalogResolver";
import { WorkspaceResolver } from "@beep/npm-spec/WorkspaceResolver";
import {
  CatalogSet,
  ConfigDependencyHooks,
  PackageStateSnapshot,
  WorkspaceSnapshots,
  WorkspaceStateSnapshot,
  Workspaces,
} from "@beep/repo-workspaces";
import { PeerDependencyRules } from "@beep/repo-workspaces/ConfigDependencyHooks";
import { HookReplay } from "@beep/repo-workspaces/ConfigDependencyReplay";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import { dual, identity } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { manifest, platform, rootManifest } from "./support/fixtures.ts";
import type { GitStubs } from "@beep/git";
import type { HookInjection } from "@beep/repo-workspaces";
import type { Tree } from "./support/fixtures.ts";

type RefTrees = Readonly<Record<string, Readonly<Record<string, string>>>>;

const scriptGit = (
  trees: RefTrees,
  overrides: {
    readonly lsTree?: GitStubs["lsTree"];
  } = {}
): Layer.Layer<Git> =>
  Git.layerTest({
    show: (_cwd: string, ref: string, path: string) => {
      const gitCwdResolvedPath = Str.startsWith("./")(path) ? Str.slice(2)(path) : path;
      const content = trees[ref]?.[gitCwdResolvedPath];
      return Effect.succeed(content === undefined ? O.none() : O.some(content));
    },
    lsTree:
      overrides.lsTree ??
      ((_cwd: string, ref: string) =>
        Effect.succeed(
          A.map(R.keys(trees[ref] ?? {}), (path) =>
            LsTreeEntry.make({ mode: "100644", type: "blob", oid: Str.repeat(40)("0"), path })
          )
        )),
  });

const snapshotsLayer = (
  git: Layer.Layer<Git>,
  tree: Tree,
  cwd = "/repo",
  seedCatalogs?: CatalogSet,
  hooks: Layer.Layer<ConfigDependencyHooks> = ConfigDependencyHooks.layerNoop
) => {
  const base = platform(tree);
  const core = Workspaces.layer({ cwd });
  const snapshots = WorkspaceSnapshots.layer({ cwd, ...(seedCatalogs === undefined ? {} : { seedCatalogs }) }).pipe(
    Layer.provide(git),
    Layer.provide(hooks),
    Layer.provide(core)
  );
  return Layer.mergeAll(core, snapshots).pipe(Layer.provideMerge(base));
};

const headRefFromTree = (tree: Tree, root = "/repo"): RefTrees => {
  const prefix = `${root}/`;
  const rel: Record<string, string> = {};
  for (const [abs, content] of R.toEntries(tree)) {
    if (Str.startsWith(prefix)(abs)) rel[Str.slice(prefix.length)(abs)] = content;
  }
  return { HEAD: rel };
};

const npmRefTrees: RefTrees = {
  HEAD: {
    "package.json": rootManifest(["packages/*"]),
    "packages/alpha/package.json": manifest("@x/alpha"),
    "packages/beta/package.json": manifest("@x/beta", { dependencies: { "@x/alpha": "workspace:*" } }),
  },
};

const npmRootMarkerOnlyOnDisk: Tree = { "/repo/package.json": rootManifest(["packages/*"]) };

describe("WorkspaceSnapshots.at — the c594ff1 fallback", () => {
  it.layer(snapshotsLayer(scriptGit(npmRefTrees), npmRootMarkerOnlyOnDisk), { timeout: "30 seconds" })((it) => {
    it.effect("a bun/npm workspace at a ref discovers its members, not the root alone", () =>
      Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots;
        const snapshot = yield* snapshots.at("HEAD");
        const names = [...HashMap.keys(snapshot.versions)].sort();
        assert.deepStrictEqual(
          names,
          ["@x/alpha", "@x/beta", "root"],
          "without the package.json workspaces fallback this collapses to root, and every dependency looks new"
        );
        assert.deepStrictEqual(
          snapshot.hookReplays,
          {},
          "no pnpm-workspace.yaml at the ref means no config dependencies: an empty replay record, set every fresh read"
        );
      })
    );

    it.effect("member dependency records survive into the snapshot", () =>
      Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots;
        const snapshot = yield* snapshots.at("HEAD");
        const beta = snapshot.package("@x/beta");
        assertSome(beta, O.getOrThrow(beta));
        assert.strictEqual(beta.value.dependencies["@x/alpha"], "workspace:*");
      })
    );
  });
});

const scopedRefTrees: RefTrees = {
  HEAD: {
    "package.json": rootManifest(["packages/*"]),
    "packages/alpha/package.json": manifest("@x/alpha"),
    "tools/gen/package.json": manifest("@x/gen"),
  },
};

describe("WorkspaceSnapshots.at — glob filtering over ls-tree", () => {
  it.layer(snapshotsLayer(scriptGit(scopedRefTrees), npmRootMarkerOnlyOnDisk), { timeout: "30 seconds" })((it) => {
    it.effect("only package.json directories the glob set accepts become members", () =>
      Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots;
        const snapshot = yield* snapshots.at("HEAD");
        const names = [...HashMap.keys(snapshot.versions)].sort();
        assert.deepStrictEqual(
          names,
          ["@x/alpha", "root"],
          "tools/gen has a package.json outside packages/* and is dropped; the root is always included"
        );
      })
    );
  });
});

const parityTree: Tree = {
  "/repo/pnpm-workspace.yaml": "packages:\n  - packages/*\ncatalog:\n  effect: ^4.0.0\n",
  "/repo/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(S.fromJsonString(S.Unknown))({ name: "root", version: "0.0.0", private: true }),
    identity
  ),
  "/repo/packages/alpha/package.json": manifest("@x/alpha", { dependencies: { effect: "catalog:" } }),
  "/repo/packages/beta/package.json": manifest("@x/beta", {
    version: "2.0.0",
    dependencies: { "@x/alpha": "workspace:*" },
  }),
};

const observableState = (snapshot: WorkspaceStateSnapshot) => ({
  versions: [...HashMap.entries(snapshot.versions)].sort(),
  catalogs: snapshot.catalogs.entries,
  effectResolved: snapshot.resolve("effect", "catalog:"),
  alphaResolved: snapshot.resolve("@x/alpha", "workspace:*"),
});

describe("WorkspaceSnapshots — at('HEAD') and worktree() parity on a clean tree", () => {
  it.layer(snapshotsLayer(scriptGit(headRefFromTree(parityTree)), parityTree), { timeout: "30 seconds" })((it) => {
    it.effect(
      "the two snapshots agree on packages, catalogs and resolution, with catalog and workspace indirections resolved",
      () =>
        Effect.gen(function* () {
          const snapshots = yield* WorkspaceSnapshots;
          const atHead = yield* snapshots.at("HEAD");
          const worktree = yield* snapshots.worktree;
          assert.deepStrictEqual(
            observableState(atHead),
            observableState(worktree),
            "worktree() reads the inline catalog from disk and at('HEAD') from git; a clean tree must agree"
          );
          assertSome(atHead.resolve("effect", "catalog:"), "^4.0.0");
          assertSome(atHead.resolve("@x/alpha", "workspace:*"), "1.0.0");
          assertSome(atHead.resolve("@x/beta", "workspace:^"), "2.0.0");
        })
    );
  });
});

const bunNoLockTree: Tree = {
  "/repo/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(S.fromJsonString(S.Unknown))({
      name: "root",
      version: "0.0.0",
      private: true,
      packageManager: "bun@1.2.0",
      workspaces: { packages: ["packages/*"], catalog: { effect: "^4.0.0" } },
    }),
    identity
  ),
  "/repo/packages/alpha/package.json": manifest("@x/alpha", { dependencies: { effect: "catalog:" } }),
};

describe("WorkspaceSnapshots — bun inline catalogs at a ref with NO bun.lock (parity)", () => {
  it.layer(snapshotsLayer(scriptGit(headRefFromTree(bunNoLockTree)), bunNoLockTree), { timeout: "30 seconds" })(
    (it) => {
      it.effect("at('HEAD') reads inline bun catalogs without a lockfile, matching worktree()", () =>
        Effect.gen(function* () {
          const snapshots = yield* WorkspaceSnapshots;
          const atHead = yield* snapshots.at("HEAD");
          const worktree = yield* snapshots.worktree;
          assert.deepStrictEqual(
            atHead.catalogs.entries,
            worktree.catalogs.entries,
            "gating the at-ref inline read on bun.lock returned an empty set here: c594ff1 again, one layer up, so every catalog dependency diffed as new"
          );
          assertSome(atHead.resolve("effect", "catalog:"), "^4.0.0");
          assertSome(worktree.resolve("effect", "catalog:"), "^4.0.0");
        })
      );
    }
  );
});

describe("WorkspaceSnapshots.at — a failed init is retried", () => {
  let lsTreeCalls = 0;
  const flakyLsTree: GitStubs["lsTree"] = (_cwd: string, ref: string) => {
    lsTreeCalls += 1;
    if (lsTreeCalls === 1) {
      return Effect.fail(
        GitCommandError.make({ kind: "failed", args: ["ls-tree", "-r", "-z", ref], cwd: "/repo", stderr: "boom" })
      );
    }
    return Effect.succeed(
      A.map(R.keys(npmRefTrees[ref] ?? {}), (path) =>
        LsTreeEntry.make({ mode: "100644", type: "blob", oid: Str.repeat(40)("0"), path })
      )
    );
  };

  it.layer(snapshotsLayer(scriptGit(npmRefTrees, { lsTree: flakyLsTree }), npmRootMarkerOnlyOnDisk), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("the first call fails; the second recomputes and succeeds", () =>
      Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots;
        const first = yield* Effect.result(snapshots.at("HEAD"));
        assert.strictEqual(first._tag, "Failure");
        const second = yield* snapshots.at("HEAD");
        assert.deepStrictEqual(
          [...HashMap.keys(second.versions)].sort(),
          ["@x/alpha", "@x/beta", "root"],
          "a bare Effect.cached would replay the failure; the success-only memo re-runs the init"
        );
      })
    );
  });
});

const resolveSnapshot = WorkspaceStateSnapshot.make({
  packages: [
    PackageStateSnapshot.make({ name: "@x/alpha", version: "1.2.3", relativePath: "packages/alpha" }),
    PackageStateSnapshot.make({ name: "@x/beta", version: "4.5.6", relativePath: "packages/beta" }),
  ],
  catalogs: CatalogSet.make({ entries: { default: { effect: "^4.0.0" }, build: { vitest: "^3.0.0" } } }),
});

describe("WorkspaceStateSnapshot.resolve", () => {
  it.effect("resolves workspace: against the snapshot's captured versions", () =>
    Effect.sync(() => {
      assertSome(resolveSnapshot.resolve("@x/alpha", "workspace:*"), "1.2.3");
      assertSome(resolveSnapshot.resolve("@x/beta", "workspace:^"), "4.5.6");
    })
  );

  it.effect("resolves catalog: against the snapshot's captured catalog set", () =>
    Effect.sync(() => {
      assertSome(resolveSnapshot.resolve("effect", "catalog:"), "^4.0.0");
      assertSome(resolveSnapshot.resolve("vitest", "catalog:build"), "^3.0.0");
    })
  );

  it.effect("an unmatched specifier is Option.none(), never an error", () =>
    Effect.sync(() => {
      const nonMember = resolveSnapshot.resolve("nope", "workspace:*");
      assertNone(nonMember);
      const unknownCatalog = resolveSnapshot.resolve("effect", "catalog:missing");
      assertNone(unknownCatalog);
      const plainRangeNothingToResolve = resolveSnapshot.resolve("effect", "^4.0.0");
      assertNone(plainRangeNothingToResolve);
      const unparseableSpecifier = resolveSnapshot.resolve("effect", "not a specifier");
      assertNone(unparseableSpecifier);
    })
  );
});

const versionlessMemberSnapshot = WorkspaceStateSnapshot.make({
  packages: [
    PackageStateSnapshot.make({ name: "@x/bare", relativePath: "packages/bare" }),
    PackageStateSnapshot.make({ name: "@x/alpha", version: "1.2.3", relativePath: "packages/alpha" }),
  ],
  catalogs: CatalogSet.make({ entries: {} }),
});

describe('WorkspaceStateSnapshot — a version-less member is absent, never `""`', () => {
  it('the model cannot hold `""`: make rejects it', () => {
    assert.throws(() => PackageStateSnapshot.make({ name: "@x/bare", version: "", relativePath: "packages/bare" }));
  });

  it('a snapshot serialized with the old `""` sentinel decodes to the absent key', () => {
    const legacy = Result.getOrThrow(
      S.decodeResult(PackageStateSnapshot)({
        name: "@x/bare",
        version: "",
        relativePath: "packages/bare",
      })
    );
    assert.isFalse("version" in legacy);
    assert.isTrue(Equal.equals(legacy, versionlessMemberSnapshot.packages[0]));
    const versioned = Result.getOrThrow(
      S.decodeResult(PackageStateSnapshot)({
        name: "@x/alpha",
        version: "1.2.3",
        relativePath: "packages/alpha",
      })
    );
    assert.strictEqual(versioned.version, "1.2.3", "control: a real version survives the same decode");
  });

  it("encoding omits the key rather than writing a placeholder", () => {
    const pkg = versionlessMemberSnapshot.packages[0];
    if (pkg === undefined) return assert.fail("expected a snapshot package");
    const encoded = Result.getOrThrow(S.encodeResult(PackageStateSnapshot)(pkg));
    assert.isFalse(
      "version" in encoded,
      "the key is absent: the shape snapshotOf and the worktree snapshot write (#613)"
    );
  });

  it("versions lists only members that declared a version; package() still answers membership", () => {
    assert.deepStrictEqual([...HashMap.entries(versionlessMemberSnapshot.versions)], [["@x/alpha", "1.2.3"]]);
    const bare = versionlessMemberSnapshot.package("@x/bare");
    assertSome(bare, O.getOrThrow(bare));
  });

  it.effect('a version-less member resolves to none, never a some("") that rewrites workspace:^ as a bare ^', () =>
    Effect.sync(() => {
      assertNone(versionlessMemberSnapshot.resolve("@x/bare", "workspace:^"));
      const versionedPositiveControl = versionlessMemberSnapshot.resolve("@x/alpha", "workspace:^");
      assertSome(versionedPositiveControl, "1.2.3");
    })
  );

  it.layer(versionlessMemberSnapshot.workspaceResolver, { timeout: "30 seconds" })((it) => {
    it.effect("the snapshot's WorkspaceResolver fails typed for a version-less member, like discovery's", () =>
      Effect.gen(function* () {
        const workspace = yield* WorkspaceResolver;
        const error = yield* Effect.flip(workspace.versionOf("@x/bare"));
        assert.strictEqual(
          error._tag,
          "DependencyResolutionError",
          "a known member with nothing to resolve fails typed: the contract reserves none for a non-member"
        );
        assert.strictEqual(error.specifier, "workspace:@x/bare");
        assert.strictEqual(
          error.reason,
          "no-version",
          "the branch a _tag check cannot pin: raised from structured data with no foreign failure to wrap"
        );
        assert.isUndefined(error.cause);
        const versionedPositiveControl = yield* workspace.versionOf("@x/alpha");
        assertSome(versionedPositiveControl, "1.2.3");
        const nonMemberNegativeControl = yield* workspace.versionOf("nope");
        assertNone(nonMemberNegativeControl);
      })
    );
  });
});

const versionlessTree: Tree = {
  "/repo/pnpm-workspace.yaml": "packages:\n  - packages/*\n",
  "/repo/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(S.fromJsonString(S.Unknown))({ name: "root", private: true }),
    identity
  ),
  "/repo/packages/bare/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(S.fromJsonString(S.Unknown))({ name: "@x/bare", private: true }),
    identity
  ),
  "/repo/packages/alpha/package.json": manifest("@x/alpha", { dependencies: { "@x/bare": "workspace:^" } }),
};

describe("WorkspaceSnapshots — version-less manifests at a ref and in the worktree", () => {
  it.layer(snapshotsLayer(scriptGit(headRefFromTree(versionlessTree)), versionlessTree), { timeout: "30 seconds" })(
    (it) => {
      it.effect("both sides omit version, agree structurally, and resolve workspace: to none", () =>
        Effect.gen(function* () {
          const snapshots = yield* WorkspaceSnapshots;
          const atHead = yield* snapshots.at("HEAD");
          const worktree = yield* snapshots.worktree;
          for (const snapshot of [atHead, worktree]) {
            const bare = O.getOrThrow(snapshot.package("@x/bare"));
            const root = O.getOrThrow(snapshot.package("root"));
            assert.isFalse("version" in bare, 'neither side may present "" as a version');
            assert.isFalse("version" in root);
            assert.deepStrictEqual(snapshot.versionNames, ["@x/alpha"]);
            assertNone(snapshot.resolve("@x/bare", "workspace:^"));
          }
          const byName = (snapshot: WorkspaceStateSnapshot) =>
            [...snapshot.packages].sort((a, b) => Str.localeCompare(b.name)(a.name));
          const [left, right] = [byName(atHead), byName(worktree)];
          assert.strictEqual(left.length, right.length);
          for (const [index, pkg] of left.entries())
            assert.isTrue(
              Equal.equals(pkg, right[index]),
              `${pkg.name}: both capture paths omit the key alike, so a clean-tree diff reports nothing`
            );
          const atHeadVersionedControl = atHead.resolve("@x/alpha", "workspace:*");
          assertSome(atHeadVersionedControl, "1.0.0");
          const worktreeVersionedControl = worktree.resolve("@x/alpha", "workspace:*");
          assertSome(worktreeVersionedControl, "1.0.0");
        })
      );
    }
  );
});

describe("WorkspaceStateSnapshot — snapshot-scoped resolver layers", () => {
  it.layer(resolveSnapshot.resolvers, { timeout: "30 seconds" })((it) => {
    it.effect("CatalogResolver and WorkspaceResolver resolve against the snapshot", () =>
      Effect.gen(function* () {
        const catalog = yield* CatalogResolver;
        const workspace = yield* WorkspaceResolver;
        const rangeOf3 = yield* catalog.rangeOf("effect", O.none());
        assertSome(rangeOf3, "^4.0.0");
        const rangeOf4 = yield* catalog.rangeOf("vitest", O.some("build"));
        assertSome(rangeOf4, "^3.0.0");
        const versionOf5 = yield* workspace.versionOf("@x/beta");
        assertSome(versionOf5, "4.5.6");
      })
    );

    it.effect("an unmatched name resolves to Option.none() on both layers", () =>
      Effect.gen(function* () {
        const catalog = yield* CatalogResolver;
        const workspace = yield* WorkspaceResolver;
        const rangeOf6 = yield* catalog.rangeOf("nope", O.none());
        assertNone(rangeOf6);
        const versionOf7 = yield* workspace.versionOf("nope");
        assertNone(versionOf7);
      })
    );
  });
});

const HOOK_LOCK = `lockfileVersion: '9.0'

importers:

  .:
    devDependencies:
      effect:
        specifier: catalog:effect
        version: 4.0.0-beta.101

packages: {}
`;

const hookOnlyCatalogManifest = Result.getOrThrowWith(
  S.encodeUnknownResult(S.fromJsonString(S.Unknown))({
    name: "root",
    version: "1.0.0",
    peerDependencies: { effect: "catalog:effect:peers" },
    devDependencies: { effect: "catalog:effect" },
  }),
  identity
);

const hookTree: Tree = {
  "/repo/package.json": hookOnlyCatalogManifest,
  "/repo/pnpm-workspace.yaml": "packages: []\n",
  "/repo/pnpm-lock.yaml": HOOK_LOCK,
};

const hookRefTrees: RefTrees = {
  HEAD: {
    "package.json": hookOnlyCatalogManifest,
    "pnpm-workspace.yaml": "packages: []\n",
    "pnpm-lock.yaml": HOOK_LOCK,
  },
};

describe("WorkspaceSnapshots — hook-injected catalog symmetry", () => {
  it.layer(snapshotsLayer(scriptGit(hookRefTrees), hookTree), { timeout: "30 seconds" })((it) => {
    it.effect("at(ref) and worktree() resolve the injected catalog to the same version", () =>
      Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots;
        const atRef = yield* snapshots.at("HEAD");
        const live = yield* snapshots.worktree;

        const fromRef = atRef.resolve("effect", "catalog:effect:peers");
        const fromLive = live.resolve("effect", "catalog:effect:peers");

        assertSome(fromRef, "4.0.0-beta.101");
        assert.deepStrictEqual(
          fromLive,
          fromRef,
          "both sides read the committed lockfile importer; resolving on one side only is a bogus row every run"
        );
      })
    );

    it.effect("the importer index reaches both snapshots", () =>
      Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots;
        const atRef = yield* snapshots.at("HEAD");
        const live = yield* snapshots.worktree;
        assert.strictEqual(atRef.importerVersions?.["."]?.effect, "4.0.0-beta.101");
        assert.strictEqual(live.importerVersions?.["."]?.effect, "4.0.0-beta.101");
      })
    );
  });
});

const HOOKED_MARKER: Tree = {
  "/repo/pnpm-workspace.yaml": A.join(["packages:", "  - packages/*", "catalog:", "  effect: ^4.0.0", ""], "\n"),
  "/repo/package.json": rootManifest(["packages/*"]),
  "/repo/packages/alpha/package.json": manifest("@x/alpha", {
    dependencies: { effect: "catalog:", "hooked-dep": "catalog:" },
  }),
};

const HOOKED_REF: RefTrees = headRefFromTree(HOOKED_MARKER);

const HOOK_PNPMFILE_INJECTED_CATALOG = CatalogSet.make({ entries: { default: { "hooked-dep": "^9.9.9" } } });

describe("WorkspaceSnapshots — under layerNoop, the hook-injected catalog is invisible at a ref", () => {
  it.layer(snapshotsLayer(scriptGit(HOOKED_REF), HOOKED_MARKER), { timeout: "30 seconds" })((it) => {
    it.effect("resolves the committed catalog and abstains on the hook-injected one", () =>
      Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots;
        const atRef = yield* snapshots.at("HEAD");
        const committedCatalogControl = atRef.resolve("effect", "catalog:");
        assertSome(committedCatalogControl, "^4.0.0");
        assertNone(atRef.resolve("hooked-dep", "catalog:"));
      })
    );
  });
});

describe("WorkspaceSnapshots — seedCatalogs hand a held live set to the ref side, executing nothing", () => {
  it.layer(snapshotsLayer(scriptGit(HOOKED_REF), HOOKED_MARKER, "/repo", HOOK_PNPMFILE_INJECTED_CATALOG), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("reaches at(ref)", () =>
      Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots;
        const atRef = yield* snapshots.at("HEAD");
        assertSome(atRef.resolve("hooked-dep", "catalog:"), "^9.9.9");
      })
    );

    it.effect("reaches worktree() too, so the two sides of a diff agree", () =>
      Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots;
        const atRef = yield* snapshots.at("HEAD");
        const live = yield* snapshots.worktree;
        assert.deepStrictEqual(
          live.resolve("hooked-dep", "catalog:"),
          atRef.resolve("hooked-dep", "catalog:"),
          "a seeded at against an unseeded worktree reports the catalog removed every run; HOOKED_REF is derived from HOOKED_MARKER, so two hand-written trees cannot drift into a false agreement"
        );
      })
    );

    it.effect("never overrides what the ref itself committed", () =>
      Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots;
        const atRef = yield* snapshots.at("HEAD");
        assertSome(atRef.resolve("effect", "catalog:"), "^4.0.0");
        const refOwnCatalogsOnly = atRef.catalogs.rangeOf("hooked-dep", O.none());
        assertNone(refOwnCatalogsOnly);
      })
    );
  });
});

interface InjectCall {
  readonly configDependencies: Readonly<Record<string, string>>;
  readonly root: string;
  readonly rules: HookInjection["peerDependencyRules"] | undefined;
  readonly seed: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

const recordingHooks = (answers: Readonly<Record<string, Readonly<Record<string, string>>>>) => {
  const calls: Array<InjectCall> = [];
  const layer = Layer.succeed(ConfigDependencyHooks, {
    inject: dual(
      (args) => P.isString(args[0]),
      Effect.fn("ConfigDependencyHooks.inject")(
        (
          root: string,
          configDependencies: Readonly<Record<string, string>>,
          seed: Readonly<Record<string, Readonly<Record<string, string>>>>,
          rules: PeerDependencyRules | undefined
        ) =>
          Effect.sync(() => {
            calls.push({ root, configDependencies, seed, rules });
            let injected: Record<string, string> = {};
            const replays: Record<string, HookReplay> = {};
            for (const [name, spec] of R.toEntries(configDependencies)) {
              const declared = Str.split(spec, "+")[0] ?? spec;
              injected = { ...injected, ...(answers[`${name}@${declared}`] ?? {}) };
              replays[name] = HookReplay.make({ version: declared, source: "supplied" });
            }
            return {
              catalogs: { ...seed, default: { ...(seed.default ?? {}), ...injected } },
              releaseAge: {},
              peerDependencyRules:
                rules ?? PeerDependencyRules.make({ allowedVersions: {}, ignoreMissing: [], allowAny: [] }),
              replays,
            };
          })
      )
    ),
  });
  return { calls, layer };
};

const replayWorkspaceYaml = (spec: string): string =>
  A.join(
    [
      "packages:",
      "  - packages/*",
      "catalog:",
      "  effect: ^4.0.0",
      "configDependencies:",
      `  '@scope/plugin': '${spec}'`,
      "",
    ],
    "\n"
  );

const REPLAY_MEMBER = manifest("@x/alpha", { dependencies: { effect: "catalog:", "hooked-dep": "catalog:" } });

const suffixedBeforeBareAfterRefs: RefTrees = {
  before: {
    "package.json": rootManifest(["packages/*"]),
    "pnpm-workspace.yaml": replayWorkspaceYaml("1.0.0+sha512-abc"),
    "packages/alpha/package.json": REPLAY_MEMBER,
  },
  after: {
    "package.json": rootManifest(["packages/*"]),
    "pnpm-workspace.yaml": replayWorkspaceYaml("2.0.0"),
    "packages/alpha/package.json": REPLAY_MEMBER,
  },
};
const replayRootMarkerOnly: Tree = {
  "/repo/package.json": rootManifest(["packages/*"]),
  "/repo/pnpm-workspace.yaml": replayWorkspaceYaml("2.0.0"),
};

describe("WorkspaceSnapshots.at — replays the ref's configDependencies at the ref's declared versions", () => {
  const hooks = recordingHooks({
    "@scope/plugin@1.0.0": { "hooked-dep": "^1.0.0" },
    "@scope/plugin@2.0.0": { "hooked-dep": "^2.0.0" },
  });
  it.layer(
    snapshotsLayer(scriptGit(suffixedBeforeBareAfterRefs), replayRootMarkerOnly, "/repo", undefined, hooks.layer),
    {
      timeout: "30 seconds",
    }
  )((it) => {
    it.effect("hands the hooks layer THAT ref's configDependencies and inline seed", () =>
      Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots;
        yield* snapshots.at("before");
        const call = O.getOrUndefined(
          A.findFirst(hooks.calls, (entry) => entry.configDependencies["@scope/plugin"] === "1.0.0+sha512-abc")
        );
        assert.isDefined(call, "the recording hooks layer proves which declarations reached the seam");
        assert.strictEqual(call?.root, "/repo");
        assert.deepStrictEqual(call?.seed, { default: { effect: "^4.0.0" } }, "the seed is the ref's inline catalogs");
        assert.deepStrictEqual(
          call?.rules,
          PeerDependencyRules.make({ allowedVersions: {}, ignoreMissing: [], allowAny: [] }),
          "the rules are the ref's own, here none"
        );
      })
    );

    it.effect("merges the injected catalogs into the ref's own catalogs", () =>
      Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots;
        const before = yield* snapshots.at("before");
        const ownCatalogsInjectedRange = before.catalogs.rangeOf("hooked-dep", O.none());
        assertSome(ownCatalogsInjectedRange, "^1.0.0");
        assertSome(before.resolve("hooked-dep", "catalog:"), "^1.0.0");
        const inlineCatalogControl = before.resolve("effect", "catalog:");
        assertSome(inlineCatalogControl, "^4.0.0");
      })
    );

    it.effect("two refs declaring different versions yield different catalogs — the bump IS detected", () =>
      Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots;
        const before = yield* snapshots.at("before");
        const after = yield* snapshots.at("after");
        assertSome(before.resolve("hooked-dep", "catalog:"), "^1.0.0");
        assertSome(after.resolve("hooked-dep", "catalog:"), "^2.0.0");
        assert.deepStrictEqual(
          before.hookReplays,
          { "@scope/plugin": "1.0.0" },
          "the replayed version evidences a config-dependency bump; the machine-local source stays off the value"
        );
        assert.deepStrictEqual(after.hookReplays, { "@scope/plugin": "2.0.0" });
        const [seededBefore, seededAfter] = WorkspaceStateSnapshot.crossSeed(before, after);
        assert.notDeepEqual(
          seededBefore.resolve("hooked-dep", "catalog:"),
          seededAfter.resolve("hooked-dep", "catalog:"),
          "own catalogs outrank the seed; at(ref) once skipped the replay and resolved both refs of a bump alike"
        );
      })
    );
  });
});

describe("WorkspaceSnapshots.at — under layerNoop the ref read executes nothing and sees no injection", () => {
  it.layer(snapshotsLayer(scriptGit(suffixedBeforeBareAfterRefs), replayRootMarkerOnly), { timeout: "30 seconds" })(
    (it) => {
      it.effect("both refs abstain on the hook-only catalog, exactly as before", () =>
        Effect.gen(function* () {
          const snapshots = yield* WorkspaceSnapshots;
          const before = yield* snapshots.at("before");
          const after = yield* snapshots.at("after");
          assertNone(before.resolve("hooked-dep", "catalog:"));
          assertNone(after.resolve("hooked-dep", "catalog:"));
          assertSome(before.resolve("effect", "catalog:"), "^4.0.0");
          assert.deepStrictEqual(
            before.hookReplays,
            {},
            "a pnpm-workspace.yaml was read, so the record is present and empty: replayed nothing, not no config dependencies"
          );
        })
      );
    }
  );
});

describe("WorkspaceSnapshots.at — a hook replay failure at the ref surfaces typed", () => {
  const failing = Layer.succeed(ConfigDependencyHooks, {
    inject: dual(
      (args) => P.isString(args[0]),
      Effect.fn("ConfigDependencyHooks.inject")((_root: string, configDependencies: Readonly<Record<string, string>>) =>
        Effect.fail(
          CatalogAssemblyError.make({
            source: "hooks",
            path: R.keys(configDependencies)[0] ?? "",
            cause: new Error("not installed"),
          })
        )
      )
    ),
  });
  it.layer(snapshotsLayer(scriptGit(suffixedBeforeBareAfterRefs), replayRootMarkerOnly, "/repo", undefined, failing), {
    timeout: "30 seconds",
  })((it) => {
    it.effect("fails at(ref) with the hooks-source CatalogAssemblyError, never a silent skip", () =>
      Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots;
        const error = yield* Effect.flip(snapshots.at("before"));
        assert.instanceOf(error, CatalogAssemblyError);
        if (S.is(CatalogAssemblyError)(error)) {
          assert.strictEqual(error.source, "hooks");
          assert.strictEqual(error.path, "@scope/plugin");
        }
      })
    );
  });
});

describe("WorkspaceStateSnapshot.versions — Effect collection and explicit order", () => {
  it("keeps first insertion order and last version, excluding unversioned members", () => {
    const state = WorkspaceStateSnapshot.make({
      catalogs: CatalogSet.empty(),
      packages: [
        PackageStateSnapshot.make({ name: "z", version: "1.0.0", relativePath: "z" }),
        PackageStateSnapshot.make({ name: "bare", relativePath: "." }),
        PackageStateSnapshot.make({ name: "a", version: "2.0.0", relativePath: "a" }),
        PackageStateSnapshot.make({ name: "z", version: "3.0.0", relativePath: "z" }),
      ],
    });
    assert.deepStrictEqual(state.versionNames, ["z", "a"]);
    assert.strictEqual(HashMap.size(state.versions), 2);
    assertSome(HashMap.get(state.versions, "z"), "3.0.0");
    assertSome(HashMap.get(state.versions, "a"), "2.0.0");
    assertNone(HashMap.get(state.versions, "bare"));
    assert.strictEqual(state.versions, state.versions);
    assert.strictEqual(state.versionNames, state.versionNames);
  });
});

const tolerantJsonRefs: RefTrees = {
  HEAD: {
    "package.json": rootManifest(["packages/*"]),
    "packages/valid/package.json":
      '{"name":"valid","version":"1.0.0","dependencies":{"constructor":"^1.0.0","__proto__":"^2.0.0"}}',
    "packages/invalid-json/package.json": "{",
    "packages/array/package.json": '[{"name":"array"}]',
    "packages/null/package.json": "null",
    "packages/string/package.json": '"string"',
    "packages/number/package.json": "42",
    "packages/boolean/package.json": "true",
    "packages/no-name/package.json": "{}",
    "packages/bad-fields/package.json":
      '{"name":"bad-fields","version":42,"dependencies":{"effect":42},"devDependencies":[]}',
  },
};

describe("WorkspaceSnapshots.at — tolerant JSON schema decoding", () => {
  it.layer(snapshotsLayer(scriptGit(tolerantJsonRefs), npmRootMarkerOnlyOnDisk), { timeout: "30 seconds" })((it) => {
    it.effect("keeps valid own keys and degrades corrupt, non-object and malformed fields", () =>
      Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots;
        const state = yield* snapshots.at("HEAD");
        assert.deepStrictEqual(
          A.map(state.packages, (pkg) => pkg.name),
          ["root", "bad-fields", "valid"]
        );
        const valid = O.getOrThrow(state.package("valid"));
        assert.deepStrictEqual(
          valid.dependencies,
          R.fromEntries([
            ["constructor", "^1.0.0"],
            ["__proto__", "^2.0.0"],
          ])
        );
        const badFields = O.getOrThrow(state.package("bad-fields"));
        assert.isUndefined(badFields.version);
        assert.deepStrictEqual(badFields.dependencies, {});
        assert.deepStrictEqual(badFields.devDependencies, {});
      })
    );
  });
});

import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { WorkspaceCatalogs } from "@beep/repo-workspaces/WorkspaceCatalogs";
import { WorkspaceDiscovery } from "@beep/repo-workspaces/WorkspaceDiscovery";
import { WorkspaceRoot } from "@beep/repo-workspaces/WorkspaceRoot";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as R from "effect/Record";

const ownNameReplayEntries: ReadonlyArray<readonly [string, HookReplay]> = [
  ["first", HookReplay.make({ version: "1.0.0", source: "supplied" })],
  ["__proto__", HookReplay.make({ version: "2.0.0", source: "installed" })],
  ["constructor", HookReplay.make({ version: "3.0.0", source: "store" })],
  ["last", HookReplay.make({ version: "4.0.0", source: "fetched" })],
];
const ownNameReplays = R.fromEntries(ownNameReplayEntries);
const ownNameHooks = Layer.succeed(ConfigDependencyHooks, {
  inject: dual(
    (args) => P.isString(args[0]),
    Effect.fn("OwnNameHooks.inject")(
      (
        _root: string,
        _dependencies: Readonly<Record<string, string>>,
        seed: Readonly<Record<string, Readonly<Record<string, string>>>>,
        rules?: PeerDependencyRules
      ) =>
        Effect.succeed({
          catalogs: seed,
          releaseAge: {},
          peerDependencyRules:
            rules ?? PeerDependencyRules.make({ allowedVersions: {}, ignoreMissing: [], allowAny: [] }),
          replays: ownNameReplays,
        })
    )
  ),
});
const ownNameTree: Tree = {
  "/repo/package.json": rootManifest([]),
  "/repo/pnpm-workspace.yaml": "packages: []\n",
};
const ownNameDependencies = Layer.mergeAll(
  scriptGit(headRefFromTree(ownNameTree)),
  WorkspaceRoot.layerTest("/repo"),
  WorkspaceDiscovery.layerTest({ listPackages: Effect.succeed([]) }),
  WorkspaceCatalogs.layerTest({
    set: Effect.succeed(CatalogSet.empty()),
    importerVersions: Effect.succeed({}),
    hookReplays: Effect.succeed(ownNameReplays),
  }),
  ownNameHooks
);

describe("snapshot hook-version projection preserves own replay names", () => {
  it.layer(ownNameDependencies, { timeout: "30 seconds" })((it) => {
    it.effect("both historical and live projections keep every version in replay order", () =>
      Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots.make({ cwd: "/repo" });
        const expected = [
          ["first", "1.0.0"],
          ["__proto__", "2.0.0"],
          ["constructor", "3.0.0"],
          ["last", "4.0.0"],
        ];
        const atRef = yield* snapshots.at("HEAD");
        const live = yield* snapshots.worktree;
        for (const snapshot of [atRef, live]) {
          assert.deepStrictEqual(R.toEntries(snapshot.hookReplays ?? {}), expected);
          assertSome(R.get(snapshot.hookReplays ?? {}, "__proto__"), "2.0.0");
          const codec = S.fromJsonString(WorkspaceStateSnapshot);
          const argument = S.decodeEffect(codec);
          const value1 = yield* S.encodeEffect(codec)(snapshot);
          const stored = yield* argument(value1);
          assert.deepStrictEqual(R.toEntries(stored.hookReplays ?? {}), expected);
        }
        assert.deepStrictEqual(
          A.map(R.toEntries(ownNameReplays), ([name, replay]) => [name, replay.version]),
          expected
        );
        assert.deepStrictEqual(
          A.map(R.values(ownNameReplays), (replay) => replay.source),
          ["supplied", "installed", "store", "fetched"]
        );
      })
    );
  });
});

const bunCatalogCases = [
  {
    name: "array workspaces retain top-level default and named catalogs without a lockfile",
    root: {
      name: "root",
      version: "0.0.0",
      private: true,
      packageManager: "bun@1.2.0",
      workspaces: ["packages/*"],
      catalog: { effect: "^4.0.0" },
      catalogs: { build: { typescript: "^6.0.0" } },
    },
    expected: { default: { effect: "^4.0.0" }, build: { typescript: "^6.0.0" } },
  },
  {
    name: "workspaces-object catalogs win overlaps and retain top-level-only entries",
    root: {
      name: "root",
      version: "0.0.0",
      private: true,
      packageManager: "bun@1.2.0",
      catalog: { effect: "^3.0.0", react: "^19.0.0" },
      catalogs: { build: { typescript: "^5.0.0", vitest: "^3.0.0" }, topOnly: { eslint: "^9.0.0" } },
      workspaces: {
        packages: ["packages/*"],
        catalog: { effect: "^4.0.0" },
        catalogs: { build: { typescript: "^6.0.0" } },
      },
    },
    expected: {
      default: { effect: "^4.0.0", react: "^19.0.0" },
      build: { typescript: "^6.0.0", vitest: "^3.0.0" },
      topOnly: { eslint: "^9.0.0" },
    },
  },
];

for (const control of bunCatalogCases) {
  const tree: Tree = {
    "/repo/package.json": Result.getOrThrow(S.encodeResult(S.fromJsonString(S.Unknown))(control.root)),
    "/repo/packages/member/package.json": manifest("member", {
      dependencies: { effect: "catalog:", typescript: "catalog:build" },
    }),
  };
  describe("Bun top-level snapshot catalogs", () => {
    it.layer(snapshotsLayer(scriptGit(headRefFromTree(tree)), tree), { timeout: "30 seconds" })((it) => {
      it.effect(control.name, () =>
        Effect.gen(function* () {
          const snapshots = yield* WorkspaceSnapshots;
          const atRef = yield* snapshots.at("HEAD");
          const live = yield* snapshots.worktree;
          assert.deepStrictEqual(atRef.catalogs.entries, control.expected);
          assert.deepStrictEqual(live.catalogs.entries, control.expected);
          assert.deepStrictEqual(observableState(atRef), observableState(live));
          assertSome(atRef.resolve("effect", "catalog:"), "^4.0.0");
          assertSome(live.resolve("effect", "catalog:"), "^4.0.0");
          assertSome(atRef.resolve("typescript", "catalog:build"), "^6.0.0");
          assertSome(live.resolve("typescript", "catalog:build"), "^6.0.0");
        })
      );
    });
  });
}

const malformedBunTrees: RefTrees = {
  badNested: {
    "package.json":
      '{"name":"root","workspaces":{"packages":[],"catalog":42,"catalogs":["bad"]},"catalog":{"effect":"^4.0.0","bad":42},"catalogs":{"build":{"typescript":"^6.0.0","bad":false},"bad":42}}',
  },
  badTopLevel: {
    "package.json":
      '{"name":"root","catalog":42,"catalogs":["bad"],"workspaces":{"packages":[],"catalog":{"effect":"^4.0.0"},"catalogs":{"build":{"typescript":"^6.0.0"}}}}',
  },
  badWorkspaces: {
    "package.json":
      '{"name":"root","workspaces":42,"catalog":{"effect":"^4.0.0"},"catalogs":{"build":{"typescript":"^6.0.0"}}}',
  },
};
describe("historical Bun catalogs retain tolerant malformed-input degradation", () => {
  it.layer(snapshotsLayer(scriptGit(malformedBunTrees), npmRootMarkerOnlyOnDisk), { timeout: "30 seconds" })((it) => {
    it.effect("malformed blocks and entries do not hide usable top-level or nested catalogs", () =>
      Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots;
        for (const ref of ["badNested", "badTopLevel", "badWorkspaces"]) {
          const snapshot = yield* snapshots.at(ref);
          assert.deepStrictEqual(snapshot.catalogs.entries, {
            default: { effect: "^4.0.0" },
            build: { typescript: "^6.0.0" },
          });
        }
      })
    );
  });
});

it.effect.prop(
  "a captured member generated from its schema survives an encode/decode round trip",
  [Arbitrary.schema(PackageStateSnapshot)],
  ([value]) =>
    Effect.gen(function* () {
      const argument1 = S.decodeEffect(PackageStateSnapshot);
      const value2 = yield* S.encodeEffect(PackageStateSnapshot)(value);
      const decoded = yield* argument1(value2);
      assert.isTrue(S.toEquivalence(PackageStateSnapshot)(decoded, value));
    }),
  { arbitrary: fcRuns(50) }
);
