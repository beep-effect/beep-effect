import {
  GoalFinalPullRequestCandidate,
  GoalFinalPullRequestResolver,
  GoalFinalPullRequestState,
  goalFinalPullRequestResolver,
} from "@beep/repo-cli/commands/Goals/FinalPullRequest";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import { scriptedSpawner, withLayer } from "./support/GithubLedgerFakes.ts";
import type { ScriptedProcess } from "./support/GithubLedgerFakes.ts";

const BRANCH_LINE = "gh pr view --json number,state,headRefName";
const NUMBER_LINE = "gh pr view 12 --json number,state,headRefName";

// gh's `--json` output: the requested fields, whatever extra keys it adds, as one JSON object.
const prJson = (state: string) => `{"number":12,"state":"${state}","headRefName":"feat/demo","url":"ignored"}`;

// Every live read in this file answers from a scripted spawner; nothing reaches gh.
const liveResolver = (answer: ScriptedProcess) => {
  const { spawner, spawned } = scriptedSpawner({ [BRANCH_LINE]: answer, [NUMBER_LINE]: answer });
  const layer = GoalFinalPullRequestResolver.layer.pipe(
    Layer.provide(
      Layer.mergeAll(Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner), SecureRandom.layerWebCrypto)
    )
  );
  return { layer, spawned };
};

const readBoth = Effect.gen(function* () {
  const resolver = yield* GoalFinalPullRequestResolver;
  const forBranch = yield* resolver.forBranch("/repo");
  const byNumber = yield* resolver.byNumber("/repo", 12);
  return { forBranch, byNumber };
});

const expected = (state: GoalFinalPullRequestState) =>
  GoalFinalPullRequestCandidate.make({ number: 12, state, headRefName: "feat/demo" });

describe("GoalFinalPullRequestResolver.layer", () => {
  for (const state of GoalFinalPullRequestState.literals) {
    it.effect(`decodes a ${state} pull request for both the branch and a number`, () =>
      Effect.gen(function* () {
        const { layer, spawned } = liveResolver({ stdout: prJson(state) });
        const result = yield* readBoth.pipe(withLayer(layer));
        assertSome(result.forBranch, expected(state));
        assertSome(result.byNumber, expected(state));
        expect(spawned).toStrictEqual([BRANCH_LINE, NUMBER_LINE]);
      })
    );
  }

  it.effect("resolves None when gh exits non-zero", () =>
    Effect.gen(function* () {
      const { layer, spawned } = liveResolver({ stdout: prJson("OPEN"), exitCode: 1 });
      const result = yield* readBoth.pipe(withLayer(layer));
      assertNone(result.forBranch);
      assertNone(result.byNumber);
      expect(spawned).toStrictEqual([BRANCH_LINE, NUMBER_LINE]);
    })
  );

  it.effect("resolves None for malformed JSON and for a state outside GitHub's three", () =>
    Effect.gen(function* () {
      const malformed = liveResolver({ stdout: "no pull requests found for branch" });
      const malformedResult = yield* readBoth.pipe(withLayer(malformed.layer));
      assertNone(malformedResult.forBranch);
      assertNone(malformedResult.byNumber);

      const drafted = liveResolver({ stdout: prJson("DRAFT") });
      const draftedResult = yield* readBoth.pipe(withLayer(drafted.layer));
      assertNone(draftedResult.forBranch);
      assertNone(draftedResult.byNumber);
    })
  );
});

describe("GoalFinalPullRequestResolver.layerTest", () => {
  it.effect("answers the branch with the first candidate and numbers from all of them", () =>
    Effect.gen(function* () {
      const open = GoalFinalPullRequestCandidate.make({ number: 7, state: "OPEN", headRefName: "feat/seven" });
      const merged = GoalFinalPullRequestCandidate.make({ number: 3, state: "MERGED", headRefName: "feat/three" });
      const resolver = yield* GoalFinalPullRequestResolver.pipe(
        withLayer(GoalFinalPullRequestResolver.layerTest([open, merged]))
      );
      const branch = yield* resolver.forBranch(".");
      assertSome(branch, open);
      const three = yield* resolver.byNumber(".", 3);
      assertSome(three, merged);
      const missing = yield* resolver.byNumber(".", 99);
      assertNone(missing);

      const empty = yield* GoalFinalPullRequestResolver.pipe(withLayer(GoalFinalPullRequestResolver.layerTest([])));
      const noBranch = yield* empty.forBranch(".");
      assertNone(noBranch);
    })
  );
});

describe("goalFinalPullRequestResolver", () => {
  it.effect("prefers a provided resolver and never spawns", () =>
    Effect.gen(function* () {
      const { spawner, spawned } = scriptedSpawner({});
      const open = GoalFinalPullRequestCandidate.make({ number: 7, state: "OPEN", headRefName: "feat/seven" });
      const branch = yield* goalFinalPullRequestResolver().pipe(
        Effect.flatMap((resolver) => resolver.forBranch(".")),
        withLayer(GoalFinalPullRequestResolver.layerTest([open])),
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
        withLayer(SecureRandom.layerWebCrypto)
      );
      assertSome(branch, open);
      expect(spawned).toStrictEqual([]);
    })
  );

  it.effect("falls back to the live gh resolver when none is provided", () =>
    Effect.gen(function* () {
      const { spawner, spawned } = scriptedSpawner({ [NUMBER_LINE]: { stdout: prJson("MERGED") } });
      const byNumber = yield* goalFinalPullRequestResolver().pipe(
        Effect.flatMap((resolver) => resolver.byNumber("/repo", 12)),
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
        withLayer(SecureRandom.layerWebCrypto)
      );
      assertSome(byNumber, expected("MERGED"));
      expect(spawned).toStrictEqual([NUMBER_LINE]);
    })
  );
});
