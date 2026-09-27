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
import { fcRuns } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";

const SourceArtifactArbitrary = Arbitrary.schema(SourceArtifact);
const ExportArchiveOperationArbitrary = Arbitrary.schema(ExportArchiveOperation);
const PffexportEngineConfigArbitrary = Arbitrary.schema(PffexportEngineConfig);
const LibpffFileProcessingEngineOptionsArbitrary = Arbitrary.schema(LibpffFileProcessingEngineOptions);
const LibpffErrorArbitrary = Arbitrary.schema(LibpffError);
const PffexportMessageRecordArbitrary = Arbitrary.schema(PffexportMessageRecord);
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
  it.effect.prop(
    "round-trips schema-derived archive operation data through file-processing schemas",
    [SourceArtifactArbitrary, ExportArchiveOperationArbitrary],
    Effect.fnUntraced(function* ([sourceArtifact, exportOperation]) {
      const encodedSourceArtifact = yield* encodeSourceArtifact(sourceArtifact);
      const decodedSourceArtifact = yield* decodeSourceArtifact(encodedSourceArtifact);
      expect(yield* encodeSourceArtifact(decodedSourceArtifact)).toEqual(encodedSourceArtifact);

      const encodedExportOperation = yield* encodeExportArchiveOperation(exportOperation);
      const decodedExportOperation = yield* decodeExportArchiveOperation(encodedExportOperation);
      expect(yield* encodeExportArchiveOperation(decodedExportOperation)).toEqual(encodedExportOperation);
    }),
    { arbitrary: fcRuns(25) }
  );

  it.effect.prop(
    "round-trips libpff-owned schema-derived data through encoded shapes",
    [
      PffexportEngineConfigArbitrary,
      LibpffFileProcessingEngineOptionsArbitrary,
      LibpffErrorArbitrary,
      PffexportMessageRecordArbitrary,
    ],
    Effect.fnUntraced(function* ([config, options, error, record]) {
      const encodedConfig = yield* encodePffexportEngineConfig(config);
      const decodedConfig = yield* decodePffexportEngineConfig(encodedConfig);
      expect(yield* encodePffexportEngineConfig(decodedConfig)).toEqual(encodedConfig);

      const encodedOptions = yield* encodeLibpffFileProcessingEngineOptions(options);
      const decodedOptions = yield* decodeLibpffFileProcessingEngineOptions(encodedOptions);
      expect(yield* encodeLibpffFileProcessingEngineOptions(decodedOptions)).toEqual(encodedOptions);

      const encodedError = yield* encodeLibpffError(error);
      const decodedError = yield* decodeLibpffError(encodedError);
      expect(yield* encodeLibpffError(decodedError)).toEqual(encodedError);

      const encodedRecord = yield* encodePffexportMessageRecord(record);
      const decodedRecord = yield* decodePffexportMessageRecord(encodedRecord);
      expect(yield* encodePffexportMessageRecord(decodedRecord)).toEqual(encodedRecord);
    }),
    { arbitrary: fcRuns(25) }
  );

  it.effect(
    "preserves encoded libpff shapes for schema-owned defaults and option fields",
    Effect.fnUntraced(function* () {
      const config = PffexportEngineConfig.make({ exportRoot: "/tmp/pst-out" });
      const errorWithoutContext = LibpffError.fromReason("timeout");
      const errorWithContext = LibpffError.fromReason("process", {
        cause: "pffexport failed",
        exitCode: NonNegativeInt.make(2),
      });

      expect(yield* encodePffexportEngineConfig(config)).toStrictEqual({
        existingExportPolicy: "fail",
        exportFormat: "text",
        exportMode: "items",
        exportRoot: "/tmp/pst-out",
        pffexportPath: "pffexport",
        systemdRunPath: "systemd-run",
      });
      expect(yield* encodeLibpffError(errorWithoutContext)).toStrictEqual({
        _tag: "LibpffError",
        reason: "timeout",
      });
      expect(yield* encodeLibpffError(errorWithContext)).toStrictEqual({
        _tag: "LibpffError",
        cause: "pffexport failed",
        exitCode: 2,
        reason: "process",
      });
    })
  );

  it.layer(NodeServices.layer)("maps unavailable libpff runtime to an operation-level deferral", (it) => {
    it.effect(
      "maps unavailable libpff runtime to an operation-level deferral",
      Effect.fnUntraced(function* () {
        const ids = yield* fixtureIds;
        const error = yield* LibpffFileProcessingEngine.exportArchive(yield* operation(ids)).pipe(Effect.flip);

        return yield* Effect.sync(() => {
          expect(error._tag).toBe("FileProcessingOperationError");
          expect(error.reason).toBe("engine-unavailable");
        });
      })
    );
  });

  it.layer(NodeServices.layer)("can emit synthetic child artifacts for proof fixtures", (it) => {
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
      })
    );
  });
});
