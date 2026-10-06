import { Sha256Hex } from "@beep/schema/Sha256";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome } from "@effect/vitest/utils";
import { DateTime, Effect, FileSystem, Layer } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Hex from "effect/encoding/Hex";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { changeEventLedgerSha256, changeEventTable } from "@/kpi/ChangeEvents";
import { CiOpsKpi, CiOpsKpiLive } from "@/kpi/CiOpsKpi";
import {
  adoptionProbes,
  classifyAttempt,
  foldKpiReading,
  KpiFoldInput,
  kpiWindows,
  nearestRank,
  starvationBoundMs,
  streaksOf,
} from "@/kpi/Fold";
import { adoptionTableSha256, kpiOutputPaths, kpiReadingInput, kpiSourcePins } from "@/kpi/Pins";
import { renderAdoptionTable, renderReadingJson, renderReadingMarkdown } from "@/kpi/Render";
import {
  AdoptionProbe,
  AdoptionTable,
  KpiAdmissionJoinMismatchError,
  KpiDigestMismatchError,
  KpiReadingInput,
  KpiTier,
  PinnedKpiInput,
} from "@/kpi/Schemas";
import { KpiArtifactError, syncKpiArtifacts } from "@/kpi/Script";
import {
  AdmissionEventTag,
  AttemptOutcome,
  decodeAttemptJournal,
  FleetAttempt,
  FleetJournal,
  KpiAdmissionRow,
  mergeAdmissionSources,
  ProofScope,
  ProofStage,
  readFleetManifestFacts,
} from "@/kpi/Sources";
import type { KpiReading, PercentileRow } from "@/kpi/Schemas";
import type { AttemptJournalPin, FleetManifestFacts } from "@/kpi/Sources";

const repoRoot = "../../..";
const PlatformLive = Layer.mergeAll(BunFileSystem.layer, BunCrypto.layer);
const KpiLive = Layer.provideMerge(CiOpsKpiLive, PlatformLive);

const ledgerPin = O.getOrThrow(A.findFirst(kpiSourcePins, (pin) => pin.role === "change-event-ledger"));
const manifestPin = O.getOrThrow(A.findFirst(kpiSourcePins, (pin) => pin.role === "fleet-manifest"));

const readText = (path: string) => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.readFileString(path));

const sha256Of = Effect.fn("KpiTest.sha256Of")(function* (bytes: Uint8Array) {
  const crypto = yield* Crypto.Crypto;
  return Sha256Hex.make(Hex.encode(yield* crypto.digest("SHA-256", bytes)));
});

// ---- synthetic fold fixtures (every instant inside W and W-b) ----

const at = (iso: string) => DateTime.makeUnsafe(iso);
const ms = (iso: string) => DateTime.toEpochMillis(at(iso));

type AttemptSpec = {
  readonly id: string;
  readonly branch: string;
  readonly start: string;
  readonly finish?: string;
  readonly outcome: AttemptOutcome;
  readonly stage?: ProofStage;
  readonly scope?: ProofScope;
  readonly mode?: string;
};

const attempt = (spec: AttemptSpec): FleetAttempt =>
  FleetAttempt.make({
    checkout: "fixture",
    runId: `run-${spec.branch}`,
    attemptId: spec.id,
    branch: spec.branch,
    mode: spec.mode ?? "publish",
    startedAt: at(spec.start),
    stage: O.some(spec.stage ?? "pre-push"),
    proofScope: O.some(spec.scope ?? "full"),
    resolvedHeadSha: O.none(),
    outcome: spec.outcome,
    finishedAt: O.map(O.fromUndefinedOr(spec.finish), at),
  });

const journal = (
  branch: string,
  attempts: ReadonlyArray<FleetAttempt>,
  facts: { readonly atWriterCap?: boolean; readonly cutoff?: string } = {}
): FleetJournal =>
  FleetJournal.make({
    checkout: "fixture",
    runId: `run-${branch}`,
    atWriterCap: facts.atWriterCap ?? false,
    compactionCutoff: O.map(O.fromUndefinedOr(facts.cutoff), at),
    attempts,
  });

const emptyTable = AdoptionTable.make({
  schemaVersion: "ciops-kpi-adoption-table/v1",
  generator: "apps/labs/ciops/scripts/generate-adoption-table.ts",
  probe: "fixture",
  generation: "fixture",
  windowStart: kpiWindows[0].start,
  windowEnd: kpiWindows[0].end,
  pins: kpiSourcePins,
  rows: [],
});

const enqueue = (
  nonce: string,
  attemptId: string,
  enqueuedAt: string,
  admittedAt?: string
): ReadonlyArray<KpiAdmissionRow> => [
  KpiAdmissionRow.make({
    _tag: "admission-enqueued",
    nonce,
    attemptId: O.some(attemptId),
    branch: O.none(),
    checkoutRoot: O.none(),
    enqueuedAtMillis: O.some(ms(enqueuedAt)),
    admittedAtMillis: O.none(),
    withdrawnAtMillis: O.none(),
    evictedAtMillis: O.none(),
  }),
  ...O.match(O.fromUndefinedOr(admittedAt), {
    onNone: A.empty<KpiAdmissionRow>,
    onSome: (admitted) => [
      KpiAdmissionRow.make({
        _tag: "admission-admitted",
        nonce,
        attemptId: O.some(attemptId),
        branch: O.none(),
        checkoutRoot: O.none(),
        enqueuedAtMillis: O.some(ms(enqueuedAt)),
        admittedAtMillis: O.some(ms(admitted)),
        withdrawnAtMillis: O.none(),
        evictedAtMillis: O.none(),
      }),
    ],
  }),
];

const fold = (journals: ReadonlyArray<FleetJournal>, admissions: ReadonlyArray<KpiAdmissionRow> = []) =>
  foldKpiReading(
    KpiFoldInput.make({
      inputs: kpiSourcePins,
      captureInstant: kpiWindows[0].end,
      journals,
      admissions,
      adoption: emptyTable,
      changeEvents: changeEventTable,
    }),
    kpiOutputPaths.adoptionTable
  );

const rowOf = (reading: KpiReading, slice: "W" | "W-a" | "W-b", tier: KpiTier): PercentileRow =>
  O.getOrThrow(A.findFirst(reading.percentiles, (row) => row.slice === slice && row.tier === tier));

// A red attempt then the green that closes it: one closed full-proof episode of `minutes`.
const closedEpisode = (branch: string, minutes: number): FleetJournal =>
  journal(branch, [
    attempt({
      id: `${branch}-red`,
      branch,
      start: "2026-10-02T10:00:00.000Z",
      finish: "2026-10-02T10:01:00.000Z",
      outcome: "red",
    }),
    attempt({
      id: `${branch}-green`,
      branch,
      start: "2026-10-02T10:02:00.000Z",
      finish: DateTime.formatIso(DateTime.add(at("2026-10-02T10:00:00.000Z"), { minutes })),
      outcome: "success",
    }),
  ]);

const pinnedPairs: ReadonlyArray<readonly [O.Option<ProofStage>, O.Option<ProofScope>, KpiTier]> = [
  [O.none(), O.none(), "untiered"],
  [O.some("pre-push"), O.some("full"), "local-full-proof"],
  [O.some("pre-push"), O.some("cheap-gates"), "unassigned"],
  [O.some("repair-loop"), O.some("full"), "repair-green"],
  [O.some("repair-loop"), O.some("review-fix"), "unassigned"],
  [O.some("merged-preview"), O.some("full"), "local-full-proof-merged-preview"],
];

const OptionalStage = S.Option(ProofStage);
const OptionalScope = S.Option(ProofScope);

const pairKey = (stage: O.Option<string>, scope: O.Option<string>) =>
  `${O.getOrElse(stage, () => "<absent>")}/${O.getOrElse(scope, () => "<absent>")}`;

describe("@beep/ciops KPI reading", () => {
  it.effect("nearest-rank picks the sorted value at ceil(p*n/100)-1", () =>
    Effect.sync(() => {
      assertSome(nearestRank([40, 10, 30, 20], 50), 20);
      assertSome(nearestRank(95)([40, 10, 30, 20]), 40);
      assertNone(nearestRank([], 50));
      expect(starvationBoundMs).toBe(120_000);
    })
  );

  it.effect.prop(
    "the tier rule is total: every stage and proof-scope pair classifies, and only a stage-less start is untiered",
    [Arbitrary.schema(OptionalStage), Arbitrary.schema(OptionalScope)],
    ([stage, proofScope]) =>
      Effect.sync(() => {
        const tier = classifyAttempt(
          FleetAttempt.make({
            ...attempt({ id: "a", branch: "b", start: "2026-10-02T10:00:00.000Z", outcome: "red" }),
            stage,
            proofScope,
          })
        );
        expect(S.is(KpiTier)(tier)).toBe(true);
        const stageless = O.isNone(stage) && !O.exists(proofScope, (scope) => scope === "review-fix");
        if (stageless) {
          expect(tier).toBe("untiered");
        } else {
          expect(tier).not.toBe("untiered");
        }
      }),
    { arbitrary: fcRuns(64) }
  );

  it.effect("streaks open on red, close on green, skip unterminated attempts and never open on a bounce", () =>
    Effect.sync(() => {
      const streaks = streaksOf([
        attempt({ id: "1", branch: "b", start: "2026-10-02T10:00:00.000Z", outcome: "bounce" }),
        attempt({ id: "2", branch: "b", start: "2026-10-02T10:01:00.000Z", outcome: "red" }),
        attempt({ id: "3", branch: "b", start: "2026-10-02T10:02:00.000Z", outcome: "unterminated" }),
        attempt({ id: "4", branch: "b", start: "2026-10-02T10:03:00.000Z", outcome: "success" }),
        attempt({ id: "5", branch: "b", start: "2026-10-02T10:04:00.000Z", outcome: "red" }),
      ]);
      expect(A.map(streaks, (streak) => A.map(streak.members, (member) => member.attemptId))).toStrictEqual([
        ["2"],
        ["5"],
      ]);
      expect(A.map(streaks, (streak) => O.isSome(streak.closing))).toStrictEqual([true, false]);
      expect(A.every(AttemptOutcome.literals, S.is(AttemptOutcome))).toBe(true);
    })
  );

  it.effect("a synthetic fold reports the known nearest-rank percentiles, cut and uncut", () =>
    Effect.gen(function* () {
      const reading = yield* fold([
        closedEpisode("p1", 10),
        closedEpisode("p2", 20),
        closedEpisode("p3", 30),
        closedEpisode("p4", 40),
      ]);
      const row = rowOf(reading, "W-b", "local-full-proof");
      expect(row.cut.n).toBe(4);
      assertSome(row.cut.p50Ms, 1_200_000);
      assertSome(row.cut.p95Ms, 2_400_000);
      expect(row.uncut).toStrictEqual(row.cut);
      expect(row.attemptStartEpisodes).toBe(4);
      expect(rowOf(reading, "W-a", "local-full-proof").uncut.n).toBe(0);
    })
  );

  it.effect("a joined ticket enqueued before the first start opens the episode on the seat-request clock", () =>
    Effect.gen(function* () {
      const reading = yield* fold(
        [closedEpisode("seat", 10)],
        enqueue("n-seat", "seat-red", "2026-10-02T09:55:00.000Z", "2026-10-02T09:59:00.000Z")
      );
      const row = rowOf(reading, "W-b", "local-full-proof");
      expect(row.seatRequestEpisodes).toBe(1);
      assertSome(row.cut.p50Ms, 900_000);
    })
  );

  it.effect("must-fail: a right-censored streak leaves the cut set and is counted", () =>
    Effect.gen(function* () {
      const open = journal("open", [
        attempt({
          id: "o1",
          branch: "open",
          start: "2026-10-02T10:00:00.000Z",
          finish: "2026-10-02T10:05:00.000Z",
          outcome: "red",
        }),
      ]);
      const row = rowOf(yield* fold([open]), "W", "local-full-proof");
      expect([row.cut.n, row.uncut.n, row.rightCensored]).toStrictEqual([0, 1, 1]);
      assertSome(row.uncut.p50Ms, 300_000);
    })
  );

  it.effect("must-fail: a compaction cutoff at or after the opening left-censors the episode", () =>
    Effect.gen(function* () {
      const compacted = FleetJournal.make({
        ...closedEpisode("left", 10),
        compactionCutoff: O.some(at("2026-10-02T10:00:00.000Z")),
      });
      const row = rowOf(yield* fold([compacted]), "W", "local-full-proof");
      expect([row.cut.n, row.uncut.n, row.leftCensored]).toStrictEqual([0, 1, 1]);
    })
  );

  it.effect("must-fail: a streak opening at an at-cap journal's first retained attempt is possibly truncated", () =>
    Effect.gen(function* () {
      const atCap = FleetJournal.make({ ...closedEpisode("cap", 10), atWriterCap: true });
      const row = rowOf(yield* fold([atCap]), "W", "local-full-proof");
      expect([row.cut.n, row.uncut.n, row.possiblyTruncated]).toStrictEqual([0, 1, 1]);
    })
  );

  it.effect("must-fail: an enqueue naming an unpinned attempt is counted as survivorship, never imputed", () =>
    Effect.gen(function* () {
      const reading = yield* fold(
        [closedEpisode("kept", 10)],
        enqueue("n-lost", "retired-lane-attempt", "2026-10-02T11:00:00.000Z")
      );
      expect(reading.survivorshipUnjoinedRequests).toBe(1);
      expect(rowOf(reading, "W", "local-full-proof").uncut.n).toBe(1);
    })
  );

  it.effect("starvation counts every request at the declared and sensitivity bounds, open ones to the capture", () =>
    Effect.gen(function* () {
      const reading = yield* fold(
        [],
        A.flatten([
          enqueue("fast", "x", "2026-10-02T10:00:00.000Z", "2026-10-02T10:01:00.000Z"),
          enqueue("slow", "y", "2026-10-02T10:00:00.000Z", "2026-10-02T10:20:00.000Z"),
          enqueue("open", "z", "2026-10-05T10:00:00.000Z"),
        ])
      );
      const rows = A.filter(reading.starvation, (row) => row.slice === "W-b");
      expect(
        A.map(rows, (row) => [row.boundMs, row.normative, row.requests, row.beyondBound, row.openAtCapture])
      ).toStrictEqual([
        [120_000, true, 3, 2, 1],
        [900_000, false, 3, 2, 1],
        [3_600_000, false, 3, 1, 1],
      ]);
    })
  );

  it.effect("CQ-012 prints the queue-wait share only when every W-b episode decomposes", () =>
    Effect.gen(function* () {
      const tickets = A.flatten([
        enqueue("r", "full-red", "2026-10-02T10:00:10.000Z", "2026-10-02T10:00:40.000Z"),
        enqueue("g", "full-green", "2026-10-02T10:02:10.000Z", "2026-10-02T10:02:40.000Z"),
      ]);
      const shares = (yield* fold([closedEpisode("full", 10)], tickets)).decomposition;
      expect(shares.status).toBe("shares");
      expect(shares).toMatchObject({
        decomposedEpisodes: 1,
        windowEpisodes: 1,
        queueWaitShare: 0.1,
        grandTotalMs: 600_000,
      });
      const voided = (yield* fold([closedEpisode("full", 10), closedEpisode("bare", 10)], tickets)).decomposition;
      expect(voided).toMatchObject({ status: "void", decomposedEpisodes: 1, windowEpisodes: 2 });
    })
  );

  it.effect("a ticket naming a pinned attempt on another branch fails the join typed", () =>
    Effect.gen(function* () {
      const mismatched = KpiAdmissionRow.make({
        ...O.getOrThrow(A.head(enqueue("n-x", "p1-red", "2026-10-02T09:59:00.000Z"))),
        branch: O.some("other"),
      });
      const failure = yield* Effect.flip(fold([closedEpisode("p1", 10)], [mismatched]));
      assertInstanceOf(failure, KpiAdmissionJoinMismatchError);
      expect(failure.nonce).toBe("n-x");
    })
  );

  it.effect("the two admission sources disagreeing on a shared nonce and tag fail closed", () =>
    Effect.gen(function* () {
      const row = (enqueued: number) =>
        JSON.stringify({
          _tag: "admission-enqueued",
          nonce: "n-1",
          attemptId: "a-1",
          enqueuedAtMillis: enqueued,
          pid: enqueued,
        });
      const enqueued: AdmissionEventTag = AdmissionEventTag.Enum["admission-enqueued"];
      const agreed = yield* mergeAdmissionSources({ path: "a", text: row(1) }, { path: "b", text: `${row(1)}\n` });
      expect(A.map(agreed, (entry) => entry._tag)).toStrictEqual([enqueued]);
      const failure = yield* Effect.flip(
        mergeAdmissionSources({ path: "a", text: row(1) }, { path: "b", text: row(2) })
      );
      assertInstanceOf(failure, KpiAdmissionJoinMismatchError);
      expect([failure.nonce, failure.eventTag]).toStrictEqual(["n-1", "admission-enqueued"]);
    })
  );

  it.effect("synthetic episodes need no adoption probe without a resolved head", () =>
    Effect.gen(function* () {
      expect(yield* adoptionProbes([closedEpisode("p1", 10)], [], changeEventTable)).toStrictEqual([]);
      const probe = AdoptionProbe.make({
        changeEventId: "iv-1427-push-first-publish",
        mergeCommit: "01d8c18f314661a7957ef6420b2180ffb29804d1",
        resolvedHeadSha: "28d962ec6b8d721430ed4d84ca8ff0f7c9715b74",
      });
      expect(probe.changeEventId).toBe("iv-1427-push-first-publish");
    })
  );

  it.layer(KpiLive, { timeout: "120 seconds" })((it) => {
    it.effect("the change-event table restates all 44 ledger rows and the ledger still hashes to its digest", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const bytes = yield* fs.readFile(`${repoRoot}/${ledgerPin.path}`);
        expect(yield* sha256Of(bytes)).toBe(changeEventLedgerSha256);
        const blocks = A.drop(Str.split(new TextDecoder().decode(bytes), "\n- id: "), 1);
        expect(A.length(blocks)).toBe(44);
        expect(A.length(changeEventTable)).toBe(44);
        A.forEach(A.zip(blocks, changeEventTable), ([block, row]) => {
          expect(Str.startsWith(`${row.id}\n`)(block)).toBe(true);
          expect(block).toContain(`landedAt: "${Str.replace(".000Z", "Z")(DateTime.formatIso(row.landedAt))}"`);
          expect(block).toContain(`mergeCommit: ${row.mergeCommit}`);
        });
      })
    );

    it.effect("artifact sync checks by default, names stale paths, and rewrites only in write mode", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "ciops-kpi-sync-" });
        yield* fs.writeFileString(`${root}/reading.md`, "old\n");
        const stale = yield* Effect.flip(
          syncKpiArtifacts("check", root, "evidence:kpi:write", [["reading.md", "new\n"]])
        );
        assertInstanceOf(stale, KpiArtifactError);
        expect(stale.message).toContain(
          "reading.md differ from the recomputed bytes; run `bun run evidence:kpi:write`"
        );
        expect(yield* readText(`${root}/reading.md`)).toBe("old\n");
        yield* syncKpiArtifacts("write", root, "evidence:kpi:write", [["reading.md", "new\n"]]);
        yield* syncKpiArtifacts("check", root, "evidence:kpi:write", [["reading.md", "new\n"]]);
        const missing = yield* Effect.flip(syncKpiArtifacts("check", root, "evidence:kpi:write", [["absent.md", ""]]));
        expect(missing.message).toContain('Failed to read KPI artifact "absent.md"');
      })
    );

    it.effect("ledger-digest drift fails typed against both the pin and the constant table", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "ciops-kpi-ledger-" });
        const drifted = new TextEncoder().encode(`${yield* readText(`${repoRoot}/${ledgerPin.path}`)}# drift\n`);
        yield* fs.makeDirectory(`${root}/explorations/beep-ci-operational-ontology/research`, { recursive: true });
        yield* fs.writeFile(`${root}/${ledgerPin.path}`, drifted);
        const kpi = yield* CiOpsKpi;
        const pinned = yield* Effect.flip(kpi.read(KpiReadingInput.make({ repoRoot: root, inputs: [ledgerPin] })));
        assertInstanceOf(pinned, KpiDigestMismatchError);
        expect(pinned.expectedSha256).toBe(changeEventLedgerSha256);
        const repinned = PinnedKpiInput.make({ ...ledgerPin, sha256: yield* sha256Of(drifted) });
        const table = yield* Effect.flip(kpi.probes(KpiReadingInput.make({ repoRoot: root, inputs: [repinned] })));
        assertInstanceOf(table, KpiDigestMismatchError);
        expect([table.role, table.expectedSha256]).toStrictEqual(["change-event-ledger", changeEventLedgerSha256]);
      })
    );

    it.effect("every stage and proof-tier pair the pinned journals carry classifies by the ruled table", () =>
      Effect.gen(function* () {
        const facts: FleetManifestFacts = yield* readFleetManifestFacts(
          manifestPin.path,
          yield* readText(`${repoRoot}/${manifestPin.path}`)
        );
        const directory = Str.slice(0, Str.lastIndexOf("/")(manifestPin.path).pipe(O.getOrThrow))(manifestPin.path);
        const journals = yield* Effect.forEach(facts.journals, (pin: AttemptJournalPin) =>
          Effect.flatMap(readText(`${repoRoot}/${directory}/${pin.path}`), (text) => decodeAttemptJournal(pin, text))
        );
        const starts = A.flatMap(journals, (entry) => entry.attempts);
        const carried = A.dedupe(A.map(starts, (start) => pairKey(start.stage, start.proofScope)));
        expect(A.sort(carried, Str.Order)).toStrictEqual(
          A.sort(
            A.map(pinnedPairs, ([stage, scope]) => pairKey(stage, scope)),
            Str.Order
          )
        );
        A.forEach(pinnedPairs, ([stage, proofScope, tier]) => {
          const start = O.getOrThrow(
            A.findFirst(starts, (entry) => pairKey(entry.stage, entry.proofScope) === pairKey(stage, proofScope))
          );
          expect(classifyAttempt(start)).toBe(tier);
        });
      })
    );

    it.effect("the reading renders byte-identically twice and matches the committed JSON and Markdown", () =>
      Effect.gen(function* () {
        const kpi = yield* CiOpsKpi;
        const first = yield* kpi.read(kpiReadingInput(repoRoot));
        const second = yield* kpi.read(kpiReadingInput(repoRoot));
        const json = yield* renderReadingJson(first);
        expect(yield* renderReadingJson(second)).toBe(json);
        expect(renderReadingMarkdown(second)).toBe(renderReadingMarkdown(first));
        expect(yield* readText(`${repoRoot}/${kpiOutputPaths.readingJson}`)).toBe(json);
        expect(yield* readText(`${repoRoot}/${kpiOutputPaths.readingMarkdown}`)).toBe(renderReadingMarkdown(first));
        expect(first.starvationBoundMs).toBe(starvationBoundMs);
        expect(A.map(first.inputs, (input) => input.role)).toStrictEqual([
          "fleet-manifest",
          "fleet-admission-journal",
          "admission-snapshot",
          "change-event-ledger",
          "adoption-table",
        ]);
      })
    );

    it.effect("the committed adoption table answers exactly the probes the pinned fold emits", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const bytes = yield* fs.readFile(`${repoRoot}/${kpiOutputPaths.adoptionTable}`);
        expect(yield* sha256Of(bytes)).toBe(adoptionTableSha256);
        const table = yield* S.decodeEffect(S.fromJsonString(AdoptionTable))(new TextDecoder().decode(bytes));
        expect(yield* renderAdoptionTable(table)).toBe(new TextDecoder().decode(bytes));
        const probes = yield* (yield* CiOpsKpi).probes(kpiReadingInput(repoRoot));
        expect(
          A.map(table.rows, (row) => `${row.changeEventId} ${row.mergeCommit} ${row.resolvedHeadSha}`)
        ).toStrictEqual(
          A.map(probes, (probe) => `${probe.changeEventId} ${probe.mergeCommit} ${probe.resolvedHeadSha}`)
        );
        expect(A.every(table.rows, (row) => row.ancestry !== "head-missing")).toBe(true);
      })
    );
  });
});
