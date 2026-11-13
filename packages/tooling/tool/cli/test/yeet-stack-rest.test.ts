// The Stacks REST client slice C links and reads native stacks through. The
// answers are the bodies GitHub sent on 2026-11-13 (the slice C P0 probes),
// served to the real `@beep/github` client through a recorded `fetch`.

import { GitHubError } from "@beep/github/GitHubError";
import { GithubPullRequestStackRef, GithubRest, GithubStackLinkOutcome } from "@beep/repo-cli/test/SharedInternals";
import { describe, expect, it } from "@effect/vitest";
import {
  assertFalse,
  assertInstanceOf,
  assertNone,
  assertSome,
  assertTrue,
  deepStrictEqual,
} from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { githubCallLine, recordedGithub, restPullRequest } from "./support/YeetGithub.ts";
import type { GithubAnswer, GithubCall } from "./support/YeetGithub.ts";

const LOWER = 3157;
const TOP = 3158;
const STACK = 3159;
const LOWER_HEAD = Str.repeat(40)("a");
const TOP_HEAD = Str.repeat(40)("b");
const MERGE = Str.repeat(40)("c");

const layerBody = (number: number, ref: string, sha: string, mergedAt: string | null) => ({
  number,
  state: mergedAt === null ? "open" : "closed",
  draft: false,
  merged_at: mergedAt,
  head: { ref, sha },
});

const stackBody = (mergedAt: string | null = null) => ({
  id: 3479922,
  number: STACK,
  node_id: "PRS_kw",
  base: { ref: "main" },
  open: mergedAt === null,
  created_at: "2026-11-13T00:51:08Z",
  pull_requests: [
    layerBody(LOWER, "probe/stack-c-g", LOWER_HEAD, mergedAt),
    layerBody(TOP, "probe/stack-c-h", TOP_HEAD, mergedAt),
  ],
});

const stackRef = (position: number) => ({
  id: 3479922,
  number: STACK,
  position,
  size: 2,
  base: { ref: "main", sha: null },
});

const github = (answer: (call: GithubCall) => GithubAnswer | undefined) => recordedGithub(answer);

describe("GithubRest pull request stack fields", () => {
  it.effect("carries the stack reference of a layer, with the trunk as its base", () =>
    Effect.gen(function* () {
      const recorded = github(() => ({
        body: restPullRequest({ number: TOP, base: { ref: "probe/stack-c-g", sha: LOWER_HEAD }, stack: stackRef(2) }),
      }));
      const pull = yield* GithubRest.use((rest) => rest.pullRequest(TOP)).pipe(recorded.provide);
      assertSome(pull.stack, GithubPullRequestStackRef.make({ number: STACK, position: 2, size: 2, baseRef: "main" }));
      expect(pull.baseRef).toBe("probe/stack-c-g");
    })
  );

  it.effect.each([
    ["a null stack key", { stack: null }],
    ["no stack key", {}],
  ] as const)("reads %s as a pull request outside a stack", ([, overrides]) =>
    Effect.gen(function* () {
      const pull = yield* GithubRest.use((rest) => rest.pullRequest(7)).pipe(
        github(() => ({ body: restPullRequest(overrides) })).provide
      );
      assertNone(pull.stack);
    })
  );

  it.effect("carries the merge commit only once the pull request merged", () =>
    Effect.gen(function* () {
      const read = (overrides: Readonly<Record<string, unknown>>) =>
        GithubRest.use((rest) => rest.pullRequest(7)).pipe(
          github(() => ({ body: restPullRequest({ merge_commit_sha: MERGE, ...overrides }) })).provide
        );
      // An open pull request reports GitHub's test-merge commit under the same key.
      const open = yield* read({});
      assertNone(open.mergeCommitSha);
      const merged = yield* read({ state: "closed", merged: true, merged_at: "2026-11-13T00:51:14Z" });
      deepStrictEqual(merged.mergeCommitSha, O.some(MERGE));
    })
  );
});

describe("GithubRest stacks", () => {
  it.effect("reads a stack bottom to top", () =>
    Effect.gen(function* () {
      const recorded = github(() => ({ body: stackBody() }));
      const stack = yield* GithubRest.use((rest) => rest.stack(STACK)).pipe(recorded.provide);
      expect(A.map(recorded.calls, githubCallLine)).toEqual([`GET {repo}/stacks/${STACK}`]);
      expect(stack).toMatchObject({ number: STACK, open: true, baseRef: "main" });
      expect(A.map(stack.layers, (layer) => [layer.number, layer.headRef, layer.headSha, layer.merged])).toEqual([
        [LOWER, "probe/stack-c-g", LOWER_HEAD, false],
        [TOP, "probe/stack-c-h", TOP_HEAD, false],
      ]);
    })
  );

  it.effect("keeps merged layers and marks them", () =>
    Effect.gen(function* () {
      const stack = yield* GithubRest.use((rest) => rest.stack(STACK)).pipe(
        github(() => ({ body: stackBody("2026-11-13T00:51:14Z") })).provide
      );
      assertFalse(stack.open);
      expect(A.map(stack.layers, (layer) => layer.merged)).toEqual([true, true]);
    })
  );

  it.effect("links pull requests bottom to top and reads a 201 as linked", () =>
    Effect.gen(function* () {
      const recorded = github(() => ({ status: 201, body: stackBody() }));
      const outcome = yield* GithubRest.use((rest) => rest.createStack([LOWER, TOP])).pipe(recorded.provide);
      expect(A.map(recorded.calls, githubCallLine)).toEqual(["POST {repo}/stacks"]);
      expect(recorded.calls[0]?.body).toEqual({ pull_requests: [LOWER, TOP] });
      assertTrue(GithubStackLinkOutcome.guards.Linked(outcome));
      expect(outcome).toMatchObject({ stack: { number: STACK } });
    })
  );

  it.effect.each([
    ["an out-of-order list", "Pull requests must form a stack, where each PR's base ref is the previous PR's head ref"],
    ["pull requests already stacked", `Pull requests #${LOWER}, #${TOP} are already part of a stack`],
  ] as const)("reads a 422 for %s as refused with GitHub's sentence", ([, message]) =>
    Effect.gen(function* () {
      const outcome = yield* GithubRest.use((rest) => rest.createStack([LOWER, TOP])).pipe(
        github(() => ({ status: 422, body: { message, status: "422" } })).provide
      );
      expect(outcome).toEqual(GithubStackLinkOutcome.cases.Refused.make({ message }));
    })
  );

  it.effect("keeps any other link failure a GitHubError", () =>
    Effect.gen(function* () {
      const error = yield* GithubRest.use((rest) => rest.createStack([LOWER, TOP])).pipe(
        github(() => ({ status: 404, body: { message: "Not Found" } })).provide,
        Effect.flip
      );
      assertInstanceOf(error, GitHubError);
      expect(error.status).toBe(404);
    })
  );

  it.effect.each([
    ["contains", 0, true],
    ["is behind", 2, false],
  ] as const)("says whether a head %s another from the compare endpoint", ([, behindBy, expected]) =>
    Effect.gen(function* () {
      const recorded = github(() => ({ body: { status: "ahead", ahead_by: 1, behind_by: behindBy } }));
      const contains = yield* GithubRest.use((rest) => rest.headContains(LOWER_HEAD, TOP_HEAD)).pipe(recorded.provide);
      expect(contains).toBe(expected);
      expect(A.map(recorded.calls, githubCallLine)).toEqual([`GET {repo}/compare/${LOWER_HEAD}...${TOP_HEAD}`]);
    })
  );
});
