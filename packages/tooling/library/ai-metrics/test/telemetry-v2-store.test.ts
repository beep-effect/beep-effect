import * as NodeURL from "node:url";
import {
  FlightRecord,
  FlightRecordCompositionInput,
  FlightRecordWriteEvent,
  IngestEnumeration,
  IngestManifest,
  requireAbsoluteAiMetricsDataRoot,
  TelemetryV2Store,
} from "@beep/repo-ai-metrics";
import { fcRuns } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { Context, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { TelemetryV2StoreShape } from "@beep/repo-ai-metrics";

const fixtureDir = NodeURL.fileURLToPath(new URL("./fixtures/telemetry-v2/", import.meta.url));
const fixturePath = (name: string): string => `${fixtureDir}${name}`;
const otherHash = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

const readFixture = Effect.fnUntraced(function* (name: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(fixturePath(name));
});

const readEnumeration = Effect.flatMap(readFixture("ingest-enumeration.json"), IngestEnumeration.decodeJsonEffect);
const readManifest = Effect.flatMap(readFixture("ingest-manifest.json"), IngestManifest.decodeJsonEffect);
const readFlightRecord = Effect.flatMap(readFixture("flight-record.json"), FlightRecord.decodeJsonEffect);

const withTempStore = Effect.fnUntraced(function* <A2, E, R>(
  use: (dataRoot: string, store: TelemetryV2StoreShape) => Effect.Effect<A2, E, R>
) {
  const fs = yield* FileSystem.FileSystem;
  const dataRoot = yield* fs.makeTempDirectoryScoped({ prefix: "beep-telemetry-v2-store-" });
  const absoluteDataRoot = yield* requireAbsoluteAiMetricsDataRoot(dataRoot);
  const context = yield* Layer.build(TelemetryV2Store.layer(absoluteDataRoot));
  return yield* use(dataRoot, Context.get(context, TelemetryV2Store));
});

const compositionInputFrom = (record: FlightRecord): FlightRecordCompositionInput =>
  FlightRecordCompositionInput.make({
    recordId: record.recordId,
    sessionId: record.sessionId,
    sourceKind: record.sourceKind,
    attribution: record.attribution,
    instrumentClass: record.instrumentClass,
    config: record.config,
    semantic: record.semantic,
    mechanical: record.mechanical,
    evidenceRefs: record.evidenceRefs,
  });

layer(NodeServices.layer)("telemetry-v2 store", (it) => {
  it("keeps record-wide evidence tier and OIP taint out of generated composition inputs", () => {
    fc.assert(
      fc.property(S.toArbitrary(FlightRecordCompositionInput)(fc), (input) => {
        expect("evidenceTier" in input).toBe(false);
        expect("oipTaint" in input).toBe(false);
      }),
      fcRuns(25)
    );
  });

  it.effect("commits the enumeration before source reading and the linked manifest afterward", () =>
    Effect.scoped(
      withTempStore((dataRoot, store) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const enumeration = yield* readEnumeration;
          const manifest = yield* readManifest;
          const manifestsDirectory = path.join(dataRoot, "telemetry-v2/ingest-manifests");

          const result = yield* store.runIngest(enumeration, (enumerationReceipt) =>
            Effect.gen(function* () {
              expect(yield* fs.exists(path.join(dataRoot, enumerationReceipt.relativePath))).toBe(true);
              expect(yield* fs.exists(manifestsDirectory)).toBe(false);
              return manifest;
            })
          );

          const persistedEnumeration = yield* IngestEnumeration.decodeJsonEffect(
            yield* fs.readFileString(path.join(dataRoot, result.enumerationReceipt.relativePath))
          );
          const persistedManifest = yield* IngestManifest.decodeJsonEffect(
            yield* fs.readFileString(path.join(dataRoot, result.manifestReceipt.relativePath))
          );

          expect(persistedEnumeration.enumerationId).toBe(enumeration.enumerationId);
          expect(persistedManifest.enumerationId).toBe(enumeration.enumerationId);
          expect(persistedManifest.summary.accountedCount).toBe(enumeration.enumeratedCount);
        })
      )
    )
  );

  it.effect("leaves the initial denominator durable when source reading fails", () =>
    Effect.scoped(
      withTempStore((dataRoot, store) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const enumeration = yield* readEnumeration;

          const failure = yield* store
            .runIngest(enumeration, () => Effect.fail("source-read-failed" as const))
            .pipe(Effect.flip);

          expect(failure).toBe("source-read-failed");
          expect(yield* fs.exists(path.join(dataRoot, "telemetry-v2/ingest-enumerations"))).toBe(true);
          expect(yield* fs.exists(path.join(dataRoot, "telemetry-v2/ingest-manifests"))).toBe(false);
        })
      )
    )
  );

  it.effect("refuses a final manifest whose subject set differs from the persisted denominator", () =>
    Effect.scoped(
      withTempStore((dataRoot, store) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const enumeration = yield* readEnumeration;
          const manifest = yield* readManifest;
          const encodedManifest = yield* IngestManifest.encodeEffect(manifest);
          const mismatchedManifest = yield* IngestManifest.decodeEffect({
            ...encodedManifest,
            dispositions: A.map(encodedManifest.dispositions, (disposition, index) =>
              index === 0 ? { ...disposition, subject: { ...disposition.subject, subjectId: otherHash } } : disposition
            ),
          });

          const error = yield* store.runIngest(enumeration, () => Effect.succeed(mismatchedManifest)).pipe(Effect.flip);

          expect(error._tag).toBe("TelemetryV2StoreError");
          expect(error.operation).toBe("validate-ingest-manifest");
          expect(yield* fs.exists(path.join(dataRoot, "telemetry-v2/ingest-manifests"))).toBe(false);
        })
      )
    )
  );

  it.effect("derives record-wide evidence fields and idempotently writes the accepted event", () =>
    Effect.scoped(
      withTempStore((dataRoot, store) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const sourceRecord = yield* readFlightRecord;
          const input = compositionInputFrom(sourceRecord);

          const first = yield* store.writeFlightRecord(input);
          const second = yield* store.writeFlightRecord(input);
          const persisted = yield* FlightRecordWriteEvent.decodeJsonEffect(
            yield* fs.readFileString(path.join(dataRoot, first.receipt.relativePath))
          );

          expect(second.receipt.artifactDigest).toBe(first.receipt.artifactDigest);
          expect(second.receipt.relativePath).toBe(first.receipt.relativePath);
          expect(first.record.evidenceTier).toBe(sourceRecord.evidenceTier);
          expect(first.record.oipTaint).toBe(sourceRecord.oipTaint);
          expect(persisted.status).toBe("accepted");
          if (persisted.status !== "accepted") return yield* Effect.die(new Error("expected an accepted event"));
          expect(persisted.record.recordId).toBe(sourceRecord.recordId);
          expect(yield* fs.readDirectory(path.join(dataRoot, "telemetry-v2/flight-record-events"))).toHaveLength(1);
        })
      )
    )
  );

  it.effect("durably records a content-free invalid candidate event", () =>
    Effect.scoped(
      withTempStore((dataRoot, store) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const invalidEvent = yield* S.decodeEffect(FlightRecordWriteEvent)({
            status: "invalid",
            candidateDigest: otherHash,
            violations: ["schema-invalid"],
            evidenceTier: "unknown",
            oipTaint: "unknown",
          });

          const receipt = yield* store.appendFlightRecordEvent(invalidEvent);
          const persistedText = yield* fs.readFileString(path.join(dataRoot, receipt.relativePath));
          const persisted = yield* FlightRecordWriteEvent.decodeJsonEffect(persistedText);

          expect(persisted.status).toBe("invalid");
          expect(persistedText).not.toMatch(/"(?:prompt|command|toolArgument|toolResult|path)"/iu);
        })
      )
    )
  );
});
