/**
 * Recorded git answers for base-merge proofs, replayed without a checkout.
 *
 * Recorded 2026-11-13 with git 2.56.1 from a scratch repository: `O` holds a
 * 30-line `src/feature.ts`; the pull request commit `B` changes its line 20
 * and adds `src/new.ts`. `M` moves the base by inserting four header lines
 * (shifting the PR hunk) and editing `README.md`; `H` is `git merge main` on
 * `B`. `MC` edits line 20 on the base, so merging it conflicts, and `HC`
 * resolves the conflict keeping the PR's line. `MX` edits line 18, two lines
 * above the PR's hunk (a clean merge `HX` that moves the hunk's context). `MF`
 * already carries the whole PR patch (`HF`). `HE` is the clean merge of `M`
 * plus an extra edit to `README.md` inside the merge commit. Every output
 * below is git's own, byte for byte; the Git kit members answer from the
 * same recording through `Git.layerTest`, and the argv-level reads (`show`,
 * `diff-tree`, `diff`) through the `ScriptedSpawner`. A replayed checkout can
 * lack commits until a `git fetch`, which it answers by bringing them all,
 * failing, or hanging, and its spawner records every process it was asked to run.
 */
import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Git, GitCommandError, MergeTreeResult } from "@beep/git/Git";
import { YeetHeadMoveClassifier } from "@beep/repo-cli/test/Yeet";
import * as A from "effect/Array";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

/** The replay's checkout root; nothing reads it, every answer is recorded. */
export const REPLAY_ROOT = "/replay/base-merge";

/** The recorded commit ids. */
export const sha = {
  O: "17e0e0702bdabef365ae615a5b0cdcbbf7c1e0e5",
  B: "001e8248d697063f5ee37043e4b4b6dcc3d5c7b2",
  M: "448c3dea83ab7527c45a8d690df73fdd2e332a85",
  MC: "ae86bac161b4bb3fabbc314688722a51334934bc",
  MX: "aa3f8ce3ef411908563f89ad217e916d04d65564",
  MF: "28ab9a076d4e206f59ce6d7ca5556b3ba6c5b9ea",
  H: "2e7d57afd9f38e24507aca50d6fe9eabbd12cb75",
  HC: "13ded25d33a5560be03807b535d86b8beee4e050",
  HX: "6fe315196a4e81ce5abbe5b06ce23258619401ed",
  HF: "83cedc47f8f9c814fb4095952371cb79c530bb7e",
  HE: "409ed9fe8e31861d88c9c55ad037974d87a4bb40",
} as const;

const featureOld = `diff --git a/src/feature.ts b/src/feature.ts
index ad7250d4ce646a6242adffe777ae898cebafeb9f..00a768d934b5388addb2630655ba994ae4c06d87 100644
--- a/src/feature.ts
+++ b/src/feature.ts
@@ -17,7 +17,7 @@ export const line16 = 16;
 export const line17 = 17;
 export const line18 = 18;
 export const line19 = 19;
-export const line20 = 20;
+export const line20 = 2020;
 export const line21 = 21;
 export const line22 = 22;
 export const line23 = 23;
`;

// The same edit four lines lower: only the hunk header and the blob ids moved.
const featureMerged = `diff --git a/src/feature.ts b/src/feature.ts
index 3918cde5ceedbf01e46fab2395beca387879b4aa..800224baed0612b96302312ad8b320f9245cfa56 100644
--- a/src/feature.ts
+++ b/src/feature.ts
@@ -21,7 +21,7 @@ export const line16 = 16;
 export const line17 = 17;
 export const line18 = 18;
 export const line19 = 19;
-export const line20 = 20;
+export const line20 = 2020;
 export const line21 = 21;
 export const line22 = 22;
 export const line23 = 23;
`;

// The base edited a context line of the PR hunk: the PR's own lines are equal, the context is not.
const featureContext = `diff --git a/src/feature.ts b/src/feature.ts
index b6552804c4026965225bd1a1ce4963e1491bae24..66d8187d24fc80d6ebd9c147b3bd39ccf7ec75b0 100644
--- a/src/feature.ts
+++ b/src/feature.ts
@@ -17,7 +17,7 @@ export const line16 = 16;
 export const line17 = 17;
 export const line18 = 1818;
 export const line19 = 19;
-export const line20 = 20;
+export const line20 = 2020;
 export const line21 = 21;
 export const line22 = 22;
 export const line23 = 23;
`;

const newFile = `diff --git a/src/new.ts b/src/new.ts
new file mode 100644
index 0000000000000000000000000000000000000000..4d6969757eccb15b5653fb9857ca47d338f5b0cc
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1 @@
+export const added = true;
`;

const entries = (featureBlobs: string) =>
  `:100644 100644 ${featureBlobs} M\0src/feature.ts\0:000000 100644 0000000000000000000000000000000000000000 4d6969757eccb15b5653fb9857ca47d338f5b0cc A\0src/new.ts\0`;

/** Everything one replay answers, keyed by the arguments git received. */
export interface BaseMergeReplay {
  /** `<ancestor> <descendant>` pairs `merge-base --is-ancestor` accepts. */
  readonly ancestors: ReadonlyArray<string>;
  /** Per-path `diff` output by `<from> <to> <path>`. */
  readonly diffs: Readonly<Record<string, string>>;
  /** `diff-tree --raw -z` output by `<from> <to>`. */
  readonly diffTrees: Readonly<Record<string, string>>;
  /** `merge-base` answers by `<a> <b>`. */
  readonly mergeBases: Readonly<Record<string, string>>;
  /** `merge-tree` answers by `<ours> <theirs>`. */
  readonly mergeTrees: Readonly<Record<string, MergeTreeResult>>;
  /** `show -s --format=%P <sha>` output by commit. */
  readonly parents: Readonly<Record<string, string>>;
  /** `rev-parse <ref>` answers. */
  readonly revisions: Readonly<Record<string, string>>;
  readonly shallow: boolean;
}

const clean = (tree: string) => MergeTreeResult.cases.clean.make({ tree });

/** The recording: every scenario's answers in one checkout, as git gave them. */
export const recordedReplay: BaseMergeReplay = {
  parents: {
    [sha.B]: sha.O,
    [sha.H]: `${sha.B} ${sha.M}`,
    [sha.HC]: `${sha.B} ${sha.MC}`,
    [sha.HX]: `${sha.B} ${sha.MX}`,
    [sha.HF]: `${sha.B} ${sha.MF}`,
    [sha.HE]: `${sha.B} ${sha.M}`,
  },
  ancestors: A.map([sha.M, sha.MC, sha.MX, sha.MF], (merged) => `${merged} ${merged}`),
  mergeTrees: {
    [`${sha.B} ${sha.M}`]: clean("23cb658e7bc82793bea1863f694f294a366788af"),
    [`${sha.B} ${sha.MC}`]: MergeTreeResult.cases.conflicted.make({
      tree: "b885fc35bd6bf4488c2585f0f3b0a6370eb1db0e",
      paths: ["src/feature.ts"],
      messages: ["Auto-merging src/feature.ts", "CONFLICT (content): Merge conflict in src/feature.ts"],
    }),
    [`${sha.B} ${sha.MX}`]: clean("ac0979ac47108368d31e3e840d9d209de6bcc288"),
    [`${sha.B} ${sha.MF}`]: clean("01398e242e5cd9bac25600c8333bde60932ecef4"),
  },
  revisions: {
    [`${sha.H}^{tree}`]: "23cb658e7bc82793bea1863f694f294a366788af",
    [`${sha.HX}^{tree}`]: "ac0979ac47108368d31e3e840d9d209de6bcc288",
    [`${sha.HF}^{tree}`]: "01398e242e5cd9bac25600c8333bde60932ecef4",
    [`${sha.HE}^{tree}`]: "b510f7ae1870e9509114c310e756484124c7f2e9",
  },
  mergeBases: {
    [`${sha.M} ${sha.B}`]: sha.O,
    [`${sha.M} ${sha.H}`]: sha.M,
    [`${sha.MX} ${sha.B}`]: sha.O,
    [`${sha.MX} ${sha.HX}`]: sha.MX,
    [`${sha.MF} ${sha.B}`]: sha.O,
    [`${sha.MF} ${sha.HF}`]: sha.MF,
  },
  diffTrees: {
    [`${sha.O} ${sha.B}`]: entries("ad7250d4ce646a6242adffe777ae898cebafeb9f 00a768d934b5388addb2630655ba994ae4c06d87"),
    [`${sha.M} ${sha.H}`]: entries("3918cde5ceedbf01e46fab2395beca387879b4aa 800224baed0612b96302312ad8b320f9245cfa56"),
    [`${sha.MX} ${sha.HX}`]: entries(
      "b6552804c4026965225bd1a1ce4963e1491bae24 66d8187d24fc80d6ebd9c147b3bd39ccf7ec75b0"
    ),
    [`${sha.MF} ${sha.HF}`]: "",
  },
  diffs: {
    [`${sha.O} ${sha.B} src/feature.ts`]: featureOld,
    [`${sha.O} ${sha.B} src/new.ts`]: newFile,
    [`${sha.M} ${sha.H} src/feature.ts`]: featureMerged,
    [`${sha.M} ${sha.H} src/new.ts`]: newFile,
    [`${sha.MX} ${sha.HX} src/feature.ts`]: featureContext,
    [`${sha.MX} ${sha.HX} src/new.ts`]: newFile,
  },
  shallow: false,
};

const unrecorded = (args: ReadonlyArray<string>) =>
  GitCommandError.make({ kind: "failed", args, cwd: REPLAY_ROOT, exitCode: 128, stderr: "fatal: not recorded" });

const answer = <V>(table: Readonly<Record<string, V>>, key: string, args: ReadonlyArray<string>) =>
  Effect.fromOption(R.get(table, key)).pipe(Effect.mapError(() => unrecorded(args)));

/** What a replayed checkout answers from: the recording, its root, and what its object store lacks. */
interface CheckoutState {
  /** Commits not in the local object store; a fetch that succeeds brings them all. */
  readonly absent: MutableHashSet.MutableHashSet<string>;
  readonly fetchFails: boolean;
  readonly fetchHangs: boolean;
  readonly replay: BaseMergeReplay;
  readonly root: string;
}

/** One replayed checkout, with the scripted spawner whose `spawns` list every `git` process it ran. */
export interface ReplayCheckout extends CheckoutState {
  readonly spawner: ScriptedSpawner;
}

const isLocal = (state: CheckoutState, sha: string): boolean => !MutableHashSet.has(state.absent, sha);

// `show -s --format=%P <sha>` prints the parents and a newline (and fails for an absent commit);
// `diff-tree ... <from> <to> --` and `diff ... <from> <to> -- <path>` print exactly what was recorded.
const rawRead = (state: CheckoutState, args: ReadonlyArray<string>): O.Option<string> => {
  if (A.contains(args, "show"))
    return O.map(
      O.flatMap(
        O.filter(A.last(args), (commit) => isLocal(state, commit)),
        (commit) => R.get(state.replay.parents, commit)
      ),
      (parents) => `${parents}\n`
    );
  if (A.contains(args, "diff-tree")) {
    const [from, to] = A.takeRight(args, 3);
    return R.get(state.replay.diffTrees, `${from} ${to}`);
  }
  const [from, to, , path] = A.takeRight(args, 4);
  return R.get(state.replay.diffs, `${from} ${to} ${path}`);
};

// A fetch from origin hangs, fails, or brings every commit the checkout lacked.
const fetchAnswer = (state: CheckoutState) => {
  if (state.fetchHangs) return { hang: true };
  if (state.fetchFails) return { stderr: "fatal: unable to access origin", exit: 128 };
  MutableHashSet.clear(state.absent);
  return {};
};

const scriptFor = (state: CheckoutState) => (_command: string, args: ReadonlyArray<string>) =>
  O.contains(A.head(args), "fetch")
    ? fetchAnswer(state)
    : O.match(rawRead(state, args), {
        onNone: () => ({ stderr: `fatal: not recorded: ${A.join(args, " ")}`, exit: 128 }),
        onSome: (stdout) => ({ stdout }),
      });

/**
 * A replayed checkout of the recording.
 *
 * **Details**
 *
 * By default it answers for {@link REPLAY_ROOT} with every recorded commit
 * local. A suite that fetches passes a root of its own, because the classifier
 * fetches an object at most once per head per checkout per process.
 */
export const replayCheckout = (
  options: {
    readonly replay?: BaseMergeReplay;
    readonly root?: string;
    readonly absent?: ReadonlyArray<string>;
    readonly fetchFails?: boolean;
    readonly fetchHangs?: boolean;
  } = {}
): ReplayCheckout => {
  const state: CheckoutState = {
    replay: options.replay ?? recordedReplay,
    root: options.root ?? REPLAY_ROOT,
    absent: MutableHashSet.fromIterable(options.absent ?? []),
    fetchFails: options.fetchFails ?? false,
    fetchHangs: options.fetchHangs ?? false,
  };
  return { ...state, spawner: ScriptedSpawner.make(scriptFor(state)) };
};

/** The `git fetch` argv lists a checkout ran, in order. */
export const fetchesOf = (checkout: ReplayCheckout): ReadonlyArray<ReadonlyArray<string>> =>
  A.filter(
    A.map(checkout.spawner.spawns, (spawn) => spawn.args),
    (args) => O.contains(A.head(args), "fetch")
  );

/** The Git kit members a base-merge proof reads, answered from a replayed checkout. */
const replayGit = (checkout: ReplayCheckout) =>
  Git.layerTest({
    configGet: () => Effect.succeedNone,
    refExists: (_cwd, ref) => Effect.succeed(isLocal(checkout, A.headNonEmpty(Str.split(ref, "^")))),
    isShallow: () => Effect.succeed(checkout.replay.shallow),
    isAncestor: (_cwd, ancestor, descendant) =>
      Effect.succeed(A.contains(checkout.replay.ancestors, `${ancestor} ${descendant}`)),
    mergeTree: (_cwd, ours, theirs) =>
      answer(checkout.replay.mergeTrees, `${ours} ${theirs}`, ["merge-tree", ours, theirs]),
    revParse: (_cwd, ref) => answer(checkout.replay.revisions, ref, ["rev-parse", ref]),
    mergeBase: (_cwd, a, b) => answer(checkout.replay.mergeBases, `${a} ${b}`, ["merge-base", a, b]),
  });

/** A deterministic `SecureRandom` for the scripted child processes. */
const replaySecureRandom = Layer.succeed(
  SecureRandom.SecureRandom,
  SecureRandom.make((size) => new Uint8Array(size))
);

/** The real classifier over a replayed checkout: no repository, no network, no clock. */
export const replayClassifier = (checkout: ReplayCheckout): Layer.Layer<YeetHeadMoveClassifier> =>
  YeetHeadMoveClassifier.layer(checkout.root).pipe(
    Layer.provide(Layer.mergeAll(replayGit(checkout), checkout.spawner.layer, replaySecureRandom))
  );

/**
 * The services a gh-login surface asks for beside GitHub: a silent spawner and
 * the deterministic `SecureRandom`, so no `gh` or `git` process ever runs.
 */
export const replayPlatform: Layer.Layer<ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom> =
  Layer.mergeAll(ScriptedSpawner.make(() => ({})).layer, replaySecureRandom);

/**
 * Provide built layers to one effect, the way the suites hand doubles to a read
 * (`Layer.build` in a scope of its own, then `Effect.provideContext`).
 */
export const provideBuilt =
  <ROut>(layer: Layer.Layer<ROut>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, Exclude<R, ROut>> =>
    Effect.scopedWith((scope) =>
      Effect.flatMap(Layer.buildWithScope(layer, scope), (context) => Effect.provideContext(effect, context))
    );
