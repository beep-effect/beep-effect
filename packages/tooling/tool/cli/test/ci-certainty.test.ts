// Replays the committed certainty corpora (test/fixtures/ci-certainty, decision `in-repo-fixture-corpus`
// in goals/certainty-scorecard) and pins the per-head cases, monotonicity and api-partial refusal.

import * as NodeURL from "node:url";
import {
  buildCiCertaintyReport,
  CiCertaintyCorpus,
  CiCertaintyRun,
  CiCommandError,
  CiLaneTimingGithubClient,
  CiWorkflowJob,
  CiWorkflowPartialRead,
  ciCertaintyLatencyStat,
  ciCertaintyRunnerMinutes,
  collectCiWorkflowRunAttemptJobs,
  decodeCiCertaintyCorpus,
  renderCiCertaintyMarkdown,
} from "@beep/repo-cli/commands/Ci";
import { A, O, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import type { CiCertaintyHeadRow } from "@beep/repo-cli/commands/Ci";

const testLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);

const fixturePath = (name: string): string =>
  NodeURL.fileURLToPath(new URL(`./fixtures/ci-certainty/${name}`, import.meta.url));

const loadCorpus = (name: string) =>
  FileSystem.FileSystem.use((fs) => fs.readFileString(fixturePath(name))).pipe(Effect.flatMap(decodeCiCertaintyCorpus));

const BASELINE = "baseline-2026-11-09.json";
const PLANNED = "planned-2026-11-10.json";

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
        strictEqual(report.slo.n, 17);
        strictEqual(report.slo.misses, 6);
        strictEqual(report.slo.censoredSuperseded, 14);
        strictEqual(report.slo.censoredOpen, 0);
        strictEqual(report.slo.withinTen, 1);
        assertSome(report.slo.p50Minutes, 63.35);
        strictEqual(report.slo.p95Status, "not-attained");
        assertNone(report.slo.p95Minutes);
        // The green-only diagnostic reproduces the recorded 101.9-minute p95 (facc14a6, three attempts).
        strictEqual(report.greenOnly.n, 11);
        assertSome(report.greenOnly.p95Minutes, 101.9);
        // Four heads finished under ten minutes: one code head and three docs heads.
        strictEqual(report.slo.withinTen + report.docsHeads.withinTen, 4);
        strictEqual(report.docsHeads.n, 4);
        strictEqual(report.docsHeads.misses, 1);
        // Runner-minutes per producer run and the superseded share.
        strictEqual(report.runnerMinutes.runs, 40);
        assertSome(report.runnerMinutes.meanTotal, 219.7);
        assertSome(report.supersededRunnerMinuteShare, 0.4083);
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

        // Cancelled because a newer head of the branch arrived: censored, cost counted in the share.
        const superseded = headStartingWith(report.heads, "93ef8b3a");
        assertSome(superseded.censor, "superseded");
      })
    );

    it.effect("reports the post-#3030 admission and Test Unit selection rows", () =>
      Effect.gen(function* () {
        const report = yield* loadCorpus(PLANNED).pipe(Effect.flatMap(buildCiCertaintyReport));

        assertTrue(report.certified);
        strictEqual(report.admissionToHeavy.n, 15);
        assertSome(report.admissionToHeavy.p50Minutes, 6.45);
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
