import { Sha256Hex } from "@beep/schema/Sha256";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CiOpsKpi, CiOpsKpiNotImplemented } from "@/kpi/CiOpsKpi";
import {
  AdoptionClass,
  AdoptionTableRow,
  AncestryVerdict,
  CensorClass,
  ChangeEventId,
  ChangeEventPartition,
  ChangeEventRow,
  ChangeEventSeries,
  ChangeEventTierPartition,
  Cq012Decomposition,
  EpisodeAdoption,
  EpisodeClock,
  EpisodeKey,
  GitCommitSha,
  KpiEpisode,
  KpiInputRole,
  KpiNotImplementedError,
  KpiReading,
  KpiReadingInput,
  KpiTier,
  M1ReplicaRow,
  PercentileRow,
  PercentileSet,
  PinnedKpiInput,
  StarvationRow,
  WindowBounds,
  WindowSlice,
} from "@/kpi/Schemas";
import type { CiOpsKpiError, CiOpsKpiShape } from "@/kpi/CiOpsKpi";
import type { RepoRelativePath } from "@/projection/Schemas";

// The empty-input digest: a well-formed placeholder pin for contract tests, never a real input's digest.
const placeholderSha256 = Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
const ledgerPath: RepoRelativePath = "explorations/beep-ci-operational-ontology/research/control-interventions.yaml";

const set = (n: number, p50: number, p95: number) =>
  PercentileSet.make({ n: S.Natural.make(n), p50Ms: O.some(S.Natural.make(p50)), p95Ms: O.some(S.Natural.make(p95)) });

const emptySet = PercentileSet.make({ n: S.Natural.make(0), p50Ms: O.none(), p95Ms: O.none() });

const readingInput = KpiReadingInput.make({
  repoRoot: ".",
  inputs: [PinnedKpiInput.make({ role: "change-event-ledger", path: ledgerPath, sha256: placeholderSha256 })],
});

const sharesDecomposition: Cq012Decomposition = Cq012Decomposition.cases.shares.make({
  decomposedEpisodes: S.Natural.make(2),
  windowEpisodes: S.Natural.make(2),
  queueWaitShare: UnitInterval.make(0.25),
  grandTotalMs: S.Natural.make(10_000),
});

const pushFirstId: ChangeEventId = "iv-1427-push-first-publish";
const pushFirstMerge: GitCommitSha = "01d8c18f314661a7957ef6420b2180ffb29804d1";

const episode = KpiEpisode.make({
  key: EpisodeKey.make({ checkout: "beep-effect", branch: "main" }),
  tier: "local-full-proof",
  clock: "seat-request",
  openedAt: DateTime.makeUnsafe("2026-10-06T01:00:00.000Z"),
  stoppedAt: DateTime.makeUnsafe("2026-10-06T01:30:00.000Z"),
  durationMs: S.Natural.make(1_800_000),
  censoring: [],
  adoption: [EpisodeAdoption.make({ changeEventId: pushFirstId, adoption: "pre" })],
});

// A reading that exercises every row type, so the JSON codec covers each nested schema.
const reading = KpiReading.make({
  schemaVersion: "ciops-kpi-reading/v1",
  estimator: "nearest-rank",
  inputs: readingInput.inputs,
  windows: [
    WindowBounds.make({
      slice: "W",
      start: DateTime.makeUnsafe("2026-09-03T06:29:33.572Z"),
      end: DateTime.makeUnsafe("2026-10-06T03:19:28.440Z"),
    }),
  ],
  starvationBoundMs: 120_000,
  untieredStarts: S.Natural.make(3),
  survivorshipUnjoinedRequests: S.Natural.make(2),
  percentiles: [
    PercentileRow.make({
      slice: "W",
      tier: "local-full-proof",
      cut: set(4, 1_000, 9_000),
      uncut: set(5, 1_000, 12_000),
      rightCensored: S.Natural.make(1),
      leftCensored: S.Natural.make(0),
      possiblyTruncated: S.Natural.make(1),
      seatRequestEpisodes: S.Natural.make(2),
      attemptStartEpisodes: S.Natural.make(3),
    }),
  ],
  starvation: [
    StarvationRow.make({
      slice: "W",
      boundMs: 120_000,
      normative: true,
      requests: S.Natural.make(7),
      beyondBound: S.Natural.make(1),
      openAtCapture: S.Natural.make(0),
      exceptions: "unobservable",
    }),
  ],
  m1Replica: [
    M1ReplicaRow.make({
      slice: "W-a",
      label: "M1 definition over the fleet pin, not M1",
      comparable24h: set(3, 2_000, 8_000),
      uncut: emptySet,
      rightCensoredStreaks: S.Natural.make(1),
      leftCensoredEpisodesExcluded: S.Natural.make(0),
      closedEpisodesOver24hExcluded: S.Natural.make(0),
    }),
  ],
  decomposition: sharesDecomposition,
  changeEvents: [
    ChangeEventRow.make({
      id: pushFirstId,
      landedAt: DateTime.makeUnsafe("2026-10-06T01:36:13.000Z"),
      mergeCommit: pushFirstMerge,
      tiers: ["local"],
    }),
  ],
  changeEventPartitions: [
    ChangeEventPartition.make({
      changeEventId: pushFirstId,
      label: "observational",
      inWindow: true,
      tiers: [
        ChangeEventTierPartition.make({
          tier: "unassigned",
          pre: set(3, 1_000, 4_000),
          preCensored: S.Natural.make(1),
          postAdopted: emptySet,
          postAdoptedCensored: S.Natural.make(0),
          postUnadopted: S.Natural.make(2),
          unknown: S.Natural.make(0),
        }),
      ],
    }),
  ],
});

const ReadingJson = S.fromJsonString(KpiReading);

// Every literal domain with the members the launch sitting rules; totality is checked both ways.
const domain = <L extends string>(
  kit: { readonly literals: ReadonlyArray<L> },
  is: (u: unknown) => boolean,
  members: ReadonlyArray<L>
) => ({
  literals: kit.literals,
  is,
  members,
});

const literalDomains = [
  domain<KpiTier>(KpiTier, S.is(KpiTier), [
    "repair-green",
    "local-full-proof",
    "local-full-proof-merged-preview",
    "ci-merge-green",
    "unassigned",
    "untiered",
  ]),
  domain<EpisodeClock>(EpisodeClock, S.is(EpisodeClock), ["seat-request", "attempt-start"]),
  domain<CensorClass>(CensorClass, S.is(CensorClass), [
    "right-censored",
    "left-censored",
    "possibly-truncated",
    "survivorship",
  ]),
  domain<AdoptionClass>(AdoptionClass, S.is(AdoptionClass), ["pre", "post-adopted", "post-unadopted", "unknown"]),
  domain<WindowSlice>(WindowSlice, S.is(WindowSlice), ["W", "W-a", "W-b"]),
  domain<ChangeEventSeries>(ChangeEventSeries, S.is(ChangeEventSeries), ["local", "hosted"]),
  domain<AncestryVerdict>(AncestryVerdict, S.is(AncestryVerdict), ["ancestor", "not-ancestor", "head-missing"]),
  domain<KpiInputRole>(KpiInputRole, S.is(KpiInputRole), [
    "fleet-manifest",
    "fleet-admission-journal",
    "admission-snapshot",
    "adoption-table",
    "change-event-ledger",
  ]),
];

describe("@beep/ciops KPI contract", () => {
  it.effect("literal domains are total over exactly the ruled members", () =>
    Effect.sync(() => {
      A.forEach(literalDomains, ({ literals, is, members }) => {
        expect(literals).toEqual(members);
        expect(A.every(members, is)).toBe(true);
        expect(is("not-a-member")).toBe(false);
      });
    })
  );

  it.effect("ledger ids, commit ids and episode keys refuse malformed values", () =>
    Effect.sync(() => {
      expect(S.is(ChangeEventId)("iv-870-weighted-admission")).toBe(true);
      expect(S.is(ChangeEventId)("pr-870")).toBe(false);
      expect(S.is(GitCommitSha)("01d8c18f314661a7957ef6420b2180ffb29804d1")).toBe(true);
      expect(S.is(GitCommitSha)("01D8C18F")).toBe(false);
      expect(S.is(EpisodeKey)(EpisodeKey.make({ checkout: "beep-effect", branch: "main" }))).toBe(true);
      expect(S.is(EpisodeKey)({ checkout: "", branch: "main" })).toBe(false);
    })
  );

  it.effect("an episode with its adoption class round-trips through JSON", () =>
    Effect.gen(function* () {
      const EpisodeJson = S.fromJsonString(KpiEpisode);
      const json = yield* S.encodeEffect(EpisodeJson)(episode);
      const argument = S.toEquivalence(KpiEpisode);
      const value = yield* S.decodeEffect(EpisodeJson)(json);
      expect(argument(value, episode)).toBe(true);
      expect(json).toContain('"changeEventId":"iv-1427-push-first-publish"');
      expect(json).toContain('"adoption":"pre"');
    })
  );

  it.effect("the reading document round-trips through its JSON codec", () =>
    Effect.gen(function* () {
      const json = yield* S.encodeEffect(ReadingJson)(reading);
      const decoded = yield* S.decodeEffect(ReadingJson)(json);
      expect(S.toEquivalence(KpiReading)(decoded, reading)).toBe(true);
      expect(json).toContain('"schemaVersion":"ciops-kpi-reading/v1"');
      expect(json).toContain('"start":"2026-09-03T06:29:33.572Z"');
    })
  );

  it.effect("the reading refuses another schema id and an empty input list", () =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(KpiReading)(reading);
      const wrongVersion = yield* Effect.flip(
        S.decodeUnknownEffect(KpiReading)({ ...encoded, schemaVersion: "ciops-kpi-reading/v2" })
      );
      assertInstanceOf(wrongVersion, S.SchemaError);
      const noInputs = yield* Effect.flip(S.decodeUnknownEffect(KpiReading)({ ...encoded, inputs: [] }));
      assertInstanceOf(noInputs, S.SchemaError);
    })
  );

  it.effect.prop(
    "episodes and change-event rows round-trip through their codecs",
    [Arbitrary.schema(KpiEpisode), Arbitrary.schema(ChangeEventRow)],
    ([episode, row]) =>
      Effect.gen(function* () {
        const episodeEncoded = yield* S.encodeEffect(KpiEpisode)(episode);
        const argument1 = S.toEquivalence(KpiEpisode);
        const value1 = yield* S.decodeEffect(KpiEpisode)(episodeEncoded);
        expect(argument1(value1, episode)).toBe(true);
        const rowEncoded = yield* S.encodeEffect(ChangeEventRow)(row);
        const argument2 = S.toEquivalence(ChangeEventRow);
        const value2 = yield* S.decodeEffect(ChangeEventRow)(rowEncoded);
        expect(argument2(value2, row)).toBe(true);
      }),
    { arbitrary: fcRuns(64) }
  );

  it.effect.prop(
    "adoption, percentile, starvation and replica rows round-trip through their codecs",
    [
      Arbitrary.schema(AdoptionTableRow),
      Arbitrary.schema(PercentileRow),
      Arbitrary.schema(StarvationRow),
      Arbitrary.schema(M1ReplicaRow),
    ],
    ([adoption, percentile, starvation, replica]) =>
      Effect.gen(function* () {
        const argument3 = S.decodeEffect(AdoptionTableRow);
        const value3 = yield* S.encodeEffect(AdoptionTableRow)(adoption);
        const adoptionBack = yield* argument3(value3);
        expect(S.toEquivalence(AdoptionTableRow)(adoptionBack, adoption)).toBe(true);
        const argument4 = S.decodeEffect(PercentileRow);
        const value4 = yield* S.encodeEffect(PercentileRow)(percentile);
        const percentileBack = yield* argument4(value4);
        expect(S.toEquivalence(PercentileRow)(percentileBack, percentile)).toBe(true);
        const argument5 = S.decodeEffect(StarvationRow);
        const value5 = yield* S.encodeEffect(StarvationRow)(starvation);
        const starvationBack = yield* argument5(value5);
        expect(S.toEquivalence(StarvationRow)(starvationBack, starvation)).toBe(true);
        const argument6 = S.decodeEffect(M1ReplicaRow);
        const value6 = yield* S.encodeEffect(M1ReplicaRow)(replica);
        const replicaBack = yield* argument6(value6);
        expect(S.toEquivalence(M1ReplicaRow)(replicaBack, replica)).toBe(true);
      }),
    { arbitrary: fcRuns(64) }
  );

  it.effect.prop(
    "the CQ-012 decomposition round-trips both statuses",
    [Arbitrary.schema(Cq012Decomposition)],
    ([decomposition]) =>
      Effect.gen(function* () {
        const argument7 = S.decodeEffect(Cq012Decomposition);
        const value7 = yield* S.encodeEffect(Cq012Decomposition)(decomposition);
        const back = yield* argument7(value7);
        expect(S.toEquivalence(Cq012Decomposition)(back, decomposition)).toBe(true);
      }),
    { arbitrary: fcRuns(64) }
  );

  it.layer(CiOpsKpiNotImplemented, { timeout: "10 seconds" })((it) => {
    it.effect("the contract stub fails both operations typed with KpiNotImplementedError", () =>
      Effect.gen(function* () {
        const service: CiOpsKpiShape = yield* CiOpsKpi;
        const failure: CiOpsKpiError = yield* Effect.flip(service.read(readingInput));
        assertInstanceOf(failure, KpiNotImplementedError);
        expect(failure.operation).toBe("read");
        const probes: CiOpsKpiError = yield* Effect.flip(service.probes(readingInput));
        assertInstanceOf(probes, KpiNotImplementedError);
        expect(probes.operation).toBe("probes");
      })
    );
  });
});
