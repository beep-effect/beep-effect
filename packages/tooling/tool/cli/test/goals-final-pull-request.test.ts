import {
  GoalFinalPullRequestCandidate,
  GoalFinalPullRequestResolver,
  GoalFinalPullRequestState,
  goalFinalPullRequestResolver,
} from "@beep/repo-cli/commands/Goals/FinalPullRequest";
import { GithubTransportFetch } from "@beep/repo-cli/test/SharedInternals";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import { scriptedSpawner, withLayer } from "./support/GithubLedgerFakes.ts";
import { githubCallLine, recordedGithub, restPullRequest } from "./support/YeetGithub.ts";
import type { ScriptedProcess } from "./support/GithubLedgerFakes.ts";
import type { GithubAnswer, GithubCall } from "./support/YeetGithub.ts";

const BRANCH_LINE = "gh pr view --json number,state,headRefName";
// `byNumber` reads `GET /repos/{owner}/{repo}/pulls/12` as the gh login (W8, SPEC D-22): the token
// and the origin remote come from the scripted spawner, the pull request from a recorded `fetch`.
const TOKEN_LINE = "gh auth token";
const ORIGIN_LINE = "git remote get-url origin";
const identityScript: Readonly<Record<string, ScriptedProcess>> = {
  [TOKEN_LINE]: { stdout: "gho_test\n" },
  [ORIGIN_LINE]: { stdout: "https://github.com/beep-effect/beep-effect.git\n" },
};

// gh's `--json` output: the requested fields, whatever extra keys it adds, as one JSON object.
const prJson = (state: string) => `{"number":12,"state":"${state}","headRefName":"feat/demo","url":"ignored"}`;

// The REST record GitHub answers for each gh state: REST has `open` / `closed` plus `merged`.
const restStates: Readonly<Record<GoalFinalPullRequestState, Readonly<Record<string, unknown>>>> = {
  OPEN: { state: "open" },
  MERGED: { state: "closed", merged: true, merged_at: "2026-10-06T11:00:00Z" },
  CLOSED: { state: "closed" },
};
const restRoute =
  (answer: GithubAnswer | undefined) =>
  (call: GithubCall): GithubAnswer | undefined =>
    call.path === "{repo}/pulls/12" ? answer : undefined;
const restAnswer = (state: GoalFinalPullRequestState): GithubAnswer => ({
  body: restPullRequest({ number: 12, head: { ref: "feat/demo", sha: "abc1234def" }, ...restStates[state] }),
});

// Every live read in this file answers from a scripted spawner and a recorded `fetch`; nothing
// reaches gh or GitHub.
const liveResolver = (answer: ScriptedProcess, rest: GithubAnswer | undefined) => {
  const { spawner, spawned } = scriptedSpawner({ ...identityScript, [BRANCH_LINE]: answer });
  const github = recordedGithub(restRoute(rest));
  const layer = GoalFinalPullRequestResolver.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner),
        SecureRandom.layerWebCrypto,
        Layer.succeed(GithubTransportFetch, O.some(github.fetch))
      )
    )
  );
  return { layer, spawned, calls: github.calls };
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
        const { layer, spawned, calls } = liveResolver({ stdout: prJson(state) }, restAnswer(state));
        const result = yield* readBoth.pipe(withLayer(layer));
        assertSome(result.forBranch, expected(state));
        assertSome(result.byNumber, expected(state));
        expect(spawned[0]).toBe(BRANCH_LINE);
        expect(spawned).toContain(TOKEN_LINE);
        expect(A.map(calls, githubCallLine)).toStrictEqual(["GET {repo}/pulls/12"]);
      })
    );
  }

  it.effect("resolves None when gh exits non-zero", () =>
    Effect.gen(function* () {
      const { layer, spawned } = liveResolver({ stdout: prJson("OPEN"), exitCode: 1 }, undefined);
      const result = yield* readBoth.pipe(withLayer(layer));
      assertNone(result.forBranch);
      assertNone(result.byNumber);
      expect(spawned[0]).toBe(BRANCH_LINE);
    })
  );

  it.effect("resolves None for malformed JSON and for a state outside GitHub's three", () =>
    Effect.gen(function* () {
      const malformed = liveResolver({ stdout: "no pull requests found for branch" }, { body: { number: 12 } });
      const malformedResult = yield* readBoth.pipe(withLayer(malformed.layer));
      assertNone(malformedResult.forBranch);
      assertNone(malformedResult.byNumber);

      // REST has no draft state; its byNumber twin is a record that does not decode.
      const drafted = liveResolver({ stdout: prJson("DRAFT") }, { body: { number: 12, state: "draft" } });
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
      const { spawner, spawned } = scriptedSpawner(identityScript);
      const github = recordedGithub(restRoute(restAnswer("MERGED")));
      const byNumber = yield* goalFinalPullRequestResolver().pipe(
        Effect.flatMap((resolver) => resolver.byNumber("/repo", 12)),
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
        Effect.provideService(GithubTransportFetch, O.some(github.fetch)),
        withLayer(SecureRandom.layerWebCrypto)
      );
      assertSome(byNumber, expected("MERGED"));
      expect(spawned).toContain(TOKEN_LINE);
      expect(A.map(github.calls, githubCallLine)).toStrictEqual(["GET {repo}/pulls/12"]);
    })
  );
});
