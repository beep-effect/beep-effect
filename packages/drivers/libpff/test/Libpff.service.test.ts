import {
  ArtifactId,
  ArtifactLocator,
  ContentDigest,
  OperationId,
  SourceArtifact,
} from "@beep/file-processing/Artifact";
import { ExportArchiveOperation } from "@beep/file-processing/Operation";
import {
  LibpffError,
  LibpffFileProcessingEngine,
  LibpffFileProcessingEngineOptions,
  makeLibpffFileProcessingEngine,
  PffexportEngineConfig,
  PffexportMessageRecord,
} from "@beep/libpff";
import { NonNegativeInt } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const SourceArtifactArbitrary = S.toArbitrary(SourceArtifact)(fc);
const ExportArchiveOperationArbitrary = S.toArbitrary(ExportArchiveOperation)(fc);
const PffexportEngineConfigArbitrary = S.toArbitrary(PffexportEngineConfig)(fc);
const LibpffFileProcessingEngineOptionsArbitrary = S.toArbitrary(LibpffFileProcessingEngineOptions)(fc);
const LibpffErrorArbitrary = S.toArbitrary(LibpffError)(fc);
const PffexportMessageRecordArbitrary = S.toArbitrary(PffexportMessageRecord)(fc);
const encodeSourceArtifact = S.encodeEffect(SourceArtifact);
const decodeSourceArtifact = S.decodeUnknownEffect(SourceArtifact);
const encodeExportArchiveOperation = S.encodeEffect(ExportArchiveOperation);
const decodeExportArchiveOperation = S.decodeUnknownEffect(ExportArchiveOperation);
const encodePffexportEngineConfig = S.encodeEffect(PffexportEngineConfig);
const decodePffexportEngineConfig = S.decodeUnknownEffect(PffexportEngineConfig);
const encodeLibpffFileProcessingEngineOptions = S.encodeEffect(LibpffFileProcessingEngineOptions);
const decodeLibpffFileProcessingEngineOptions = S.decodeUnknownEffect(LibpffFileProcessingEngineOptions);
const encodeLibpffError = S.encodeEffect(LibpffError);
const decodeLibpffError = S.decodeUnknownEffect(LibpffError);
const encodePffexportMessageRecord = S.encodeEffect(PffexportMessageRecord);
const decodePffexportMessageRecord = S.decodeUnknownEffect(PffexportMessageRecord);
const providePlatform = provideScopedLayer(NodeServices.layer);

const fixtureIds = Effect.all({
  artifactId: S.decodeEffect(ArtifactId)("artifact:3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7"),
  digest: S.decodeEffect(ContentDigest)("sha256:3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7"),
  operationId: S.decodeEffect(OperationId)(
    "operation:3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7"
  ),
});

type FixtureIds = {
  readonly artifactId: ArtifactId;
  readonly digest: ContentDigest;
  readonly operationId: OperationId;
};

const decodeFixturePath = S.decodeUnknownEffect(PosixPath);

const source = Effect.fn("LibpffTest.source")(function* (ids: FixtureIds) {
  const relativePath = yield* decodeFixturePath("mailbox.pst");

  return SourceArtifact.make({
    digest: ids.digest,
    extension: "pst",
    id: ids.artifactId,
    locator: ArtifactLocator.make({ kind: "synthetic", value: relativePath }),
    name: "mailbox.pst",
    relativePath,
    sizeBytes: NonNegativeInt.make(4),
  });
});

const operation = Effect.fn("LibpffTest.operation")(function* (ids: FixtureIds) {
  const mailbox = yield* source(ids);

  return ExportArchiveOperation.make({
    format: "pst",
    operationId: ids.operationId,
    operationKind: "export-archive",
    preference: { engine: "libpff" },
    source: mailbox,
  });
});

describe("@beep/libpff", () => {
  it("round-trips schema-derived archive operation data through file-processing schemas", () =>
    fc.assert(
      fc.property(SourceArtifactArbitrary, ExportArchiveOperationArbitrary, (sourceArtifact, exportOperation) => {
        const encodedSourceArtifact = Effect.runSync(encodeSourceArtifact(sourceArtifact));
        const decodedSourceArtifact = Effect.runSync(decodeSourceArtifact(encodedSourceArtifact));
        expect(Effect.runSync(encodeSourceArtifact(decodedSourceArtifact))).toEqual(encodedSourceArtifact);

        const encodedExportOperation = Effect.runSync(encodeExportArchiveOperation(exportOperation));
        const decodedExportOperation = Effect.runSync(decodeExportArchiveOperation(encodedExportOperation));
        expect(Effect.runSync(encodeExportArchiveOperation(decodedExportOperation))).toEqual(encodedExportOperation);
      }),
      fcRuns(25)
    ));

  it("round-trips libpff-owned schema-derived data through encoded shapes", () =>
    fc.assert(
      fc.property(
        PffexportEngineConfigArbitrary,
        LibpffFileProcessingEngineOptionsArbitrary,
        LibpffErrorArbitrary,
        PffexportMessageRecordArbitrary,
        (config, options, error, record) => {
          const encodedConfig = Effect.runSync(encodePffexportEngineConfig(config));
          const decodedConfig = Effect.runSync(decodePffexportEngineConfig(encodedConfig));
          expect(Effect.runSync(encodePffexportEngineConfig(decodedConfig))).toEqual(encodedConfig);

          const encodedOptions = Effect.runSync(encodeLibpffFileProcessingEngineOptions(options));
          const decodedOptions = Effect.runSync(decodeLibpffFileProcessingEngineOptions(encodedOptions));
          expect(Effect.runSync(encodeLibpffFileProcessingEngineOptions(decodedOptions))).toEqual(encodedOptions);

          const encodedError = Effect.runSync(encodeLibpffError(error));
          const decodedError = Effect.runSync(decodeLibpffError(encodedError));
          expect(Effect.runSync(encodeLibpffError(decodedError))).toEqual(encodedError);

          const encodedRecord = Effect.runSync(encodePffexportMessageRecord(record));
          const decodedRecord = Effect.runSync(decodePffexportMessageRecord(encodedRecord));
          expect(Effect.runSync(encodePffexportMessageRecord(decodedRecord))).toEqual(encodedRecord);
        }
      ),
      fcRuns(25)
    ));

  it("preserves encoded libpff shapes for schema-owned defaults and option fields", () => {
    const config = PffexportEngineConfig.make({ exportRoot: "/tmp/pst-out" });
    const errorWithoutContext = LibpffError.fromReason("timeout");
    const errorWithContext = LibpffError.fromReason("process", {
      cause: "pffexport failed",
      exitCode: NonNegativeInt.make(2),
    });

    expect(Effect.runSync(encodePffexportEngineConfig(config))).toStrictEqual({
      existingExportPolicy: "fail",
      exportFormat: "text",
      exportMode: "items",
      exportRoot: "/tmp/pst-out",
      pffexportPath: "pffexport",
      systemdRunPath: "systemd-run",
    });
    expect(Effect.runSync(encodeLibpffError(errorWithoutContext))).toStrictEqual({
      _tag: "LibpffError",
      reason: "timeout",
    });
    expect(Effect.runSync(encodeLibpffError(errorWithContext))).toStrictEqual({
      _tag: "LibpffError",
      cause: "pffexport failed",
      exitCode: 2,
      reason: "process",
    });
  });

  it.effect(
    "maps unavailable libpff runtime to an operation-level deferral",
    Effect.fnUntraced(function* () {
      const ids = yield* fixtureIds;
      const error = yield* LibpffFileProcessingEngine.exportArchive(yield* operation(ids)).pipe(Effect.flip);

      return yield* Effect.sync(() => {
        expect(error._tag).toBe("FileProcessingOperationError");
        expect(error.reason).toBe("engine-unavailable");
      });
    }, providePlatform)
  );

  it.effect(
    "can emit synthetic child artifacts for proof fixtures",
    Effect.fnUntraced(function* () {
      const ids = yield* fixtureIds;
      const result = yield* makeLibpffFileProcessingEngine({ syntheticExport: true }).exportArchive(
        yield* operation(ids)
      );

      return yield* Effect.sync(() => {
        expect(result.children).toHaveLength(1);
        expect(result.children[0]?.id).not.toBe(ids.artifactId);
        expect(result.engine).toBe("libpff");
      });
    }, providePlatform)
  );
});
