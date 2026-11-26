import { MemoryFileSystem } from "@beep/memfs";
import {
  findWorkspaceRootSync,
  getWorkspacePackagesSync,
  WorkspaceDiscovery,
  WorkspaceDiscoveryError,
  WorkspacePatternError,
  WorkspaceRoot,
} from "@beep/repo-workspaces";
import { WorkspaceEnumerationDepthError } from "@beep/repo-workspaces/WorkspacesSync";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { hostPath } from "./support/hostPath.ts";
import type { MemoryFileSystemHandle } from "@beep/memfs";
import type { SyncFileSystem, WorkspacePackage, WorkspacesSyncOptions } from "@beep/repo-workspaces";

const UnknownJson = S.fromJsonString(S.Unknown);

const PRIVATE_ROOT_WITHOUT_VERSION = `{ "name": "root", "private": true }`;

const opsOverFreshVolume = (seed: Readonly<Record<string, string>>): WorkspacesSyncOptions => ({
  fileSystem: MemoryFileSystem.makeSync(seed).sync,
  path: hostPath.posix,
});

describe("getWorkspacePackagesSync — hostile manifests", () => {
  const ops = opsOverFreshVolume({
    "/repo/pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
    "/repo/package.json": Result.getOrThrowWith(
      S.encodeUnknownResult(UnknownJson)({ name: "root", version: "0.0.0", private: true }),
      identity
    ),
    "/repo/packages/good/package.json": Result.getOrThrowWith(
      S.encodeUnknownResult(UnknownJson)({ name: "@x/good", version: "1.0.0" }),
      identity
    ),
    "/repo/packages/null-manifest/package.json": "null",
    "/repo/packages/number-manifest/package.json": "42",
    "/repo/packages/string-manifest/package.json": '"nope"',
    "/repo/packages/array-manifest/package.json": "[1, 2, 3]",
    "/repo/packages/broken-manifest/package.json": "{ not json",
  });

  it("a package.json containing exactly `null` does not crash the enumeration", () => {
    const packages = getWorkspacePackagesSync("/repo", ops);
    const names = A.map(packages, (pkg) => pkg.name);
    assert.include(
      names,
      "@x/good",
      'regression: readJson typed JSON.parse as Record | undefined, but JSON.parse("null") is null, so the raw === undefined guard let it through and raw.name threw a TypeError, malformed input escaping as a defect out of a function documented as total, which would crash a calling Vitest config'
    );
  });

  it("every non-object manifest is skipped, not decoded into a member", () => {
    const names = A.map(getWorkspacePackagesSync("/repo", ops), (pkg) => pkg.name);
    assert.deepStrictEqual(
      names.slice().sort(),
      ["@x/good", "root"],
      "only the root and the one good member survive; the five hostile directories contribute nothing: four are valid JSON that is not an object (JSON.parse returns null, a number, a string or an array, never undefined, the case a raw === undefined guard does not cover) and one is a syntax error, which that guard did cover"
    );
  });

  it("the good member is still fully decoded alongside the hostile ones", () => {
    const good = O.getOrUndefined(A.findFirst(getWorkspacePackagesSync("/repo", ops), (pkg) => pkg.name === "@x/good"));
    assert.isDefined(good);
    assert.strictEqual(good?.version, "1.0.0");
    assert.strictEqual(good?.relativePath, "packages/good");
  });

  it("the as-read manifest record rides along on every member", () => {
    const good = O.getOrUndefined(A.findFirst(getWorkspacePackagesSync("/repo", ops), (pkg) => pkg.name === "@x/good"));
    assert.deepStrictEqual(good?.manifestRecord, { name: "@x/good", version: "1.0.0" });
  });

  it("finds the root from a nested directory", () => {
    assert.strictEqual(findWorkspaceRootSync("/repo/packages/good", ops), "/repo");
  });
});

describe("findWorkspaceRootSync", () => {
  it("a root whose package.json is `null` still resolves via pnpm-workspace.yaml", () => {
    const ops = opsOverFreshVolume({
      "/hostile/package.json": "null",
      "/hostile/pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
      "/hostile/packages/a/package.json": Result.getOrThrowWith(
        S.encodeUnknownResult(UnknownJson)({ name: "@h/a", version: "1.0.0" }),
        identity
      ),
    });
    assert.strictEqual(
      findWorkspaceRootSync("/hostile/packages/a", ops),
      "/hostile",
      "a VALID root manifest would only re-test pnpm marker discovery and never create the hostile state this test is named for, so the state is built explicitly"
    );
    assert.deepStrictEqual(
      A.map(getWorkspacePackagesSync("/hostile", ops), (pkg) => pkg.name),
      ["@h/a"],
      "enumeration over that root still works, skipping the null root manifest"
    );
  });
});

const oneVolumeWithLeafAtDepth = (depth: number) => {
  const segmentsAboveDeep = A.join(
    Array.from({ length: depth - 1 }, (_, i) => `n${i + 1}/`),
    ""
  );
  return MemoryFileSystem.makeSync({
    "/repo/pnpm-workspace.yaml": "packages:\n  - 'packages/**'\n",
    "/repo/package.json": Result.getOrThrowWith(
      S.encodeUnknownResult(UnknownJson)({ name: "root", version: "0.0.0" }),
      identity
    ),
    [`/repo/packages/${segmentsAboveDeep}deep/package.json`]: Result.getOrThrowWith(
      S.encodeUnknownResult(UnknownJson)({ name: "@d/deep", version: "1.0.0" }),
      identity
    ),
  });
};

const listPackagesViaDiscovery = (handle: MemoryFileSystemHandle, options: { readonly maxDepth?: number } = {}) => {
  const servicesScopedToCallingTest = Layer.build(
    WorkspaceDiscovery.layer({ cwd: "/repo", ...options }).pipe(
      Layer.provide(WorkspaceRoot.layer),
      Layer.provide(handle.layer)
    )
  );
  return servicesScopedToCallingTest.pipe(
    Effect.flatMap((services) => Context.get(services, WorkspaceDiscovery).listPackages)
  );
};

const effectSideNamesOverVolume = (handle: MemoryFileSystemHandle, maxDepth: number) =>
  listPackagesViaDiscovery(handle, { maxDepth }).pipe(Effect.map((packages) => A.map(packages, (pkg) => pkg.name)));

describe("the sync hatch and the Effect enumerator, one traversal over ONE memfs volume, agree at the depth boundary", () => {
  it.effect("AT the cap, both find the deep package", () =>
    Effect.gen(function* () {
      const leafAtMaxDepth = oneVolumeWithLeafAtDepth(2);
      const sync = A.map(
        getWorkspacePackagesSync("/repo", {
          fileSystem: leafAtMaxDepth.sync,
          path: hostPath.posix,
          maxDepth: 2,
        }),
        (pkg) => pkg.name
      );
      const eff = yield* effectSideNamesOverVolume(leafAtMaxDepth, 2);
      assert.include(sync, "@d/deep");
      assert.deepStrictEqual(sync.slice().sort(), eff.slice().sort());
    })
  );

  it.effect("BEYOND the cap, the sync hatch does NOT return a package the Effect path rejects", () =>
    Effect.gen(function* () {
      const leafOnePastMaxDepth = oneVolumeWithLeafAtDepth(3);
      const sync = A.map(
        getWorkspacePackagesSync("/repo", {
          fileSystem: leafOnePastMaxDepth.sync,
          path: hostPath.posix,
          maxDepth: 2,
        }),
        (pkg) => pkg.name
      );
      assert.notInclude(
        sync,
        "@d/deep",
        "the drift: before both entry points drove one traversal (internal/traverse.ts) the hand-rolled sync worklist accepted the child BEFORE checking its depth and declined to descend, so @d/deep came back while the Effect enumerator failed with depthExceeded on the identical tree; a test of one entry point cannot catch that, so both run against one volume (handle.layer and handle.sync)"
      );
      assert.include(sync, "root", "positive control: the sync side did read the tree");

      const error = yield* Effect.flip(effectSideNamesOverVolume(leafOnePastMaxDepth, 2));
      assert.instanceOf(error, WorkspacePatternError);
      assert.strictEqual(
        error.kind,
        "depthExceeded",
        "the Effect path fails typed where the sync hatch truncates, the ONE deliberate divergence because the sync hatch has no error channel; which packages are in scope must never differ"
      );
    })
  );

  it("a non-integer maxDepth (NaN, 2.5 slip a bare < 1 check) is a caller error as for Effect.die, not a silent empty result", () => {
    const ops = { fileSystem: oneVolumeWithLeafAtDepth(1).sync, path: hostPath.posix };
    assert.throws(
      () => getWorkspacePackagesSync("/repo", { ...ops, maxDepth: Number.NaN }),
      WorkspaceEnumerationDepthError
    );
    assert.throws(() => getWorkspacePackagesSync("/repo", { ...ops, maxDepth: 2.5 }), WorkspaceEnumerationDepthError);
    assert.throws(() => getWorkspacePackagesSync("/repo", { ...ops, maxDepth: 0 }), WorkspaceEnumerationDepthError);
  });
});

describe("getWorkspacePackagesSync over consumer-supplied memfs ops: nothing is on disk, so a src reaching node:fs fails", () => {
  const ops = opsOverFreshVolume({
    "/repo/pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
    "/repo/package.json": Result.getOrThrowWith(
      S.encodeUnknownResult(UnknownJson)({ name: "root", version: "0.0.0", private: true }),
      identity
    ),
    "/repo/packages/a/package.json": Result.getOrThrowWith(
      S.encodeUnknownResult(UnknownJson)({
        name: "@mem/a",
        version: "2.0.0",
        scripts: { build: "tsc" },
      }),
      identity
    ),
    "/repo/packages/b/package.json": Result.getOrThrowWith(
      S.encodeUnknownResult(UnknownJson)({ name: "@mem/b", version: "3.0.0" }),
      identity
    ),
  });

  it("enumerates the virtual workspace", () => {
    const names = A.map(getWorkspacePackagesSync("/repo", ops), (pkg) => pkg.name);
    assert.deepStrictEqual(names, ["root", "@mem/a", "@mem/b"]);
  });

  it("finds the root by ascending the virtual tree", () => {
    assert.strictEqual(findWorkspaceRootSync("/repo/packages/a", ops), "/repo");
  });

  it("carries fields outside the discovery slice through manifestRecord", () => {
    const a = O.getOrUndefined(A.findFirst(getWorkspacePackagesSync("/repo", ops), (pkg) => pkg.name === "@mem/a"));
    assert.deepStrictEqual(a?.manifestRecord.scripts, { build: "tsc" });
  });
});

describe("findWorkspaceRootSync stopAt over a single-package checkout inside a pnpm root (as WorkspacesStopAt.test.ts)", () => {
  const CWD = "/outer/checkout";
  const files: Record<string, string> = {
    "/outer/pnpm-workspace.yaml": "packages:\n  - 'pkgs/*'\n",
    "/outer/package.json": Result.getOrThrowWith(
      S.encodeUnknownResult(UnknownJson)({ name: "outer-root", version: "0.0.0", private: true }),
      identity
    ),
    "/outer/pkgs/other/package.json": Result.getOrThrowWith(
      S.encodeUnknownResult(UnknownJson)({ name: "other", version: "1.0.0" }),
      identity
    ),
    "/outer/checkout/package.json": Result.getOrThrowWith(
      S.encodeUnknownResult(UnknownJson)({ name: "checkout", version: "1.0.0" }),
      identity
    ),
  };
  const ops = opsOverFreshVolume(files);

  it("control: with no ceiling the ascent adopts the outer workspace", () => {
    assert.strictEqual(findWorkspaceRootSync(CWD, ops), "/outer", "the control proves the tree resolves at all");
  });

  it("stopAt: cwd refuses the enclosing workspace", () => {
    assert.isNull(findWorkspaceRootSync(CWD, { ...ops, stopAt: CWD }));
  });

  it("the ceiling is inclusive — a ceiling that is itself the root resolves", () => {
    assert.strictEqual(findWorkspaceRootSync(CWD, { ...ops, stopAt: "/outer" }), "/outer");
  });

  it("a checkout that is itself a root still resolves under stopAt: cwd", () => {
    const selfRooted = opsOverFreshVolume({ ...files, "/outer/checkout/pnpm-workspace.yaml": "packages: []\n" });
    assert.strictEqual(findWorkspaceRootSync(CWD, { ...selfRooted, stopAt: CWD }), CWD);
  });

  it("an unnormalized ceiling is resolved before comparison, not string-matched raw", () => {
    assert.isNull(findWorkspaceRootSync(CWD, { ...ops, stopAt: "/outer/checkout/./" }));
  });

  it("a relative ceiling resolves through the supplied path's cwd at lookup time", () => {
    let cwd = "/outer";
    const path = {
      ...hostPath.posix,
      resolve: (...segments: Array<string>) => hostPath.posix.resolve(cwd, ...segments),
    };
    const bounded = { ...ops, path, stopAt: "checkout" };
    assert.isNull(
      findWorkspaceRootSync(CWD, bounded),
      "the consumer's resolve decides what a relative ceiling means, as node's does against process.cwd(); its working directory moves AFTER the options are built, so the ceiling resolves when the call runs, not when the options were assembled"
    );
    cwd = "/elsewhere";
    assert.strictEqual(
      findWorkspaceRootSync(CWD, bounded),
      "/outer",
      "discriminating control: under a cwd that makes the same relative ceiling name a non-ancestor it never matches, so the ascent is unbounded again"
    );
  });

  it("a ceiling naming no ancestor never matches — the ascent runs to the filesystem root", () => {
    assert.strictEqual(findWorkspaceRootSync(CWD, { ...ops, stopAt: "/unrelated" }), "/outer");
  });
});

describe("getWorkspacePackagesSync exclusions gate ACCEPTANCE, never descent, owing the async enumerator's proof", () => {
  const ops = opsOverFreshVolume({
    "/repo/pnpm-workspace.yaml": "packages:\n  - 'packages/**'\n  - '!packages/private-*'\n",
    "/repo/package.json": Result.getOrThrowWith(
      S.encodeUnknownResult(UnknownJson)({ name: "root", version: "0.0.0", private: true }),
      identity
    ),
    "/repo/packages/alpha/package.json": Result.getOrThrowWith(
      S.encodeUnknownResult(UnknownJson)({ name: "@mem/alpha", version: "1.0.0" }),
      identity
    ),
    "/repo/packages/private-thing/package.json": Result.getOrThrowWith(
      S.encodeUnknownResult(UnknownJson)({ name: "@mem/private", version: "1.0.0" }),
      identity
    ),
    "/repo/packages/private-thing/nested/package.json": Result.getOrThrowWith(
      S.encodeUnknownResult(UnknownJson)({ name: "@mem/nested", version: "1.0.0" }),
      identity
    ),
  });

  it("a leading-bang pattern excludes the package the includes matched", () => {
    const names = A.map(getWorkspacePackagesSync("/repo", ops), (pkg) => pkg.name);
    assert.include(names, "@mem/alpha");
    assert.notInclude(names, "@mem/private");
  });

  it("an excluded directory is still DESCENDED — a package under it stays discovered", () => {
    const names = A.map(getWorkspacePackagesSync("/repo", ops), (pkg) => pkg.name);
    assert.include(
      names,
      "@mem/nested",
      "!packages/private-* rejects packages/private-thing and nothing below it, since a * does not cross a segment boundary; gating traversal.push on the exclusion instead would drop this member silently"
    );
  });
});

const win32ViewOfPosixPort = (port: SyncFileSystem): SyncFileSystem => {
  const posix = (p: string): string => `/${Str.replace(/\\/g, "/")(p)}`;
  return {
    exists: (p) => port.exists(posix(p)),
    readFile: (p) => port.readFile(posix(p)),
    readDirectory: (p) => port.readDirectory(posix(p)),
    isDirectory: (p) => port.isDirectory(posix(p)),
  };
};

describe("WorkspacesSync with a win32 SyncPath, end to end over the real POSIX memfs port behind a C:\\repo -> /C:/repo shim", () => {
  const handle = MemoryFileSystem.makeSync({
    "/C:/repo/pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
    "/C:/repo/package.json": Result.getOrThrowWith(
      S.encodeUnknownResult(UnknownJson)({ name: "root", version: "0.0.0", private: true }),
      identity
    ),
    "/C:/repo/packages/a/package.json": Result.getOrThrowWith(
      S.encodeUnknownResult(UnknownJson)({ name: "@win/a", version: "1.0.0" }),
      identity
    ),
  });
  const ops: WorkspacesSyncOptions = { fileSystem: win32ViewOfPosixPort(handle.sync), path: hostPath.win32 };

  it("finds the root by ascending a drive-letter path", () => {
    assert.strictEqual(findWorkspaceRootSync("C:\\repo\\packages\\a", ops), "C:\\repo");
  });

  it("enumerates the workspace under a drive-letter root", () => {
    const packages = getWorkspacePackagesSync("C:\\repo", ops);
    assert.deepStrictEqual(
      A.map(packages, (pkg) => pkg.name),
      ["root", "@win/a"]
    );
    const a = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.name === "@win/a"));
    assert.strictEqual(
      a?.path,
      "C:\\repo\\packages\\a",
      "absolute paths come from the CONSUMER's implementation (backslashes)"
    );
    assert.strictEqual(
      a?.relativePath,
      "packages/a",
      "the workspace-relative path stays POSIX by the packages: contract"
    );
  });

  it("the two path implementations genuinely disagree about these inputs", () => {
    assert.strictEqual(
      hostPath.posix.dirname("C:\\repo\\packages\\a"),
      ".",
      "the premise the suite rests on, pinned so it cannot pass vacuously: under posix the ascent is a no-op fixpoint at ., so the win32 result above could never have come from the posix implementation"
    );
    assert.strictEqual(hostPath.win32.dirname("C:\\repo\\packages\\a"), "C:\\repo\\packages");
    assert.isNull(findWorkspaceRootSync("C:\\repo\\packages\\a", { ...ops, path: hostPath.posix }));
  });
});

describe("SyncFileSystem.readDirectoryWithTypes, a pure syscall saving: the four-operation fallback's results on every tree", () => {
  it("re-resolves an entry the fast path reports as a link", () => {
    const handle = MemoryFileSystem.makeSync({
      "/repo/package.json": `{ "name": "root", "version": "0.0.0", "private": true }`,
      "/repo/pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "/repo/packages/a/package.json": `{ "name": "@x/a", "version": "1.0.0" }`,
      "/repo/real/b/package.json": `{ "name": "@x/b", "version": "2.0.0" }`,
      "/repo/packages/b": MemoryFileSystem.symlink("/repo/real/b"),
    });
    const linkReportingFastPath: SyncFileSystem = {
      ...handle.sync,
      readDirectoryWithTypes: (p) =>
        A.map(handle.sync.readDirectory(p), (name) => ({
          name,
          isDirectory: name !== "b" && handle.sync.isDirectory(hostPath.posix.join(p, name)),
          isSymbolicLink: name === "b",
        })),
    };
    const viaSlow = getWorkspacePackagesSync("/repo", { fileSystem: handle.sync, path: hostPath.posix });
    const viaFast = getWorkspacePackagesSync("/repo", { fileSystem: linkReportingFastPath, path: hostPath.posix });
    assert.deepStrictEqual(
      A.sort(
        A.map(viaSlow, (pkg) => pkg.name),
        Str.Order
      ),
      ["@x/a", "@x/b", "root"]
    );
    assert.deepStrictEqual(
      viaFast,
      viaSlow,
      "b reports as a link and not a directory, as node's withFileTypes form does, because a Dirent describes the link and not its target; a naive fast path trusting Dirent.isDirectory() silently drops symlinked packages (node's own Dirent semantics are pinned on real disk by integration/node-sync.int.test.ts)"
    );
  });

  it("a throwing fast path (node's own EACCES errno over memfs, no symlinks needed) skips the directory, not propagating", () => {
    const handle = MemoryFileSystem.makeSync({
      "/repo/package.json": `{ "name": "root", "version": "0.0.0", "private": true }`,
      "/repo/pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "/repo/packages/a/package.json": `{ "name": "@x/a", "version": "1.0.0" }`,
    });
    const eaccesThrowingFastPath: SyncFileSystem = {
      ...handle.sync,
      readDirectoryWithTypes: (p) => {
        throw MemoryFileSystem.errno("EACCES", "scandir", p);
      },
    };
    assert.include(
      A.map(getWorkspacePackagesSync("/repo", { fileSystem: handle.sync, path: hostPath.posix }), (pkg) => pkg.name),
      "@x/a",
      "positive control: without the throwing fast path the member IS found"
    );
    assert.deepStrictEqual(
      A.map(
        getWorkspacePackagesSync("/repo", { fileSystem: eaccesThrowingFastPath, path: hostPath.posix }),
        (pkg) => pkg.name
      ),
      ["root"],
      "the whole wildcard base is unreadable, so no wildcard member survives, but the root package still resolves and nothing escapes"
    );
  });
});

describe("SyncFileSystem over a memfs volume, a sanctioned backend for the consumer-supplied port", () => {
  const symlinkedPackageB = MemoryFileSystem.symlink("/repo/real/b");
  const seed = {
    "/repo/package.json": `{ "name": "root", "version": "0.0.0", "private": true }`,
    "/repo/pnpm-workspace.yaml": "packages:\n  - packages/*\n",
    "/repo/packages/a/package.json": `{ "name": "@x/a", "version": "1.0.0" }`,
    "/repo/real/b/package.json": `{ "name": "@x/b", "version": "2.0.0" }`,
    "/repo/packages/b": symlinkedPackageB,
  };

  it.effect("enumerates a symlinked package directory, as the node binding does", () =>
    Effect.gen(function* () {
      const { volume } = yield* MemoryFileSystem.makeHandle(seed);
      const fileSystem = MemoryFileSystem.syncFileSystem(volume);

      const found = A.map(
        getWorkspacePackagesSync("/repo", { fileSystem, path: hostPath.posix }),
        (pkg) => pkg.name
      ).sort();

      assert.deepStrictEqual(
        found,
        ["@x/a", "@x/b", "root"],
        "positive control, the symlinked package must actually be found or this would pass on an empty result: a backend answering symlinks LITERALLY would drop it, giving two package lists for one workspace depending on the backend (caught in review of #445)"
      );
    })
  );

  it.effect("resolves the workspace root through a symlinked directory", () =>
    Effect.gen(function* () {
      const { volume } = yield* MemoryFileSystem.makeHandle(seed);
      const fileSystem = MemoryFileSystem.syncFileSystem(volume);
      assert.strictEqual(findWorkspaceRootSync("/repo/packages/b", { fileSystem, path: hostPath.posix }), "/repo");
    })
  );
});

describe("getWorkspacePackagesSync: version-less manifests are members, and every other skip is REPORTED", () => {
  const seed = {
    "/repo/package.json": PRIVATE_ROOT_WITHOUT_VERSION,
    "/repo/pnpm-workspace.yaml": "packages:\n  - packages/*\n",
    "/repo/packages/bare/package.json": `{ "name": "@x/bare", "private": true }`,
    "/repo/packages/versioned/package.json": `{ "name": "@x/versioned", "version": "1.0.0" }`,
    "/repo/packages/nameless/package.json": `{ "version": "1.0.0" }`,
    "/repo/packages/broken/package.json": `{ not json`,
    "/repo/packages/scalar/package.json": `42`,
    "/repo/packages/bad-version/package.json": `{ "name": "@x/bad-version", "version": 42 }`,
  };

  it.effect("a version-less root AND member are returned, root first, with `version` absent", () =>
    Effect.gen(function* () {
      const { volume } = yield* MemoryFileSystem.makeHandle(seed);
      const fileSystem = MemoryFileSystem.syncFileSystem(volume);
      const packages = getWorkspacePackagesSync("/repo", { fileSystem, path: hostPath.posix });
      assert.deepStrictEqual(
        A.map(packages, (pkg) => pkg.name),
        ["root", "@x/bare", "@x/versioned"]
      );
      const [root, bare, versioned] = packages;
      if (root === undefined || bare === undefined || versioned === undefined)
        return assert.fail("expected three packages");
      assert.isTrue(root.isRootWorkspace);
      assert.isFalse("version" in root, "absent: never a placeholder, never a present undefined key");
      assert.isFalse("version" in bare);
      assert.strictEqual(versioned.version, "1.0.0");
    })
  );

  it.effect("every skipped manifest is reported with its path and kind through `onSkip`", () =>
    Effect.gen(function* () {
      const { volume } = yield* MemoryFileSystem.makeHandle(seed);
      const fileSystem = MemoryFileSystem.syncFileSystem(volume);
      const skipped: Array<{ readonly path: string; readonly kind: string; readonly root: string }> = [];
      getWorkspacePackagesSync("/repo", {
        fileSystem,
        path: hostPath.posix,
        onSkip: (skip) => skipped.push({ path: skip.path, kind: skip.kind, root: skip.root }),
      });
      assert.deepStrictEqual(
        skipped.slice().sort((a, b) => Str.localeCompare(b.path)(a.path)),
        [
          { root: "/repo", path: "/repo/packages/bad-version/package.json", kind: "invalidShape" },
          { root: "/repo", path: "/repo/packages/broken/package.json", kind: "invalidJson" },
          { root: "/repo", path: "/repo/packages/nameless/package.json", kind: "missingName" },
          { root: "/repo", path: "/repo/packages/scalar/package.json", kind: "invalidShape" },
        ],
        "one report per unusable manifest, one per skip kind the read can produce, no report for a usable one, and the version-less members are NOT among them"
      );
    })
  );

  it.effect("a throwing `readFile` is reported as a `read` skip carrying the thrown cause", () =>
    Effect.gen(function* () {
      const handle = yield* MemoryFileSystem.makeHandle(seed);
      const boom = MemoryFileSystem.errno("EACCES", "open", "/repo/packages/versioned/package.json");
      const delegateToVolume = undefined;
      const { sync: fileSystem } = handle.withFaults({
        sync: {
          readFile: (p) => {
            if (p === "/repo/packages/versioned/package.json") throw boom;
            return delegateToVolume;
          },
        },
      });
      const skipped: Array<{ readonly path: string; readonly kind: string; readonly cause: unknown }> = [];
      const names = A.map(
        getWorkspacePackagesSync("/repo", {
          fileSystem,
          path: hostPath.posix,
          onSkip: (skip) => skipped.push({ path: skip.path, kind: skip.kind, cause: skip.cause }),
        }),
        (pkg) => pkg.name
      );
      assert.notInclude(names, "@x/versioned", "the unreadable member is gone from the result AND accounted for below");
      const read = O.getOrUndefined(
        A.findFirst(skipped, (skip) => skip.path === "/repo/packages/versioned/package.json")
      );
      assert.deepStrictEqual(read, { path: "/repo/packages/versioned/package.json", kind: "read", cause: boom });
    })
  );

  it.effect("a skipped ROOT manifest is reported too, not silently dropped", () =>
    Effect.gen(function* () {
      const { volume } = yield* MemoryFileSystem.makeHandle({
        ...seed,
        "/repo/package.json": "null",
      });
      const fileSystem = MemoryFileSystem.syncFileSystem(volume);
      const skipped: Array<string> = [];
      const names = A.map(
        getWorkspacePackagesSync("/repo", {
          fileSystem,
          path: hostPath.posix,
          onSkip: (skip) => skipped.push(`${skip.kind}:${skip.path}`),
        }),
        (pkg) => pkg.name
      );
      assert.notInclude(names, "root");
      assert.include(skipped, "invalidShape:/repo/package.json");
    })
  );

  it.effect("a version that is PRESENT but EMPTY is skipped as invalidShape, never admitted", () =>
    Effect.gen(function* () {
      const { volume } = yield* MemoryFileSystem.makeHandle({
        ...seed,
        "/repo/packages/empty/package.json": `{ "name": "@x/empty", "version": "" }`,
      });
      const fileSystem = MemoryFileSystem.syncFileSystem(volume);
      const skipped: Array<{ readonly path: string; readonly kind: string }> = [];
      const names = A.map(
        getWorkspacePackagesSync("/repo", {
          fileSystem,
          path: hostPath.posix,
          onSkip: (skip) => skipped.push({ path: skip.path, kind: skip.kind }),
        }),
        (pkg) => pkg.name
      );
      assert.notInclude(
        names,
        "@x/empty",
        'an empty version was never a legitimate pnpm shape: admitted, it resolves workspace:^ to a bare "^"; absence is tolerated, an empty string is the manifest\'s shape being wrong, as on the Effect surface'
      );
      assert.include(names, "@x/bare", "positive control: the version-less member IS still admitted");
      assert.deepStrictEqual(
        A.filter(skipped, (skip) => skip.path === "/repo/packages/empty/package.json"),
        [{ path: "/repo/packages/empty/package.json", kind: "invalidShape" }]
      );
    })
  );

  it.effect("every skip carries the cause the Effect surface fails with; only missingName has none", () =>
    Effect.gen(function* () {
      const { volume } = yield* MemoryFileSystem.makeHandle({
        ...seed,
        "/repo/packages/empty/package.json": `{ "name": "@x/empty", "version": "" }`,
      });
      const fileSystem = MemoryFileSystem.syncFileSystem(volume);
      const causes = MutableHashMap.empty<string, unknown>();
      getWorkspacePackagesSync("/repo", {
        fileSystem,
        path: hostPath.posix,
        onSkip: (skip) => MutableHashMap.set(causes, skip.path, skip.cause),
      });
      const messageAt = (path: string): unknown => {
        const cause = O.getOrUndefined(MutableHashMap.get(causes, path));
        return cause instanceof Error ? cause.message : cause;
      };
      assert.strictEqual(
        messageAt("/repo/packages/bad-version/package.json"),
        "version must be a string, got number",
        "the same sentences WorkspaceDiscovery attaches, so a consumer reading a skip and one reading a failure read one vocabulary"
      );
      assert.strictEqual(messageAt("/repo/packages/empty/package.json"), "version must be a non-empty string");
      assert.strictEqual(messageAt("/repo/packages/scalar/package.json"), "package.json is not a JSON object");
      assert.isTrue(MutableHashMap.has(causes, "/repo/packages/nameless/package.json"));
      assert.strictEqual(
        O.getOrUndefined(MutableHashMap.get(causes, "/repo/packages/nameless/package.json")),
        undefined,
        "missingName is the one kind with nothing to attach: the field is simply absent, and there is no originating throwable"
      );
      assert.instanceOf(
        O.getOrUndefined(MutableHashMap.get(causes, "/repo/packages/broken/package.json")),
        S.SchemaError,
        "discriminating control: invalidJson carries the JSON codec's SchemaError"
      );
    })
  );

  it.effect("without `onSkip` the call stays total and returns the same members", () =>
    Effect.gen(function* () {
      const { volume } = yield* MemoryFileSystem.makeHandle(seed);
      const fileSystem = MemoryFileSystem.syncFileSystem(volume);
      const names = A.map(getWorkspacePackagesSync("/repo", { fileSystem, path: hostPath.posix }), (pkg) => pkg.name);
      assert.deepStrictEqual(names, ["root", "@x/bare", "@x/versioned"]);
    })
  );
});

describe("the sync hatch and the Effect enumerator agree about `version` on a version-less tree", () => {
  const paritySeed = {
    "/repo/pnpm-workspace.yaml": "packages:\n  - packages/*\n",
    "/repo/package.json": PRIVATE_ROOT_WITHOUT_VERSION,
    "/repo/packages/bare/package.json": `{ "name": "@x/bare", "private": true }`,
    "/repo/packages/versioned/package.json": `{ "name": "@x/versioned", "version": "1.0.0" }`,
  };

  const nameHasOwnVersionTuples = (packages: ReadonlyArray<WorkspacePackage>) =>
    A.map(packages, (pkg) => [pkg.name, "version" in pkg, pkg.version] as const);

  it.effect("identical (name, hasOwn version, version) tuples, and one skip vocabulary", () =>
    Effect.gen(function* () {
      const handle = yield* MemoryFileSystem.makeHandle(paritySeed);
      const asyncPackages = yield* listPackagesViaDiscovery(handle);
      const syncPackages = getWorkspacePackagesSync("/repo", { fileSystem: handle.sync, path: hostPath.posix });

      assert.deepStrictEqual(
        A.map(asyncPackages, (pkg) => pkg.name),
        ["root", "@x/bare", "@x/versioned"],
        "positive control: both actually found the tree; comparing two empty arrays would pass under any implementation"
      );
      assert.deepStrictEqual(
        nameHasOwnVersionTuples(syncPackages),
        nameHasOwnVersionTuples(asyncPackages),
        "one seed read both ways, the Effect enumerator over the handle's pinned layer and the sync facade over its sync port, so a disagreement is a real divergence, not a fixture difference, which a separate real-directory fixture could not prove"
      );

      const nameless = yield* MemoryFileSystem.makeHandle({
        ...paritySeed,
        "/repo/packages/nameless/package.json": `{ "version": "1.0.0" }`,
      });
      const failure = yield* Effect.flip(listPackagesViaDiscovery(nameless));
      const skipped: Array<{ readonly path: string; readonly kind: string }> = [];
      getWorkspacePackagesSync("/repo", {
        fileSystem: nameless.sync,
        path: hostPath.posix,
        onSkip: (skip) => skipped.push({ path: skip.path, kind: skip.kind }),
      });
      assert.instanceOf(failure, WorkspaceDiscoveryError);
      assert.deepStrictEqual(
        skipped,
        [{ path: failure.path, kind: failure.kind }],
        "a nameless member fails the Effect surface with the kind the sync facade reports it under"
      );
    })
  );
});
