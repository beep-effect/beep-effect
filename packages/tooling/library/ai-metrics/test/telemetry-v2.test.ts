import * as NodeURL from "node:url";
import {
  EvidenceTier,
  FlightRecord,
  HookPulseEvidenceTier,
  HookPulseInstrumentClass,
  HookPulseWaitReason,
  IngestEnumeration,
  IngestManifest,
  InstrumentClass,
  WaitReason,
  weakestEvidenceTier,
} from "@beep/repo-ai-metrics";
import { fcRuns } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { Effect, FileSystem, Result } from "effect";
import * as A from "effect/Array";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const fixtureDir = NodeURL.fileURLToPath(new URL("./fixtures/telemetry-v2/", import.meta.url));
const fixturePath = (name: string): string => `${fixtureDir}${name}`;

const readFixture = Effect.fnUntraced(function* (name: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(fixturePath(name));
});

const flightRecordEquivalent = S.toEquivalence(FlightRecord);
const ingestEnumerationEquivalent = S.toEquivalence(IngestEnumeration);
const ingestManifestEquivalent = S.toEquivalence(IngestManifest);
const hashA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const hashB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const hashC = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const hashD = "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

const subject = {
  subjectId: hashA,
  rootId: hashB,
  sourceKind: "codex",
  subjectKind: "source-instance",
  evidenceTier: "derived",
  oipTaint: "unknown",
};

const manifestWith = (disposition: object, summary: object) => ({
  schemaVersion: "telemetry-v2/ingest-manifest/v1",
  enumerationId: hashA,
  ingestRunId: hashB,
  attestedAt: "2026-09-03T12:00:00.000Z",
  configFingerprint: hashC,
  configEvidenceTier: "derived",
  enumeratedCount: 1,
  dispositions: [disposition],
  summary,
  evidenceTier: "derived",
  oipTaint: "unknown",
});

const singleSummary = (status: "read" | "tombstoned" | "unreachable" | "skipped" | "unemittable") => ({
  enumeratedCount: 1,
  accountedCount: 1,
  readCount: status === "read" ? 1 : 0,
  tombstonedCount: status === "tombstoned" ? 1 : 0,
  unreachableCount: status === "unreachable" ? 1 : 0,
  skippedCount: status === "skipped" ? 1 : 0,
  unemittableCount: status === "unemittable" ? 1 : 0,
});

layer(NodeServices.layer)("telemetry-v2 contracts", (it) => {
  it.effect("round-trips the hand-written real-session flight record", () =>
    Effect.gen(function* () {
      const raw = yield* readFixture("flight-record.json");
      const decoded = yield* FlightRecord.decodeJsonEffect(raw);
      const encoded = yield* FlightRecord.encodeJsonEffect(decoded);
      const roundTripped = yield* FlightRecord.decodeJsonEffect(encoded);

      expect(flightRecordEquivalent(decoded, roundTripped)).toBe(true);
      expect(decoded.mechanical.observedEventCount).toBe(37);
      expect(decoded.mechanical.turnCount).toBe(1);
      expect(decoded.mechanical.toolCallCount).toBe(17);
      expect(decoded.mechanical.toolFailureCount).toBe(0);
      expect(decoded.evidenceTier).toBe(EvidenceTier.Enum.unknown);
    })
  );

  it.effect("round-trips the real workstation enumeration and final dry-run manifest", () =>
    Effect.gen(function* () {
      const enumerationRaw = yield* readFixture("ingest-enumeration.json");
      const manifestRaw = yield* readFixture("ingest-manifest.json");
      const enumeration = yield* IngestEnumeration.decodeJsonEffect(enumerationRaw);
      const manifest = yield* IngestManifest.decodeJsonEffect(manifestRaw);
      const encodedEnumeration = yield* IngestEnumeration.encodeJsonEffect(enumeration);
      const encodedManifest = yield* IngestManifest.encodeJsonEffect(manifest);
      const roundTrippedEnumeration = yield* IngestEnumeration.decodeJsonEffect(encodedEnumeration);
      const roundTrippedManifest = yield* IngestManifest.decodeJsonEffect(encodedManifest);

      expect(ingestEnumerationEquivalent(enumeration, roundTrippedEnumeration)).toBe(true);
      expect(ingestManifestEquivalent(manifest, roundTrippedManifest)).toBe(true);
      expect(enumeration.enumeratedCount).toBe(6);
      expect(manifest.summary.accountedCount).toBe(6);
      expect(manifest.summary.skippedCount).toBe(6);
      expect(manifest.enumerationId).toBe(enumeration.enumerationId);
      expect(manifest.ingestRunId).toBe(enumeration.ingestRunId);
      expect(manifest.configFingerprint).toBe(enumeration.configFingerprint);

      const enumeratedIds = A.sort(
        A.map(enumeration.subjects, (entry) => entry.subjectId),
        Order.String
      );
      const dispositionIds = A.sort(
        A.map(manifest.dispositions, (entry) => entry.subject.subjectId),
        Order.String
      );
      expect(dispositionIds).toEqual(enumeratedIds);
    })
  );

  it.effect("keeps prompt, command, tool payload, and absolute path fields unrepresentable in fixtures", () =>
    Effect.gen(function* () {
      const fixtureTexts = yield* Effect.forEach(
        ["flight-record.json", "ingest-enumeration.json", "ingest-manifest.json"],
        readFixture
      );
      const combined = A.join(fixtureTexts, "\n");

      expect(combined).not.toMatch(/"(?:prompt|command|toolArgument|toolResult|toolInput|toolOutput|path)"/iu);
      expect(combined).not.toMatch(/\/(?:home|Users|tmp)\//u);
    })
  );

  it("requires a bounded reason for every skipped subject", () => {
    const invalid = manifestWith(
      {
        status: "skipped",
        subject,
        evidenceTier: "derived",
      },
      singleSummary("skipped")
    );

    expect(Result.isFailure(IngestManifest.decodeResult(invalid))).toBe(true);
  });

  it("strips skip-only fields from a read disposition", () => {
    const decoded = Result.getOrThrow(
      IngestManifest.decodeResult(
        manifestWith(
          {
            status: "read",
            subject,
            recordCount: 1,
            evidenceDigest: hashD,
            evidenceTier: "derived",
            reason: "dry-run",
          },
          singleSummary("read")
        )
      )
    );
    const encoded = Result.getOrThrow(IngestManifest.encodeResult(decoded));
    const firstDisposition = A.headNonEmpty(encoded.dispositions);

    expect("reason" in firstDisposition).toBe(false);
  });

  it("retains an unemittable source in the accounted denominator", () => {
    const decoded = Result.getOrThrow(
      IngestManifest.decodeResult(
        manifestWith(
          {
            status: "unemittable",
            subject,
            reason: "unsupported-brand",
            evidenceTier: "derived",
          },
          singleSummary("unemittable")
        )
      )
    );

    expect(decoded.enumeratedCount).toBe(1);
    expect(decoded.summary.accountedCount).toBe(1);
    expect(decoded.summary.unemittableCount).toBe(1);
  });

  it("rejects duplicate subjects and summary partitions that omit the denominator", () => {
    const duplicate = {
      ...manifestWith(
        {
          status: "skipped",
          subject,
          reason: "dry-run",
          evidenceTier: "derived",
        },
        {
          ...singleSummary("skipped"),
          enumeratedCount: 2,
          accountedCount: 2,
          skippedCount: 2,
        }
      ),
      enumeratedCount: 2,
      dispositions: [
        { status: "skipped", subject, reason: "dry-run", evidenceTier: "derived" },
        { status: "skipped", subject, reason: "dry-run", evidenceTier: "derived" },
      ],
    };
    const omitted = {
      ...manifestWith(
        {
          status: "skipped",
          subject,
          reason: "dry-run",
          evidenceTier: "derived",
        },
        singleSummary("skipped")
      ),
      enumeratedCount: 2,
    };

    expect(Result.isFailure(IngestManifest.decodeResult(duplicate))).toBe(true);
    expect(Result.isFailure(IngestManifest.decodeResult(omitted))).toBe(true);
  });

  it("propagates the weakest evidence tier, including reconstruction", () => {
    expect(weakestEvidenceTier(["observed", "derived"])).toBe(EvidenceTier.Enum.derived);
    expect(weakestEvidenceTier(["observed", "reconstructed", "derived"])).toBe(EvidenceTier.Enum.reconstructed);
    expect(weakestEvidenceTier(["heuristic", "unknown", "reconstructed"])).toBe(EvidenceTier.Enum.unknown);
  });

  it("keeps weakest-link propagation stable for schema-derived tier collections", () => {
    fc.assert(
      fc.property(S.toArbitrary(S.Array(EvidenceTier))(fc), (tiers) => {
        expect(weakestEvidenceTier(tiers)).toBe(weakestEvidenceTier(A.reverse(tiers)));
        expect(weakestEvidenceTier(A.append(tiers, EvidenceTier.Enum.unknown))).toBe(EvidenceTier.Enum.unknown);
      }),
      fcRuns(50)
    );
  });

  it("preserves hook-pulse/v1 literal compatibility without accepting P2-only cases", () => {
    expect(HookPulseInstrumentClass.Options).toEqual(InstrumentClass.Options);
    expect(HookPulseEvidenceTier.Options).toEqual(["observed", "derived", "heuristic", "unknown"]);
    expect(HookPulseWaitReason.Options).toEqual([
      WaitReason.Enum["plan-approval"],
      WaitReason.Enum["tool-permission"],
      WaitReason.Enum["idle-input"],
      WaitReason.Enum.none,
      WaitReason.Enum.unknown,
    ]);
    expect(S.is(HookPulseEvidenceTier)(EvidenceTier.Enum.reconstructed)).toBe(false);
    expect(S.is(HookPulseWaitReason)(WaitReason.Enum.scheduler)).toBe(false);
  });
});
