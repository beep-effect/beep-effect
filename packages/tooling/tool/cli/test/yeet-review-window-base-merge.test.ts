import { GraphqlBudgetPolicy } from "@beep/repo-cli/test/SharedInternals";
import {
  decideYeetGhMergeGate,
  layerYeetBaseMergeClassifierTest,
  layerYeetHeadMoveClassifierTest,
  RepoRunContext,
  readYeetGhGateFactsForTesting,
  readYeetReviewWindow,
  readYeetReviewWindowAsGhLogin,
  renderYeetReviewWindow,
  YeetBaseMergeUnchanged,
  YeetGhGateFacts,
  YeetHeadMoveChanged,
  YeetHeadMoveClassifier,
  YeetHeadMoveRequest,
  YeetHeadMoveUnknown,
  YeetReviewWindowCarry,
} from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import {
  provideBuilt,
  REPLAY_ROOT,
  recordedReplay,
  replayClassifier,
  replayPlatform,
  sha,
} from "./support/YeetBaseMergeReplay.ts";
import { recordedGithub, restPullRequest } from "./support/YeetGithub.ts";
import type { YeetBaseMerge, YeetReviewWindow } from "@beep/repo-cli/test/Yeet";
import type { BaseMergeReplay } from "./support/YeetBaseMergeReplay.ts";
import type { GithubAnswer } from "./support/YeetGithub.ts";

const noOverride = Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({}));
const millis = (iso: string) => DateTime.toEpochMillis(DateTime.makeUnsafe(iso));

// --- The proof, replayed from recorded git output -----------------------------------------------

const classifyBaseMerge = (replay: BaseMergeReplay, before: string, after: string, base: string) =>
  YeetHeadMoveClassifier.use((classifier) =>
    classifier.classifyBaseMerge(YeetHeadMoveRequest.make({ before, after, base }))
  ).pipe(provideBuilt(replayClassifier(replay)));

const changeOf = (verdict: YeetBaseMerge): string =>
  verdict._tag === "changed" ? `${verdict.change}: ${verdict.detail}` : verdict._tag;

describe("base-merge proof replay", () => {
  it.effect("a clean merge of the base keeps the pull request's patch identity", () =>
    Effect.gen(function* () {
      const verdict = yield* classifyBaseMerge(recordedReplay, sha.B, sha.H, sha.M);
      expect(verdict).toStrictEqual(
        YeetBaseMergeUnchanged.make({ before: sha.B, after: sha.H, base: sha.M, merged: sha.M })
      );
    })
  );

  it.effect.each([
    {
      name: "a conflicting merge of the base",
      after: sha.HC,
      base: sha.MC,
      change: "merge-conflict: The automatic merge of the base conflicts.",
    },
    {
      name: "an edit inside a clean merge commit",
      after: sha.HE,
      base: sha.M,
      change: "replay-tree: The merge commit's tree differs from the clean merge of the base.",
    },
    {
      name: "a clean merge that moves a context line of the pull request's hunk",
      after: sha.HX,
      base: sha.MX,
      change: "patch: The pull request's patch: src/feature.ts differs.",
    },
    {
      name: "a base that already carries the whole patch",
      after: sha.HF,
      base: sha.MF,
      change: "patch: The pull request's patch: raw entries differ at src/feature.ts, src/new.ts.",
    },
    {
      name: "a merged commit that is not on the synchronized base",
      after: sha.H,
      base: sha.O,
      change: "base-mismatch: The merged commit is not on the synchronized base.",
    },
  ])("refuses $name", ({ after, base, change }) =>
    Effect.gen(function* () {
      const verdict = yield* classifyBaseMerge(recordedReplay, sha.B, after, base);
      expect(changeOf(verdict)).toBe(change);
    })
  );

  it.effect("refuses a head that is not one merge commit on top of the old head", () =>
    Effect.gen(function* () {
      const notMerge = "not-base-merge: The new head is not one merge commit on top of the old head.";
      const single = yield* classifyBaseMerge(recordedReplay, sha.O, sha.B, sha.M);
      expect(changeOf(single)).toBe(notMerge);
      const otherParent = yield* classifyBaseMerge(recordedReplay, sha.HC, sha.H, sha.M);
      expect(changeOf(otherParent)).toBe(notMerge);
    })
  );

  it.effect("reads a shallow history or an unrecorded read as unknown, never unchanged", () =>
    Effect.gen(function* () {
      const shallow = yield* classifyBaseMerge({ ...recordedReplay, shallow: true }, sha.B, sha.H, sha.M);
      expect(shallow._tag).toBe("unknown");
      if (shallow._tag === "unknown") expect(shallow.reason).toContain("Base-merge evidence needs a full history.");
      const unreadable = yield* classifyBaseMerge({ ...recordedReplay, diffs: {} }, sha.B, sha.H, sha.M);
      expect(unreadable._tag).toBe("unknown");
    })
  );

  it.effect("probes merge commits locally, reading an unreadable commit as none", () =>
    Effect.gen(function* () {
      const probe = (commit: string) =>
        YeetHeadMoveClassifier.use((classifier) => classifier.isMergeCommit(commit)).pipe(
          provideBuilt(replayClassifier(recordedReplay))
        );
      const merge = yield* probe(sha.H);
      const single = yield* probe(sha.B);
      const unrecorded = yield* probe(sha.M);
      assertTrue(merge);
      assertFalse(single);
      assertFalse(unrecorded);
    })
  );

  it.effect("test classifiers answer the member they were not given a fixture for as unknown", () =>
    Effect.gen(function* () {
      const request = YeetHeadMoveRequest.make({ before: "b", after: "h", base: "s" });
      const rewrites = layerYeetHeadMoveClassifierTest((input) => YeetHeadMoveUnknown.make({ ...input, reason: "x" }));
      const merges = layerYeetBaseMergeClassifierTest((input) =>
        YeetHeadMoveChanged.make({ ...input, change: "merge-conflict", detail: "x" })
      );
      const fromRewrites = yield* YeetHeadMoveClassifier.use((classifier) =>
        Effect.all([classifier.classifyBaseMerge(request), classifier.isMergeCommit("h")])
      ).pipe(provideBuilt(rewrites));
      expect(fromRewrites).toMatchObject([{ _tag: "unknown", reason: "no base-merge fixture" }, false]);
      const fromMerges = yield* YeetHeadMoveClassifier.use((classifier) =>
        Effect.all([classifier.classify(request), classifier.isMergeCommit("h"), classifier.classifyBaseMerge(request)])
      ).pipe(provideBuilt(merges));
      expect(fromMerges).toMatchObject([{ _tag: "unknown", reason: "no rewrite fixture" }, true, { _tag: "changed" }]);
    })
  );
});

// --- The window, replayed from recorded GitHub reads -------------------------------------------

const PR = 77;
// Ready at 09:50; the pull request head B pushed at 10:05; the base merged in at 10:20.
const READY_AT = "2026-11-13T09:50:00Z";
const ROOT_PUSHED_AT = "2026-11-13T10:05:00Z";
const MERGE_PUSHED_AT = "2026-11-13T10:20:00Z";

interface WindowScene {
  readonly activity?: GithubAnswer;
  readonly base: string;
  readonly forcePushed?: boolean;
  readonly head: string;
  // Commits whose first check suite is the root push; every other commit's is the merge push.
  readonly roots?: ReadonlyArray<string>;
  // GitHub has no check suite for the root commit (its suites expired or were never created).
  readonly rootUnsuited?: boolean;
}

const pushRow = (before: string, after: string, timestamp: string) => ({
  activity_type: "push",
  before,
  after,
  timestamp,
});

// The branch was created at B, so a walk that wrongly carried past B would still find a root row.
const sceneActivity = (scene: WindowScene): GithubAnswer =>
  scene.activity ?? {
    body: [
      {
        ...pushRow(sha.B, scene.head, MERGE_PUSHED_AT),
        activity_type: scene.forcePushed === true ? "force_push" : "push",
      },
      { activity_type: "branch_creation", before: Str.repeat(40)("0"), after: sha.B, timestamp: ROOT_PUSHED_AT },
    ],
  };

const suiteAt = (scene: WindowScene, path: string): string =>
  A.some(scene.roots ?? [sha.B], (root) => Str.includes(root)(path)) ? ROOT_PUSHED_AT : MERGE_PUSHED_AT;

const sceneRoutes = (scene: WindowScene): Readonly<Record<string, GithubAnswer>> => ({
  [`{repo}/issues/${PR}/timeline`]: {
    body: [
      { event: "ready_for_review", created_at: READY_AT },
      ...(scene.forcePushed === true
        ? [{ event: "head_ref_force_pushed", created_at: MERGE_PUSHED_AT, commit_id: scene.head }]
        : []),
    ],
  },
  [`{repo}/pulls/${PR}`]: {
    body: restPullRequest({
      number: PR,
      head: { ref: "feat/window-anchor", sha: scene.head },
      base: { ref: "main", sha: scene.base },
    }),
  },
  "{repo}/activity": sceneActivity(scene),
  "{repo}/rules/branches/main": { body: [] },
  "{repo}/actions/runs": { body: { workflow_runs: [], total_count: 0 } },
});

const sceneGithub = (scene: WindowScene) =>
  recordedGithub((call) => {
    const fixed = R.get(sceneRoutes(scene), call.path);
    if (O.isSome(fixed)) return fixed.value;
    if (scene.rootUnsuited === true && Str.endsWith(`${sha.B}/check-suites`)(call.path))
      return { body: { check_suites: [] } };
    if (Str.endsWith("/check-suites")(call.path))
      return { body: { check_suites: [{ created_at: suiteAt(scene, call.path) }] } };
    if (Str.endsWith("/check-runs")(call.path)) return { body: { check_runs: [], total_count: 0 } };
    return undefined;
  });

const readScene = Effect.fn("BaseMergeWindowTest.readScene")(function* (
  scene: WindowScene,
  classifier: Layer.Layer<YeetHeadMoveClassifier>,
  now: string
) {
  yield* TestClock.setTime(millis(now));
  const github = sceneGithub(scene);
  const window = yield* readYeetReviewWindow({ prNumber: PR, headSha: scene.head }).pipe(
    github.provide,
    provideBuilt(classifier),
    noOverride
  );
  return { window, paths: A.map(github.calls, (call) => call.path) };
});

const carriedOf = (window: YeetReviewWindow) => (window._tag === "unknown" ? O.none() : window.carried);

describe("base-merge window replay", () => {
  it.effect("a clean merge of the base keeps the anchor at the pull request's earlier push", () =>
    Effect.gen(function* () {
      const { window } = yield* readScene(
        { head: sha.H, base: sha.M },
        replayClassifier(recordedReplay),
        "2026-11-13T10:27:00Z"
      );
      expect(window).toMatchObject({ _tag: "elapsed", anchor: "head-push", anchoredAt: "2026-11-13T10:05:00.000Z" });
      assertSome(carriedOf(window), YeetReviewWindowCarry.make({ rewrites: 0, merges: 1, rootSha: sha.B }));
      expect(renderYeetReviewWindow(window)).toBe(
        `review window elapsed (20 min after the last push at 2026-11-13T10:05:00.000Z); carried across 1 base merge(s) from ${sha.B}`
      );
    })
  );

  it.effect("counts a carried root without a check suite from its activity row", () =>
    Effect.gen(function* () {
      const { window } = yield* readScene(
        { head: sha.H, base: sha.M, rootUnsuited: true },
        replayClassifier(recordedReplay),
        "2026-11-13T10:24:00Z"
      );
      expect(window).toMatchObject({ _tag: "open", anchoredAt: "2026-11-13T10:05:00.000Z", remainingMs: 60_000 });
      assertSome(carriedOf(window), YeetReviewWindowCarry.make({ rewrites: 0, merges: 1, rootSha: sha.B }));
    })
  );

  it.effect("a merge whose conflict resolution touches the pull request's lines re-arms the window", () =>
    Effect.gen(function* () {
      const { window } = yield* readScene(
        { head: sha.HC, base: sha.MC },
        replayClassifier(recordedReplay),
        "2026-11-13T10:27:00Z"
      );
      expect(window).toMatchObject({ _tag: "open", anchoredAt: "2026-11-13T10:20:00.000Z", remainingMs: 13 * 60_000 });
      assertNone(carriedOf(window));
    })
  );

  it.effect.each([
    { name: "a shallow history", replay: { ...recordedReplay, shallow: true }, scene: {} },
    { name: "an activity read that fails", replay: recordedReplay, scene: { activity: { status: 503 } } },
    {
      name: "a push that did not move the branch from the merge's first parent",
      replay: recordedReplay,
      scene: {
        roots: [sha.HC],
        activity: {
          body: [
            pushRow(sha.HC, sha.H, MERGE_PUSHED_AT),
            { activity_type: "branch_creation", before: Str.repeat(40)("0"), after: sha.HC, timestamp: ROOT_PUSHED_AT },
          ],
        },
      },
    },
    { name: "a force-pushed merge", replay: recordedReplay, scene: { forcePushed: true } },
  ])("an unknown identity re-arms the window: $name", ({ replay, scene }) =>
    Effect.gen(function* () {
      const { window } = yield* readScene(
        { head: sha.H, base: sha.M, ...scene },
        replayClassifier(replay),
        "2026-11-13T10:27:00Z"
      );
      expect(window).toMatchObject({ _tag: "open", anchoredAt: "2026-11-13T10:20:00.000Z" });
      assertNone(carriedOf(window));
    })
  );

  it.effect("carries a chain of base merges to the first push that changed the patch", () =>
    Effect.gen(function* () {
      const second = "e2e2e2e2e2000000000000000000000000000000";
      const proven = layerYeetBaseMergeClassifierTest((request) =>
        request.before === sha.O
          ? YeetHeadMoveChanged.make({ ...request, change: "not-base-merge", detail: "B is a lane commit" })
          : YeetBaseMergeUnchanged.make({ ...request, merged: request.base })
      );
      const { window } = yield* readScene(
        {
          head: second,
          base: sha.M,
          activity: {
            body: [
              pushRow(sha.H, second, "2026-11-13T10:24:00Z"),
              pushRow(sha.B, sha.H, MERGE_PUSHED_AT),
              pushRow(sha.O, sha.B, ROOT_PUSHED_AT),
            ],
          },
        },
        proven,
        "2026-11-13T10:27:00Z"
      );
      expect(window).toMatchObject({ _tag: "elapsed", anchoredAt: "2026-11-13T10:05:00.000Z" });
      assertSome(carriedOf(window), YeetReviewWindowCarry.make({ rewrites: 0, merges: 2, rootSha: sha.B }));
    })
  );

  it.effect("spends no GitHub read on a base merge once the push no longer holds the window", () =>
    Effect.gen(function* () {
      const elapsed = yield* readScene(
        { head: sha.H, base: sha.M },
        replayClassifier(recordedReplay),
        "2026-11-13T10:41:00Z"
      );
      expect(elapsed.window).toMatchObject({ _tag: "elapsed", anchoredAt: "2026-11-13T10:20:00.000Z" });
      expect(A.some(elapsed.paths, (path) => path === "{repo}/activity")).toBe(false);
      const notMerge = yield* readScene(
        { head: sha.H, base: sha.M },
        layerYeetHeadMoveClassifierTest((request) => YeetHeadMoveUnknown.make({ ...request, reason: "x" })),
        "2026-11-13T10:27:00Z"
      );
      expect(notMerge.window).toMatchObject({ _tag: "open", anchoredAt: "2026-11-13T10:20:00.000Z" });
      expect(A.sort(notMerge.paths, Str.Order)).toStrictEqual([
        `{repo}/commits/${sha.H}/check-suites`,
        `{repo}/issues/${PR}/timeline`,
      ]);
    })
  );
});

describe("review-window carry schema", () => {
  it.effect("decodes a carry recorded before base merges counted, and refuses one with no step", () =>
    Effect.gen(function* () {
      const decode = S.decodeUnknownEffect(YeetReviewWindowCarry);
      const legacy = yield* decode({ rewrites: 2, rootSha: "root" });
      expect(legacy).toStrictEqual(YeetReviewWindowCarry.make({ rewrites: 2, merges: 0, rootSha: "root" }));
      const empty = yield* Effect.flip(decode({ rewrites: 0, merges: 0, rootSha: "root" }));
      expect(empty.message).toContain("A carry links at least one head move.");
    })
  );
});

// --- Every surface reads the same anchor ---------------------------------------------------------

const context = RepoRunContext.make({
  base: "origin/main",
  branch: "feat/window-anchor",
  cwd: REPLAY_ROOT,
  head: "HEAD",
  originalArgv: [],
  packetDir: ".beep/yeet",
  repoRoot: REPLAY_ROOT,
  turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
});

describe("base-merge anchor across surfaces", () => {
  it.effect("the REST merge gate and the gh-login status read share the carried anchor", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(millis("2026-11-13T10:27:00Z"));
      const scene = { head: sha.H, base: sha.M };
      const classifier = replayClassifier(recordedReplay);
      const facts = yield* readYeetGhGateFactsForTesting({
        number: PR,
        repoRoot: REPLAY_ROOT,
        pinnedSha: O.none(),
        tolerated: [],
        forceWindow: false,
        readThreads: false,
        policy: GraphqlBudgetPolicy.noWait,
      }).pipe(sceneGithub(scene).provide, provideBuilt(Layer.mergeAll(classifier, replayPlatform)), noOverride);
      assertSome(O.map(facts.headPushedAt, DateTime.formatIso), "2026-11-13T10:05:00.000Z");
      const gate = decideYeetGhMergeGate(
        YeetGhGateFacts.make({ ...facts, now: DateTime.makeUnsafe("2026-11-13T10:27:00Z") })
      );
      expect(A.some(gate.findings, (finding) => finding.reason === "review-window-open")).toBe(false);
      const status = yield* readYeetReviewWindowAsGhLogin(context, { prNumber: PR, headSha: sha.H }).pipe(
        sceneGithub(scene).provide,
        provideBuilt(Layer.mergeAll(classifier, replayPlatform)),
        noOverride
      );
      expect(status).toMatchObject({ _tag: "elapsed", anchoredAt: "2026-11-13T10:05:00.000Z" });
    })
  );
});
