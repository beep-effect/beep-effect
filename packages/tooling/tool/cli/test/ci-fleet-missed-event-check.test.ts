import { ActionOutputs } from "@beep/github-actions/ActionOutputs";
import {
  CiCommandError,
  checkingRun,
  ciFleetMissedEventCheckCommand,
  classifyFleetEvidence,
  decideFleetVerdict,
  deliveryWindow,
  earlierFleetRuns,
  FLEET_CHECK_JOB_NAME,
  FleetCheckingRun,
  FleetCheckJob,
  FleetCheckReport,
  FleetDeliveryDetail,
  FleetDeliveryEvidence,
  FleetGithubFixture,
  FleetGithubReads,
  FleetGuardDecision,
  FleetGuardInput,
  FleetHookDelivery,
  FleetHookSource,
  FleetHookSourceEntry,
  FleetJob,
  FleetJobFinding,
  FleetJobsPage,
  FleetMissedEventInput,
  FleetPoolCap,
  FleetPoolCapsInput,
  FleetPoolObservation,
  FleetPreviousRun,
  FleetReadError,
  FleetRunner,
  FleetRunnersPage,
  FleetRunsPage,
  FleetRunsQuery,
  FleetSleep,
  FleetVerdict,
  FleetWatchToken,
  FleetWorkflowRun,
  failOnFleetAlerts,
  fleetGuardDecision,
  fleetHookSources,
  fleetPoolCaps,
  fleetPoolCapsProjection,
  fleetPreviousRun,
  fleetRemedies,
  fleetVerdictLabel,
  hookSourceAt,
  isCadenceGapFinding,
  isFleetAlert,
  judgeDeliveryEvidence,
  layerFleetGithubReadsLive,
  layerFleetMissedEventLive,
  nextLinkCursor,
  percentile95,
  productionFleetPools,
  quoteJsonIds,
  renderFleetCheckSummary,
  renderFleetGuardDecision,
  runFleetMissedEventCheck,
  runFleetMissedEventGuard,
} from "@beep/repo-cli/commands/Ci";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import { parseWorkflowYaml, yamlAt } from "./support/WorkflowYaml.ts";
import type { FleetGithubReadsShape } from "@beep/repo-cli/commands/Ci";

const REPOSITORY = "beep-effect/beep-effect";
const HOOK = "714397446";
const NOW = DateTime.toEpochMillis(DateTime.makeUnsafe("2026-11-22T21:20:00Z"));
const minutes = (count: number): number => count * 60_000;
const ago = (count: number): number => NOW - minutes(count);

const HEAVY = FleetPoolCap.make({ pool: "heavy", label: "beep-fleet-heavy", cap: 2 });
const heavyAt = (cap: number) => FleetPoolCap.make({ pool: "heavy", label: "beep-fleet-heavy", cap });
const OVERFLOW = FleetPoolCap.make({ pool: "overflow", label: "beep-fleet-overflow", cap: 48 });

const hookSource = FleetHookSource.cases.RepositoryHook.make({ hookId: HOOK });
const noHook = FleetHookSource.cases.NoHook.make({});
const hookSources = [FleetHookSourceEntry.make({ source: hookSource, effectiveFrom: 0 })] as const;
const gateSources = [FleetHookSourceEntry.make({ source: noHook, effectiveFrom: 0 })] as const;

type RunnerState = "idle" | "busy" | "offline";

const runner = (id: number, state: RunnerState, label = "beep-fleet-heavy") =>
  FleetRunner.make({
    id,
    name: `beep-fleet-${id}`,
    online: state !== "offline",
    busy: state === "busy",
    labels: ["self-hosted", label],
  });

const queued = (id: number, createdAt: number, label = "beep-fleet-heavy") =>
  FleetJob.make({
    id,
    runId: id + 3000,
    name: `job ${id}`,
    status: "queued",
    labels: [label],
    createdAt,
    startedAt: O.none(),
    runnerName: O.none(),
  });

const started = (id: number, createdAt: number, startedAt: number, runnerName: O.Option<string> = O.some("r")) =>
  FleetJob.make({
    id,
    runId: id + 3000,
    name: `job ${id}`,
    status: O.isSome(runnerName) ? "in_progress" : "completed",
    labels: ["beep-fleet-heavy"],
    createdAt,
    startedAt: O.some(startedAt),
    runnerName,
  });

const delivery = (id: string, deliveredAt: number, statusCode = 200, action: O.Option<string> = O.some("queued")) =>
  FleetHookDelivery.make({ id, deliveredAt, statusCode, action });

const run = (id: number, createdAt: number) => FleetWorkflowRun.make({ id, createdAt });

const ranAt = (runId: number, startedAt: number) => ({ runId, job: FleetCheckJob.cases.Ran.make({ startedAt }) });

const detail = (id: string, jobId: number) => FleetDeliveryDetail.make({ id, workflowJobId: O.some(`${jobId}`) });

const fixtureOf = (input: {
  readonly reads: ReadonlyArray<ReadonlyArray<FleetRunner>>;
  readonly jobs: ReadonlyArray<FleetJob>;
  readonly deliveries?: ReadonlyArray<FleetHookDelivery>;
  readonly details?: ReadonlyArray<FleetDeliveryDetail>;
  readonly failingDetails?: ReadonlyArray<string>;
  readonly failDeliveryPageAt?: number;
  readonly workflowRuns?: O.Option<ReadonlyArray<FleetWorkflowRun>>;
  readonly checkJobs?: ReadonlyArray<{ readonly runId: number; readonly job: FleetCheckJob }>;
  readonly failingCheckJobs?: ReadonlyArray<number>;
  readonly pageSize?: number;
  readonly recentRuns?: ReadonlyArray<number>;
}) =>
  FleetGithubFixture.make({
    runnerReads: input.reads,
    queuedRuns: A.dedupe(
      A.map(
        A.filter(input.jobs, (job) => job.status === "queued"),
        (job) => job.runId
      )
    ),
    inProgressRuns: A.dedupe(
      A.map(
        A.filter(input.jobs, (job) => job.status === "in_progress"),
        (job) => job.runId
      )
    ),
    recentRuns: A.dedupe(input.recentRuns ?? A.map(input.jobs, (job) => job.runId)),
    jobs: input.jobs,
    deliveries: input.deliveries ?? [],
    details: input.details ?? [],
    failingDetails: input.failingDetails ?? [],
    failDeliveryPageAt: O.fromUndefinedOr(input.failDeliveryPageAt),
    workflowRuns: input.workflowRuns ?? O.some([]),
    checkJobs: input.checkJobs ?? [],
    failingCheckJobs: input.failingCheckJobs ?? [],
    pageSize: input.pageSize ?? 100,
  });

interface Calls {
  readonly deliveriesPage: number;
  readonly deliveryDetail: number;
  readonly jobsPage: number;
}

const countingReads = (
  fixture: FleetGithubFixture,
  calls: Ref.Ref<Calls>,
  overrides: Partial<FleetGithubReadsShape> = {}
) =>
  Layer.effect(
    FleetGithubReads,
    Effect.gen(function* () {
      const base = yield* FleetGithubReads;
      const bump = (key: keyof Calls) => Ref.update(calls, (current) => ({ ...current, [key]: current[key] + 1 }));
      return FleetGithubReads.of({
        ...base,
        deliveriesPage: flow(base.deliveriesPage, Effect.ensuring(bump("deliveriesPage"))),
        deliveryDetail: flow(base.deliveryDetail, Effect.ensuring(bump("deliveryDetail"))),
        jobsPage: flow(base.jobsPage, Effect.ensuring(bump("jobsPage"))),
        ...overrides,
      });
    })
  ).pipe(Layer.provide(FleetGithubReads.layerFake(fixture)));

const FIRST_READ_AT = NOW - 300_000;

const advancingSleep = (slept: Ref.Ref<ReadonlyArray<number>>) =>
  Layer.effect(
    FleetSleep,
    Effect.gen(function* () {
      const base = yield* FleetSleep;
      return FleetSleep.of({
        sleep: Effect.fn("FleetSleep.advancing.sleep")(function* (duration: Duration.Duration) {
          yield* base.sleep(duration);
          yield* TestClock.adjust(duration);
        }),
      });
    })
  ).pipe(Layer.provide(FleetSleep.layerFake(slept)));

const inputOf = (options: {
  readonly pools?: ReadonlyArray<FleetPoolCap>;
  readonly sources?: readonly [FleetHookSourceEntry, ...Array<FleetHookSourceEntry>];
  readonly currentRunId?: number;
  readonly stepSummary?: boolean;
}) =>
  FleetMissedEventInput.make({
    repository: REPOSITORY,
    workflowFile: "fleet-missed-event-check.yml",
    currentRunId: O.fromUndefinedOr(options.currentRunId),
    stepSummary: options.stepSummary ?? false,
    pools: options.pools ?? [HEAVY],
    hookSources: options.sources ?? hookSources,
  });

const runCheck = Effect.fnUntraced(function* (
  fixture: FleetGithubFixture,
  options: Parameters<typeof inputOf>[0] & { readonly overrides?: Partial<FleetGithubReadsShape> } = {}
) {
  yield* TestClock.setTime(FIRST_READ_AT);
  const slept = yield* Ref.make<ReadonlyArray<number>>([]);
  const calls = yield* Ref.make<Calls>({ deliveriesPage: 0, deliveryDetail: 0, jobsPage: 0 });
  const outputs = ActionOutputs.recording();
  const report = yield* runFleetMissedEventCheck(inputOf(options)).pipe(
    provideScopedLayer(
      Layer.mergeAll(countingReads(fixture, calls, options.overrides), advancingSleep(slept), outputs.layer)
    )
  );
  return {
    report,
    slept: yield* Ref.get(slept),
    calls: yield* Ref.get(calls),
    summaries: A.map(
      A.filter(outputs.entries(), (entry) => entry.member === "summary"),
      (entry) => entry.value
    ),
  };
});

const findingOf = (report: FleetCheckReport, jobId: number): FleetJobFinding =>
  O.getOrThrow(A.findFirst(report.findings, (finding) => finding.job.id === jobId));

const tagOf = (report: FleetCheckReport, jobId: number): string => findingOf(report, jobId).verdict._tag;

describe("fleet missed-event check verdicts", () => {
  it.effect("Stuck: an idle runner at cap in both reads while a pool job is queued", () =>
    Effect.gen(function* () {
      const read = [runner(1, "idle"), runner(2, "busy")];
      const { report, slept } = yield* runCheck(fixtureOf({ reads: [read, read], jobs: [queued(101, ago(6))] }), {
        sources: gateSources,
      });
      const finding = findingOf(report, 101);
      expect(finding.verdict).toEqual(FleetVerdict.cases.Stuck.make({ idleRunnerIds: [1] }));
      expect(finding.evidence).toEqual(FleetDeliveryEvidence.cases.Gate.makeOption({}));
      expect(report.pools[0]?.firstReadAt).toBe(FIRST_READ_AT);
      expect(slept).toEqual([300_000]);
    })
  );

  it.effect("WaitingAtCap, not Stuck: a job created between the two runner reads may not be picked up yet", () =>
    Effect.gen(function* () {
      const read = [runner(1, "idle"), runner(2, "busy")];
      const { report } = yield* runCheck(
        fixtureOf({ reads: [read, read], jobs: [queued(111, ago(2)), queued(112, ago(6))] }),
        { sources: gateSources }
      );
      expect(findingOf(report, 111).verdict).toEqual(FleetVerdict.cases.WaitingAtCap.make({}));
      expect(tagOf(report, 112)).toBe("Stuck");
    })
  );

  it.effect("Waiting, not NoLaunch: a runner idle only in the second read, below cap, with progress", () =>
    Effect.gen(function* () {
      const jobs = [started(210, ago(20), ago(14)), queued(211, ago(12))];
      const { report } = yield* runCheck(
        fixtureOf({ reads: [[runner(1, "busy")], [runner(1, "busy"), runner(2, "idle")]], jobs }),
        { pools: [heavyAt(5)], sources: gateSources }
      );
      const pool = report.pools[0];
      expect([pool?.idleRunnerIds, pool?.secondReadIdleRunnerIds, pool?.progress]).toEqual([[], [2], true]);
      expect(findingOf(report, 211).verdict).toEqual(FleetVerdict.cases.Waiting.make({ launches: 1, rank: 1 }));
    })
  );

  it.effect("Wedged: two ghost offline runners at cap 2, a job queued 20 minutes and no progress", () =>
    Effect.gen(function* () {
      const read = [runner(1, "offline"), runner(2, "offline")];
      const { report } = yield* runCheck(fixtureOf({ reads: [read, read], jobs: [queued(102, ago(20))] }));
      expect(findingOf(report, 102).verdict).toEqual(FleetVerdict.cases.Wedged.make({ notBusyRunnerIds: [1, 2] }));
      expect(report.pools[0]?.idleRunnerIds).toEqual([]);
    })
  );

  it.effect("WaitingAtCap: two busy runners on 40-minute jobs at cap 2", () =>
    Effect.gen(function* () {
      const read = [runner(1, "busy"), runner(2, "busy")];
      const jobs = [started(1, ago(45), ago(40)), started(2, ago(45), ago(40)), queued(109, ago(20))];
      const { report } = yield* runCheck(fixtureOf({ reads: [read, read], jobs }));
      expect(tagOf(report, 109)).toBe("WaitingAtCap");
      expect(report.pools[0]?.progress).toBe(false);
      expect(isFleetAlert(findingOf(report, 109).verdict)).toBe(false);
    })
  );

  it.effect("WaitingAtCap, not Stuck: a cap read that cycles between the two runner reads", () =>
    Effect.gen(function* () {
      const jobs = [started(2, ago(8), ago(5)), queued(114, ago(12))];
      const { report } = yield* runCheck(
        fixtureOf({ reads: [[runner(1, "idle"), runner(2, "busy")], [runner(2, "busy")]], jobs }),
        { sources: gateSources }
      );
      const pool = report.pools[0];
      expect([pool?.firstCount, pool?.secondCount, pool?.atCap]).toEqual([2, 1, true]);
      expect(tagOf(report, 114)).toBe("WaitingAtCap");
    })
  );

  it.effect("MissedDelivery: no 2xx queued delivery for a job queued below cap, ahead of NoLaunch", () =>
    Effect.gen(function* () {
      const job = queued(103, ago(12));
      const other = "9000000000000000001";
      const { report } = yield* runCheck(
        fixtureOf({
          reads: [[], []],
          jobs: [job],
          deliveries: [delivery(other, ago(15))],
          details: [detail(other, 999)],
        })
      );
      const finding = findingOf(report, 103);
      expect(finding.verdict._tag).toBe("MissedDelivery");
      assertNone(finding.classification);
      expect(finding.evidence).toEqual(
        FleetDeliveryEvidence.cases.NotDelivered.makeOption({
          windowStart: ago(14),
          windowEnd: ago(7),
          oldestReached: ago(15),
        })
      );
    })
  );

  it.effect("MissedDelivery below the 10-minute threshold, from a failed delivery", () =>
    Effect.gen(function* () {
      const id = "3855552300210716674";
      const { report } = yield* runCheck(
        fixtureOf({
          reads: [[], []],
          jobs: [queued(110, ago(7))],
          deliveries: [delivery(id, ago(7) + 1000, 502), delivery("1", ago(30))],
          details: [detail(id, 110), detail("1", 1)],
        })
      );
      const finding = findingOf(report, 110);
      expect(finding.verdict._tag).toBe("MissedDelivery");
      expect(finding.evidence).toEqual(
        FleetDeliveryEvidence.cases.DeliveryFailed.makeOption({ hookId: HOOK, deliveryId: id, statusCode: 502 })
      );
    })
  );

  it.effect("a known failed delivery prints its redelivery only; a missed one prints the cancel-and-rerun pair", () =>
    Effect.gen(function* () {
      const id = "3855552300210716680";
      const { report } = yield* runCheck(
        fixtureOf({
          reads: [[], []],
          jobs: [queued(115, ago(12)), queued(116, ago(12))],
          deliveries: [delivery(id, ago(12) + 1000, 502), delivery("5", ago(30))],
          details: [detail(id, 115), detail("5", 5)],
        })
      );
      expect([tagOf(report, 115), tagOf(report, 116)]).toEqual(["MissedDelivery", "MissedDelivery"]);
      expect(fleetRemedies(REPOSITORY, findingOf(report, 115))).toEqual([
        `redeliver: \`gh api -X POST repos/${REPOSITORY}/hooks/${HOOK}/deliveries/${id}/attempts\``,
      ]);
      expect(fleetRemedies(REPOSITORY, findingOf(report, 116))).toEqual([
        `gate's call (reruns the whole run): \`gh run cancel 3116 --repo ${REPOSITORY}\`, then once the run completes \`gh run rerun 3116 --repo ${REPOSITORY}\``,
      ]);
    })
  );

  it.effect("NoLaunch lost: a 2xx delivery, below cap and no progress", () =>
    Effect.gen(function* () {
      const id = "3855552300210716675";
      const { report } = yield* runCheck(
        fixtureOf({
          reads: [[], []],
          jobs: [queued(104, ago(12))],
          deliveries: [delivery(id, ago(12) + 2000), delivery("2", ago(40))],
          details: [detail(id, 104), detail("2", 2)],
        })
      );
      const finding = findingOf(report, 104);
      expect(finding.verdict).toEqual(
        FleetVerdict.cases.NoLaunch.make({ reason: "no-progress", launches: 0, rank: 1 })
      );
      assertSome(finding.classification, "lost");
      expect(fleetRemedies(REPOSITORY, finding)).toEqual([
        `redeliver: \`gh api -X POST repos/${REPOSITORY}/hooks/${HOOK}/deliveries/${id}/attempts\``,
      ]);
    })
  );

  it.effect("NoLaunch unknown: a detail read that fails after its retries", () =>
    Effect.gen(function* () {
      const id = "4000000000000000001";
      const { report, slept, calls } = yield* runCheck(
        fixtureOf({
          reads: [[], []],
          jobs: [queued(105, ago(12))],
          deliveries: [delivery(id, ago(12) + 500), delivery("3", ago(30))],
          details: [detail("3", 3)],
          failingDetails: [id],
        })
      );
      const finding = findingOf(report, 105);
      expect(finding.verdict._tag).toBe("NoLaunch");
      assertSome(finding.classification, "unknown");
      expect(calls.deliveryDetail).toBe(3);
      expect(slept).toEqual([300_000, 2000, 2000]);
      expect(fleetRemedies(REPOSITORY, finding)).toEqual([]);
    })
  );

  it.effect("NoLaunch unknown: delivery pages that do not reach back to the job's window start", () =>
    Effect.gen(function* () {
      const id = "4000000000000000002";
      const { report } = yield* runCheck(
        fixtureOf({
          reads: [[], []],
          jobs: [queued(106, ago(12))],
          deliveries: [delivery(id, ago(11))],
          details: [detail(id, 999)],
        })
      );
      const finding = findingOf(report, 106);
      assertSome(finding.classification, "unknown");
      expect(finding.evidence).toEqual(
        FleetDeliveryEvidence.cases.Unreadable.makeOption({
          reason: "the pages read do not reach back to the job's delivery window start",
          oldestReached: O.some(ago(11)),
        })
      );
    })
  );

  it.effect("NoLaunch unknown: a walk that reaches the job's creation but not its window start", () =>
    Effect.gen(function* () {
      const { report } = yield* runCheck(
        fixtureOf({
          reads: [[], []],
          jobs: [queued(220, ago(12))],
          deliveries: [delivery("4000000000000000220", ago(11)), delivery("4000000000000000221", ago(13))],
          details: [detail("4000000000000000220", 998), detail("4000000000000000221", 999)],
        })
      );
      const finding = findingOf(report, 220);
      expect(finding.verdict._tag).toBe("NoLaunch");
      assertSome(finding.classification, "unknown");
      expect(finding.evidence).toEqual(
        FleetDeliveryEvidence.cases.Unreadable.makeOption({
          reason: "the pages read do not reach back to the job's delivery window start",
          oldestReached: O.some(ago(13)),
        })
      );
    })
  );

  it.effect("NoLaunch unknown: a delivery walk stopped at 60 pages", () =>
    Effect.gen(function* () {
      const deliveries = A.map(A.range(1, 61), (n) => delivery(`${9100 + n}`, ago(1)));
      const { report, calls } = yield* runCheck(
        fixtureOf({ reads: [[], []], jobs: [queued(230, ago(12))], deliveries, pageSize: 1 })
      );
      const finding = findingOf(report, 230);
      expect(calls.deliveriesPage).toBe(60);
      assertSome(finding.classification, "unknown");
      expect(finding.evidence).toEqual(
        FleetDeliveryEvidence.cases.Unreadable.makeOption({
          reason: "the delivery walk stopped at 60 pages",
          oldestReached: O.some(ago(1)),
        })
      );
    })
  );

  it.effect("NoLaunch unknown: a delivery page read that fails before reaching the job", () =>
    Effect.gen(function* () {
      const { report } = yield* runCheck(
        fixtureOf({
          reads: [[], []],
          jobs: [queued(108, ago(12))],
          deliveries: [delivery("5", ago(1)), delivery("6", ago(20))],
          details: [detail("5", 5), detail("6", 6)],
          failDeliveryPageAt: 1,
          pageSize: 1,
        })
      );
      const finding = findingOf(report, 108);
      assertSome(finding.classification, "unknown");
      expect(
        O.exists(finding.evidence, (evidence) =>
          FleetDeliveryEvidence.guards.Unreadable(evidence)
            ? Str.includes("failed after 3 attempts")(evidence.reason)
            : false
        )
      ).toBe(true);
    })
  );

  it.effect("NoLaunch delivery evidence: gate, from 6b", () =>
    Effect.gen(function* () {
      const { report, calls } = yield* runCheck(fixtureOf({ reads: [[], []], jobs: [queued(107, ago(12))] }), {
        sources: gateSources,
      });
      const finding = findingOf(report, 107);
      expect(finding.verdict._tag).toBe("NoLaunch");
      assertSome(finding.classification, "gate");
      expect(calls.deliveriesPage).toBe(0);
      expect(fleetRemedies(REPOSITORY, finding)).toEqual([
        "gate: run the gate's enrichment and App-redelivery command for this job",
        `gate's call (reruns the whole run): \`gh run cancel 3107 --repo ${REPOSITORY}\`, then once the run completes \`gh run rerun 3107 --repo ${REPOSITORY}\``,
      ]);
    })
  );

  it.effect("the 6b switch in the middle of a window classifies each job by its creation", () =>
    Effect.gen(function* () {
      const sources = [
        FleetHookSourceEntry.make({ source: hookSource, effectiveFrom: 0 }),
        FleetHookSourceEntry.make({ source: noHook, effectiveFrom: ago(10) }),
      ] as const;
      const id = "4100000000000000001";
      const { report } = yield* runCheck(
        fixtureOf({
          reads: [[], []],
          jobs: [queued(120, ago(15)), queued(121, ago(8))],
          deliveries: [delivery(id, ago(15) + 1000), delivery("7", ago(40))],
          details: [detail(id, 120), detail("7", 7)],
        }),
        { sources }
      );
      assertSome(findingOf(report, 120).classification, "lost");
      assertSome(findingOf(report, 121).classification, "gate");
      expect(findingOf(report, 121).source).toEqual(noHook);
    })
  );

  it.effect("Waiting: the rank rule with progress, 3 launches for rank 4", () =>
    Effect.gen(function* () {
      const read = [runner(1, "busy")];
      const jobs = [
        queued(130, ago(32)),
        queued(131, ago(27)),
        queued(132, ago(19)),
        queued(133, ago(16)),
        started(140, ago(15), ago(14)),
        started(141, ago(15), ago(10)),
        started(142, ago(15), ago(6)),
      ];
      const { report } = yield* runCheck(fixtureOf({ reads: [read, read], jobs }), {
        pools: [heavyAt(5)],
        sources: gateSources,
      });
      expect(findingOf(report, 133).verdict).toEqual(FleetVerdict.cases.Waiting.make({ launches: 3, rank: 4 }));
      expect(tagOf(report, 130)).toBe("NoLaunch");
    })
  );

  it.effect("total outage: 0 launches and 3 jobs queued 10 minutes or more below cap are all NoLaunch", () =>
    Effect.gen(function* () {
      const jobs = [
        queued(150, ago(10), "beep-fleet-overflow"),
        queued(151, ago(12), "beep-fleet-overflow"),
        queued(152, ago(14), "beep-fleet-overflow"),
      ];
      const ids = ["5000000000000000150", "5000000000000000151", "5000000000000000152"];
      const { report, calls } = yield* runCheck(
        fixtureOf({
          reads: [[], []],
          jobs,
          deliveries: [
            delivery(ids[0] ?? "", ago(10) + 100),
            delivery(ids[1] ?? "", ago(12) + 100),
            delivery(ids[2] ?? "", ago(14) + 100),
            delivery("8", ago(50)),
          ],
          details: [detail(ids[0] ?? "", 150), detail(ids[1] ?? "", 151), detail(ids[2] ?? "", 152), detail("8", 8)],
        }),
        { pools: [OVERFLOW] }
      );
      expect(A.map(report.findings, (finding) => finding.verdict)).toEqual([
        FleetVerdict.cases.NoLaunch.make({ reason: "no-progress", launches: 0, rank: 3 }),
        FleetVerdict.cases.NoLaunch.make({ reason: "no-progress", launches: 0, rank: 2 }),
        FleetVerdict.cases.NoLaunch.make({ reason: "no-progress", launches: 0, rank: 1 }),
      ]);
      expect(calls.deliveriesPage).toBe(1);
      expect(calls.deliveryDetail).toBe(3);
    })
  );

  it.effect("NoLaunch: launches that cover the rank while the job is still queued", () =>
    Effect.gen(function* () {
      const read = [runner(1, "busy")];
      const { report } = yield* runCheck(
        fixtureOf({ reads: [read, read], jobs: [started(160, ago(6), ago(5)), queued(161, ago(12))] }),
        { sources: gateSources }
      );
      expect(findingOf(report, 161).verdict).toEqual(
        FleetVerdict.cases.NoLaunch.make({ reason: "launches-cover-rank", launches: 1, rank: 1 })
      );
    })
  );

  it.effect("NoLaunch: a job queued 2 hours or more below cap with progress and launches below its rank", () =>
    Effect.gen(function* () {
      const read = [runner(1, "busy")];
      const jobs = [queued(170, ago(130)), queued(171, ago(125)), started(172, ago(6), ago(5))];
      const { report } = yield* runCheck(fixtureOf({ reads: [read, read], jobs }), {
        pools: [heavyAt(5)],
        sources: gateSources,
      });
      expect(findingOf(report, 171).verdict).toEqual(
        FleetVerdict.cases.NoLaunch.make({ reason: "queued-two-hours", launches: 1, rank: 2 })
      );
    })
  );

  it.effect("a runner registered offline below cap counts toward the cap and as a launch, never as idle", () =>
    Effect.gen(function* () {
      const read = [runner(1, "offline")];
      const { report } = yield* runCheck(fixtureOf({ reads: [read, read], jobs: [queued(180, ago(6))] }), {
        sources: gateSources,
      });
      const pool = report.pools[0];
      expect([pool?.secondCount, pool?.atCap, pool?.idleRunnerIds, pool?.notBusyRunnerIds]).toEqual([
        1,
        false,
        [],
        [1],
      ]);
      expect(findingOf(report, 180).verdict).toEqual(FleetVerdict.cases.Waiting.make({ launches: 1, rank: 1 }));
    })
  );

  it.effect("launches exclude a job cancelled or skipped while queued", () =>
    Effect.gen(function* () {
      const read = [runner(1, "busy")];
      const jobs = [
        queued(190, ago(12)),
        queued(191, ago(11)),
        started(192, ago(10), ago(4)),
        started(193, ago(10), ago(3), O.none()),
      ];
      const { report } = yield* runCheck(fixtureOf({ reads: [read, read], jobs }), {
        pools: [heavyAt(5)],
        sources: gateSources,
      });
      expect(findingOf(report, 191).verdict).toEqual(FleetVerdict.cases.Waiting.make({ launches: 1, rank: 2 }));
    })
  );
});

describe("fleet missed-event check review wave 1", () => {
  it.effect("launches count only runs created in the last two hours: an older run's start keeps the job Waiting", () =>
    Effect.gen(function* () {
      const older = started(220, ago(150), ago(5));
      const { report } = yield* runCheck(
        fixtureOf({
          reads: [[runner(1, "busy")], [runner(1, "busy")]],
          jobs: [older, queued(221, ago(12))],
          recentRuns: [queued(221, ago(12)).runId],
        }),
        { pools: [heavyAt(5)], sources: gateSources }
      );
      expect(report.pools[0]?.progress).toBe(true);
      expect(findingOf(report, 221).verdict).toEqual(FleetVerdict.cases.Waiting.make({ launches: 0, rank: 1 }));
    })
  );

  it.effect("the p95 queue-to-start samples only the starts in the two-hour window", () =>
    Effect.gen(function* () {
      const jobs = [started(230, ago(200), ago(180)), started(231, ago(30), ago(25)), queued(232, ago(3))];
      const { report } = yield* runCheck(fixtureOf({ reads: [[runner(1, "busy")], [runner(1, "busy")]], jobs }), {
        pools: [heavyAt(5)],
        sources: gateSources,
      });
      assertSome(O.flatten(O.fromUndefinedOr(report.pools[0]?.p95QueueToStart)), minutes(5));
    })
  );

  it.effect("one verdict time, taken after the job reads, sets age, progress and checkedAt", () =>
    Effect.gen(function* () {
      const read = [runner(1, "offline"), runner(2, "offline")];
      const job = queued(240, ago(14));
      const { report } = yield* runCheck(fixtureOf({ reads: [read, read], jobs: [job] }), {
        overrides: {
          jobsPage: () =>
            Effect.as(TestClock.adjust(Duration.minutes(2)), FleetJobsPage.make({ jobs: [job], totalCount: 1 })),
        },
      });
      expect(report.checkedAt).toBe(NOW + minutes(2));
      expect(findingOf(report, 240).age).toBe(minutes(16));
      expect(findingOf(report, 240).verdict).toEqual(FleetVerdict.cases.Wedged.make({ notBusyRunnerIds: [1, 2] }));
    })
  );

  it.effect("an unreadable candidate detail beside a confirmed 502 is unknown, not MissedDelivery", () =>
    Effect.gen(function* () {
      const failed = "3855552300210716690";
      const unread = "3855552300210716691";
      const { report } = yield* runCheck(
        fixtureOf({
          reads: [[], []],
          jobs: [queued(250, ago(12))],
          deliveries: [delivery(unread, ago(12) + 2000), delivery(failed, ago(12) + 1000, 502), delivery("6", ago(30))],
          details: [detail(failed, 250), detail("6", 6)],
          failingDetails: [unread],
        })
      );
      const finding = findingOf(report, 250);
      expect(finding.verdict._tag).toBe("NoLaunch");
      assertSome(finding.classification, "unknown");
    })
  );

  it.effect("a page boundary tied at the window start, then a failed page, is unknown, not MissedDelivery", () =>
    Effect.gen(function* () {
      const { report } = yield* runCheck(
        fixtureOf({
          reads: [[], []],
          jobs: [queued(260, ago(12))],
          deliveries: [delivery("71", ago(14)), delivery("72", ago(14))],
          details: [detail("71", 71), detail("72", 72)],
          failDeliveryPageAt: 1,
          pageSize: 1,
        })
      );
      const finding = findingOf(report, 260);
      expect(finding.verdict._tag).toBe("NoLaunch");
      assertSome(finding.classification, "unknown");
    })
  );

  it.effect("Wedged counts a runner busy in the first read and not busy in the second", () =>
    Effect.gen(function* () {
      const { report } = yield* runCheck(
        fixtureOf({
          reads: [
            [runner(1, "busy"), runner(2, "busy")],
            [runner(1, "busy"), runner(2, "offline")],
          ],
          jobs: [queued(270, ago(20))],
        }),
        { sources: gateSources }
      );
      expect(findingOf(report, 270).verdict).toEqual(FleetVerdict.cases.Wedged.make({ notBusyRunnerIds: [2] }));
    })
  );

  it.effect("a run listing whose membership shifts between page reads is walked again until two walks agree", () =>
    Effect.gen(function* () {
      const jobs = [queued(281, ago(150)), queued(282, ago(150)), queued(283, ago(150))];
      const fixture = fixtureOf({ reads: [[], []], jobs, recentRuns: [], pageSize: 1 });
      const walks = yield* Ref.make(0);
      const shifted: ReadonlyArray<number> = [3281, 3283, 3284];
      const listed: ReadonlyArray<number> = [3281, 3282, 3283];
      const { report } = yield* runCheck(fixture, {
        sources: gateSources,
        overrides: {
          runsPage: Effect.fnUntraced(function* (query, page) {
            const queuedListing = FleetRunsQuery.guards.ByStatus(query) && query.status === "queued";
            const walk =
              queuedListing && page === 1 ? yield* Ref.updateAndGet(walks, (n) => n + 1) : yield* Ref.get(walks);
            const served = queuedListing ? (walk === 1 ? shifted : listed) : [];
            return FleetRunsPage.make({ runIds: A.take(A.drop(served, page - 1), 1), totalCount: A.length(served) });
          }),
        },
      });
      expect(
        A.sort(
          A.map(report.findings, (finding) => finding.job.id),
          Order.Number
        )
      ).toEqual([281, 282, 283]);
      const walkCount = yield* Ref.get(walks);
      expect(walkCount).toBe(3);
    })
  );

  it.effect("a run listing that changes in every walk uses the union of its walks and notes it", () =>
    Effect.gen(function* () {
      const fixture = fixtureOf({ reads: [[], []], jobs: [] });
      const walks = yield* Ref.make(0);
      const jobRuns = yield* Ref.make<ReadonlyArray<number>>([]);
      const { report } = yield* runCheck(fixture, {
        overrides: {
          runsPage: Effect.fnUntraced(function* (query, page) {
            const queuedListing = FleetRunsQuery.guards.ByStatus(query) && query.status === "queued";
            const walk = page === 1 ? yield* Ref.updateAndGet(walks, (n) => n + 1) : yield* Ref.get(walks);
            return queuedListing
              ? FleetRunsPage.make({ runIds: [walk * 10 + page], totalCount: 2 })
              : FleetRunsPage.make({ runIds: [], totalCount: 0 });
          }),
          jobsPage: Effect.fnUntraced(function* (runId) {
            yield* Ref.update(jobRuns, A.append(runId));
            return FleetJobsPage.make({ jobs: [], totalCount: 0 });
          }),
        },
      });
      const readRuns = yield* Ref.get(jobRuns);
      expect(A.sort(readRuns, Order.Number)).toEqual([11, 12, 21, 22, 31, 32]);
      expect(report.listingNotes).toEqual(["runs ByStatus: listing unstable (3 walks)"]);
      expect(renderFleetCheckSummary(report)).toContain("fleet missed-event check: green");
      expect(renderFleetCheckSummary(report)).toContain("notes: runs ByStatus: listing unstable (3 walks)");
      expect(report.findings).toEqual([]);
    })
  );

  it.effect("a runner listing that repeats a runner across its pages is not accepted as complete", () =>
    Effect.gen(function* () {
      const walks = yield* Ref.make(0);
      const listing = [runner(1, "busy"), runner(2, "idle")];
      const { report } = yield* runCheck(fixtureOf({ reads: [[]], jobs: [] }), {
        overrides: {
          runnersPage: Effect.fnUntraced(function* (page) {
            const walk = page === 1 ? yield* Ref.updateAndGet(walks, (n) => n + 1) : yield* Ref.get(walks);
            const served = walk === 1 ? [runner(1, "busy"), runner(1, "busy")] : listing;
            return FleetRunnersPage.make({ runners: A.take(A.drop(served, page - 1), 1), totalCount: 2 });
          }),
        },
      });
      expect([report.pools[0]?.firstCount, report.pools[0]?.idleRunnerIds]).toEqual([2, [2]]);
      const walkCount = yield* Ref.get(walks);
      expect(walkCount).toBe(5);
    })
  );
});

describe("fleet missed-event check review wave 2", () => {
  it.effect(
    "Waiting, not NoLaunch: a delivered job queued 12 minutes, idle only in the second read, without progress",
    () =>
      Effect.gen(function* () {
        const id = "3855552300210716700";
        const { report } = yield* runCheck(
          fixtureOf({
            reads: [[runner(1, "busy")], [runner(1, "busy"), runner(2, "idle")]],
            jobs: [queued(290, ago(12))],
            deliveries: [delivery(id, ago(12) + 2000), delivery("12", ago(40))],
            details: [detail(id, 290), detail("12", 12)],
          }),
          { pools: [heavyAt(5)] }
        );
        const pool = report.pools[0];
        expect([pool?.atCap, pool?.idleRunnerIds, pool?.secondReadIdleRunnerIds, pool?.progress]).toEqual([
          false,
          [],
          [2],
          false,
        ]);
        const finding = findingOf(report, 290);
        expect(finding.verdict).toEqual(FleetVerdict.cases.Waiting.make({ launches: 1, rank: 1 }));
        expect(isFleetAlert(finding.verdict)).toBe(false);
      })
  );

  it.effect("a 2xx queued delivery whose detail names no workflow job is unknown, not MissedDelivery", () =>
    Effect.gen(function* () {
      const id = "3855552300210716701";
      const { report } = yield* runCheck(
        fixtureOf({
          reads: [[], []],
          jobs: [queued(291, ago(12))],
          deliveries: [delivery(id, ago(12) + 1000), delivery("13", ago(30))],
          details: [FleetDeliveryDetail.make({ id, workflowJobId: O.none() }), detail("13", 13)],
        })
      );
      const finding = findingOf(report, 291);
      expect(finding.verdict).toEqual(
        FleetVerdict.cases.NoLaunch.make({ reason: "no-progress", launches: 0, rank: 1 })
      );
      assertSome(finding.classification, "unknown");
      expect(finding.evidence).toEqual(
        FleetDeliveryEvidence.cases.Unreadable.makeOption({
          reason: "1 candidate delivery detail(s) unreadable after retries or naming no workflow job",
          oldestReached: O.some(ago(30)),
        })
      );
    })
  );

  it.effect("fails the run when an empty page falls short of a changed total in every walk", () =>
    Effect.gen(function* () {
      const error = yield* runCheck(fixtureOf({ reads: [[]], jobs: [] }), {
        overrides: {
          runnersPage: (page) =>
            Effect.succeed(
              page === 1
                ? FleetRunnersPage.make({ runners: [runner(1, "busy")], totalCount: 2 })
                : FleetRunnersPage.make({ runners: [], totalCount: 3 })
            ),
        },
      }).pipe(Effect.flip);
      expect(error.message).toBe("GitHub read org runners failed: listing stopped at page 2 with 1 of 3 items");
    })
  );

  it.effect("an empty page at a total that shrank to the items read is a disagreement, not a read error", () =>
    Effect.gen(function* () {
      const { report } = yield* runCheck(fixtureOf({ reads: [[]], jobs: [] }), {
        overrides: {
          runnersPage: (page) =>
            Effect.succeed(
              page === 1
                ? FleetRunnersPage.make({ runners: [runner(1, "busy")], totalCount: 2 })
                : FleetRunnersPage.make({ runners: [], totalCount: 1 })
            ),
        },
      });
      expect(report.pools[0]?.firstCount).toBe(1);
      expect(report.listingNotes).toEqual([
        "org runners: listing unstable (3 walks)",
        "org runners: listing unstable (3 walks)",
      ]);
    })
  );

  it.effect("a paginated listing that shrinks to one page is accepted only once a third walk confirms it", () =>
    Effect.gen(function* () {
      const walks = yield* Ref.make(0);
      const jobRuns = yield* Ref.make<ReadonlyArray<number>>([]);
      const { report } = yield* runCheck(fixtureOf({ reads: [[], []], jobs: [] }), {
        overrides: {
          runsPage: Effect.fnUntraced(function* (query, page) {
            const queuedListing = FleetRunsQuery.guards.ByStatus(query) && query.status === "queued";
            const walk =
              queuedListing && page === 1 ? yield* Ref.updateAndGet(walks, (n) => n + 1) : yield* Ref.get(walks);
            return !queuedListing
              ? FleetRunsPage.make({ runIds: [], totalCount: 0 })
              : walk === 1
                ? FleetRunsPage.make({ runIds: [3291 + page - 1], totalCount: 2 })
                : FleetRunsPage.make({ runIds: [3291], totalCount: 1 });
          }),
          jobsPage: Effect.fnUntraced(function* (runId) {
            yield* Ref.update(jobRuns, A.append(runId));
            return FleetJobsPage.make({ jobs: [], totalCount: 0 });
          }),
        },
      });
      const walkCount = yield* Ref.get(walks);
      expect(walkCount).toBe(3);
      const readRuns = yield* Ref.get(jobRuns);
      expect(readRuns).toEqual([3291]);
      expect(report.listingNotes).toEqual([]);
    })
  );

  it.effect("a stable fixture with two queued jobs in one run settles every listing without noting instability", () =>
    Effect.gen(function* () {
      const read = [runner(1, "busy")];
      const jobs = [queued(292, ago(6)), FleetJob.make({ ...queued(293, ago(6)), runId: queued(292, ago(6)).runId })];
      const { report } = yield* runCheck(fixtureOf({ reads: [read, read], jobs }), {
        pools: [heavyAt(5)],
        sources: gateSources,
      });
      expect(report.listingNotes).toEqual([]);
      expect(
        A.sort(
          A.map(report.findings, (finding) => finding.job.id),
          Order.Number
        )
      ).toEqual([292, 293]);
    })
  );

  it.effect("the previous check run is the newest earlier run that ran its check, past newer and skipped runs", () =>
    Effect.gen(function* () {
      const { report } = yield* runCheck(
        fixtureOf({
          reads: [[]],
          jobs: [],
          workflowRuns: O.some([
            run(60, ago(2)),
            run(50, ago(10)),
            run(40, ago(20)),
            run(30, ago(25)),
            run(10, ago(60)),
          ]),
          checkJobs: [ranAt(60, ago(2)), ranAt(50, ago(10)), ranAt(40, ago(20)), ranAt(10, ago(60))],
        }),
        { currentRunId: 40 }
      );
      expect(report.previousRun).toEqual(
        FleetPreviousRun.cases.Found.make({
          runId: 10,
          startedAt: ago(60),
          currentStartedAt: O.some(ago(20)),
          fleetJobsInGap: 0,
        })
      );
      expect(renderFleetCheckSummary(report)).toContain(
        "previous check run 10 started 2026-11-22T20:20:00.000Z, 40m00s before this check run started (more than 30 minutes, no fleet job created inside it: information only)"
      );
    })
  );

  it.effect("a workflow_run or dispatch run that ran its check counts as the previous check run", () =>
    Effect.gen(function* () {
      const { report } = yield* runCheck(
        fixtureOf({
          reads: [[]],
          jobs: [],
          workflowRuns: O.some([run(70, ago(1)), run(69, ago(4)), run(68, ago(6)), run(67, ago(30))]),
          checkJobs: [ranAt(70, ago(1)), ranAt(68, ago(6)), ranAt(67, ago(30))],
        }),
        { currentRunId: 70 }
      );
      assertTrue(FleetPreviousRun.guards.Found(report.previousRun));
      expect(FleetPreviousRun.guards.Found(report.previousRun) ? report.previousRun.runId : 0).toBe(68);
    })
  );

  it.effect("no earlier checking run, and a run of its own with no other runs, name none", () =>
    Effect.gen(function* () {
      const onlySkipped = yield* runCheck(
        fixtureOf({ reads: [[]], jobs: [], workflowRuns: O.some([run(90, ago(1)), run(89, ago(3))]) }),
        { currentRunId: 90 }
      );
      expect(onlySkipped.report.previousRun).toEqual(FleetPreviousRun.cases.NoneFound.make({}));
      expect(renderFleetCheckSummary(onlySkipped.report)).toContain("previous check run: none found");
    })
  );
});

describe("fleet missed-event check precedence", () => {
  it.effect("Stuck before Wedged", () =>
    Effect.gen(function* () {
      const read = [runner(1, "idle"), runner(2, "offline")];
      const { report } = yield* runCheck(fixtureOf({ reads: [read, read], jobs: [queued(200, ago(20))] }), {
        sources: gateSources,
      });
      expect(tagOf(report, 200)).toBe("Stuck");
    })
  );

  it.effect("Wedged before MissedDelivery", () =>
    Effect.gen(function* () {
      const read = [runner(1, "offline"), runner(2, "offline")];
      const { report } = yield* runCheck(
        fixtureOf({
          reads: [read, read],
          jobs: [queued(201, ago(20))],
          deliveries: [delivery("9", ago(60))],
          details: [detail("9", 9)],
        })
      );
      assertNone(findingOf(report, 201).classification);
      expect(tagOf(report, 201)).toBe("Wedged");
    })
  );

  it.effect("below the 10-minute threshold a job without progress is Waiting, not NoLaunch", () =>
    Effect.gen(function* () {
      const { report } = yield* runCheck(fixtureOf({ reads: [[], []], jobs: [queued(202, ago(7))] }), {
        sources: gateSources,
      });
      expect(findingOf(report, 202).verdict).toEqual(FleetVerdict.cases.Waiting.make({ launches: 0, rank: 1 }));
    })
  );

  it("follows the precedence order for a constructed observation", () => {
    const observation = (fields: Partial<FleetPoolObservation>) =>
      FleetPoolObservation.make({
        pool: HEAVY,
        firstReadAt: minutes(20),
        firstCount: 2,
        secondCount: 2,
        atCap: true,
        idleRunnerIds: [],
        secondReadIdleRunnerIds: [],
        notBusyRunnerIds: [],
        currentNotBusy: 0,
        progress: false,
        p95QueueToStart: O.none(),
        ...fields,
      });
    const missed = FleetDeliveryEvidence.cases.NotDelivered.makeOption({
      windowStart: 0,
      windowEnd: 1,
      oldestReached: 0,
    });
    const verdict = (fields: Partial<FleetPoolObservation>, evidence = missed, createdAt = 0) =>
      decideFleetVerdict({
        observation: observation(fields),
        createdAt,
        age: minutes(20),
        launches: 0,
        rank: 1,
        oldestQueuedAge: minutes(20),
        evidence,
      })._tag;
    expect(verdict({ idleRunnerIds: [1], notBusyRunnerIds: [1] })).toBe("Stuck");
    expect(verdict({ idleRunnerIds: [1] }, O.none(), minutes(20) + 1)).toBe("WaitingAtCap");
    expect(verdict({ notBusyRunnerIds: [1] })).toBe("Wedged");
    expect(verdict({})).toBe("MissedDelivery");
    expect(verdict({ atCap: false })).toBe("MissedDelivery");
    expect(verdict({ atCap: false }, O.none())).toBe("NoLaunch");
    expect(verdict({}, O.none())).toBe("WaitingAtCap");
    expect(verdict({ atCap: false, secondReadIdleRunnerIds: [1] }, O.none())).toBe("Waiting");
    expect(verdict({ atCap: false, idleRunnerIds: [1] }, O.none())).toBe("NoLaunch");
  });
});

describe("fleet missed-event check delivery detail budget", () => {
  const JOB_AT = ago(12);
  const decoys = (count: number, from: number) =>
    A.map(A.range(1, count), (n) => delivery(`9100${n}`, JOB_AT + from + n * 1000));
  const decoyDetails = (count: number) => A.map(A.range(1, count), (n) => detail(`9100${n}`, 900 + n));

  it.effect("stops after the first batch when the nearest candidate is the job's 2xx delivery", () =>
    Effect.gen(function* () {
      const { report, calls } = yield* runCheck(
        fixtureOf({
          reads: [[], []],
          jobs: [queued(160, JOB_AT)],
          deliveries: [delivery("91601", JOB_AT + 200), ...decoys(9, 10_000)],
          details: [detail("91601", 160), ...decoyDetails(9)],
        })
      );
      expect(findingOf(report, 160).evidence).toEqual(
        FleetDeliveryEvidence.cases.Delivered.makeOption({ hookId: HOOK, deliveryId: "91601", statusCode: 200 })
      );
      expect(calls.deliveryDetail).toBe(4);
    })
  );

  it.effect("searches past a nearer non-2xx delivery naming the job to a later 2xx one", () =>
    Effect.gen(function* () {
      const { report, calls } = yield* runCheck(
        fixtureOf({
          reads: [[], []],
          jobs: [queued(161, JOB_AT)],
          deliveries: [delivery("91611", JOB_AT + 100, 502), ...decoys(4, 1000), delivery("91612", JOB_AT + 60_000)],
          details: [detail("91611", 161), detail("91612", 161), ...decoyDetails(4)],
        })
      );
      expect(findingOf(report, 161).evidence).toEqual(
        FleetDeliveryEvidence.cases.Delivered.makeOption({ hookId: HOOK, deliveryId: "91612", statusCode: 200 })
      );
      expect(calls.deliveryDetail).toBe(6);
    })
  );

  it.effect("reads every candidate of a job with no 2xx delivery naming it", () =>
    Effect.gen(function* () {
      const { report, calls } = yield* runCheck(
        fixtureOf({
          reads: [[], []],
          jobs: [queued(162, JOB_AT)],
          deliveries: [...decoys(6, 1000), delivery("91620", ago(40))],
          details: [...decoyDetails(6), detail("91620", 1)],
        })
      );
      assertSome(
        O.map(findingOf(report, 162).evidence, (evidence) => evidence._tag),
        "NotDelivered"
      );
      expect(calls.deliveryDetail).toBe(6);
    })
  );

  it.effect("reuses a detail one job's search read for the next job", () =>
    Effect.gen(function* () {
      const { report, calls } = yield* runCheck(
        fixtureOf({
          reads: [[], []],
          jobs: [queued(163, JOB_AT), queued(164, JOB_AT + 1000)],
          deliveries: [delivery("91631", JOB_AT + 100), delivery("91641", JOB_AT + 1100), ...decoys(2, 30_000)],
          details: [detail("91631", 163), detail("91641", 164), ...decoyDetails(2)],
        })
      );
      expect(
        A.map(report.findings, (finding) =>
          O.getOrElse(
            O.map(finding.evidence, (evidence) => evidence._tag),
            () => "none"
          )
        )
      ).toEqual(["Delivered", "Delivered"]);
      expect(calls.deliveryDetail).toBe(4);
    })
  );
});

describe("fleet missed-event check reads", () => {
  it.effect("pages every listing in full and walks the deliveries once, stopping past the oldest job", () =>
    Effect.gen(function* () {
      const read = A.map(A.range(1, 5), (id) => runner(id, "busy", "beep-fleet-overflow"));
      const jobs = A.appendAll(
        A.map(A.range(1, 4), (n) => queued(300 + n, ago(10 + n), "beep-fleet-overflow")),
        [FleetJob.make({ ...queued(399, ago(30), "ubuntu-latest") }), started(398, ago(9), ago(8))]
      );
      const deliveries = A.appendAll(
        A.map(A.range(1, 4), (n) => delivery(`70000000000000003${n}`, ago(10 + n) + 100)),
        A.map(A.range(1, 6), (n) => delivery(`8${n}`, ago(20 + n)))
      );
      const details = A.appendAll(
        A.map(A.range(1, 4), (n) => detail(`70000000000000003${n}`, 300 + n)),
        A.map(A.range(1, 6), (n) => detail(`8${n}`, 80 + n))
      );
      const { report, calls } = yield* runCheck(
        fixtureOf({ reads: [read, read], jobs, deliveries, details, pageSize: 1 }),
        {
          pools: [OVERFLOW],
        }
      );
      expect(A.map(report.findings, (finding) => finding.job.id)).toEqual([301, 302, 303, 304]);
      expect(A.map(report.findings, (finding) => finding.classification)).toEqual(A.replicate(O.some("lost"), 4));
      expect(report.pools[0]?.secondCount).toBe(5);
      expect(calls.deliveriesPage).toBe(5);
      expect(calls.deliveryDetail).toBe(4);
    })
  );

  it.effect("fails the run when a listing stops at 50 pages short of its total count", () =>
    Effect.gen(function* () {
      const read = A.map(A.range(1, 51), (id) => runner(id, "busy"));
      const error = yield* runCheck(fixtureOf({ reads: [read, read], jobs: [], pageSize: 1 })).pipe(Effect.flip);
      expect(error.message).toBe("GitHub read org runners failed: listing truncated at 50 pages");
    })
  );

  it.effect("fails the run when a runner read fails after its retries", () =>
    Effect.gen(function* () {
      const exit = yield* runCheck(fixtureOf({ reads: [[]], jobs: [] }), {
        overrides: {
          runnersPage: () =>
            Effect.fail(FleetReadError.make({ endpoint: "orgs/beep-effect/actions/runners", message: "HTTP 502" })),
        },
      }).pipe(Effect.exit);
      expect(exit._tag).toBe("Failure");
    })
  );

  it.effect("names an unreadable previous run without failing", () =>
    Effect.gen(function* () {
      const { report } = yield* runCheck(fixtureOf({ reads: [[]], jobs: [], workflowRuns: O.none() }));
      expect(report.previousRun._tag).toBe("Unreadable");
      expect(renderFleetCheckSummary(report)).toContain("previous check run: unreadable");
      const jobsUnreadable = yield* runCheck(
        fixtureOf({ reads: [[]], jobs: [], workflowRuns: O.some([run(5, ago(20))]), failingCheckJobs: [5] })
      );
      expect(jobsUnreadable.report.previousRun._tag).toBe("Unreadable");
    })
  );
});

describe("fleet missed-event check output", () => {
  it.effect("writes one green line with the counts, p95 and previous run", () =>
    Effect.gen(function* () {
      const read = [runner(1, "busy"), runner(2, "busy")];
      const jobs = [started(1, ago(45), ago(40)), started(2, ago(44), ago(42)), queued(400, ago(4))];
      const { report, summaries } = yield* runCheck(
        fixtureOf({
          reads: [read, read],
          jobs,
          workflowRuns: O.some([run(9001, ago(5)), run(77, ago(15))]),
          checkJobs: [ranAt(9001, ago(5)), ranAt(77, ago(15))],
        }),
        { currentRunId: 9001, stepSummary: true }
      );
      const summary = renderFleetCheckSummary(report);
      expect(A.length(Str.split(Str.trimEnd(summary), "\n"))).toBe(1);
      expect(summary).toContain("fleet missed-event check: green");
      expect(summary).toContain("1 queued job(s) checked; verdicts: WaitingAtCap 1");
      expect(summary).toContain("p95 queue-to-start: heavy 5m00s");
      expect(summary).toContain(
        "previous check run 77 started 2026-11-22T21:05:00.000Z, 10m00s before this check run started;"
      );
      expect(report.githubRequests).toBe(11);
      expect(summary).toContain("; 11 GitHub request(s)");
      expect(summaries).toEqual([summary]);
      const exit = yield* Effect.exit(failOnFleetAlerts(report));
      expect(exit._tag).toBe("Success");
    })
  );

  it.effect("lists each alert with its evidence and remedies, flags a late previous run, and fails", () =>
    Effect.gen(function* () {
      const id = "3855552300210716674";
      const { report } = yield* runCheck(
        fixtureOf({
          reads: [[], []],
          jobs: [queued(410, ago(12))],
          deliveries: [delivery(id, ago(12) + 1000, 500), delivery("10", ago(40))],
          details: [detail(id, 410), detail("10", 10)],
          workflowRuns: O.some([run(9002, ago(5)), run(76, ago(45))]),
          checkJobs: [ranAt(9002, ago(5)), ranAt(76, ago(45))],
        }),
        { currentRunId: 9002 }
      );
      const summary = renderFleetCheckSummary(report);
      assertSome(A.head(Str.split(summary, "\n")), "## Fleet missed-event check: 1 alert(s)");
      expect(summary).toContain("checked at 2026-11-22T21:20:00.000Z: 1 queued job(s) checked");
      expect(summary).toContain(`| 410 | 3410 | heavy | 12m00s | MissedDelivery | none | delivery ${id} (500) |`);
      expect(summary).toContain(`gh api -X POST repos/${REPOSITORY}/hooks/${HOOK}/deliveries/${id}/attempts`);
      expect(summary).not.toContain("gh run cancel 3410");
      expect(summary).not.toContain("--failed");
      expect(summary).toContain(
        "40m00s before this check run started (more than 30 minutes with 1 fleet job(s) created inside it: a finding for the gate)"
      );
      assertTrue(isCadenceGapFinding(report.previousRun));
      const exit = yield* Effect.exit(failOnFleetAlerts(report));
      expect(exit._tag).toBe("Failure");
    })
  );

  it.effect("measures the cadence gap from check start to check start, and only notes the elapsed time otherwise", () =>
    Effect.gen(function* () {
      const inActions = yield* runCheck(
        fixtureOf({
          reads: [[]],
          jobs: [],
          workflowRuns: O.some([run(9003, ago(5)), run(78, ago(31))]),
          checkJobs: [ranAt(9003, ago(5)), ranAt(78, ago(31))],
        }),
        { currentRunId: 9003 }
      );
      const inActionsSummary = renderFleetCheckSummary(inActions.report);
      expect(inActionsSummary).toContain("26m00s before this check run started");
      expect(inActionsSummary).not.toContain("more than 30 minutes");
      const local = yield* runCheck(
        fixtureOf({ reads: [[]], jobs: [], workflowRuns: O.some([run(79, ago(45))]), checkJobs: [ranAt(79, ago(45))] })
      );
      const localSummary = renderFleetCheckSummary(local.report);
      expect(localSummary).toContain("45m00s before this check");
      expect(localSummary).not.toContain("more than 30 minutes");
    })
  );

  it("reports a gap over 30 minutes as a finding only when a fleet job was created inside it", () => {
    const previous = FleetCheckingRun.makeOption({ runId: 5, startedAt: ago(45) });
    const inGap = queued(1, ago(20));
    const beforeGap = queued(2, ago(50));
    const afterGap = queued(3, ago(1));
    const withJob = fleetPreviousRun({
      previous,
      currentStartedAt: O.some(ago(5)),
      jobs: [inGap, beforeGap, afterGap],
      checkedAt: NOW,
    });
    expect(withJob).toEqual(
      FleetPreviousRun.cases.Found.make({
        runId: 5,
        startedAt: ago(45),
        currentStartedAt: O.some(ago(5)),
        fleetJobsInGap: 1,
      })
    );
    assertTrue(isCadenceGapFinding(withJob));
    const quiet = fleetPreviousRun({ previous, currentStartedAt: O.some(ago(5)), jobs: [beforeGap], checkedAt: NOW });
    expect(isCadenceGapFinding(quiet)).toBe(false);
    const short = fleetPreviousRun({
      previous: FleetCheckingRun.makeOption({ runId: 5, startedAt: ago(30) }),
      currentStartedAt: O.some(ago(5)),
      jobs: [inGap],
      checkedAt: NOW,
    });
    expect(isCadenceGapFinding(short)).toBe(false);
    const local = fleetPreviousRun({ previous, currentStartedAt: O.none(), jobs: [inGap, afterGap], checkedAt: NOW });
    expect(isCadenceGapFinding(local)).toBe(false);
    expect(FleetPreviousRun.guards.Found(local) ? local.fleetJobsInGap : -1).toBe(2);
    expect(fleetPreviousRun({ previous: O.none(), currentStartedAt: O.none(), jobs: [], checkedAt: NOW })).toEqual(
      FleetPreviousRun.cases.NoneFound.make({})
    );
  });

  it("renders every verdict and evidence form", () => {
    const base = {
      job: queued(500, ago(20)),
      pool: "heavy",
      age: minutes(20),
      rank: 1,
      launches: 0,
      source: hookSource,
    };
    const finding = (verdict: FleetVerdict, evidence: O.Option<FleetDeliveryEvidence>) =>
      FleetJobFinding.make({
        ...base,
        verdict,
        evidence,
        classification: O.flatMap(evidence, classifyFleetEvidence),
      });
    const report = FleetCheckReport.make({
      repository: REPOSITORY,
      checkedAt: NOW,
      pools: [],
      previousRun: FleetPreviousRun.cases.NoneFound.make({}),
      findings: [
        finding(FleetVerdict.cases.Stuck.make({ idleRunnerIds: [1, 2] }), O.none()),
        finding(
          FleetVerdict.cases.Wedged.make({ notBusyRunnerIds: [3] }),
          FleetDeliveryEvidence.cases.Delivered.makeOption({ hookId: HOOK, deliveryId: "11", statusCode: 200 })
        ),
        finding(
          FleetVerdict.cases.NoLaunch.make({ reason: "no-progress", launches: 0, rank: 1 }),
          FleetDeliveryEvidence.cases.Unreadable.makeOption({ reason: "x", oldestReached: O.none() })
        ),
        finding(
          FleetVerdict.cases.NoLaunch.make({ reason: "no-progress", launches: 0, rank: 1 }),
          FleetDeliveryEvidence.cases.Gate.makeOption({})
        ),
        finding(
          FleetVerdict.cases.MissedDelivery.make({}),
          FleetDeliveryEvidence.cases.NotDelivered.makeOption({
            windowStart: ago(22),
            windowEnd: ago(15),
            oldestReached: ago(30),
          })
        ),
        finding(FleetVerdict.cases.Waiting.make({ launches: 0, rank: 2 }), O.none()),
        finding(FleetVerdict.cases.WaitingAtCap.make({}), O.none()),
      ],
    });
    const summary = renderFleetCheckSummary(report);
    expect(summary).toContain("Stuck (idle in both reads, at cap in at least one: 1, 2)");
    expect(summary).toContain("Wedged (not busy at cap, no progress: 3)");
    expect(summary).toContain("NoLaunch (no-progress; 0 launch(es), rank 1)");
    expect(summary).toContain("not read (job younger than 5 minutes)");
    expect(summary).toContain("x; oldest read none");
    expect(summary).toContain("| delivery evidence: gate | delivery evidence: gate |");
    expect(summary).toContain("none in 2026-11-22T20:58:00.000Z..2026-11-22T21:05:00.000Z");
    expect(summary).toContain("verdicts: Stuck 1, Wedged 1, MissedDelivery 1, NoLaunch 2, WaitingAtCap 1, Waiting 1");
    expect(summary).toContain("previous check run: none found");
    expect(summary).toContain("## Fleet missed-event check: 5 alert(s)");
  });

  it("prints a remedy-free alert as none", () => {
    const report = FleetCheckReport.make({
      repository: REPOSITORY,
      checkedAt: NOW,
      pools: [],
      previousRun: FleetPreviousRun.cases.NoneFound.make({}),
      findings: [
        FleetJobFinding.make({
          job: queued(501, ago(3)),
          pool: "heavy",
          age: 45_000,
          rank: 1,
          launches: 0,
          source: hookSource,
          verdict: FleetVerdict.cases.Stuck.make({ idleRunnerIds: [1] }),
          evidence: O.none(),
          classification: O.none(),
        }),
      ],
    });
    const summary = renderFleetCheckSummary(report);
    expect(summary).toContain("| 501 | 3501 | heavy | 45s |");
    expect(summary).toContain("### Remedies (printed only; this check never runs them)\n\n- none");
  });

  it("prints the listing notes under the alert heading", () => {
    const report = FleetCheckReport.make({
      repository: REPOSITORY,
      checkedAt: NOW,
      pools: [],
      previousRun: FleetPreviousRun.cases.NoneFound.make({}),
      listingNotes: ["org runners: listing unstable (3 walks)"],
      findings: [
        FleetJobFinding.make({
          job: queued(502, ago(3)),
          pool: "heavy",
          age: 45_000,
          rank: 1,
          launches: 0,
          source: hookSource,
          verdict: FleetVerdict.cases.Stuck.make({ idleRunnerIds: [1] }),
          evidence: O.none(),
          classification: O.none(),
        }),
      ],
    });
    expect(A.take(Str.split(renderFleetCheckSummary(report), "\n"), 4)).toEqual([
      "## Fleet missed-event check: 1 alert(s)",
      "",
      "- note: org runners: listing unstable (3 walks)",
      "",
    ]);
  });
});

describe("fleet missed-event check helpers", () => {
  it("chooses the hook source in effect at a time", () => {
    const sources = [
      FleetHookSourceEntry.make({ source: hookSource, effectiveFrom: 100 }),
      FleetHookSourceEntry.make({ source: noHook, effectiveFrom: 1000 }),
    ] as const;
    expect(hookSourceAt(sources, 50)).toEqual(hookSource);
    expect(hookSourceAt(sources, 999)).toEqual(hookSource);
    expect(pipe(sources, hookSourceAt(1000))).toEqual(noHook);
    expect(fleetHookSources[0].source).toEqual(hookSource);
  });

  it("selects the earlier runs newest first and the checking run of a run that ran its check", () => {
    const runs = [run(2, 20), run(3, 30), run(1, 10)];
    expect(A.map(earlierFleetRuns(runs, O.some(3)), (each) => each.id)).toEqual([2, 1]);
    expect(A.map(pipe(runs, earlierFleetRuns(O.none())), (each) => each.id)).toEqual([3, 2, 1]);
    expect(earlierFleetRuns(runs, O.some(1))).toEqual([]);
    assertSome(
      checkingRun(run(2, 20), FleetCheckJob.cases.Ran.make({ startedAt: 25 })),
      FleetCheckingRun.make({ runId: 2, startedAt: 25 })
    );
    assertNone(pipe(run(2, 20), checkingRun(FleetCheckJob.cases.NotRan.make({}))));
  });

  it("labels the non-alert verdicts", () => {
    expect(fleetVerdictLabel(FleetVerdict.cases.WaitingAtCap.make({}))).toBe("WaitingAtCap");
    expect(fleetVerdictLabel(FleetVerdict.cases.Waiting.make({ launches: 3, rank: 4 }))).toBe(
      "Waiting (3 launch(es), rank 4)"
    );
  });

  it.layer(FleetGithubReads.layerFake(FleetGithubFixture.make({})), { timeout: "30 seconds" })((layerIt) => {
    layerIt.effect("fails a fake detail read the fixture does not hold", () =>
      Effect.gen(function* () {
        const reads = yield* FleetGithubReads;
        const error = yield* Effect.flip(reads.deliveryDetail(HOOK, "1"));
        expect(error.endpoint).toBe(`hooks/${HOOK}/deliveries/1`);
      })
    );
  });

  it("computes the nearest-rank p95", () => {
    assertNone(percentile95([]));
    assertSome(percentile95([5]), 5);
    assertSome(percentile95(A.range(1, 20)), 19);
  });

  it("judges delivery evidence from the walk", () => {
    const job = queued(600, ago(12));
    const window = deliveryWindow(job);
    expect(window).toEqual({ start: ago(14), end: ago(7) });
    const judge = (deliveries: ReadonlyArray<FleetHookDelivery>, details: ReadonlyArray<FleetDeliveryDetail>) =>
      judgeDeliveryEvidence({
        job,
        hookId: HOOK,
        deliveries,
        oldestReached: O.some(ago(20)),
        walkFailure: O.none(),
        listingEnded: false,
        details: HashMap.fromIterable(A.map(details, (item) => [item.id, O.some(item)] as const)),
      });
    const both = [delivery("21", ago(11), 200), delivery("22", ago(12), 502)];
    expect(judge(both, [detail("21", 600), detail("22", 600)])._tag).toBe("Delivered");
    expect(judge([delivery("23", ago(11), 200, O.some("completed"))], [detail("23", 600)])._tag).toBe("NotDelivered");
    expect(judge([delivery("24", ago(30))], [])._tag).toBe("NotDelivered");
  });

  it("needs a confirmed end of the listing at a tied window start, and coverage before a 502", () => {
    const job = queued(601, ago(12));
    const judge = (oldestReached: number, listingEnded: boolean, deliveries: ReadonlyArray<FleetHookDelivery>) =>
      judgeDeliveryEvidence({
        job,
        hookId: HOOK,
        deliveries,
        oldestReached: O.some(oldestReached),
        walkFailure: O.none(),
        listingEnded,
        details: HashMap.fromIterable(A.map(deliveries, (item) => [item.id, O.some(detail(item.id, 601))] as const)),
      })._tag;
    expect(judge(ago(14), false, [])).toBe("Unreadable");
    expect(judge(ago(14), true, [])).toBe("NotDelivered");
    expect(judge(ago(13), false, [delivery("25", ago(11), 502)])).toBe("Unreadable");
    expect(judge(ago(15), false, [delivery("25", ago(11), 502)])).toBe("DeliveryFailed");
  });

  it("classifies every evidence form", () => {
    deepStrictEqual(
      A.map(
        [
          FleetDeliveryEvidence.cases.Delivered.make({ hookId: HOOK, deliveryId: "1", statusCode: 204 }),
          FleetDeliveryEvidence.cases.DeliveryFailed.make({ hookId: HOOK, deliveryId: "1", statusCode: 500 }),
          FleetDeliveryEvidence.cases.NotDelivered.make({ windowStart: 0, windowEnd: 1, oldestReached: 0 }),
          FleetDeliveryEvidence.cases.Unreadable.make({ reason: "r", oldestReached: O.none() }),
          FleetDeliveryEvidence.cases.Gate.make({}),
        ],
        classifyFleetEvidence
      ),
      [O.some("lost"), O.none(), O.none(), O.some("unknown"), O.some("gate")]
    );
  });

  it("reads the remedies pipeably", () => {
    const finding = FleetJobFinding.make({
      job: queued(700, ago(12)),
      pool: "heavy",
      age: minutes(12),
      rank: 1,
      launches: 0,
      source: hookSource,
      verdict: FleetVerdict.cases.MissedDelivery.make({}),
      evidence: O.none(),
      classification: O.none(),
    });
    expect(pipe(REPOSITORY, fleetRemedies(finding))).toEqual([]);
  });

  it("quotes JSON ids and reads Link cursors", () => {
    expect(quoteJsonIds('[{"id": 3855552300210716674, "guid": "x", "hook_id": 1}]')).toBe(
      '[{"id":"3855552300210716674", "guid": "x", "hook_id": 1}]'
    );
    assertSome(
      nextLinkCursor(
        '<https://api.github.com/x?per_page=100&cursor=v1_1>; rel="prev", <https://api.github.com/x?per_page=100&cursor=v1_9>; rel="next"'
      ),
      "v1_9"
    );
    assertNone(nextLinkCursor('<https://api.github.com/x?cursor=v1_1>; rel="prev"'));
  });
});

const runGuard = Effect.fnUntraced(function* (
  fixture: FleetGithubFixture,
  options: { readonly event: string; readonly currentRunId?: number; readonly githubOutput?: boolean }
) {
  yield* TestClock.setTime(NOW);
  const slept = yield* Ref.make<ReadonlyArray<number>>([]);
  const calls = yield* Ref.make<Calls>({ deliveriesPage: 0, deliveryDetail: 0, jobsPage: 0 });
  const outputs = ActionOutputs.recording();
  const decision = yield* runFleetMissedEventGuard(
    FleetGuardInput.make({
      repository: REPOSITORY,
      workflowFile: "fleet-missed-event-check.yml",
      currentRunId: O.fromUndefinedOr(options.currentRunId),
      event: options.event,
      githubOutput: options.githubOutput ?? true,
    })
  ).pipe(provideScopedLayer(Layer.mergeAll(countingReads(fixture, calls), advancingSleep(slept), outputs.layer)));
  return {
    decision,
    sets: A.map(
      A.filter(outputs.entries(), (entry) => entry.member === "set"),
      (entry) => [entry.name, entry.value]
    ),
  };
});

describe("fleet missed-event check guard", () => {
  it.effect("skips when the previous check run started inside the 8-minute window", () =>
    Effect.gen(function* () {
      const { decision, sets } = yield* runGuard(
        fixtureOf({
          reads: [],
          jobs: [],
          workflowRuns: O.some([run(101, NOW), run(100, ago(4))]),
          checkJobs: [ranAt(100, ago(3))],
        }),
        { event: "workflow_run", currentRunId: 101 }
      );
      expect(decision).toEqual(FleetGuardDecision.cases.Skip.make({ runId: 100, startedAt: ago(3) }));
      expect(sets).toEqual([["run", "false"]]);
      const logs = yield* TestConsole.logLines;
      expect(A.join(A.map(logs, String), "\n")).toContain(
        "fleet missed-event guard: skip; check run 100 started 3m00s ago, inside the 8m00s window"
      );
    })
  );

  it.effect("looks past guard-skipped runs to the earlier check run", () =>
    Effect.gen(function* () {
      const recent = yield* runGuard(
        fixtureOf({
          reads: [],
          jobs: [],
          workflowRuns: O.some([run(105, NOW), run(104, ago(1)), run(103, ago(2)), run(102, ago(6))]),
          checkJobs: [ranAt(102, ago(6))],
        }),
        { event: "workflow_run", currentRunId: 105 }
      );
      expect(recent.decision).toEqual(FleetGuardDecision.cases.Skip.make({ runId: 102, startedAt: ago(6) }));
      const stale = yield* runGuard(
        fixtureOf({
          reads: [],
          jobs: [],
          workflowRuns: O.some([run(105, NOW), run(104, ago(1)), run(103, ago(2)), run(102, ago(9))]),
          checkJobs: [ranAt(102, ago(9))],
        }),
        { event: "workflow_run", currentRunId: 105 }
      );
      expect(stale.decision).toEqual(
        FleetGuardDecision.cases.Run.make({ reason: "previous check run 102 started 9m00s ago" })
      );
      expect(stale.sets).toEqual([["run", "true"]]);
    })
  );

  it.effect("runs when no earlier run ran its check, and ignores a newer pending run", () =>
    Effect.gen(function* () {
      const { decision, sets } = yield* runGuard(
        fixtureOf({
          reads: [],
          jobs: [],
          workflowRuns: O.some([run(111, NOW), run(110, ago(1)), run(109, ago(2))]),
          checkJobs: [ranAt(111, ago(1))],
        }),
        { event: "schedule", currentRunId: 110 }
      );
      expect(decision).toEqual(FleetGuardDecision.cases.Run.make({ reason: "no previous check run found" }));
      expect(sets).toEqual([["run", "true"]]);
    })
  );

  it.effect("a dispatch always runs without reading", () =>
    Effect.gen(function* () {
      const { decision, sets } = yield* runGuard(
        fixtureOf({ reads: [], jobs: [], workflowRuns: O.none(), checkJobs: [ranAt(100, ago(1))] }),
        { event: "workflow_dispatch", currentRunId: 101 }
      );
      expect(decision).toEqual(FleetGuardDecision.cases.Run.make({ reason: "workflow_dispatch always runs" }));
      expect(sets).toEqual([["run", "true"]]);
    })
  );

  it.effect("fails open when the runs or a check job cannot be read", () =>
    Effect.gen(function* () {
      const runs = yield* runGuard(fixtureOf({ reads: [], jobs: [], workflowRuns: O.none() }), {
        event: "workflow_run",
        currentRunId: 101,
      });
      expect(runs.decision._tag).toBe("Run");
      expect(FleetGuardDecision.guards.Run(runs.decision) ? runs.decision.reason : "").toContain(
        "previous check run unreadable, failing open"
      );
      expect(runs.sets).toEqual([["run", "true"]]);
      const jobs = yield* runGuard(
        fixtureOf({
          reads: [],
          jobs: [],
          workflowRuns: O.some([run(101, NOW), run(100, ago(2))]),
          failingCheckJobs: [100],
        }),
        { event: "workflow_run", currentRunId: 101 }
      );
      expect(jobs.decision._tag).toBe("Run");
      expect(jobs.sets).toEqual([["run", "true"]]);
    })
  );

  it.effect("writes no output when GITHUB_OUTPUT is not requested", () =>
    Effect.gen(function* () {
      const { sets } = yield* runGuard(fixtureOf({ reads: [], jobs: [] }), {
        event: "workflow_run",
        githubOutput: false,
      });
      expect(sets).toEqual([]);
    })
  );

  it("decides and renders from a constructed previous run", () => {
    const previous = FleetCheckingRun.makeOption({ runId: 7, startedAt: ago(8) });
    expect(fleetGuardDecision({ event: "workflow_run", now: NOW, previous: Result.succeed(previous) })._tag).toBe(
      "Run"
    );
    expect(fleetGuardDecision({ event: "workflow_run", now: NOW - 1, previous: Result.succeed(previous) })._tag).toBe(
      "Skip"
    );
    expect(fleetGuardDecision({ event: "workflow_run", now: NOW, previous: Result.fail("HTTP 502") })).toEqual(
      FleetGuardDecision.cases.Run.make({ reason: "previous check run unreadable, failing open (HTTP 502)" })
    );
    expect(pipe(FleetGuardDecision.cases.Run.make({ reason: "x" }), renderFleetGuardDecision(NOW))).toBe(
      "fleet missed-event guard: run; x"
    );
  });
});

describe("fleet missed-event check caps", () => {
  it.effect("projects the production caps from the generated input", () =>
    Effect.gen(function* () {
      const decoded = yield* S.decodeEffect(FleetPoolCapsInput)(fleetPoolCapsProjection);
      expect(decoded.phase).toBe("primary");
      expect(productionFleetPools).toEqual([
        FleetPoolCap.make({ pool: "heavy", label: "beep-fleet-heavy", cap: 2 }),
        FleetPoolCap.make({ pool: "overflow", label: "beep-fleet-overflow", cap: 48 }),
      ]);
      expect(A.map(fleetPoolCaps({ ...fleetPoolCapsProjection, phase: "overlap" }), (pool) => pool.cap)).toEqual([
        1, 2,
      ]);
    })
  );
});

interface Recorded {
  readonly authorization: O.Option<string>;
  readonly method: string;
  readonly url: string;
}

type Route = readonly [match: string, status: number, body: string, headers?: Record<string, string>];

const fakeHttp = (routes: ReadonlyArray<Route>, recorded: Ref.Ref<ReadonlyArray<Recorded>>) =>
  HttpClient.make((request, url) =>
    Effect.gen(function* () {
      yield* Ref.update(
        recorded,
        A.append({
          method: request.method,
          url: url.toString(),
          authorization: O.fromUndefinedOr(request.headers.authorization),
        })
      );
      const route = A.findFirst(routes, ([match]) => Str.includes(match)(url.toString()));
      if (O.isNone(route)) {
        return yield* new HttpClientError.HttpClientError({
          reason: new HttpClientError.TransportError({ request, description: "no route" }),
        });
      }
      const [, status, body, headers] = route.value;
      return HttpClientResponse.fromWeb(request, new Response(body, { status, headers: headers ?? {} }));
    })
  );

const liveReads = Effect.fnUntraced(function* (routes: ReadonlyArray<Route>) {
  const recorded = yield* Ref.make<ReadonlyArray<Recorded>>([]);
  const reads = yield* Effect.service(FleetGithubReads).pipe(
    provideScopedLayer(
      layerFleetGithubReadsLive(REPOSITORY).pipe(
        Layer.provide(FleetWatchToken.layerFake("ghs_test")),
        Layer.provide(Layer.succeed(HttpClient.HttpClient, fakeHttp(routes, recorded)))
      )
    )
  );
  return { reads, recorded };
});

describe("fleet missed-event check live reads", () => {
  it.effect("maps runners, runs, jobs and workflow runs over GET requests with the token", () =>
    Effect.gen(function* () {
      const { reads, recorded } = yield* liveReads([
        [
          "orgs/beep-effect/actions/runners",
          200,
          '{"total_count":2,"runners":[{"id":1,"name":"a","status":"online","busy":false,"labels":[{"name":"beep-fleet-heavy"}]},{"id":2,"name":"b","status":"offline","busy":false,"labels":[]}]}',
        ],
        [
          "actions/runs?status=queued",
          200,
          '{"total_count":1,"workflow_runs":[{"id":45066910700,"created_at":"2026-11-22T21:00:00Z"}]}',
        ],
        ["actions/runs?created=", 200, '{"total_count":0,"workflow_runs":[]}'],
        [
          "actions/runs/45066910700/jobs",
          200,
          '{"total_count":2,"jobs":[{"id":137354449472,"run_id":45066910700,"name":"Heavy","status":"queued","labels":["beep-fleet-heavy"],"created_at":"2026-11-22T21:03:59Z","started_at":null,"runner_name":""},{"id":2,"run_id":45066910700,"name":"Done","status":"completed","labels":[],"created_at":"2026-11-22T21:00:00Z","started_at":"2026-11-22T21:01:00Z","runner_name":"r1"}]}',
        ],
        [
          "workflows/fleet-missed-event-check.yml/runs",
          200,
          '{"total_count":1,"workflow_runs":[{"id":5,"created_at":"2026-11-22T21:10:00Z"}]}',
        ],
        [
          "actions/runs/5/jobs",
          200,
          `{"total_count":2,"jobs":[{"name":"Fleet Missed-Event Guard","status":"completed","conclusion":"success","started_at":"2026-11-22T21:10:05Z"},{"name":"${FLEET_CHECK_JOB_NAME}","status":"completed","conclusion":"success","started_at":"2026-11-22T21:11:00Z"}]}`,
        ],
        [
          "actions/runs/6/jobs",
          200,
          `{"total_count":1,"jobs":[{"name":"${FLEET_CHECK_JOB_NAME}","status":"completed","conclusion":"skipped","started_at":"2026-11-22T21:12:00Z"}]}`,
        ],
        [
          "actions/runs/7/jobs",
          200,
          `{"total_count":1,"jobs":[{"name":"${FLEET_CHECK_JOB_NAME}","status":"queued","conclusion":null,"started_at":null}]}`,
        ],
        ["actions/runs/8/jobs", 200, '{"total_count":0,"jobs":[]}'],
      ]);
      const runners = yield* reads.runnersPage(1);
      expect(runners.runners).toEqual([
        FleetRunner.make({ id: 1, name: "a", online: true, busy: false, labels: ["beep-fleet-heavy"] }),
        FleetRunner.make({ id: 2, name: "b", online: false, busy: false, labels: [] }),
      ]);
      const runs = yield* reads.runsPage(FleetRunsQuery.cases.ByStatus.make({ status: "queued" }), 1);
      expect(runs.runIds).toEqual([45066910700]);
      yield* reads.runsPage(FleetRunsQuery.cases.CreatedSince.make({ since: NOW }), 2);
      const jobs = yield* reads.jobsPage(45066910700, 1);
      deepStrictEqual(
        A.map(jobs.jobs, (job) => [job.id, job.startedAt, job.runnerName]),
        [
          [137354449472, O.none(), O.none()],
          [2, O.some(DateTime.makeUnsafe("2026-11-22T21:01:00Z").pipe(DateTime.toEpochMillis)), O.some("r1")],
        ]
      );
      const workflowRuns = yield* reads.workflowRuns("fleet-missed-event-check.yml");
      expect(workflowRuns).toEqual([run(5, DateTime.toEpochMillis(DateTime.makeUnsafe("2026-11-22T21:10:00Z")))]);
      const checkJobs = yield* Effect.forEach([5, 6, 7, 8], reads.checkJob, { concurrency: 1 });
      const notRan = FleetCheckJob.cases.NotRan.make({});
      expect(checkJobs).toEqual([
        FleetCheckJob.cases.Ran.make({
          startedAt: DateTime.toEpochMillis(DateTime.makeUnsafe("2026-11-22T21:11:00Z")),
        }),
        notRan,
        notRan,
        notRan,
      ]);
      const requestCount = yield* reads.requestCount;
      expect(requestCount).toBe(9);
      const requests = yield* Ref.get(recorded);
      expect(A.every(requests, (request) => request.method === "GET")).toBe(true);
      assertTrue(A.every(requests, (request) => O.contains(request.authorization, "Bearer ghs_test")));
      expect(A.map(requests, (request) => request.url)).toContain(
        "https://api.github.com/repos/beep-effect/beep-effect/actions/runs?created=%3E%3D2026-11-22T21%3A20%3A00.000Z&per_page=100&page=2"
      );
      expect(A.map(requests, (request) => request.url)).toContain(
        "https://api.github.com/repos/beep-effect/beep-effect/actions/workflows/fleet-missed-event-check.yml/runs?per_page=30"
      );
    })
  );

  it.effect("keeps delivery ids exact and follows the Link cursor", () =>
    Effect.gen(function* () {
      const { reads, recorded } = yield* liveReads([
        [
          "deliveries?per_page=100&cursor=v1_9",
          200,
          '[{"id":3855552300210716675,"delivered_at":"2026-11-22T20:00:00Z","status_code":500,"action":null}]',
        ],
        [
          "hooks/714397446/deliveries/3855552300210716674",
          200,
          '{"id":3855552300210716674,"request":{"payload":{"workflow_job":{"id":137354449472}}}}',
        ],
        ["hooks/714397446/deliveries/1", 200, '{"id":1,"request":{"payload":null}}'],
        ["hooks/714397446/deliveries/2", 200, '{"id":2}'],
        [
          "hooks/714397446/deliveries?per_page=100",
          200,
          '[{"id":3855552300210716674,"guid":"g","delivered_at":"2026-11-22T21:04:00Z","status_code":200,"action":"queued","redelivery":false}]',
          {
            link: '<https://api.github.com/repos/beep-effect/beep-effect/hooks/714397446/deliveries?per_page=100&cursor=v1_9>; rel="next"',
          },
        ],
      ]);
      const first = yield* reads.deliveriesPage(HOOK, O.none());
      expect(first.deliveries[0]?.id).toBe("3855552300210716674");
      deepStrictEqual(first.deliveries[0]?.action, O.some("queued"));
      assertSome(first.nextCursor, "v1_9");
      const second = yield* reads.deliveriesPage(HOOK, first.nextCursor);
      expect(second.deliveries[0]?.id).toBe("3855552300210716675");
      deepStrictEqual(second.deliveries[0]?.action, O.none());
      assertNone(second.nextCursor);
      const matched = yield* reads.deliveryDetail(HOOK, "3855552300210716674");
      expect(matched).toEqual(
        FleetDeliveryDetail.make({ id: "3855552300210716674", workflowJobId: O.some("137354449472") })
      );
      assertNone((yield* reads.deliveryDetail(HOOK, "1")).workflowJobId);
      assertNone((yield* reads.deliveryDetail(HOOK, "2")).workflowJobId);
      const requestsAfter = yield* Ref.get(recorded);
      expect(A.every(requestsAfter, (request) => request.method === "GET")).toBe(true);
    })
  );

  it.effect("turns HTTP, decode and transport failures into read errors", () =>
    Effect.gen(function* () {
      const { reads } = yield* liveReads([
        ["actions/runners", 404, '{"message":"Not Found"}'],
        ["actions/runs/1/jobs", 200, '{"jobs":"nope"}'],
      ]);
      const missing = yield* Effect.flip(reads.runnersPage(1));
      expect([missing.status, missing.message]).toEqual([404, "HTTP 404"]);
      const undecodable = yield* Effect.flip(reads.jobsPage(1, 1));
      expect(undecodable.message).toContain("undecodable response");
      const transport = yield* Effect.flip(reads.deliveryDetail(HOOK, "9"));
      expect(transport._tag).toBe("FleetReadError");
    })
  );

  it.layer(FleetWatchToken.layerEnv, { timeout: "30 seconds" })((layerIt) => {
    layerIt.effect("reads the token from GH_TOKEN and fails without it", () =>
      Effect.gen(function* () {
        const read = Effect.gen(function* () {
          const service = yield* FleetWatchToken;
          return yield* service.token;
        });
        const token = yield* read.pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ GH_TOKEN: "ghs_env" }))
        );
        expect(Redacted.value(token)).toBe("ghs_env");
        const missing = yield* read.pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})),
          Effect.flip
        );
        expect(missing.message).toBe("GH_TOKEN is not set");
      })
    );
  });

  it.layer(FleetSleep.layerLive, { timeout: "30 seconds" })((layerIt) => {
    layerIt.effect("sleeps for real through the live seam", () =>
      Effect.gen(function* () {
        const fiber = yield* Effect.gen(function* () {
          const service = yield* FleetSleep;
          yield* service.sleep(Duration.seconds(1));
        }).pipe(Effect.forkChild);
        yield* TestClock.adjust("1 second");
        yield* Fiber.join(fiber);
      })
    );
  });
});

const commandEnv = (env: Record<string, string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env));

const runCommand = Command.runWith(ciFleetMissedEventCheckCommand, { version: "0.0.0" });

const runCommandFor = Effect.fnUntraced(function* (
  args: ReadonlyArray<string>,
  env: Record<string, string>,
  routes: ReadonlyArray<Route>
) {
  yield* TestClock.setTime(NOW);
  const recorded = yield* Ref.make<ReadonlyArray<Recorded>>([]);
  const fiber = yield* runCommand(args).pipe(
    Effect.provideService(HttpClient.HttpClient, fakeHttp(routes, recorded)),
    commandEnv(env),
    Effect.exit,
    Effect.forkChild
  );
  yield* TestClock.adjust("10 minutes");
  const exit = yield* Fiber.join(fiber);
  return { exit, recorded: yield* Ref.get(recorded) };
});

const emptyFleet: ReadonlyArray<Route> = [
  ["actions/runners", 200, '{"total_count":0,"runners":[]}'],
  ["actions/runs?", 200, '{"total_count":0,"workflow_runs":[]}'],
  ["workflows/fleet-missed-event-check.yml/runs", 200, '{"total_count":0,"workflow_runs":[]}'],
];

it.layer(Layer.mergeAll(NodeServices.layer, TestConsole.layer), { timeout: "30 seconds" })(
  "ci fleet-missed-event-check command",
  (layerIt) => {
    layerIt.effect("passes a green fleet with only GET requests", () =>
      Effect.gen(function* () {
        const { exit, recorded } = yield* runCommandFor(
          [],
          { GH_REPO: REPOSITORY, GH_TOKEN: "ghs_x", GITHUB_RUN_ID: "12" },
          emptyFleet
        );
        expect(exit._tag).toBe("Success");
        expect(A.length(recorded)).toBeGreaterThan(0);
        expect(A.every(recorded, (request) => request.method === "GET")).toBe(true);
        const logs = yield* TestConsole.logLines;
        expect(A.join(A.map(logs, String), "\n")).toContain("fleet missed-event check: green");
      })
    );

    layerIt.effect("fails the run when a listing serves an empty page short of its total count", () =>
      Effect.gen(function* () {
        const routes: ReadonlyArray<Route> = [
          ["actions/runners", 200, '{"total_count":5,"runners":[]}'],
          ["actions/runs?", 200, '{"total_count":0,"workflow_runs":[]}'],
          ["workflows/fleet-missed-event-check.yml/runs", 200, '{"total_count":0,"workflow_runs":[]}'],
        ];
        const { exit } = yield* runCommandFor(
          [],
          { GH_REPO: REPOSITORY, GH_TOKEN: "ghs_x", GITHUB_RUN_ID: "12" },
          routes
        );
        expect(exit._tag).toBe("Failure");
        expect(String(exit)).toContain("listing stopped at page 1 with 0 of 5 items");
      })
    );

    layerIt.effect("fails on an alert", () =>
      Effect.gen(function* () {
        const createdAt = DateTime.formatIso(DateTime.makeUnsafe(ago(12)));
        const routes: ReadonlyArray<Route> = [
          ["actions/runners", 200, '{"total_count":0,"runners":[]}'],
          [
            "actions/runs?status=queued",
            200,
            '{"total_count":1,"workflow_runs":[{"id":3800,"created_at":"2026-11-22T21:00:00Z"}]}',
          ],
          ["actions/runs?", 200, '{"total_count":0,"workflow_runs":[]}'],
          [
            "actions/runs/3800/jobs",
            200,
            `{"total_count":1,"jobs":[{"id":800,"run_id":3800,"name":"Heavy","status":"queued","labels":["beep-fleet-heavy"],"created_at":"${createdAt}","started_at":null}]}`,
          ],
          ["hooks/714397446/deliveries", 200, "[]"],
          ["workflows/fleet-missed-event-check.yml/runs", 200, '{"total_count":0,"workflow_runs":[]}'],
        ];
        const { exit } = yield* runCommandFor(
          ["--repository", REPOSITORY],
          { GH_TOKEN: "ghs_x", GITHUB_STEP_SUMMARY: "" },
          routes
        );
        expect(exit._tag).toBe("Failure");
        const errors = yield* TestConsole.errorLines;
        expect(A.join(A.map(errors, String), "\n")).toContain("fleet missed-event check: 1 alert(s)");
      })
    );

    layerIt.effect("--guard skips behind a recent check run and exits green", () =>
      Effect.gen(function* () {
        const startedAt = DateTime.formatIso(DateTime.makeUnsafe(ago(2)));
        const routes: ReadonlyArray<Route> = [
          [
            "workflows/fleet-missed-event-check.yml/runs",
            200,
            '{"total_count":2,"workflow_runs":[{"id":12,"created_at":"2026-11-22T21:20:00Z"},{"id":11,"created_at":"2026-11-22T21:17:00Z"}]}',
          ],
          [
            "actions/runs/11/jobs",
            200,
            `{"total_count":1,"jobs":[{"name":"${FLEET_CHECK_JOB_NAME}","status":"in_progress","conclusion":null,"started_at":"${startedAt}"}]}`,
          ],
        ];
        const { exit, recorded } = yield* runCommandFor(
          ["--guard"],
          { GH_REPO: REPOSITORY, GH_TOKEN: "ghs_x", GITHUB_RUN_ID: "12", GITHUB_EVENT_NAME: "workflow_run" },
          routes
        );
        expect(exit._tag).toBe("Success");
        expect(A.length(recorded)).toBe(2);
        const logs = yield* TestConsole.logLines;
        expect(A.join(A.map(logs, String), "\n")).toContain("fleet missed-event guard: skip; check run 11");
      })
    );

    layerIt.effect("--guard fails open without a token and runs on a dispatch without reading", () =>
      Effect.gen(function* () {
        const tokenless = yield* runCommandFor(
          ["--guard"],
          { GH_REPO: REPOSITORY, GITHUB_RUN_ID: "12", GITHUB_EVENT_NAME: "workflow_run" },
          emptyFleet
        );
        expect(tokenless.exit._tag).toBe("Success");
        const dispatched = yield* runCommandFor(
          ["--guard"],
          { GH_REPO: REPOSITORY, GH_TOKEN: "ghs_x", GITHUB_EVENT_NAME: "workflow_dispatch" },
          emptyFleet
        );
        expect(dispatched.exit._tag).toBe("Success");
        expect(dispatched.recorded).toEqual([]);
        const logLines = yield* TestConsole.logLines;
        const logs = A.join(A.map(logLines, String), "\n");
        expect(logs).toContain("fleet missed-event guard: run; previous check run unreadable, failing open");
        expect(logs).toContain("fleet missed-event guard: run; workflow_dispatch always runs");
      })
    );

    layerIt.effect("--guard without an event name reads the runs like a scheduled run", () =>
      Effect.gen(function* () {
        const { exit, recorded } = yield* runCommandFor(
          ["--guard"],
          { GH_REPO: REPOSITORY, GH_TOKEN: "ghs_x", GITHUB_RUN_ID: "12" },
          emptyFleet
        );
        expect(exit._tag).toBe("Success");
        expect(A.length(recorded)).toBe(1);
        const logs = yield* TestConsole.logLines;
        expect(A.join(A.map(logs, String), "\n")).toContain(
          "fleet missed-event guard: run; no previous check run found"
        );
      })
    );

    layerIt.effect("passes when the current run's check job has not started", () =>
      Effect.gen(function* () {
        const startedAt = DateTime.formatIso(DateTime.makeUnsafe(ago(20)));
        const routes: ReadonlyArray<Route> = [
          ["actions/runners", 200, '{"total_count":0,"runners":[]}'],
          [
            "workflows/fleet-missed-event-check.yml/runs",
            200,
            '{"total_count":2,"workflow_runs":[{"id":12,"created_at":"2026-11-22T21:20:00Z"},{"id":11,"created_at":"2026-11-22T21:00:00Z"}]}',
          ],
          [
            "actions/runs/11/jobs",
            200,
            `{"total_count":1,"jobs":[{"name":"${FLEET_CHECK_JOB_NAME}","status":"completed","conclusion":"success","started_at":"${startedAt}"}]}`,
          ],
          ["actions/runs/12/jobs", 200, '{"total_count":0,"jobs":[]}'],
          ["actions/runs?", 200, '{"total_count":0,"workflow_runs":[]}'],
        ];
        const { exit, recorded } = yield* runCommandFor(
          [],
          { GH_REPO: REPOSITORY, GH_TOKEN: "ghs_x", GITHUB_RUN_ID: "12" },
          routes
        );
        expect(exit._tag).toBe("Success");
        expect(A.some(recorded, (request) => Str.includes("actions/runs/12/jobs")(request.url))).toBe(true);
        const logs = yield* TestConsole.logLines;
        expect(A.join(A.map(logs, String), "\n")).toContain("fleet missed-event check: green");
      })
    );

    layerIt.effect("refuses to run without a repository", () =>
      Effect.gen(function* () {
        const { exit } = yield* runCommandFor([], { GH_TOKEN: "ghs_x" }, emptyFleet);
        expect(exit._tag).toBe("Failure");
        const errors = yield* TestConsole.errorLines;
        expect(A.join(A.map(errors, String), "\n")).toContain("Pass --repository or set GH_REPO.");
      })
    );

    layerIt.effect("fails when GitHub cannot be read", () =>
      Effect.gen(function* () {
        const { exit } = yield* runCommandFor([], { GH_REPO: REPOSITORY, GITHUB_RUN_ID: "not-a-number" }, emptyFleet);
        expect(exit._tag).toBe("Failure");
      })
    );

    layerIt.effect("builds the live layer", () =>
      Effect.sync(() => {
        expect(Layer.isLayer(layerFleetMissedEventLive(REPOSITORY))).toBe(true);
        expect(CiCommandError.make({ message: "x" })._tag).toBe("CiCommandError");
      })
    );

    layerIt.effect("schedules the workflow on a hosted runner with a read-only App token and no cap literal", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* findRepoRoot();
        const text = yield* fs.readFileString(path.join(root, ".github/workflows/fleet-missed-event-check.yml"));
        const workflow = parseWorkflowYaml(text);
        const job = (segments: ReadonlyArray<string | number>) => yamlAt(workflow, ["jobs", "check", ...segments]);
        const guard = (segments: ReadonlyArray<string | number>) => yamlAt(workflow, ["jobs", "guard", ...segments]);
        expect(yamlAt(workflow, ["on", "schedule"])).toEqual([{ cron: "3-59/10 * * * *" }]);
        expect(yamlAt(workflow, ["on"])).toHaveProperty("workflow_dispatch");
        expect(yamlAt(workflow, ["on", "workflow_run"])).toEqual({
          workflows: ["Check", "Heavy Admit", "Cache Warm"],
          types: ["requested"],
        });
        expect(yamlAt(workflow, ["concurrency"])).toEqual({
          group: "fleet-missed-event-check",
          "cancel-in-progress": false,
        });
        expect(yamlAt(workflow, ["permissions"])).toEqual({});
        expect(job(["name"])).toBe(FLEET_CHECK_JOB_NAME);
        expect(job(["needs"])).toBe("guard");
        expect(job(["if"])).toBe("${{ !cancelled() && needs.guard.outputs.run != 'false' }}");
        expect(job(["runs-on"])).toBe("ubuntu-latest");
        expect(job(["environment"])).toBe("fleet-watch");
        expect(job(["permissions"])).toEqual({ contents: "read" });
        expect(guard(["permissions"])).toEqual({ actions: "read", contents: "read" });
        expect(guard(["environment"])).toBeUndefined();
        expect(guard(["outputs", "run"])).toBe("${{ steps.guard.outputs.run }}");
        const stepsOf = (value: unknown): ReadonlyArray<unknown> => (A.isArray(value) ? value : []);
        const guardSteps = stepsOf(guard(["steps"]));
        const decide = A.findFirst(guardSteps, (step) => yamlAt(step, ["id"]) === "guard");
        assertSome(
          O.map(decide, (step) => [yamlAt(step, ["run"]), yamlAt(step, ["env", "GH_TOKEN"])]),
          ["bun run beep ci fleet-missed-event-check --guard", "${{ github.token }}"]
        );
        expect(
          A.some(guardSteps, (step) => Str.includes("create-github-app-token")(String(yamlAt(step, ["uses"]))))
        ).toBe(false);
        for (const steps of [guardSteps, stepsOf(job(["steps"]))]) {
          const checkout = A.findFirst(steps, (step) =>
            Str.startsWith("actions/checkout@")(String(yamlAt(step, ["uses"])))
          );
          assertSome(
            O.map(checkout, (step) => [yamlAt(step, ["with", "ref"]), yamlAt(step, ["with", "persist-credentials"])]),
            ["${{ github.event.repository.default_branch }}", false]
          );
        }
        expect(text).toContain("Security posture");
        expect(text).not.toMatch(/head_sha|head_branch|pull_request/u);
        const steps = job(["steps"]);
        const stepList: ReadonlyArray<unknown> = A.isArray(steps) ? steps : [];
        const mint = A.findFirst(stepList, (step) =>
          Str.includes("create-github-app-token")(String(yamlAt(step, ["uses"])))
        );
        const withInputs = O.map(mint, (step) => yamlAt(step, ["with"]));
        assertSome(
          O.map(withInputs, (inputs) =>
            A.filter(P.isObject(inputs) ? R.keys(inputs) : [], Str.startsWith("permission-"))
          ),
          ["permission-actions", "permission-organization-self-hosted-runners", "permission-repository-hooks"]
        );
        assertSome(
          O.map(withInputs, (inputs) => [
            yamlAt(inputs, ["repositories"]),
            yamlAt(inputs, ["permission-actions"]),
            yamlAt(inputs, ["permission-organization-self-hosted-runners"]),
            yamlAt(inputs, ["permission-repository-hooks"]),
          ]),
          ["beep-effect", "read", "read", "read"]
        );
        assertSome(
          O.map(mint, (step) => yamlAt(step, ["uses"])),
          "actions/create-github-app-token@f418cff399f7aef4c2f0ad47e25ca7a6abbdd6fc"
        );
        expect(text).toContain("run: bun run beep ci fleet-missed-event-check");
        expect(text).not.toContain("beep-fleet");
        expect(text).not.toMatch(/maximumCount|--cap|\b48\b/u);
        expect(text).not.toMatch(/gh run|gh api|redeliver|attempts/u);
      })
    );
  }
);
