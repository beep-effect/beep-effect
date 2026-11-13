// Replays the committed certainty corpora (test/fixtures/ci-certainty, decision `in-repo-fixture-corpus`
// in goals/certainty-scorecard) and pins the per-head cases, monotonicity and api-partial refusal.

import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  buildCiCertaintyReport,
  CiCertaintyCorpus,
  CiCertaintyMainCommit,
  CiCertaintyReport,
  CiCertaintyRun,
  CiCommandError,
  CiLaneTimingGithubClient,
  CiWorkflowJob,
  CiWorkflowPartialRead,
  CiWorkflowWindowRun,
  ciCertaintyCommand,
  ciCertaintyLatencyStat,
  ciCertaintyRunnerMinutes,
  collectCiWorkflowRunAttemptJobs,
  decodeCiCertaintyCorpus,
  renderCiCertaintyMarkdown,
} from "@beep/repo-cli/commands/Ci";
import { GithubTransportFetch } from "@beep/repo-cli/test/SharedInternals";
import { findRepoRoot } from "@beep/repo-utils";
import { A, O, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto";
import { describe, expect, it } from "@effect/vitest";
import {
  assertFalse,
  assertInstanceOf,
  assertNone,
  assertSome,
  assertTrue,
  deepStrictEqual,
  strictEqual,
} from "@effect/vitest/utils";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import baselineCorpus from "./fixtures/ci-certainty/baseline-2026-11-09.json" with { type: "json" };
import plannedCorpus from "./fixtures/ci-certainty/planned-2026-11-10.json" with { type: "json" };
import { githubFetch, reply } from "./support/GithubFetch.ts";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import type { CiCertaintyHeadRow } from "@beep/repo-cli/commands/Ci";
import type { GithubFetchCall } from "./support/GithubFetch.ts";

const testLayer = NodeCrypto.layer;

const decodeCorpus = S.decodeUnknownEffect(CiCertaintyCorpus);

const FIXTURES = { baseline: baselineCorpus as unknown, planned: plannedCorpus as unknown };

const loadCorpus = (name: keyof typeof FIXTURES) => decodeCorpus(FIXTURES[name]).pipe(Effect.orDie);

const BASELINE = "baseline";
const PLANNED = "planned";

const headStartingWith = (heads: ReadonlyArray<CiCertaintyHeadRow>, prefix: string): CiCertaintyHeadRow =>
  O.getOrThrow(A.findFirst(heads, (head) => Str.startsWith(prefix)(head.headSha)));

// A not-attained percentile is unbounded, so comparisons order it above every attained value.
const percentileValue = (minutes: O.Option<number>): number => O.getOrElse(minutes, () => Number.POSITIVE_INFINITY);

describe("ci certainty fixture replay", () => {
  it.layer(testLayer)((it) => {
    it.effect("reproduces the 2026-11-09 baseline window", () =>
      Effect.gen(function* () {
        const report = yield* loadCorpus(BASELINE).pipe(Effect.flatMap(buildCiCertaintyReport));

        assertTrue(report.certified);
        strictEqual(A.length(report.requiredContexts), 15);
        // SLO statistic: code heads with misses counted; most misses are cancellations, not reds.
        // f6c4a648 went red before its successor's push, so it counts as a miss rather than superseded.
        strictEqual(report.slo.n, 18);
        strictEqual(report.slo.misses, 7);
        strictEqual(report.slo.censoredSuperseded, 13);
        strictEqual(report.slo.censoredOpen, 0);
        strictEqual(report.slo.withinTen, 1);
        assertSome(report.slo.p50Minutes, 63.35);
        strictEqual(report.slo.p95Status, "not-attained");
        assertNone(report.slo.p95Minutes);
        // The green-only diagnostic reproduces the recorded 101.9-minute p95 (facc14a6, three attempts).
        strictEqual(report.greenOnly.n, 11);
        assertSome(report.greenOnly.p95Minutes, 101.9);
        // The recorded "4 of 30 under ten minutes" is not reproduced: one code head is under ten, and the
        // three docs heads under ten are their own class (decision fixture-corpus-real-captures).
        strictEqual(report.docsHeads.withinTen, 3);
        strictEqual(report.docsHeads.n, 4);
        strictEqual(report.docsHeads.misses, 1);
        // Runner-minutes per head attempt (check.yml run plus its admitted heavy-admit.yml runs).
        strictEqual(report.runnerMinutes.runs, 35);
        assertSome(report.runnerMinutes.meanTotal, 251.08);
        assertSome(report.runnerMinutes.greenCodeRunP50, 278.85);
        assertSome(report.runnerMinutes.greenCodeRunP95, 385.35);
        assertSome(report.supersededRunnerMinuteShare, 0.3737);
        // The plan's spot check: 9f30182f ran 40.2 min to every required green on 315 runner-minutes.
        const spotCheck = headStartingWith(report.heads, "9f30182f");
        assertSome(spotCheck.requiredGreenMinutes, 40.18);
        strictEqual(
          Math.round(
            (spotCheck.runnerMinutes.githubHosted + spotCheck.runnerMinutes.managed + spotCheck.runnerMinutes.unknown) *
              10
          ) / 10,
          315.3
        );
      })
    );

    it.effect("judges the named per-head cases", () =>
      Effect.gen(function* () {
        const report = yield* loadCorpus(BASELINE).pipe(Effect.flatMap(buildCiCertaintyReport));

        // Two producers: heavy-admit.yml's Heavy / Test Integration failed, check.yml's later start passed.
        const twoProducers = headStartingWith(report.heads, "eb295434");
        deepStrictEqual(twoProducers.producers, ["check.yml", "heavy-admit.yml"]);
        strictEqual(twoProducers.state, "green");
        const integration = O.getOrThrow(
          A.findFirst(twoProducers.contexts, (row) => row.context === "Heavy / Test Integration")
        );
        assertSome(integration.producer, "check.yml");
        strictEqual(integration.state, "green");

        // Three attempts: the run's latest attempt decides, timed from the first push.
        const threeAttempts = headStartingWith(report.heads, "facc14a6");
        strictEqual(threeAttempts.attempts, 3);
        strictEqual(threeAttempts.state, "green");
        assertSome(threeAttempts.requiredGreenMinutes, 101.9);
        assertSome(threeAttempts.criticalContext, "Heavy / Test Integration");

        // Docs-only: the documentation-only admission step classes it apart.
        const docs = headStartingWith(report.heads, "b85ee265");
        strictEqual(docs.headClass, "docs");
        strictEqual(docs.state, "green");
        assertSome(docs.requiredGreenMinutes, 2.77);

        // Cancelled without a successor: counted, and a miss.
        const cancelled = headStartingWith(report.heads, "ecc04921");
        strictEqual(cancelled.state, "cancelled");
        assertNone(cancelled.censor);
        assertNone(cancelled.requiredGreenMinutes);

        // Red before the branch's next push started: counted as a miss, although later jobs ran past it.
        const redBeforeSuccessor = headStartingWith(report.heads, "f6c4a648");
        strictEqual(redBeforeSuccessor.state, "red");
        assertNone(redBeforeSuccessor.censor);

        // Cancelled because a newer head of the branch arrived: censored, cost counted in the share.
        const superseded = headStartingWith(report.heads, "93ef8b3a");
        assertSome(superseded.censor, "superseded");
      })
    );

    it.effect("reports the post-#3030 admission and Test Unit selection rows", () =>
      Effect.gen(function* () {
        const report = yield* loadCorpus(PLANNED).pipe(Effect.flatMap(buildCiCertaintyReport));

        assertTrue(report.certified);
        // Heavy Admission to the first beep-ec2-heavy job of the same run, across both producers.
        strictEqual(report.admissionToHeavy.n, 15);
        assertSome(report.admissionToHeavy.p50Minutes, 1.22);
        strictEqual(report.runnerMinutes.runs, 29);
        assertSome(report.runnerMinutes.greenCodeRunP50, 222.62);
        strictEqual(report.testUnitConversion.fullLayoutJobs, 24);
        strictEqual(report.testUnitConversion.plannedRuns, 15);
        strictEqual(report.testUnitConversion.ownerScopedRuns, 2);
        // Yeet-mergeable sits beside the statistic: Coverage Regression reds miss it while required stays green.
        strictEqual(report.slo.misses, 0);
        strictEqual(report.mergeable.misses, 11);
      })
    );
  });
});

const failCriticalContext = (corpus: CiCertaintyCorpus, head: CiCertaintyHeadRow): CiCertaintyCorpus => {
  const context = O.getOrThrow(head.criticalContext);
  const row = O.getOrThrow(A.findFirst(head.contexts, (candidate) => candidate.context === context));
  const runId = O.getOrThrow(row.runId);
  const runAttempt = O.getOrThrow(row.runAttempt);
  return CiCertaintyCorpus.make({
    ...corpus,
    pullRequestRuns: A.map(corpus.pullRequestRuns, (run) =>
      run.run.id === runId
        ? CiCertaintyRun.make({
            ...run,
            jobs: A.map(run.jobs, (job) =>
              job.name === context && job.run_attempt === runAttempt
                ? CiWorkflowJob.make({ ...job, conclusion: "failure" })
                : job
            ),
          })
        : run
    ),
  });
};

const FIRST_PUSH = Str.repeat(40)("a");
const SECOND_PUSH = Str.repeat(40)("b");

const producerRun = (
  workflow: "check.yml" | "heavy-admit.yml",
  id: number,
  headSha: string,
  createdAt: string,
  jobs: ReadonlyArray<Partial<CiWorkflowJob>>
) =>
  CiCertaintyRun.make({
    jobs: A.map(jobs, (job, index) =>
      CiWorkflowJob.make({
        completed_at: null,
        conclusion: "success",
        created_at: createdAt,
        id: id * 100 + index,
        labels: ["ubuntu-24.04"],
        name: "Lint",
        run_attempt: 1,
        run_id: id,
        started_at: null,
        status: "completed",
        ...job,
      })
    ),
    run: CiWorkflowWindowRun.make({
      conclusion: O.some("success"),
      created_at: DateTime.makeUnsafe(createdAt),
      event: "pull_request",
      head_branch: O.some("feat/one-branch"),
      head_sha: headSha,
      id,
      run_attempt: 1,
      status: O.some("completed"),
    }),
    workflow,
  });

// Two pushes to one branch: the first's Test Unit decides at 10:40, a non-required Property Laws job
// runs to 10:55, and the second push starts at 10:45.
const supersessionCorpus = (testUnit: "success" | "failure") =>
  CiCertaintyCorpus.make({
    capturedAt: DateTime.makeUnsafe("2026-11-10T03:00:00Z"),
    mainCommits: [],
    pullRequestRuns: [
      producerRun("check.yml", 301, FIRST_PUSH, "2026-11-09T10:00:00Z", [
        { completed_at: "2026-11-09T10:05:00Z", started_at: "2026-11-09T10:01:00Z" },
        {
          completed_at: "2026-11-09T10:40:00Z",
          conclusion: testUnit,
          name: "Test Unit",
          started_at: "2026-11-09T10:01:00Z",
        },
        { completed_at: "2026-11-09T10:55:00Z", name: "Property Laws", started_at: "2026-11-09T10:01:00Z" },
      ]),
      producerRun("check.yml", 302, SECOND_PUSH, "2026-11-09T10:45:00Z", [
        { completed_at: "2026-11-09T10:50:00Z", started_at: "2026-11-09T10:46:00Z" },
        { completed_at: "2026-11-09T10:52:00Z", name: "Test Unit", started_at: "2026-11-09T10:46:00Z" },
      ]),
    ],
    requestCount: 0,
    requiredContexts: ["Lint", "Test Unit"],
    since: SYNTHETIC_WINDOW_SINCE,
    until: SYNTHETIC_WINDOW_UNTIL,
  });

const SYNTHETIC_WINDOW_SINCE = DateTime.makeUnsafe("2026-11-09T00:00:00Z");
const SYNTHETIC_WINDOW_UNTIL = DateTime.makeUnsafe("2026-11-10T00:00:00Z");

// One code head admitted by label: check.yml runs only hosted jobs (its Heavy / Test Integration aggregate
// included), one heavy-admit.yml run executes Heavy / Check on the heavy pool, and a second one admitted
// nothing.
const labelAdmittedCorpus = CiCertaintyCorpus.make({
  capturedAt: DateTime.makeUnsafe("2026-11-10T03:00:00Z"),
  mainCommits: [],
  pullRequestRuns: [
    producerRun("check.yml", 401, FIRST_PUSH, "2026-11-09T12:00:00Z", [
      { completed_at: "2026-11-09T12:04:00Z", started_at: "2026-11-09T12:01:00Z" },
      { completed_at: "2026-11-09T12:01:00Z", name: "Heavy Admission", started_at: "2026-11-09T12:00:10Z" },
      {
        completed_at: "2026-11-09T12:30:00Z",
        name: "Heavy / Test Integration",
        started_at: "2026-11-09T12:20:00Z",
      },
    ]),
    producerRun("heavy-admit.yml", 402, FIRST_PUSH, "2026-11-09T12:05:00Z", [
      { completed_at: "2026-11-09T12:06:00Z", name: "Heavy Admission", started_at: "2026-11-09T12:05:00Z" },
      {
        completed_at: "2026-11-09T12:17:00Z",
        labels: ["beep-ec2-heavy"],
        name: "Heavy / Check",
        started_at: "2026-11-09T12:07:00Z",
      },
    ]),
    producerRun("heavy-admit.yml", 403, FIRST_PUSH, "2026-11-09T12:06:00Z", [
      { conclusion: "skipped", name: "Heavy Admission" },
      { conclusion: "skipped", name: "Heavy" },
    ]),
  ],
  requestCount: 0,
  requiredContexts: ["Lint"],
  since: SYNTHETIC_WINDOW_SINCE,
  until: SYNTHETIC_WINDOW_UNTIL,
});

describe("ci certainty producer pairing", () => {
  it.layer(testLayer)((it) => {
    it.effect("times admission to the heavy pool and bills heavy-admit minutes to the head attempt", () =>
      Effect.gen(function* () {
        const report = yield* buildCiCertaintyReport(labelAdmittedCorpus);
        // Only heavy-admit run 402 reaches the heavy pool: 12:05 to 12:07. check.yml's hosted
        // Heavy / Test Integration aggregate (12:20) is not pickup.
        strictEqual(report.admissionToHeavy.n, 1);
        assertSome(report.admissionToHeavy.p50Minutes, 2);
        // One head attempt: check.yml run 401 with run 402 attached; run 403 admitted nothing.
        strictEqual(report.runnerMinutes.runs, 1);
        assertSome(report.runnerMinutes.meanManaged, 10);
        // 3 + 0.83 + 10 GitHub-hosted (Lint, Heavy Admission, the aggregate), 1 more for 402's admission, 10 managed.
        assertSome(report.runnerMinutes.greenCodeRunP50, 24.83);
      })
    );
  });
});

describe("ci certainty monotonicity", () => {
  it.layer(testLayer)((it) => {
    it.effect("never improves the SLO statistic when a green head turns red", () =>
      Effect.gen(function* () {
        const corpus = yield* loadCorpus(BASELINE);
        const baseline = yield* buildCiCertaintyReport(corpus);
        const greenCodeHeads = A.filter(
          baseline.heads,
          (head) => head.headClass === "code" && head.state === "green" && O.isNone(head.censor)
        );
        expect(A.length(greenCodeHeads)).toBeGreaterThan(0);
        yield* Effect.forEach(greenCodeHeads, (head) =>
          Effect.gen(function* () {
            const flipped = yield* buildCiCertaintyReport(failCriticalContext(corpus, head));
            const flippedHead = headStartingWith(flipped.heads, head.headSha);
            strictEqual(flippedHead.state, "red");
            strictEqual(flipped.slo.n, baseline.slo.n);
            strictEqual(flipped.slo.misses, baseline.slo.misses + 1);
            expect(percentileValue(flipped.slo.p50Minutes)).toBeGreaterThanOrEqual(
              percentileValue(baseline.slo.p50Minutes)
            );
            expect(percentileValue(flipped.slo.p95Minutes)).toBeGreaterThanOrEqual(
              percentileValue(baseline.slo.p95Minutes)
            );
            expect(flipped.slo.withinTen).toBeLessThanOrEqual(baseline.slo.withinTen);
          })
        );
      })
    );

    it.effect("counts a head that turned red before its successor's push, whatever ran after", () =>
      Effect.gen(function* () {
        const green = yield* buildCiCertaintyReport(supersessionCorpus("success"));
        const red = yield* buildCiCertaintyReport(supersessionCorpus("failure"));
        const greenHead = headStartingWith(green.heads, FIRST_PUSH);
        const redHead = headStartingWith(red.heads, FIRST_PUSH);
        // Required green at 40 min, the next push at 45 and a non-required job running to 55.
        strictEqual(greenHead.state, "green");
        assertNone(greenHead.censor);
        assertSome(greenHead.requiredGreenMinutes, 40);
        strictEqual(redHead.state, "red");
        assertNone(redHead.censor);
        strictEqual(red.slo.n, green.slo.n);
        strictEqual(red.slo.misses, green.slo.misses + 1);
        expect(percentileValue(red.slo.p95Minutes)).toBeGreaterThanOrEqual(percentileValue(green.slo.p95Minutes));
      })
    );

    it("counts a miss as unbounded rather than dropping it", () => {
      const heads = (values: ReadonlyArray<O.Option<number>>) =>
        A.map(
          values,
          (minutes) => ({ censor: O.none(), requiredGreenMinutes: minutes }) as unknown as CiCertaintyHeadRow
        );
      const allGreen = ciCertaintyLatencyStat(
        heads([O.some(5), O.some(8), O.some(30)]),
        (head) => head.requiredGreenMinutes
      );
      const oneMiss = ciCertaintyLatencyStat(
        heads([O.some(5), O.some(8), O.none()]),
        (head) => head.requiredGreenMinutes
      );
      assertSome(allGreen.p95Minutes, 30);
      strictEqual(oneMiss.p95Status, "not-attained");
      strictEqual(oneMiss.misses, 1);
      strictEqual(oneMiss.n, 3);
    });
  });
});

describe("ci certainty certification", () => {
  it.layer(testLayer)((it) => {
    it.effect("refuses certification on an api-partial census", () =>
      Effect.gen(function* () {
        const corpus = yield* loadCorpus(BASELINE);
        const target = O.getOrThrow(
          A.findFirst(corpus.pullRequestRuns, (run) => Str.startsWith("9f30182f")(run.run.head_sha))
        );
        const partial = CiCertaintyCorpus.make({
          ...corpus,
          pullRequestRuns: A.map(corpus.pullRequestRuns, (run) =>
            run.run.id === target.run.id
              ? CiCertaintyRun.make({
                  ...run,
                  partialReads: [CiWorkflowPartialRead.make({ attempt: 1, message: "HTTP 502", runId: run.run.id })],
                })
              : run
          ),
        });
        const report = yield* buildCiCertaintyReport(partial);

        assertFalse(report.certified);
        deepStrictEqual(report.refusals, ["api-partial"]);
        strictEqual(headStartingWith(report.heads, "9f30182f").state, "api-partial");
        expect(renderCiCertaintyMarkdown(report)).toContain("Not certified, not acceptance evidence.");
        expect(renderCiCertaintyMarkdown(report)).toContain(`run ${target.run.id} attempt 1`);
      })
    );

    it.effect("refuses certification when the main listing was partial or no code head counted", () =>
      Effect.gen(function* () {
        const corpus = yield* loadCorpus(BASELINE);
        const report = yield* buildCiCertaintyReport(
          CiCertaintyCorpus.make({ ...corpus, mainListingPartial: true, pullRequestRuns: [] })
        );

        deepStrictEqual(report.refusals, ["api-partial", "empty-population"]);
        strictEqual(report.slo.p95Status, "empty");
        // No job read failed, so the refusal stamp names no partial run.
        const rendered = renderCiCertaintyMarkdown(report);
        expect(rendered).toContain(
          "> **Not certified, not acceptance evidence.** Refused: api-partial, empty-population."
        );
        expect(rendered).not.toContain("partial job reads");
      })
    );
  });
});

// A synthetic window whose heads land in the states the recorded corpora never reach.
const SYNTHETIC_SINCE = DateTime.makeUnsafe("2026-11-09T00:00:00Z");
const SYNTHETIC_UNTIL = DateTime.makeUnsafe("2026-11-10T00:00:00Z");
const OPEN_HEAD = Str.repeat(40)("1");
const HELD_HEAD = Str.repeat(40)("2");
const NULL_CONCLUSION_HEAD = Str.repeat(40)("3");
const GREEN_HEAD = Str.repeat(40)("4");

const foldJob = (overrides: Partial<CiWorkflowJob>) =>
  CiWorkflowJob.make({
    completed_at: "2026-11-09T10:05:00Z",
    conclusion: "success",
    created_at: "2026-11-09T10:00:30Z",
    id: 1,
    labels: ["ubuntu-24.04"],
    name: "Lint",
    run_attempt: 1,
    run_id: 1,
    started_at: "2026-11-09T10:01:00Z",
    status: "completed",
    ...overrides,
  });

const foldRun = (
  id: number,
  headSha: string,
  createdAt: string,
  status: O.Option<string>,
  jobs: ReadonlyArray<CiWorkflowJob>
) =>
  CiCertaintyRun.make({
    jobs: A.map(jobs, (job) => CiWorkflowJob.make({ ...job, run_id: id })),
    run: CiWorkflowWindowRun.make({
      conclusion: O.none(),
      created_at: DateTime.makeUnsafe(createdAt),
      event: "pull_request",
      head_branch: O.some(`feat/${id}`),
      head_sha: headSha,
      id,
      run_attempt: 1,
      status,
    }),
    workflow: "check.yml",
  });

const syntheticCorpus = (mainCommits: ReadonlyArray<CiCertaintyMainCommit>) =>
  CiCertaintyCorpus.make({
    capturedAt: DateTime.makeUnsafe("2026-11-10T03:00:00Z"),
    mainCommits,
    pullRequestRuns: [
      // Still running: one job in progress, one queued, nothing finished yet.
      foldRun(101, OPEN_HEAD, "2026-11-09T09:00:00Z", O.some("in_progress"), [
        foldJob({
          completed_at: null,
          conclusion: null,
          id: 11,
          started_at: "2026-11-09T09:01:00Z",
          status: "in_progress",
        }),
        foldJob({
          completed_at: null,
          conclusion: null,
          id: 12,
          name: "Test Unit",
          started_at: null,
          status: "queued",
        }),
      ]),
      // A captured run without a status, whose jobs all finished, but Test Unit never ran.
      foldRun(102, HELD_HEAD, "2026-11-09T10:00:00Z", O.none(), [foldJob({ id: 21 })]),
      // GitHub reported completion without a conclusion: that is not green.
      foldRun(103, NULL_CONCLUSION_HEAD, "2026-11-09T11:00:00Z", O.some("completed"), [
        foldJob({ conclusion: null, id: 31 }),
        foldJob({ id: 32, name: "Test Unit" }),
      ]),
      foldRun(104, GREEN_HEAD, "2026-11-09T12:00:00Z", O.some("completed"), [
        // Never started: ranked by its creation time.
        foldJob({ completed_at: "2026-11-09T12:03:00Z", created_at: "2026-11-09T12:00:30Z", id: 41, started_at: null }),
        // Unreadable timestamps rank oldest, so this red copy never decides Lint.
        foldJob({
          completed_at: "2026-11-09T12:20:00Z",
          conclusion: "failure",
          created_at: "",
          id: 40,
          started_at: null,
        }),
        // Same start and attempt: the higher job id decides.
        foldJob({
          completed_at: "2026-11-09T12:06:00Z",
          conclusion: "failure",
          id: 42,
          name: "Test Unit",
          started_at: "2026-11-09T12:01:00Z",
        }),
        foldJob({
          completed_at: "2026-11-09T12:08:00Z",
          id: 43,
          name: "Test Unit",
          started_at: "2026-11-09T12:01:00Z",
        }),
        // A skipped Coverage Regression is not a coverage verdict.
        foldJob({
          completed_at: "2026-11-09T12:00:39Z",
          conclusion: "skipped",
          id: 44,
          name: "Heavy / Coverage Regression",
          started_at: "2026-11-09T12:00:40Z",
        }),
      ]),
    ],
    requestCount: 0,
    requiredContexts: ["Lint", "Test Unit"],
    since: SYNTHETIC_SINCE,
    until: SYNTHETIC_UNTIL,
  });

const OPEN_MAIN_COMMIT = CiCertaintyMainCommit.make({
  committedAt: DateTime.makeUnsafe("2026-11-09T15:00:00Z"),
  docsOnly: false,
  runs: [
    CiWorkflowWindowRun.make({
      created_at: DateTime.makeUnsafe("2026-11-09T15:00:30Z"),
      event: "push",
      head_sha: Str.repeat(40)("e"),
      id: 201,
      run_attempt: 1,
      status: O.some("in_progress"),
    }),
  ],
  sha: Str.repeat(40)("e"),
});

const DOCS_MAIN_COMMIT = CiCertaintyMainCommit.make({
  committedAt: DateTime.makeUnsafe("2026-11-09T16:00:00Z"),
  docsOnly: true,
  runs: [],
  sha: Str.repeat(40)("f"),
});

describe("ci certainty head states", () => {
  it.layer(testLayer)((it) => {
    it.effect("judges open, held, conclusion-less and tie-broken heads", () =>
      Effect.gen(function* () {
        const report = yield* buildCiCertaintyReport(syntheticCorpus([OPEN_MAIN_COMMIT, DOCS_MAIN_COMMIT]));

        const open = headStartingWith(report.heads, OPEN_HEAD);
        strictEqual(open.state, "open");
        assertSome(open.censor, "open");
        deepStrictEqual(
          A.map(open.contexts, (row) => row.state),
          ["pending", "pending"]
        );

        const held = headStartingWith(report.heads, HELD_HEAD);
        strictEqual(held.state, "held");
        assertNone(held.censor);

        strictEqual(headStartingWith(report.heads, NULL_CONCLUSION_HEAD).state, "red");

        const green = headStartingWith(report.heads, GREEN_HEAD);
        strictEqual(green.state, "green");
        assertSome(green.requiredGreenMinutes, 8);
        assertSome(green.criticalContext, "Test Unit");
        assertNone(green.coverageVerdictMinutes);
        const lint = O.getOrThrow(A.findFirst(green.contexts, (row) => row.context === "Lint"));
        assertSome(lint.runId, 104);
        strictEqual(lint.state, "green");

        // The open head is censored; the held and red heads are counted misses.
        strictEqual(report.slo.n, 3);
        strictEqual(report.slo.misses, 2);
        strictEqual(report.slo.censoredOpen, 1);
        strictEqual(report.slo.withinTen, 1);
        assertTrue(report.certified);

        // A main commit whose only run is still going has no verdict yet.
        strictEqual(report.main.open, 1);
        strictEqual(report.main.docsCommits, 1);
        assertSome(report.main.rate, 0);

        const rendered = renderCiCertaintyMarkdown(report);
        expect(rendered).not.toContain("Not certified");
        expect(rendered).toContain("| 1111111111 | code | open | open | — | — |  | 0.0 |");
        expect(rendered).toContain("| 4444444444 | code | green |  | 8.0 min | — | Test Unit | 12.0 |");
      })
    );

    it.effect("reports no main verdict rate when every main commit is documentation", () =>
      Effect.gen(function* () {
        const report = yield* buildCiCertaintyReport(syntheticCorpus([DOCS_MAIN_COMMIT]));

        strictEqual(report.main.commits, 0);
        strictEqual(report.main.docsCommits, 1);
        assertNone(report.main.rate);
      })
    );
  });
});

// The live capture through the command: a fake GitHub API and a scripted `git`.
const LIVE_HEAD = Str.repeat(40)("a");
const LATER_HEAD = Str.repeat(40)("c");
const MAIN_CODE = Str.repeat(40)("d");
const MAIN_DOCS = Str.repeat(40)("9");
const MAIN_EMPTY = Str.repeat(40)("8");
const LIVE_NOW = "2026-11-10T03:00:00Z";

const liveRun = (id: number, headSha: string, createdAt: string, event = "pull_request") => ({
  conclusion: "success",
  created_at: createdAt,
  event,
  head_branch: event === "push" ? "main" : "feat/live",
  head_sha: headSha,
  id,
  run_attempt: 1,
  status: "completed",
});

const liveJob = (
  runId: number,
  id: number,
  name: string,
  startedAt: string,
  completedAt: string,
  labels = ["ubuntu-24.04"]
) => ({
  completed_at: completedAt,
  conclusion: "success",
  created_at: startedAt,
  id,
  labels,
  name,
  run_attempt: 1,
  run_id: runId,
  runner_name: null,
  started_at: startedAt,
  status: "completed",
  steps: [],
});

const runsPage = (runs: ReadonlyArray<unknown>) => ({ total_count: A.length(runs), workflow_runs: runs });

const LIVE_JOBS: ReadonlyArray<readonly [number, ReadonlyArray<unknown>]> = [
  [
    11,
    [
      liveJob(11, 111, "Heavy Admission", "2026-11-09T10:00:30Z", "2026-11-09T10:01:00Z"),
      liveJob(11, 112, "Lint", "2026-11-09T10:01:00Z", "2026-11-09T10:05:00Z"),
    ],
  ],
  [12, [liveJob(12, 121, "Heavy / Check", "2026-11-09T10:02:00Z", "2026-11-09T10:12:00Z", ["beep-ec2-heavy"])]],
  [13, [liveJob(13, 131, "Lint", "2026-11-10T01:01:00Z", "2026-11-10T01:04:00Z")]],
];

const liveGithub = (call: GithubFetchCall): unknown => {
  const path = call.url.pathname;
  if (Str.includes("/actions/workflows/check.yml/runs")(path)) {
    return call.url.searchParams.get("event") === "push"
      ? runsPage([liveRun(21, MAIN_CODE, "2026-11-09T12:00:30Z", "push")])
      : runsPage([liveRun(11, LIVE_HEAD, "2026-11-09T10:00:00Z"), liveRun(13, LATER_HEAD, "2026-11-10T01:00:00Z")]);
  }
  if (Str.includes("/actions/workflows/heavy-admit.yml/runs")(path)) {
    return runsPage([liveRun(12, LIVE_HEAD, "2026-11-09T10:01:00Z")]);
  }
  return O.match(
    A.findFirst(LIVE_JOBS, ([runId]) => Str.includes(`/actions/runs/${runId}/attempts/1/jobs`)(path)),
    {
      onNone: () => reply(404)({ message: "Not Found" }),
      onSome: ([, jobs]) => ({ jobs, total_count: A.length(jobs) }),
    }
  );
};

const LIVE_PATHS: ReadonlyArray<readonly [string, string]> = [
  [MAIN_CODE, "packages/tooling/tool/cli/src/commands/Ci/Certainty.ts\n"],
  [MAIN_DOCS, "goals/certainty-scorecard/README.md\n"],
  // A commit that changed no path (an empty merge) is not documentation-only.
  [MAIN_EMPTY, ""],
];

// `%cI` prints the committer's own offset, never `Z`: 12:00Z, 13:00Z and 14:00Z written as git prints them.
const LIVE_LOG = A.join(
  [
    `${MAIN_CODE}\t2026-11-09T06:00:00-06:00`,
    `${MAIN_DOCS}\t2026-11-09T14:00:00+01:00`,
    `${MAIN_EMPTY}\t2026-11-09T14:00:00+00:00`,
    "",
  ],
  "\n"
);

// `gh auth token` for the client, then main's first-parent log and each commit's changed paths.
const liveGit = (
  log: { readonly stdout?: string; readonly exit?: number; readonly stderr?: string } = { stdout: LIVE_LOG }
) =>
  ScriptedSpawner.make((command, args) => {
    if (A.join([command, ...args], " ") === "gh auth token") {
      return { stdout: "ghs_fixture\n" };
    }
    if (command === "git" && A.contains(args, "log")) {
      return log;
    }
    return O.match(
      A.findFirst(LIVE_PATHS, ([sha]) => command === "git" && A.contains(args, "diff-tree") && A.contains(args, sha)),
      {
        onNone: () => ({ exit: 1, stderr: `unexpected ${command} ${A.join(args, " ")}` }),
        onSome: ([, paths]) => ({ stdout: paths }),
      }
    );
  });

const withLiveCapture =
  (calls: Array<GithubFetchCall>, spawner: ScriptedSpawner) =>
  <A, E, R>(program: Effect.Effect<A, E, R>) =>
    program.pipe(
      Effect.provideService(
        GithubTransportFetch,
        O.some(
          githubFetch((call) => {
            A.appendInPlace(calls, call);
            return liveGithub(call);
          }).fetch
        )
      ),
      provideSpawner(spawner),
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromUnknown({ GH_REPO: "beep-effect/beep-effect" })
      )
    );

const certaintyCommandLayer = Layer.mergeAll(
  NodeServices.layer,
  NodeCrypto.layer,
  MemoryFileSystem.layer,
  TestConsole.layer
);
const runCertaintyCommand = Command.runWith(ciCertaintyCommand, { version: "0.0.0" });

const lastCertaintyLog = Effect.fn("TestCiCertainty.lastLog")(function* () {
  const lines = yield* TestConsole.logLines;
  return O.getOrElse(A.last(A.filter(lines, P.isString)), () => "");
});

// The command reads the required contexts from the checkout it resolves, here inside the memory filesystem.
const seedRequiredContexts = Effect.fn("TestCiCertainty.seedRequiredContexts")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(Effect.orElseSucceed(() => process.cwd()));
  yield* fs.makeDirectory(path.join(repoRoot, "standards"), { recursive: true });
  yield* fs.writeFileString(
    path.join(repoRoot, "standards", "branch-protection-contexts.json"),
    '{"requiredStatusChecks":["Lint","Heavy / Check"]}'
  );
  yield* DateTime.makeUnsafe(LIVE_NOW).pipe(DateTime.toEpochMillis, TestClock.setTime);
  return repoRoot;
});

const gitLogArgs = (spawner: ScriptedSpawner): ReadonlyArray<string> =>
  O.getOrElse(
    O.map(
      A.findFirst(spawner.spawns, (spawn) => spawn.command === "git" && A.contains(spawn.args, "log")),
      (spawn) => spawn.args
    ),
    A.empty<string>
  );

const decodeReportJson = S.decodeUnknownEffect(S.fromJsonString(CiCertaintyReport));

const LIVE_WINDOW = ["--since", "2026-11-09T00:00:00Z", "--until", "2026-11-10T00:00:00Z"];

// Seeds the checkout, captures the fixed live window into a corpus file and returns what the capture printed.
const captureLiveWindow = Effect.fn("TestCiCertainty.captureLiveWindow")(function* () {
  const repoRoot = yield* seedRequiredContexts();
  const corpusFile = `${repoRoot}/certainty-corpus.json`;
  yield* runCertaintyCommand([...LIVE_WINDOW, "--write-corpus", corpusFile]);
  const markdown = yield* lastCertaintyLog();
  return { corpusFile, markdown, repoRoot };
});

describe("ci certainty command", () => {
  it.layer(certaintyCommandLayer, { timeout: "30 seconds" })((it) => {
    it.effect("captures a window live and renders its report", () => {
      const calls = A.empty<GithubFetchCall>();
      const spawner = liveGit();
      return Effect.gen(function* () {
        const { markdown, repoRoot } = yield* captureLiveWindow();

        expect(markdown).toContain("# ci certainty 2026-11-09T00:00:00.000Z → 2026-11-10T00:00:00.000Z");
        expect(markdown).not.toContain("Not certified");
        expect(markdown).toContain("- GitHub requests: 5");
        expect(markdown).toContain("| aaaaaaaaaa | code | green |  | 12.0 min |");
        // One code commit passed, one empty commit has no run, the docs commit is set apart.
        expect(markdown).toContain("non-docs first-parent commits: 2 (docs 1); completed verdicts 1; rate 50.0%");
        // The later head is outside the window: listed for supersession, its jobs never read.
        expect(A.some(calls, (call) => Str.includes("/actions/runs/13/")(call.url.pathname))).toBe(false);
        // Signatures stay off whatever the operator's gitconfig says, so only formatted lines reach the parser.
        deepStrictEqual(gitLogArgs(spawner), [
          "-C",
          repoRoot,
          "log",
          "--no-show-signature",
          "--first-parent",
          "--format=%H%x09%cI",
          "--since=2026-11-09T00:00:00.000Z",
          "--until=2026-11-10T00:00:00.000Z",
          "origin/main",
        ]);
      }).pipe(withLiveCapture(calls, spawner));
    });

    it.effect("writes the captured corpus and replays it without reading anything", () => {
      const calls = A.empty<GithubFetchCall>();
      const spawner = liveGit();
      return Effect.gen(function* () {
        const { corpusFile } = yield* captureLiveWindow();

        const fs = yield* FileSystem.FileSystem;
        const corpus = yield* fs.readFileString(corpusFile).pipe(Effect.flatMap(decodeCiCertaintyCorpus));
        strictEqual(corpus.requestCount, 5);
        assertFalse(corpus.mainListingPartial);
        // Commit times keep their instant whatever offset git printed them in.
        deepStrictEqual(
          A.map(corpus.mainCommits, (commit) => [
            commit.sha,
            DateTime.formatIso(commit.committedAt),
            commit.docsOnly,
            A.length(commit.runs),
          ]),
          [
            [MAIN_CODE, "2026-11-09T12:00:00.000Z", false, 1],
            [MAIN_DOCS, "2026-11-09T13:00:00.000Z", true, 0],
            [MAIN_EMPTY, "2026-11-09T14:00:00.000Z", false, 0],
          ]
        );
        deepStrictEqual(
          A.map(corpus.pullRequestRuns, (run) => [run.run.id, A.length(run.jobs)]),
          [
            [11, 2],
            [13, 0],
            [12, 1],
          ]
        );

        const readsBeforeReplay = A.length(calls);
        const spawnsBeforeReplay = A.length(spawner.spawns);
        yield* runCertaintyCommand(["--corpus", corpusFile, "--json"]);
        const replayed = yield* lastCertaintyLog().pipe(Effect.flatMap(decodeReportJson));
        assertTrue(replayed.certified);
        strictEqual(replayed.slo.n, 1);
        assertSome(replayed.slo.p50Minutes, 12);
        strictEqual(A.length(calls), readsBeforeReplay);
        strictEqual(A.length(spawner.spawns), spawnsBeforeReplay);
      }).pipe(withLiveCapture(calls, spawner));
    });

    it.effect("defaults to the 24 hours before now and refuses certification past the request bound", () => {
      const calls = A.empty<GithubFetchCall>();
      const spawner = liveGit();
      return Effect.gen(function* () {
        yield* seedRequiredContexts();
        // Two listings and three job reads fit; the main push listing is refused at the bound.
        const error = yield* Effect.flip(runCertaintyCommand(["--max-requests", "5"]));
        assertInstanceOf(error, CiCommandError);
        strictEqual(
          error.message,
          "Certification refused: api-partial. Pass --preview to accept an uncertified report."
        );
        const refused = yield* lastCertaintyLog();
        expect(refused).toContain("> **Not certified, not acceptance evidence.** Refused: api-partial.");
        strictEqual(A.length(calls), 5);
        expect(gitLogArgs(spawner)).toContain("--since=2026-11-09T03:00:00.000Z");
        expect(gitLogArgs(spawner)).toContain("--until=2026-11-10T03:00:00.000Z");

        // A preview accepts the same uncertified report, stamp and all, and prints it exactly once.
        const logsBeforePreview = yield* TestConsole.logLines;
        yield* runCertaintyCommand(["--max-requests", "5", "--preview"]);
        const logsAfterPreview = yield* TestConsole.logLines;
        strictEqual(A.length(logsAfterPreview), A.length(logsBeforePreview) + 1);
        assertSome(A.last(logsAfterPreview), refused);
      }).pipe(withLiveCapture(calls, spawner));
    });

    it.effect("refuses an unreadable or empty window before reading GitHub or git", () => {
      const calls = A.empty<GithubFetchCall>();
      const spawner = liveGit();
      return Effect.gen(function* () {
        yield* seedRequiredContexts();
        const messages = yield* Effect.forEach(
          [
            ["--since", "yesterday"],
            ["--until", "tomorrow"],
            ["--since", "2026-11-10T00:00:00Z", "--until", "2026-11-10T00:00:00Z"],
          ],
          (args) =>
            Effect.flip(runCertaintyCommand(args)).pipe(
              Effect.map((error) => {
                assertInstanceOf(error, CiCommandError);
                return error.message;
              })
            )
        );
        deepStrictEqual(messages, [
          "--since must be an ISO-8601 UTC timestamp; received yesterday.",
          "--until must be an ISO-8601 UTC timestamp; received tomorrow.",
          "--since must be earlier than --until.",
        ]);
        deepStrictEqual(calls, []);
        deepStrictEqual(spawner.spawns, []);
      }).pipe(withLiveCapture(calls, spawner));
    });

    it.effect("fails the capture when git cannot read main's history", () => {
      const calls = A.empty<GithubFetchCall>();
      return Effect.gen(function* () {
        yield* seedRequiredContexts();
        const error = yield* Effect.flip(runCertaintyCommand(["--since", "2026-11-09T00:00:00Z"]));
        assertInstanceOf(error, CiCommandError);
        strictEqual(error.message, "Failed to read main's first-parent history with git.");
      }).pipe(withLiveCapture(calls, liveGit({ exit: 128, stderr: "fatal: bad revision 'origin/main'\n" })));
    });

    it.effect("fails the capture on a git log line without a valid commit time", () =>
      Effect.gen(function* () {
        // One line lacks the time field, the other carries one that does not parse.
        const messages = yield* Effect.forEach([MAIN_CODE, `${MAIN_CODE}\tnot-a-time`], (line) =>
          Effect.gen(function* () {
            yield* seedRequiredContexts();
            const error = yield* Effect.flip(runCertaintyCommand(["--since", "2026-11-09T00:00:00Z"]));
            assertInstanceOf(error, CiCommandError);
            return error.message;
          }).pipe(withLiveCapture(A.empty<GithubFetchCall>(), liveGit({ stdout: `${line}\n` })))
        );
        deepStrictEqual(messages, [
          `git log printed a commit line without a valid commit time: ${MAIN_CODE}`,
          `git log printed a commit line without a valid commit time: ${MAIN_CODE}\tnot-a-time`,
        ]);
      })
    );
  });
});

const attemptJob = (id: number, runAttempt: number, name = `Job ${id}`) =>
  CiWorkflowJob.make({
    completed_at: "2026-11-09T16:33:13Z",
    conclusion: "success",
    created_at: "2026-11-09T16:32:00Z",
    id,
    labels: ["ubuntu-24.04"],
    name,
    run_attempt: runAttempt,
    run_id: 7,
    started_at: "2026-11-09T16:32:13Z",
    status: "completed",
  });

const jobsPage = (jobs: ReadonlyArray<CiWorkflowJob>) => ({
  jobs: A.map(jobs, (job) => ({ ...job })),
  total_count: A.length(jobs),
});

// A scripted client: each endpoint is answered by the first matching route, or fails as an exhausted 502.
const scriptedAttemptClient = (
  reads: Array<string>,
  routes: ReadonlyArray<{ readonly matches: (endpoint: string) => boolean; readonly body: unknown }>
) =>
  CiLaneTimingGithubClient.of({
    getJson: Effect.fn("TestCertaintyAttemptClient.getJson")(
      (endpoint: string): Effect.Effect<unknown, CiCommandError> => {
        A.appendInPlace(reads, endpoint);
        return O.match(
          A.findFirst(routes, (route) => route.matches(endpoint)),
          {
            onNone: () =>
              Effect.fail(CiCommandError.make({ message: `${endpoint} failed (HTTP 502) on every one of 5 attempts` })),
            onSome: (route) => Effect.succeed(route.body),
          }
        );
      }
    ),
  });

describe("ci per-attempt job reads", () => {
  it.effect("unions attempts by (id, run_attempt) and keeps rerun copies as their own rows", () => {
    const reads = A.empty<string>();
    return Effect.gen(function* () {
      const read = yield* collectCiWorkflowRunAttemptJobs(7, 2);

      // Attempt 2 re-lists job 1's copy as job 3 and repeats job 2 on a second page by mistake.
      deepStrictEqual(
        A.map(read.jobs, (job) => [job.id, job.run_attempt]),
        [
          [1, 1],
          [2, 1],
          [3, 2],
        ]
      );
      deepStrictEqual(read.partialReads, []);
      assertTrue(A.every(reads, Str.includes("/actions/runs/7/attempts/")));
    }).pipe(
      Effect.provideService(
        CiLaneTimingGithubClient,
        scriptedAttemptClient(reads, [
          {
            matches: Str.includes("/attempts/1/"),
            body: jobsPage([attemptJob(1, 1), attemptJob(2, 1), attemptJob(2, 1)]),
          },
          { matches: Str.includes("/attempts/2/"), body: jobsPage([attemptJob(3, 2, "Job 1")]) },
        ])
      )
    );
  });

  it.effect("re-reads an attempt in pages of 30 when its 100-job pages exhaust their retries", () => {
    const reads = A.empty<string>();
    return Effect.gen(function* () {
      const read = yield* collectCiWorkflowRunAttemptJobs(7, 1);

      deepStrictEqual(
        A.map(read.jobs, (job) => job.id),
        [1]
      );
      deepStrictEqual(read.partialReads, []);
      assertTrue(A.some(reads, Str.includes("per_page=100")));
      assertTrue(A.some(reads, Str.includes("per_page=30")));
    }).pipe(
      Effect.provideService(
        CiLaneTimingGithubClient,
        scriptedAttemptClient(reads, [{ matches: Str.includes("per_page=30"), body: jobsPage([attemptJob(1, 1)]) }])
      )
    );
  });

  it.effect("stamps an exhausted attempt as a partial read instead of dropping the run", () => {
    const reads = A.empty<string>();
    return Effect.gen(function* () {
      const read = yield* collectCiWorkflowRunAttemptJobs(7, 3);

      deepStrictEqual(
        A.map(read.jobs, (job) => job.id),
        [1, 3]
      );
      deepStrictEqual(
        A.map(read.partialReads, (partial) => [partial.runId, partial.attempt]),
        [[7, 2]]
      );
      expect(O.getOrThrow(A.head(read.partialReads)).message).toContain("HTTP 502");
    }).pipe(
      Effect.provideService(
        CiLaneTimingGithubClient,
        scriptedAttemptClient(reads, [
          { matches: Str.includes("/attempts/1/"), body: jobsPage([attemptJob(1, 1)]) },
          { matches: Str.includes("/attempts/3/"), body: jobsPage([attemptJob(3, 3)]) },
        ])
      )
    );
  });

  it("counts a rerun copy's runner-minutes once", () => {
    const copy = CiWorkflowJob.make({ ...attemptJob(2, 2, "Job 1"), labels: ["beep-ec2-heavy"] });
    const original = CiWorkflowJob.make({ ...attemptJob(1, 1), labels: ["beep-ec2-heavy"] });
    const minutes = ciCertaintyRunnerMinutes([original, copy]);
    strictEqual(minutes.managed, 1);
    strictEqual(minutes.githubHosted, 0);
  });
});
