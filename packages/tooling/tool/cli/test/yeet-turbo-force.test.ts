import { Git, GitCommandError } from "@beep/git/Git";
import { Lockfile } from "@beep/lockfiles/Lockfile";
import { ResolvedPackage } from "@beep/lockfiles/ResolvedPackage";
import {
  buildYeetRunPlanForTesting,
  collectTurboForceShadow,
  compareInstalledTrees,
  decideTurboForce,
  decodeYeetAttemptJournalEvent,
  InstalledTreesCompared,
  InstalledTreesLockfileUnchanged,
  PackageInstalledTreeChange,
  packageInstalledTreeDigests,
  RepoRunContext,
  ROOT_INSTALLED_TREE_PACKAGE,
  renderTurboForceReceipt,
  TurboForceDecision,
  TurboForceReason,
  TurboForceReceipt,
  TurboForceShadowComputed,
  TurboForceShadowUnavailable,
  turboForceReceiptFor,
  YeetAttemptJournalEvent,
  YeetAttemptStarted,
} from "@beep/repo-cli/test/Yeet";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import type { GitShape, GitStubs } from "@beep/git/Git";
import type { RepoPlanStep, TurboForceShadow, YeetRunMode } from "@beep/repo-cli/test/Yeet";

// A valid SRI integrity: sha512 over 64 bytes, base64-encoded.
const SRI = `sha512-${Str.repeat(21)("AQEB")}AQ==`;
const MERGE_BASE = "merge-base-commit";
const FORCE_LINE = "[yeet] bun.lock changed since origin/main; forcing dependency-sensitive lanes (TURBO_FORCE=true)";
const PATCH_FORCE_LINE =
  "[yeet] install inputs changed since origin/main (patches-changed); forcing dependency-sensitive lanes (TURBO_FORCE=true)";

// Root installs `tool` and the workspace `@x/a`, and declares an optional
// dependency the lockfile never installed. `@x/a` hoists `lib@1`, which needs
// `dep`; `@x/b` gets its own `lib@2` nested under it.
const lockfileText = (versions: { readonly tool: string; readonly nestedLib: string }): string => `{
  "lockfileVersion": 1,
  "workspaces": {
    "": {
      "name": "fixture-root",
      "devDependencies": { "tool": "${versions.tool}", "@x/a": "workspace:*", "absent-optional": "1.0.0" },
    },
    "packages/a": { "name": "@x/a", "dependencies": { "lib": "^1.0.0" } },
    "packages/b": { "name": "@x/b", "dependencies": { "lib": "^2.0.0", "@x/a": "workspace:*" } },
  },
  "packages": {
    "@x/a": ["@x/a@workspace:packages/a"],
    "@x/b": ["@x/b@workspace:packages/b"],
    "lib": ["lib@1.0.0", "", { "dependencies": { "dep": "^1.0.0" } }, "${SRI}"],
    "@x/b/lib": ["lib@${versions.nestedLib}", "", {}, "${SRI}"],
    "dep": ["dep@1.0.0", "", {}, "${SRI}"],
    "tool": ["tool@${versions.tool}", "", {}, "${SRI}"],
  }
}`;

const BASE_LOCK = lockfileText({ tool: "1.0.0", nestedLib: "2.0.0" });
const NESTED_BUMP_LOCK = lockfileText({ tool: "1.0.0", nestedLib: "2.1.0" });
const ROOT_BUMP_LOCK = lockfileText({ tool: "1.1.0", nestedLib: "2.0.0" });

const manifest = (policy: string): string => `{"name":"fixture-root","private":true${policy}}`;

type FileTree = Readonly<Record<string, string>>;

const BASE_TREE: FileTree = {
  "bun.lock": BASE_LOCK,
  "package.json": manifest(""),
  "patches/lib@1.0.0.patch": "--- a\n+++ b\n",
  "src/index.ts": "export {}\n",
};

const withFiles = (tree: FileTree, files: FileTree): FileTree => ({ ...tree, ...files });

const isUnderPathspec = (pathspec: ReadonlyArray<string>) => (path: string) =>
  A.isReadonlyArrayEmpty(pathspec) || A.some(pathspec, (spec) => path === spec || Str.startsWith(`${spec}/`)(path));

// The paths a three-dot diff from the merge base to HEAD lists, scoped like git's pathspec.
const changedPaths = (base: FileTree, head: FileTree, pathspec: ReadonlyArray<string>): ReadonlyArray<string> =>
  pipe(
    A.dedupe([...R.keys(base), ...R.keys(head)]),
    A.filter((path) => !Equal.equals(R.get(base, path), R.get(head, path))),
    A.filter(isUnderPathspec(pathspec)),
    A.sort(Order.String)
  );

// A repository whose merge base holds `base` and whose HEAD holds `head`.
const fakeRepository = (base: FileTree, head: FileTree, overrides: Partial<GitStubs> = {}) =>
  Git.makeTest({
    mergeBase: () => Effect.succeed(MERGE_BASE),
    changedFiles: (_cwd, options) => Effect.succeed(changedPaths(base, head, options.pathspec ?? [])),
    show: (_cwd, ref, path) => Effect.succeed(R.get(ref === MERGE_BASE ? base : head, path)),
    ...overrides,
  });

const gitFailure = GitCommandError.make({
  kind: "failed",
  args: ["diff"],
  cwd: "/repo",
  exitCode: 128,
  stderr: "fatal",
});

const context = RepoRunContext.make({
  base: "origin/main",
  branch: "feature",
  cwd: "/repo",
  head: "HEAD",
  originalArgv: [],
  packetDir: ".beep/yeet",
  repoRoot: "/repo",
  turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
});

// Digest comes from the `it.layer` block; each test hands in its own repository double.
const withRepository =
  (git: GitShape) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, Exclude<R, Git>> =>
    Effect.provideService(effect, Git, git);

const decisionBetween = (base: FileTree, head: FileTree, overrides: Partial<GitStubs> = {}) =>
  decideTurboForce(context, "verify").pipe(withRepository(fakeRepository(base, head, overrides)));

const decisionFor = (head: FileTree, overrides: Partial<GitStubs> = {}) => decisionBetween(BASE_TREE, head, overrides);

// The shadow a verify run records, over the same repository double its decision read.
const shadowBetween = (base: FileTree, head: FileTree, overrides: Partial<GitStubs> = {}) =>
  decideTurboForce(context, "verify").pipe(
    Effect.flatMap((decision) => collectTurboForceShadow(context, decision)),
    withRepository(fakeRepository(base, head, overrides))
  );

const shadowFor = (head: FileTree, overrides: Partial<GitStubs> = {}) => shadowBetween(BASE_TREE, head, overrides);

const receiptFor = (mode: YeetRunMode, head: FileTree, overrides: Partial<GitStubs> = {}) =>
  decideTurboForce(context, mode).pipe(
    Effect.flatMap((decision) => turboForceReceiptFor(context, mode, decision)),
    withRepository(fakeRepository(BASE_TREE, head, overrides))
  );

const PATCH_EDIT: FileTree = { "patches/lib@1.0.0.patch": "--- a\n+++ c\n" };

const digestsOf = (text: string) =>
  Lockfile.parse(text, { format: "bun" }).pipe(Effect.flatMap(packageInstalledTreeDigests));

const digestText = (text: string) => S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(text));

const changedNames = (compared: InstalledTreesCompared): ReadonlyArray<string> =>
  A.map(compared.changed, (change) => change.name);

const computedOf = (shadow: TurboForceShadow): O.Option<TurboForceShadowComputed> =>
  pipe(shadow, O.liftPredicate(S.is(TurboForceShadowComputed)));

const reasonsOf = (shadow: TurboForceShadow): O.Option<ReadonlyArray<TurboForceReason>> =>
  O.map(computedOf(shadow), (computed) => computed.reasons);

const changedNamesOf = (shadow: TurboForceShadow): O.Option<ReadonlyArray<string>> =>
  pipe(
    computedOf(shadow),
    O.map((computed) => computed.installedTrees),
    O.flatMap(O.liftPredicate(S.is(InstalledTreesCompared))),
    O.map(changedNames)
  );

const detailOf = (shadow: TurboForceShadow): O.Option<string> =>
  pipe(
    shadow,
    O.liftPredicate(S.is(TurboForceShadowUnavailable)),
    O.map((unavailable) => unavailable.detail)
  );

const lockfileUnchanged = InstalledTreesLockfileUnchanged.make({ kind: "lockfile-unchanged" });

// The lines an effect logs. Tests in one `it.layer` block share its test console.
const logsDuring = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
  const before = yield* TestConsole.logLines;
  const value = yield* effect;
  const after = yield* TestConsole.logLines;
  return [value, A.drop(after, A.length(before))] as const;
});

const ALL_MODES: ReadonlyArray<YeetRunMode> = ["repair", "verify", "publish", "monitor", "closeout", "status"];
const FORCE_DECIDING_MODES: ReadonlyArray<YeetRunMode> = ["repair", "verify", "publish"];

const forcedStepIds = (steps: ReadonlyArray<RepoPlanStep>): ReadonlyArray<string> =>
  pipe(
    steps,
    A.filter((step) => step.env?.TURBO_FORCE === "true"),
    A.map((step) => step.id)
  );

const forcedStepsFor = (mode: YeetRunMode, forceTurbo: boolean): ReadonlyArray<string> =>
  forcedStepIds(
    buildYeetRunPlanForTesting({ context, forceTurbo, message: O.some("feat(repo-cli): add yeet"), mode }).steps
  );

describe("TurboForceReason", () => {
  it("names the three reasons a run is forced or would be", () => {
    deepStrictEqual(
      [
        TurboForceReason.Enum["lockfile-changed"],
        TurboForceReason.Enum["patches-changed"],
        TurboForceReason.Enum["overrides-changed"],
      ],
      ["lockfile-changed", "patches-changed", "overrides-changed"]
    );
  });
});

it.layer(Digest.layerWebCrypto, { timeout: "30 seconds" })("packageInstalledTreeDigests", (it) => {
  it.effect("digests the sorted closure lines of every package, the root's closure folded into each", () =>
    Effect.gen(function* () {
      const digests = yield* digestsOf(BASE_LOCK);
      deepStrictEqual(pipe(HashMap.keys(digests), A.fromIterable, A.sort(Order.String)), [
        ROOT_INSTALLED_TREE_PACKAGE,
        "@x/a",
        "@x/b",
      ]);
      // The root reaches `tool`, the workspace `@x/a` and its hoisted `lib` and `dep`; the
      // optional dependency the lockfile never installed contributes no line.
      const rootLines = [
        "@x/a\0@x/a@0.0.0\0",
        `dep\0dep@1.0.0\0${SRI}`,
        `lib\0lib@1.0.0\0${SRI}`,
        `tool\0tool@1.0.0\0${SRI}`,
      ];
      const rootDigest = yield* digestText(A.join(rootLines, "\n"));
      assertSome(HashMap.get(digests, ROOT_INSTALLED_TREE_PACKAGE), rootDigest);
      // `@x/a` reaches nothing the root does not, so its tree is the root's.
      assertSome(HashMap.get(digests, "@x/a"), rootDigest);
      // `@x/b` adds its nested `lib@2`, keyed by its install position.
      const bDigest = yield* digestText(
        A.join(A.sort([...rootLines, `@x/b/lib\0lib@2.0.0\0${SRI}`], Order.String), "\n")
      );
      assertSome(HashMap.get(digests, "@x/b"), bDigest);
    })
  );

  it.effect("moves only the package whose nested dependency changed", () =>
    Effect.gen(function* () {
      const base = yield* digestsOf(BASE_LOCK);
      const head = yield* digestsOf(NESTED_BUMP_LOCK);
      deepStrictEqual(changedNames(compareInstalledTrees(base, head)), ["@x/b"]);
    })
  );

  it.effect("moves every package when a root dependency changes, because the root's tree is in each", () =>
    Effect.gen(function* () {
      const base = yield* digestsOf(BASE_LOCK);
      const head = yield* digestsOf(ROOT_BUMP_LOCK);
      deepStrictEqual(changedNames(compareInstalledTrees(base, head)), [ROOT_INSTALLED_TREE_PACKAGE, "@x/a", "@x/b"]);
    })
  );

  it.effect("digests a lockfile without a root importer from the workspace closures alone", () =>
    Effect.gen(function* () {
      const lockfile = Lockfile.make({
        format: "bun",
        lockfileVersion: "1",
        packages: [
          ResolvedPackage.make({
            name: "@x/solo",
            version: "0.0.0",
            instanceId: "@x/solo",
            isWorkspace: true,
            resolved: { leaf: "leaf" },
          }),
          ResolvedPackage.make({ name: "leaf", version: "3.0.0", instanceId: "leaf", isWorkspace: false }),
        ],
        workspaceDependencies: [],
      });
      const digests = yield* packageInstalledTreeDigests(lockfile);
      const empty = yield* digestText("");
      const solo = yield* digestText("leaf\0leaf@3.0.0\0");
      assertSome(HashMap.get(digests, ROOT_INSTALLED_TREE_PACKAGE), empty);
      assertSome(HashMap.get(digests, "@x/solo"), solo);
    })
  );
});

describe("compareInstalledTrees", () => {
  const a = Sha256Hex.make(Str.repeat(64)("a"));
  const b = Sha256Hex.make(Str.repeat(64)("b"));
  const c = Sha256Hex.make(Str.repeat(64)("c"));

  it("lists changed, added and removed packages in name order and counts every package", () => {
    const base = HashMap.make(["@x/kept", a], ["@x/moved", a], ["@x/removed", b]);
    const head = HashMap.make(["@x/kept", a], ["@x/moved", c], ["@x/added", b]);
    const compared = compareInstalledTrees(base, head);
    expect(compared.packages).toBe(4);
    deepStrictEqual(compared.changed, [
      PackageInstalledTreeChange.make({ name: "@x/added", head: O.some(b) }),
      PackageInstalledTreeChange.make({ name: "@x/moved", base: O.some(a), head: O.some(c) }),
      PackageInstalledTreeChange.make({ name: "@x/removed", base: O.some(b) }),
    ]);
  });

  it("has a data-last form", () => {
    const compared = pipe(HashMap.make(["@x/one", a]), compareInstalledTrees(HashMap.make(["@x/one", a])));
    deepStrictEqual(compared.changed, []);
    expect(compared.packages).toBe(1);
  });
});

it.layer(Digest.layerWebCrypto, { timeout: "30 seconds" })("collectTurboForceShadow", (it) => {
  it.effect("records no reason and never reads the merge base when no install input changed", () =>
    Effect.gen(function* () {
      // `mergeBase` dies when called, so the shadow must not need it.
      const shadow = yield* shadowFor(withFiles(BASE_TREE, { "src/index.ts": "export const x = 1\n" }), {
        mergeBase: () => Effect.die("merge base read"),
      });
      deepStrictEqual(
        shadow,
        TurboForceShadowComputed.make({ kind: "computed", reasons: [], installedTrees: lockfileUnchanged })
      );
    })
  );

  it.effect("keeps a patch-only commit's reason in the narrowed decision", () =>
    Effect.gen(function* () {
      const shadow = yield* shadowFor(withFiles(BASE_TREE, PATCH_EDIT));
      deepStrictEqual(
        shadow,
        TurboForceShadowComputed.make({
          kind: "computed",
          reasons: ["patches-changed"],
          installedTrees: lockfileUnchanged,
        })
      );
    })
  );

  it.effect("names overrides-changed for a root overrides or resolutions edit", () =>
    Effect.gen(function* () {
      const overrides = yield* shadowFor(
        withFiles(BASE_TREE, { "package.json": manifest(',"overrides":{"lib":"1.0.1"}') })
      );
      const resolutions = yield* shadowFor(
        withFiles(BASE_TREE, { "package.json": manifest(',"resolutions":{"lib":"1.0.1"}') })
      );
      assertSome(reasonsOf(overrides), ["overrides-changed"]);
      assertSome(reasonsOf(resolutions), ["overrides-changed"]);
    })
  );

  it.effect("names a patchedDependencies edit once, beside the patch file it adds", () =>
    Effect.gen(function* () {
      const shadow = yield* shadowFor(
        withFiles(BASE_TREE, {
          "package.json": manifest(',"patchedDependencies":{"dep@1.0.0":"patches/dep@1.0.0.patch"}'),
          "patches/dep@1.0.0.patch": "--- a\n+++ b\n",
        })
      );
      assertSome(reasonsOf(shadow), ["patches-changed"]);
    })
  );

  it.effect("names nothing for a root manifest edit outside the install policy", () =>
    Effect.gen(function* () {
      const shadow = yield* shadowFor(withFiles(BASE_TREE, { "package.json": manifest(',"scripts":{"x":"y"}') }));
      assertSome(reasonsOf(shadow), []);
    })
  );

  it.effect("reads a root manifest the merge base lacks as one without install policy", () =>
    Effect.gen(function* () {
      const shadow = yield* shadowBetween(
        R.remove(BASE_TREE, "package.json"),
        withFiles(BASE_TREE, { "package.json": manifest(',"overrides":{"lib":"1.0.1"}') })
      );
      assertSome(reasonsOf(shadow), ["overrides-changed"]);
    })
  );

  it.effect("compares the installed trees of a lockfile change, which the narrowed decision does not force", () =>
    Effect.gen(function* () {
      const shadow = yield* shadowFor(withFiles(BASE_TREE, { "bun.lock": NESTED_BUMP_LOCK }));
      assertSome(reasonsOf(shadow), []);
      assertSome(changedNamesOf(shadow), ["@x/b"]);
      assertSome(
        pipe(
          computedOf(shadow),
          O.map((computed) => computed.installedTrees),
          O.flatMap(O.liftPredicate(S.is(InstalledTreesCompared))),
          O.map((compared) => compared.packages)
        ),
        3
      );
    })
  );

  it.effect("records both a lockfile comparison and an override reason", () =>
    Effect.gen(function* () {
      const shadow = yield* shadowFor(
        withFiles(BASE_TREE, { "bun.lock": ROOT_BUMP_LOCK, "package.json": manifest(',"overrides":{"tool":"1.1.0"}') })
      );
      assertSome(reasonsOf(shadow), ["overrides-changed"]);
      assertSome(changedNamesOf(shadow), [ROOT_INSTALLED_TREE_PACKAGE, "@x/a", "@x/b"]);
    })
  );

  it.effect("is unavailable, never failing, when an input cannot be read", () =>
    Effect.gen(function* () {
      const lockHead = withFiles(BASE_TREE, { "bun.lock": NESTED_BUMP_LOCK });
      const diffFailed = yield* shadowFor(lockHead, { changedFiles: () => Effect.fail(gitFailure) });
      const mergeBaseFailed = yield* shadowFor(lockHead, { mergeBase: () => Effect.fail(gitFailure) });
      const lockAbsent = yield* shadowBetween(R.remove(BASE_TREE, "bun.lock"), lockHead);
      const lockUnparseable = yield* shadowFor(withFiles(BASE_TREE, { "bun.lock": "{ not a lockfile" }));
      const manifestUnparseable = yield* shadowFor(withFiles(BASE_TREE, { "package.json": "{ not json" }));
      deepStrictEqual(
        A.map([diffFailed, mergeBaseFailed, lockAbsent, lockUnparseable, manifestUnparseable], detailOf),
        A.map(
          [
            "git diff --name-only -z --no-relative origin/main...HEAD -- bun.lock patches package.json failed with exit code 128.",
            "git merge-base origin/main HEAD failed with exit code 128.",
            `bun.lock is absent at ${MERGE_BASE}.`,
            "Failed to parse bun.lock at HEAD.",
            "Failed to read the root package.json at HEAD.",
          ],
          O.some
        )
      );
    })
  );
});

describe("decideTurboForce", () => {
  it.effect("never reads git in a mode that does not force", () =>
    Effect.gen(function* () {
      // An unstubbed double dies on any read.
      const decisions = yield* Effect.forEach(["monitor", "closeout", "status"] as const, (mode) =>
        decideTurboForce(context, mode).pipe(Effect.provideService(Git, Git.makeTest({})))
      );
      deepStrictEqual(
        A.map(decisions, (decision) => decision.reasons),
        [[], [], []]
      );
    })
  );

  it.effect("forces a lockfile change with the line it always printed", () =>
    Effect.gen(function* () {
      const forced = yield* decisionFor(withFiles(BASE_TREE, { "bun.lock": NESTED_BUMP_LOCK }));
      const logged = yield* TestConsole.logLines;
      const unforced = yield* decisionFor(BASE_TREE);
      deepStrictEqual(forced.reasons, ["lockfile-changed"]);
      assertSome(forced.mergeBase, MERGE_BASE);
      deepStrictEqual(unforced.reasons, []);
      deepStrictEqual(logged, [FORCE_LINE]);
    })
  );

  // #2873 (d8ef9b3839b) changed only a patch file; the lockfile check never forced it.
  it.effect("forces a patch-only commit, as #2873 was, and names its reason", () =>
    Effect.gen(function* () {
      const decision = yield* decisionFor(withFiles(BASE_TREE, PATCH_EDIT), {
        mergeBase: () => Effect.die("merge base read"),
      });
      const logged = yield* TestConsole.logLines;
      deepStrictEqual(decision.reasons, ["patches-changed"]);
      deepStrictEqual(logged, [PATCH_FORCE_LINE]);
    })
  );

  it.effect("forces nothing when the diff fails, as the lockfile check read it", () =>
    Effect.gen(function* () {
      const decision = yield* decisionFor(withFiles(BASE_TREE, { "bun.lock": NESTED_BUMP_LOCK }), {
        changedFiles: () => Effect.fail(gitFailure),
      });
      const logged = yield* TestConsole.logLines;
      deepStrictEqual(decision.reasons, []);
      assertSome(
        decision.unreadable,
        "git diff --name-only -z --no-relative origin/main...HEAD -- bun.lock patches package.json failed with exit code 128."
      );
      deepStrictEqual(logged, []);
    })
  );

  it.effect("keeps the path triggers when the merge base or root manifest cannot be read", () =>
    Effect.gen(function* () {
      const lockfile = yield* decisionFor(withFiles(BASE_TREE, { "bun.lock": NESTED_BUMP_LOCK }), {
        mergeBase: () => Effect.fail(gitFailure),
      });
      const patchAndManifest = yield* decisionFor(
        withFiles(BASE_TREE, { ...PATCH_EDIT, "package.json": "{ not json" })
      );
      deepStrictEqual(lockfile.reasons, ["lockfile-changed"]);
      assertSome(lockfile.unreadable, "git merge-base origin/main HEAD failed with exit code 128.");
      deepStrictEqual(patchAndManifest.reasons, ["patches-changed"]);
      assertSome(patchAndManifest.unreadable, "Failed to read the root package.json at HEAD.");
    })
  );

  // Before this slice repair, verify and publish forced exactly when the
  // three-dot diff listed bun.lock, and other modes never forced. The slice
  // adds the patch and override triggers and changes nothing else.
  const scenarios: ReadonlyArray<readonly [string, FileTree, ReadonlyArray<TurboForceReason>]> = [
    ["no install input", withFiles(BASE_TREE, { "src/index.ts": "export const x = 1\n" }), []],
    [
      "root manifest edit outside the install policy",
      withFiles(BASE_TREE, { "package.json": manifest(',"scripts":{"x":"y"}') }),
      [],
    ],
    ["lockfile only", withFiles(BASE_TREE, { "bun.lock": NESTED_BUMP_LOCK }), ["lockfile-changed"]],
    [
      "lockfile and patch",
      withFiles(BASE_TREE, { "bun.lock": ROOT_BUMP_LOCK, ...PATCH_EDIT }),
      ["lockfile-changed", "patches-changed"],
    ],
    ["patch only, as #2873 (d8ef9b3839b) was", withFiles(BASE_TREE, PATCH_EDIT), ["patches-changed"]],
    [
      "patchedDependencies only",
      withFiles(BASE_TREE, {
        "package.json": manifest(',"patchedDependencies":{"lib@1.0.0":"patches/lib@1.0.0.patch"}'),
      }),
      ["patches-changed"],
    ],
    [
      "overrides only",
      withFiles(BASE_TREE, { "package.json": manifest(',"overrides":{"lib":"1.0.1"}') }),
      ["overrides-changed"],
    ],
    [
      "resolutions only",
      withFiles(BASE_TREE, { "package.json": manifest(',"resolutions":{"lib":"1.0.1"}') }),
      ["overrides-changed"],
    ],
  ];

  // One scenario in one mode: the reasons it records, whether it forces, and which steps.
  const checkForcedSet = Effect.fnUntraced(function* (
    [name, head, reasons]: readonly [string, FileTree, ReadonlyArray<TurboForceReason>],
    mode: YeetRunMode
  ) {
    const deciding = A.contains(FORCE_DECIDING_MODES, mode);
    const legacy = deciding && A.isReadonlyArrayNonEmpty(changedPaths(BASE_TREE, head, ["bun.lock"]));
    const decision = yield* decideTurboForce(context, mode).pipe(
      Effect.provideService(Git, fakeRepository(BASE_TREE, head))
    );
    const forced = A.isReadonlyArrayNonEmpty(decision.reasons);
    const expected = deciding ? reasons : [];
    expect({ name, mode, reasons: decision.reasons }).toStrictEqual({ name, mode, reasons: expected });
    // Every run the lockfile check forced is still forced; the only additions are the new triggers.
    expect({ name, mode, forced }).toStrictEqual({ name, mode, forced: legacy || A.isReadonlyArrayNonEmpty(expected) });
    // A forced run forces the same steps a lockfile force always did.
    deepStrictEqual(forcedStepsFor(mode, forced), forced ? forcedStepsFor(mode, true) : []);
  });

  it.effect("widens the forced set only by the patch and override triggers, for every mode", () =>
    Effect.gen(function* () {
      yield* Effect.forEach(
        A.flatMap(scenarios, (scenario) => A.map(ALL_MODES, (mode) => [scenario, mode] as const)),
        ([scenario, mode]) => checkForcedSet(scenario, mode),
        { discard: true }
      );
      expect(A.isReadonlyArrayNonEmpty(forcedStepsFor("verify", true))).toBe(true);
    })
  );
});

it.layer(Digest.layerWebCrypto, { timeout: "30 seconds" })("turboForceReceiptFor", (it) => {
  it.effect("records nothing for a mode that never forces", () =>
    Effect.gen(function* () {
      const receipt = yield* turboForceReceiptFor(
        context,
        "monitor",
        TurboForceDecision.make({ reasons: ["lockfile-changed"] })
      ).pipe(withRepository(Git.makeTest({})));
      assertNone(receipt);
    })
  );

  it.effect("names the lockfile reason on a forced attempt and logs the shadow beside it", () =>
    Effect.gen(function* () {
      const [receipt, logged] = yield* logsDuring(
        receiptFor("publish", withFiles(BASE_TREE, { "bun.lock": NESTED_BUMP_LOCK }))
      );
      assertSome(
        O.map(receipt, (value) => value.reasons),
        ["lockfile-changed"]
      );
      assertSome(
        O.flatMap(receipt, (value) => changedNamesOf(value.shadow)),
        ["@x/b"]
      );
      deepStrictEqual(logged, [
        FORCE_LINE,
        "[yeet] turbo force shadow: actual forced (lockfile-changed); narrowed not forced; installed tree changed in 1 of 3 package(s)",
      ]);
    })
  );

  it.effect("records a quiet attempt without logging it", () =>
    Effect.gen(function* () {
      const [receipt, logged] = yield* logsDuring(receiptFor("repair", BASE_TREE));
      assertSome(
        receipt,
        TurboForceReceipt.make({
          reasons: [],
          shadow: TurboForceShadowComputed.make({ kind: "computed", reasons: [], installedTrees: lockfileUnchanged }),
        })
      );
      deepStrictEqual(logged, []);
    })
  );

  it.effect("records a forced patch-only attempt with its reason in both decisions", () =>
    Effect.gen(function* () {
      const [receipt, logged] = yield* logsDuring(receiptFor("verify", withFiles(BASE_TREE, PATCH_EDIT)));
      assertSome(
        O.map(receipt, (value) => value.reasons),
        ["patches-changed"]
      );
      deepStrictEqual(logged, [
        PATCH_FORCE_LINE,
        "[yeet] turbo force shadow: actual forced (patches-changed); narrowed forced (patches-changed); lockfile unchanged",
      ]);
    })
  );

  it.effect("logs an unavailable shadow", () =>
    Effect.gen(function* () {
      const [, logged] = yield* logsDuring(
        receiptFor("verify", BASE_TREE, { changedFiles: () => Effect.fail(gitFailure) })
      );
      deepStrictEqual(logged, [
        "[yeet] turbo force shadow: actual not forced; narrowed unavailable (git diff --name-only -z --no-relative origin/main...HEAD -- bun.lock patches package.json failed with exit code 128.)",
      ]);
    })
  );
});

describe("renderTurboForceReceipt", () => {
  it("renders the comparison count of a forced lockfile attempt", () => {
    const line = renderTurboForceReceipt(
      TurboForceReceipt.make({
        reasons: ["lockfile-changed"],
        shadow: TurboForceShadowComputed.make({
          kind: "computed",
          reasons: ["patches-changed", "overrides-changed"],
          installedTrees: InstalledTreesCompared.make({ kind: "compared", packages: 5, changed: [] }),
        }),
      })
    );
    expect(line).toBe(
      "turbo force shadow: actual forced (lockfile-changed); narrowed forced (patches-changed, overrides-changed); installed tree changed in 0 of 5 package(s)"
    );
  });
});

const encodeEvent = S.encodeUnknownEffect(S.fromJsonString(YeetAttemptJournalEvent));

describe("attempt journal turboForce", () => {
  // An attempt-started row as revisions before the field wrote it.
  const OLD_STARTED_ROW = `{"_tag":"attempt-started","schemaVersion":"yeet-attempt-journal/v1","attemptId":"550e8400-e29b-41d4-a716-446655440000","runId":"feature-0123456789ab","branch":"feature","base":"origin/main","head":"${Str.repeat(40)("a")}","mode":"publish","startedAt":"2026-11-12T00:00:00.000Z"}`;

  it.effect("decodes a row written before the field with it absent, and round-trips a recorded receipt", () =>
    Effect.gen(function* () {
      const old = yield* decodeYeetAttemptJournalEvent(OLD_STARTED_ROW);
      const started = O.getOrThrow(pipe(old, O.liftPredicate(YeetAttemptJournalEvent.guards["attempt-started"])));
      assertNone(started.turboForce);
      const receipt = TurboForceReceipt.make({
        reasons: ["lockfile-changed"],
        shadow: TurboForceShadowComputed.make({
          kind: "computed",
          reasons: ["patches-changed"],
          installedTrees: InstalledTreesCompared.make({
            kind: "compared",
            packages: 2,
            changed: [
              PackageInstalledTreeChange.make({
                name: "@x/b",
                base: O.some(Sha256Hex.make(Str.repeat(64)("a"))),
                head: O.some(Sha256Hex.make(Str.repeat(64)("b"))),
              }),
            ],
          }),
        }),
      });
      const line = yield* encodeEvent(YeetAttemptStarted.make({ ...started, turboForce: O.some(receipt) }));
      expect(line).toContain('"turboForce":{"reasons":["lockfile-changed"]');
      const decoded = yield* decodeYeetAttemptJournalEvent(line);
      const roundTripped = pipe(
        decoded,
        O.liftPredicate(YeetAttemptJournalEvent.guards["attempt-started"]),
        O.flatMap((row) => row.turboForce)
      );
      assertSome(
        O.map(roundTripped, (value) => value.reasons),
        ["lockfile-changed"]
      );
      assertSome(
        O.flatMap(roundTripped, (value) => reasonsOf(value.shadow)),
        ["patches-changed"]
      );
      assertSome(
        O.flatMap(roundTripped, (value) => changedNamesOf(value.shadow)),
        ["@x/b"]
      );
    })
  );
});
