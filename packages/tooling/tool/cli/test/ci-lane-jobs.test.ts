// goals/certainty-scorecard MEAS-05 slice 1: the lane descriptors are the one job-name map. The committed table
// records what every mapper answered before the consolidation; each answer must survive it.

import {
  buildCiLaneTimingWindowReport,
  CI_LANE_DESCRIPTORS,
  CI_LANE_ID_VALUES,
  CiLaneId,
  CiSupportJobName,
  CiWorkflowJob,
  CiWorkflowWindowRun,
  CiWorkflowWindowRunJobs,
  ciCalledJobName,
  ciCallerJobName,
  ciJobShardFamily,
  ciLaneDescriptor,
  ciLaneOfReportingName,
  ciLaneOfShardFamily,
  ciLaneReportingNames,
  ciLaneShardFamilies,
  ciLaneShardJobName,
  ciLaneShardJobPrefix,
  ciShardJobNames,
  HEAVY_CONTEXT_PREFIX,
  isCiHeavyLane,
  isCiShardJobNamed,
  isCiSupportJobName,
} from "@beep/repo-cli/commands/Ci";
import { hostedJobAttribution, jobNameToLane } from "@beep/repo-cli/commands/Ci/RouteCensus";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import conservationJson from "./fixtures/ci-lane-jobs/job-name-conservation.json" with { type: "json" };
import type { CiLaneTimingWindowReport } from "@beep/repo-cli/commands/Ci";

const ConservationLane = S.Struct({
  lane: CiLaneId,
  contextName: S.String,
  workflow: S.String,
  required: S.Boolean,
  reportingNames: S.Array(S.String),
  shardFamilies: S.Array(S.String),
  heavyRoute: S.Boolean,
});

const ConservationEffectiveLane = S.Struct({
  lane: S.String,
  aggregator: S.String,
  plannedBy: S.NullOr(S.String),
  shardLayouts: S.String.pipe(S.Array, S.Array),
});

const ConservationJob = S.Struct({
  name: S.String,
  routeLane: S.NullOr(CiLaneId),
  routeClass: S.String,
  timingsLane: S.String,
  timingsComponent: S.NullOr(S.Literals(["aggregator", "shard"])),
});

const Conservation = S.Struct({
  description: S.String,
  heavyContextPrefix: S.String,
  supportJobNames: S.Array(S.String),
  certainty: S.Struct({
    coverageContexts: S.Array(S.String),
    docsPolicyJob: S.String,
    heavyAdmissionJob: S.String,
    mergeableExtraContexts: S.String.pipe(S.Array, S.Array),
    testPlanJob: S.String,
    testUnitShardPrefix: S.String,
  }),
  lanes: S.Array(ConservationLane),
  effectiveLanes: S.Array(ConservationEffectiveLane),
  layoutCases: S.Array(
    S.Struct({
      lane: S.String,
      layout: S.Int,
      red: S.NullOr(S.String),
      rows: S.Array(
        S.Struct({
          population: S.String,
          attribution: S.NullOr(S.String),
          durationSeconds: S.NullOr(S.Finite),
          jobName: S.String,
        })
      ),
    })
  ),
  jobs: S.Array(ConservationJob),
});

const decodeConservation = S.decodeUnknownEffect(Conservation);

const sorted = (names: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(names, Order.String);

// The required contexts the census is judged against: every required lane descriptor's context (15).
const REQUIRED_CONTEXTS = pipe(
  CI_LANE_DESCRIPTORS,
  A.filter((descriptor) => descriptor.required),
  A.map((descriptor) => descriptor.contextName),
  A.dedupe
);

const RUN_CREATED_AT = "2026-11-12T00:00:00Z";

const windowRun = (id: number) =>
  CiWorkflowWindowRun.make({
    created_at: DateTime.makeUnsafe(RUN_CREATED_AT),
    event: "pull_request",
    head_sha: `head-${id}`,
    id,
    run_attempt: 1,
  });

const windowJob = (runId: number, index: number, name: string, overrides: Partial<CiWorkflowJob> = {}) =>
  CiWorkflowJob.make({
    completed_at: "2026-11-12T00:10:00Z",
    conclusion: "success",
    created_at: "2026-11-12T00:00:30Z",
    id: runId * 1_000 + index,
    labels: ["ubuntu-24.04"],
    name,
    run_attempt: 1,
    run_id: runId,
    started_at: "2026-11-12T00:01:00Z",
    status: "completed",
    steps: [],
    ...overrides,
  });

type WindowRow = CiLaneTimingWindowReport["rows"][number];

const SHARD_START = DateTime.makeUnsafe("2026-11-12T00:01:00Z");

// One run of a layout: its shards start a second apart in layout order, the named shard (if any) fails, and the
// aggregator reports last.
const layoutCaseRun = (runId: number, aggregator: string, layout: ReadonlyArray<string>, red: O.Option<string>) =>
  CiWorkflowWindowRunJobs.make({
    run: windowRun(runId),
    jobs: A.append(
      A.map(layout, (name, shard) =>
        windowJob(runId, shard, name, {
          conclusion: O.exists(red, (redName) => redName === name) ? "failure" : "success",
          started_at: DateTime.formatIso(DateTime.add(SHARD_START, { seconds: shard })),
        })
      ),
      windowJob(runId, A.length(layout), aggregator, { completed_at: "2026-11-12T00:12:00Z" })
    ),
  });

const rowsOfRun = (report: CiLaneTimingWindowReport, runId: number): ReadonlyArray<WindowRow> =>
  A.filter(report.rows, (row) => row.runId === runId);

const laneRowsOf = (report: CiLaneTimingWindowReport, runId: number, lane: string) =>
  A.map(
    A.filter(rowsOfRun(report, runId), (row) => row.lane === lane && row.population !== "pickup"),
    (row) => ({
      population: row.population,
      attribution: row.population === "attribution" ? row.attribution : null,
      durationSeconds: row.population === "duration" ? row.durationSeconds : null,
      jobName: row.jobName,
    })
  );

describe("CI lane job map", () => {
  it("names each lane id in exactly one descriptor", () => {
    const laneDescriptorIds = A.filter(
      A.map(CI_LANE_DESCRIPTORS, (descriptor) => descriptor.id),
      (id) => A.contains(CI_LANE_ID_VALUES, id)
    );
    expect(sorted(laneDescriptorIds)).toEqual(sorted(CI_LANE_ID_VALUES));
  });

  it("gives every reporting name and shard family to one lane only", () => {
    const reportingNames = A.flatMap(CI_LANE_ID_VALUES, ciLaneReportingNames);
    const shardFamilies = A.flatMap(CI_LANE_ID_VALUES, ciLaneShardFamilies);
    expect(A.dedupe(reportingNames)).toEqual(reportingNames);
    expect(A.dedupe(shardFamilies)).toEqual(shardFamilies);
  });

  it("joins names to lanes in both directions", () => {
    assertSome(ciLaneOfReportingName("Coverage Artifact Migration"), "coverage");
    assertNone(ciLaneOfReportingName("Test Integration"));
    assertSome(ciLaneOfShardFamily("Test Integration"), "test-integration");
    assertNone(ciLaneOfShardFamily("Build"));
    expect(ciLaneShardJobName("lint-b", "lint")).toBe("Lint (lint-b)");
    expect(A.map(["lps-int-1", "int-rest"], ciLaneShardJobName("test-integration"))).toEqual([
      "Test Integration (lps-int-1)",
      "Test Integration (int-rest)",
    ]);
    expect(ciLaneShardJobPrefix("property")).toBe("Property Laws (");
    assertSome(ciJobShardFamily("Property Laws (property-a)"), "Property Laws");
    assertNone(ciJobShardFamily("Property Laws"));
  });

  it("names called jobs and their callers", () => {
    expect(ciCalledJobName("Check", CiSupportJobName.Enum.Heavy)).toBe("Heavy / Check");
    expect(ciCalledJobName("Overflow")("Docgen")).toBe("Overflow / Docgen");
    expect(HEAVY_CONTEXT_PREFIX).toBe(ciCalledJobName("", CiSupportJobName.Enum.Heavy));
    assertSome(ciCallerJobName("Heavy / Test Integration / Overflow"), "Heavy / Test Integration");
    assertNone(ciCallerJobName("Test Plan"));
  });

  it("matches a shard job only under the names the map gives the shard", () => {
    expect(ciShardJobNames("Test Unit (unit-a)")).toEqual(["Test Unit (unit-a)", "Test Unit (unit-a) / Overflow"]);
    expect(isCiShardJobNamed("Test Unit (unit-a)", "Test Unit (unit-a)")).toBe(true);
    expect(isCiShardJobNamed("Test Unit (unit-a)")("Test Unit (unit-a) / Overflow")).toBe(true);
    expect(isCiShardJobNamed("Test Unit (unit-a)")("Test Unit (unit-a) / Probe")).toBe(false);
  });

  it.effect("keeps each lane's names, workflow, required flag and heavy routing", () =>
    Effect.gen(function* () {
      const conservation = yield* decodeConservation(conservationJson);
      const current = A.map(conservation.lanes, ({ lane }) => {
        const descriptor = ciLaneDescriptor(lane);
        return {
          lane,
          contextName: descriptor.contextName,
          workflow: descriptor.workflow,
          required: descriptor.required,
          reportingNames: sorted(ciLaneReportingNames(lane)),
          shardFamilies: sorted(ciLaneShardFamilies(lane)),
          heavyRoute: isCiHeavyLane(lane),
        };
      });
      expect(A.length(conservation.lanes)).toBe(A.length(CI_LANE_ID_VALUES));
      expect(current).toEqual(conservation.lanes);
    })
  );

  it.effect("joins every recorded job name to the lane and class the route census gave it", () =>
    Effect.gen(function* () {
      const conservation = yield* decodeConservation(conservationJson);
      const current = A.map(conservation.jobs, ({ name }) => ({
        name,
        routeLane: O.getOrNull(jobNameToLane(name)),
        routeClass: hostedJobAttribution(name).jobClass,
      }));
      expect(current).toEqual(
        A.map(conservation.jobs, ({ name, routeLane, routeClass }) => ({ name, routeLane, routeClass }))
      );
      expect(
        sorted(
          A.filter(
            A.map(conservation.jobs, ({ name }) => name),
            isCiSupportJobName
          )
        )
      ).toEqual(conservation.supportJobNames);
    })
  );

  it.effect("keeps the certainty scorecard's context names", () =>
    Effect.gen(function* () {
      const conservation = yield* decodeConservation(conservationJson);
      const mergeableExtraLanes: ReadonlyArray<CiLaneId> = ["lint-policy", "property", "fallow", "coverage"];
      expect({
        coverageContexts: ciLaneReportingNames("coverage"),
        docsPolicyJob: ciLaneDescriptor("docs-policy").contextName,
        heavyAdmissionJob: CiSupportJobName.Enum["Heavy Admission"],
        mergeableExtraContexts: A.map(mergeableExtraLanes, ciLaneReportingNames),
        testPlanJob: CiSupportJobName.Enum["Test Plan"],
        testUnitShardPrefix: ciLaneShardJobPrefix("test-unit"),
      }).toEqual(conservation.certainty);
      expect(HEAVY_CONTEXT_PREFIX).toBe(conservation.heavyContextPrefix);
    })
  );

  it.effect("measures every recorded shard layout's runs exactly as before", () =>
    Effect.gen(function* () {
      const conservation = yield* decodeConservation(conservationJson);
      // Per layout: one green run, then one run per shard with only that shard red, each read by the census
      // before the consolidation (`layoutCases`). A layout the map lost, widened or renamed reads differently.
      const cases = A.flatMap(conservation.effectiveLanes, (effective) =>
        A.flatMap(effective.shardLayouts, (layout, layoutIndex) =>
          A.prepend(
            A.map(layout, (red) => ({ effective, layout, layoutIndex, red: O.some(red) })),
            { effective, layout, layoutIndex, red: O.none<string>() }
          )
        )
      );
      const runs = A.map(cases, ({ effective, layout, red }, index) =>
        layoutCaseRun(index + 1, effective.aggregator, layout, red)
      );
      const report = yield* buildCiLaneTimingWindowReport(REQUIRED_CONTEXTS, runs);
      const observed = A.map(cases, ({ effective, layoutIndex, red }, index) => ({
        lane: effective.lane,
        layout: layoutIndex,
        red: O.getOrNull(red),
        rows: laneRowsOf(report, index + 1, effective.lane),
      }));
      expect(A.length(cases)).toBe(130);
      expect(observed).toEqual(conservation.layoutCases);
    })
  );

  it.effect("still reads a planned run's subset of the newest layout", () =>
    Effect.gen(function* () {
      const conservation = yield* decodeConservation(conservationJson);
      // A planned run allocates only the newest layout's affected shards: here its first one.
      const planned = A.getSomes(
        A.map(conservation.effectiveLanes, (effective) =>
          O.map(O.fromNullOr(effective.plannedBy), (plannedBy) => ({
            effective,
            plannedBy,
            shard: O.getOrThrow(O.flatMap(A.last(effective.shardLayouts), A.head)),
          }))
        )
      );
      const runs = A.map(planned, ({ effective, plannedBy, shard }, index) =>
        CiWorkflowWindowRunJobs.make({
          run: windowRun(index + 1),
          jobs: [
            windowJob(index + 1, 0, plannedBy),
            windowJob(index + 1, 1, shard),
            windowJob(index + 1, 2, effective.aggregator, { completed_at: "2026-11-12T00:12:00Z" }),
          ],
        })
      );
      const report = yield* buildCiLaneTimingWindowReport(REQUIRED_CONTEXTS, runs);
      expect(A.map(planned, ({ plannedBy }) => plannedBy)).toEqual([
        CiSupportJobName.Enum["Test Plan"],
        CiSupportJobName.Enum["Test Plan"],
      ]);
      expect(A.map(planned, ({ effective }, index) => laneRowsOf(report, index + 1, effective.lane))).toEqual(
        A.map(planned, ({ effective }) => [
          { population: "duration", attribution: null, durationSeconds: 660, jobName: effective.aggregator },
        ])
      );
    })
  );

  it.effect("attributes every recorded job name to the census lane it had", () =>
    Effect.gen(function* () {
      const conservation = yield* decodeConservation(conservationJson);
      const jobs = conservation.jobs;
      const requiredLanes = HashSet.fromIterable(
        A.map(
          A.filter(jobs, (job) => A.contains(REQUIRED_CONTEXTS, job.name)),
          (job) => job.timingsLane
        )
      );
      // One run per name at attempt 1 (a shard of a sharded lane reports its pickup) and one at attempt 2 (a
      // later attempt of a required lane is attributed to that lane).
      const count = A.length(jobs);
      const runs = A.appendAll(
        A.map(jobs, (job, index) =>
          CiWorkflowWindowRunJobs.make({ run: windowRun(index + 1), jobs: [windowJob(index + 1, 0, job.name)] })
        ),
        A.map(jobs, (job, index) =>
          CiWorkflowWindowRunJobs.make({
            run: windowRun(count + index + 1),
            jobs: [windowJob(count + index + 1, 0, job.name, { run_attempt: 2 })],
          })
        )
      );
      const report = yield* buildCiLaneTimingWindowReport(REQUIRED_CONTEXTS, runs);
      const lanesOf = (runId: number, keep: (row: WindowRow) => boolean) =>
        A.map(A.filter(rowsOfRun(report, runId), keep), (row) => [row.jobName, row.lane]);
      const observed = A.map(jobs, (job, index) => ({
        name: job.name,
        pickup: lanesOf(index + 1, (row) => row.population === "pickup"),
        later: lanesOf(
          count + index + 1,
          (row) => row.population === "attribution" && row.attribution === "later-attempt"
        ),
      }));
      const expected = A.map(jobs, (job) => ({
        name: job.name,
        pickup: job.timingsComponent === "shard" ? [[job.name, job.timingsLane]] : [],
        later: HashSet.has(requiredLanes, job.timingsLane) ? [[job.name, job.timingsLane]] : [],
      }));
      expect(HashSet.size(requiredLanes)).toBe(15);
      expect(observed).toEqual(expected);
    })
  );
});
