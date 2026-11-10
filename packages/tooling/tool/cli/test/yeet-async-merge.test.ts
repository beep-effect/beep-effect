// The async merge client and the settle loop every Yeet merge goes through
// (goals/yeet-async-merge-and-stacks, slice A). The answers are the bodies
// GitHub sent on 2026-11-10 (research/merge-async-p0-probes-2026-11.md),
// served to the real `@beep/github` client through a recorded `fetch`.
import {
  GithubAsyncMergeOutcome,
  GithubAsyncMergeRequest,
  GithubPullRequestRecord,
  GithubRest,
} from "@beep/repo-cli/test/SharedInternals";
import {
  MergeGateCheckAtMerge,
  MergeGateMerge,
  MergeGateMerged,
  mergeGateRequestsBypass,
  mergeYeetGhAtHead,
  renderMergeGateMergedLine,
  renderYeetMergeEndpoint,
  renderYeetMergeSettlement,
  settleYeetMerge,
  YeetAsyncMergePoll,
  YeetMergeSettlement,
} from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { githubCallLine, recordedGithub } from "./support/YeetGithub.ts";
import type { GithubAnswer, GithubCall } from "./support/YeetGithub.ts";

const HEAD = Str.repeat(40)("a");
const MERGE = Str.repeat(40)("b");
const UUID = "d1db8402-40d9-4256-bf1c-17e01c212344";
const PR = 7;

const pendingBody = (message: string) => ({
  status: "pending",
  details: {
    message,
    uuid: UUID,
    merge_method: "squash",
    merge_action: "direct_merge",
    expected_head_sha: HEAD,
    bypass_rules: false,
  },
});
const accepted: GithubAnswer = { status: 202, body: pendingBody("Merge request enqueued.") };
const inFlight: GithubAnswer = {
  status: 409,
  body: pendingBody("A merge request already exists for this pull request."),
};
const merged: GithubAnswer = {
  body: { status: "merged", details: { message: "Pull request was merged.", sha: MERGE } },
};
const failed = (message: string, status = 200): GithubAnswer => ({
  status,
  body: { status: "failed", details: { message } },
});
const stillPending: GithubAnswer = { body: pendingBody("Merge request is in progress.") };

const strict = GithubAsyncMergeRequest.make({ action: "direct_merge", method: "squash", sha: HEAD });
const noWait = YeetAsyncMergePoll.make({ attempts: 2, interval: Duration.zero });

// PUT answers `put`; each result poll takes the next of `polls` (the last one repeats).
const github = (put: GithubAnswer, polls: ReadonlyArray<GithubAnswer> = [merged]) => {
  let reads = 0;
  return recordedGithub((call: GithubCall) => {
    if (call.method === "PUT") return put;
    if (Str.includes("/merge-async/")(call.path)) {
      reads = reads + 1;
      return polls[Math.min(reads, polls.length) - 1];
    }
    return undefined;
  });
};

const withEndpoint = (endpoint: string | undefined) =>
  Effect.provideService(
    ConfigProvider.ConfigProvider,
    ConfigProvider.fromUnknown(endpoint === undefined ? {} : { BEEP_YEET_MERGE_ENDPOINT: endpoint })
  );

const settle = (recorded: ReturnType<typeof github>, request = strict, endpoint?: string) =>
  settleYeetMerge(PR, request, noWait).pipe(withEndpoint(endpoint), recorded.provide);

describe("GithubRest async merge client", () => {
  it.effect("sends the pinned strict request and reads a 202 as pending, never merged", () =>
    Effect.gen(function* () {
      const recorded = github(accepted);
      const outcome = yield* GithubRest.use((rest) => rest.requestAsyncMerge(PR, strict)).pipe(recorded.provide);
      assertTrue(GithubAsyncMergeOutcome.guards.Pending(outcome));
      expect(outcome).toMatchObject({ uuid: UUID, inFlight: false, message: "Merge request enqueued." });
      expect(A.map(recorded.calls, githubCallLine)).toEqual([`PUT {repo}/pulls/${PR}/merge-async`]);
      expect(recorded.calls[0]?.body).toEqual({
        merge_action: "direct_merge",
        merge_method: "squash",
        sha: HEAD,
        bypass_rules: false,
      });
    })
  );

  it.effect("reads a 409 as the in-flight request's uuid", () =>
    Effect.gen(function* () {
      const outcome = yield* GithubRest.use((rest) => rest.requestAsyncMerge(PR, strict)).pipe(
        github(inFlight).provide
      );
      expect(outcome).toMatchObject({ _tag: "Pending", uuid: UUID, inFlight: true });
    })
  );

  it.effect.each([
    ["a head that already moved", "Pull request head branch was modified."],
    ["a draft", "Pull request is in draft."],
    ["a closed pull request", "Pull request is closed."],
  ] as const)("reads a 400 for %s as failed with GitHub's sentence", ([, message]) =>
    Effect.gen(function* () {
      const outcome = yield* GithubRest.use((rest) => rest.requestAsyncMerge(PR, strict)).pipe(
        github(failed(message, 400)).provide
      );
      expect(outcome).toEqual(GithubAsyncMergeOutcome.cases.Failed.make({ message }));
    })
  );

  it.effect("reads a 200 for an already merged pull request as merged", () =>
    Effect.gen(function* () {
      const already: GithubAnswer = {
        body: { status: "merged", details: { message: "Pull request is already merged.", sha: MERGE } },
      };
      const outcome = yield* GithubRest.use((rest) => rest.requestAsyncMerge(PR, strict)).pipe(github(already).provide);
      expect(outcome).toEqual(
        GithubAsyncMergeOutcome.cases.Merged.make({ sha: MERGE, message: "Pull request is already merged." })
      );
    })
  );

  it.effect("keeps any other failure a GitHubError", () =>
    Effect.gen(function* () {
      const error = yield* GithubRest.use((rest) => rest.requestAsyncMerge(PR, strict)).pipe(
        github({ status: 403, body: { message: "Resource not accessible by integration" } }).provide,
        Effect.flip
      );
      expect(error._tag).toBe("GitHubError");
      expect(error.status).toBe(403);
    })
  );

  it.effect("refuses a merged result without a merge sha", () =>
    Effect.gen(function* () {
      const error = yield* GithubRest.use((rest) => rest.requestAsyncMerge(PR, strict)).pipe(
        github({ body: { status: "merged", details: { message: "Pull request was merged." } } }).provide,
        Effect.flip
      );
      expect(error.kind).toBe("decode");
    })
  );

  it.effect("reads a 404 poll as an expired result, never merged", () =>
    Effect.gen(function* () {
      const recorded = recordedGithub(() => undefined);
      const outcome = yield* GithubRest.use((rest) => rest.asyncMergeResult(PR, UUID)).pipe(recorded.provide);
      expect(outcome).toEqual(GithubAsyncMergeOutcome.cases.Expired.make({ uuid: UUID }));
      expect(A.map(recorded.calls, githubCallLine)).toEqual([`GET {repo}/pulls/${PR}/merge-async/${UUID}`]);
    })
  );
});

describe("settleYeetMerge", () => {
  it.effect("polls an accepted request to merged", () =>
    Effect.gen(function* () {
      const recorded = github(accepted, [stillPending, merged]);
      const settled = yield* settle(recorded);
      expect(settled).toEqual(
        YeetMergeSettlement.cases.Merged.make({
          endpoint: "async",
          sha: MERGE,
          message: "Pull request was merged.",
          attached: false,
        })
      );
      expect(A.map(recorded.calls, githubCallLine)).toEqual([
        `PUT {repo}/pulls/${PR}/merge-async`,
        `GET {repo}/pulls/${PR}/merge-async/${UUID}`,
        `GET {repo}/pulls/${PR}/merge-async/${UUID}`,
      ]);
    })
  );

  it.effect("turns a rule GitHub enforces after acceptance into a failure with its sentence", () =>
    Effect.gen(function* () {
      const sentence = "A conversation must be resolved before this pull request can be merged.";
      const settled = yield* settle(github(accepted, [stillPending, failed(sentence)]));
      expect(settled).toEqual(YeetMergeSettlement.cases.Failed.make({ endpoint: "async", message: sentence }));
      expect(renderYeetMergeSettlement(settled)).toBe(`merge-async failed: ${sentence}`);
    })
  );

  it("folds GitHub's multi-line rule sentence onto one line", () => {
    const settled = YeetMergeSettlement.cases.Failed.make({
      endpoint: "async",
      message:
        "Repository rule violations found\n\nA conversation must be resolved before this pull request can be merged.\n\n",
    });
    expect(renderYeetMergeSettlement(settled)).toBe(
      "merge-async failed: Repository rule violations found A conversation must be resolved before this pull request can be merged."
    );
  });

  it.effect("fails a merge whose head moved after acceptance", () =>
    Effect.gen(function* () {
      const sentence = "Head branch is out of date. Review and try the merge again.";
      const settled = yield* settle(github(accepted, [failed(sentence)]));
      expect(settled).toMatchObject({ _tag: "Failed", message: sentence });
    })
  );

  it.effect("attaches to a request already in flight instead of sending another", () =>
    Effect.gen(function* () {
      const recorded = github(inFlight, [merged]);
      const settled = yield* settle(recorded);
      expect(settled).toMatchObject({ _tag: "Merged", sha: MERGE, attached: true });
      expect(A.filter(recorded.calls, (call) => call.method === "PUT")).toHaveLength(1);
    })
  );

  it.effect("never reads a request still pending past the poll budget as merged", () =>
    Effect.gen(function* () {
      const recorded = github(accepted, [stillPending]);
      const settled = yield* settle(recorded);
      assertTrue(YeetMergeSettlement.guards.Unsettled(settled));
      assertSome(settled.uuid, UUID);
      // One read, then the budget's two more.
      expect(A.filter(recorded.calls, (call) => call.method === "GET")).toHaveLength(3);
    })
  );

  it.effect("holds an expired result as unsettled", () =>
    Effect.gen(function* () {
      const recorded = recordedGithub((call) => (call.method === "PUT" ? accepted : undefined));
      const settled = yield* settle(recorded);
      expect(settled._tag).toBe("Unsettled");
      expect(renderYeetMergeSettlement(settled)).toContain("GitHub holds no result for the request");
    })
  );

  it.effect("sends a bypass only when the request asks for one", () =>
    Effect.gen(function* () {
      const recorded = github(merged);
      yield* settle(recorded, GithubAsyncMergeRequest.make({ ...strict, bypassRules: true }));
      expect(recorded.calls[0]?.body).toMatchObject({ bypass_rules: true });
    })
  );

  it.effect("routes through the legacy merge call behind BEEP_YEET_MERGE_ENDPOINT=legacy", () =>
    Effect.gen(function* () {
      const recorded = recordedGithub((call) =>
        call.method === "PUT"
          ? { body: { merged: true, sha: MERGE, message: "Pull Request successfully merged" } }
          : undefined
      );
      const settled = yield* settle(recorded, strict, "legacy");
      expect(settled).toMatchObject({ _tag: "Merged", endpoint: "legacy", sha: MERGE });
      expect(A.map(recorded.calls, githubCallLine)).toEqual([`PUT {repo}/pulls/${PR}/merge`]);
      expect(renderYeetMergeSettlement(settled)).toBe(`merge (legacy) merged as ${MERGE}`);
    })
  );

  it.effect("falls back to async when the switch does not parse", () =>
    Effect.gen(function* () {
      const recorded = github(merged);
      const settled = yield* settle(recorded, strict, "sideways");
      expect(settled).toMatchObject({ _tag: "Merged", endpoint: "async" });
    })
  );
});

describe("merge-gate bypass and merge line", () => {
  const met = (relaxed: boolean, atMerge: ReadonlyArray<MergeGateCheckAtMerge>) =>
    MergeGateMerge.make({
      prNumber: PR,
      headSha: HEAD,
      commitTitle: "fix: x (#7)",
      commitMessage: "",
      windowAgeSeconds: 1260,
      tolerated: [],
      relaxed,
      atMerge,
    });
  const red = MergeGateCheckAtMerge.make({
    check: "Lint",
    state: "red",
    required: true,
    attribution: "inherited: run 1 failure on merge-base 2c1cb448ba",
  });

  it("requests a bypass only for a relaxed merge that records a red", () => {
    expect(mergeGateRequestsBypass(met(false, []))).toBe(false);
    expect(mergeGateRequestsBypass(met(false, [red]))).toBe(false);
    expect(mergeGateRequestsBypass(met(true, []))).toBe(false);
    expect(mergeGateRequestsBypass(met(true, [red]))).toBe(true);
  });

  it("names merge-async and a requested bypass on the merge line", () => {
    const merge = (bypassRequested: boolean) =>
      MergeGateMerged.make({
        prNumber: PR,
        mergeSha: MERGE,
        commitTitle: "fix: x (#7)",
        endpoint: "async",
        bypassRequested,
      });
    expect(renderMergeGateMergedLine(merge(false))).toBe('MERGED #7 -> bbbbbbbbbb "fix: x (#7)" via merge-async');
    expect(renderMergeGateMergedLine(merge(true))).toBe(
      'MERGED #7 -> bbbbbbbbbb "fix: x (#7)" via merge-async, rules bypass requested (S11)'
    );
  });
});

it.layer(TestConsole.layer)("yeet gh merge step", (it) => {
  const pull = GithubPullRequestRecord.make({
    number: PR,
    nodeId: "PR_kw",
    title: "feat: x",
    body: "",
    state: "open",
    draft: false,
    merged: false,
    mergeableState: O.some("clean"),
    headRef: "feat/x",
    headSha: HEAD,
    baseRef: "main",
    htmlUrl: "https://github.com/o/r/pull/7",
    author: "octocat",
    labels: [],
    createdAt: DateTime.makeUnsafe("2026-11-10T00:00:00Z"),
    updatedAt: DateTime.makeUnsafe("2026-11-10T00:00:00Z"),
  });

  it.effect("merges through merge-async with the titled, folded body and the tolerated checks", () =>
    Effect.gen(function* () {
      const recorded = github(merged);
      yield* mergeYeetGhAtHead(PR, pull, ["Heavy / Coverage Regression=flake"]).pipe(recorded.provide);
      const body = recorded.calls[0]?.body;
      expect(body).toMatchObject({ sha: HEAD, commit_title: "feat: x (#7)", bypass_rules: false });
      // The body is folded under 100 characters per line for server-side commitlint.
      const message =
        P.hasProperty(body, "commit_message") && P.isString(body.commit_message) ? body.commit_message : "";
      expect(Str.replaceAll("\n", " ")(message)).toBe(
        `Squash-merged at ${HEAD} by beep yeet gh merge. Tolerated: Heavy / Coverage Regression=flake.`
      );
      const lines = yield* TestConsole.logLines;
      const logged = A.join(A.map(lines, String), "\n");
      expect(logged).toContain(
        "[gh] merged=true #7 bbbbbbbbbb via merge-async tolerated=[Heavy / Coverage Regression=flake]"
      );
    })
  );

  it.effect("exits as a hold with GitHub's sentence when the merge fails", () =>
    Effect.gen(function* () {
      const sentence = "A conversation must be resolved before this pull request can be merged.";
      const error = yield* mergeYeetGhAtHead(PR, pull, []).pipe(
        github(accepted, [failed(sentence)]).provide,
        Effect.flip
      );
      expect(error.message).toBe(`[gh] not merged #7: merge-async failed: ${sentence}`);
      expect(P.hasProperty(error, "exitCode") ? error.exitCode : undefined).toBe(75);
    })
  );

  it("names both endpoints", () => {
    expect(renderYeetMergeEndpoint("async")).toBe("merge-async");
    expect(renderYeetMergeEndpoint("legacy")).toBe("merge (legacy)");
    expect(
      renderMergeGateMergedLine(
        MergeGateMerged.make({
          prNumber: PR,
          mergeSha: MERGE,
          commitTitle: "fix: x (#7)",
          endpoint: "legacy",
          bypassRequested: false,
        })
      )
    ).toBe('MERGED #7 -> bbbbbbbbbb "fix: x (#7)" via merge (legacy)');
  });
});
