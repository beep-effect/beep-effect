import { ArtifactLocator, SourceArtifact } from "@beep/file-processing/Artifact";
import { ExportArchiveOperation } from "@beep/file-processing/Operation";
import { decodeTestOperationIdentifiers } from "@beep/file-processing/test";
import {
  encodePffexportMessageRecordJson,
  makePffexportFileProcessingEngine,
  PFFEXPORT_MESSAGES_SUFFIX,
  PffexportEngineConfig,
  PffexportMessageRecord,
} from "@beep/libpff";
import { NonNegativeInt } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { NodeChildProcessSpawner, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Config, Effect, FileSystem, Layer, Option as O, Path } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";

const BEEP_TEST_LIBPFF_PST_ENV = "BEEP_TEST_LIBPFF_PST";

// Snapshot the opt-in lane key once, treating absent and blank values as "not
// configured" so the whole suite no-ops instead of exporting a phantom PST.
// Operators can point this at any real PST — the documented public sample is
// Apache Tika's testPST.pst, pinned by commit URL and sha256 in the package
// README; no PST binary is committed to this public repository.
const livePstPath = Config.string(BEEP_TEST_LIBPFF_PST_ENV).pipe(Config.option, Effect.map(O.filter(Str.isNonEmpty)));

const provideLive = provideScopedLayer(NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(NodeServices.layer)));

const skipNotice = Effect.logInfo(
  `Skipping the live pffexport lane because ${BEEP_TEST_LIBPFF_PST_ENV} is not configured.`
);

const decodeMessageRecord = S.decodeUnknownEffect(S.fromJsonString(PffexportMessageRecord));
const PffexportMessageRecordArbitrary = S.toArbitrary(PffexportMessageRecord);

const liveOperation = Effect.fn("LibpffLive.operation")(function* (pstPath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const stat = yield* fs.stat(pstPath);
  const exportRoot = yield* fs.makeTempDirectoryScoped({ prefix: "libpff-pffexport-live-" });

  const { artifactId, digest, operationId } = yield* decodeTestOperationIdentifiers();
  const locatorValue = yield* S.decodeUnknownEffect(PosixPath)(pstPath);
  const relativePath = yield* S.decodeUnknownEffect(PosixPath)(path.basename(pstPath));

  const operation = ExportArchiveOperation.make({
    format: "pst",
    operationId,
    operationKind: "export-archive",
    preference: { engine: "libpff" },
    source: SourceArtifact.make({
      digest,
      extension: "pst",
      id: artifactId,
      locator: ArtifactLocator.make({ kind: "file", value: locatorValue }),
      name: path.basename(pstPath),
      relativePath,
      sizeBytes: NonNegativeInt.make(Number(stat.size)),
    }),
  });

  return { exportRoot, operation };
});

describe("@beep/libpff live pffexport", () => {
  // Deterministic even without the opt-in PST: proves the JSONL codec the
  // live assertions below decode through.
  it("round-trips schema-derived message records through the JSONL string codec", () =>
    fc.assert(
      fc.property(PffexportMessageRecordArbitrary, (record) => {
        const json = Effect.runSync(encodePffexportMessageRecordJson(record));
        const decoded = Effect.runSync(decodeMessageRecord(json));
        expect(Effect.runSync(encodePffexportMessageRecordJson(decoded))).toBe(json);
      }),
      fcRuns(25)
    ));

  it.live(
    "reports a runtime pffexport version and exports a real PST",
    Effect.fnUntraced(
      function* () {
        const pstPath = yield* livePstPath;
        if (O.isNone(pstPath)) {
          return yield* skipNotice;
        }

        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { exportRoot, operation } = yield* liveOperation(pstPath.value);
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({ existingExportPolicy: "replace", exportRoot })
        );

        expect(engine.descriptor.version).toBeDefined();

        const result = yield* engine.exportArchive(operation);

        expect(result.engine).toBe("libpff");
        expect(result.children.length).toBeGreaterThan(0);
        expect(result.children.every((child) => child.id.startsWith("artifact:"))).toBe(true);

        const jsonlName = `${operation.source.id}${PFFEXPORT_MESSAGES_SUFFIX}`;
        const hasItems = result.children.some((child) => child.relativePath === jsonlName);
        if (hasItems) {
          const emlChildren = result.children.filter((child) => child.relativePath.endsWith("/Message.eml"));
          expect(emlChildren.length).toBeGreaterThan(0);
          const jsonl = yield* fs.readFileString(path.join(exportRoot, jsonlName));
          const record = yield* decodeMessageRecord(jsonl.trimEnd().split("\n")[0]);
          expect(record.messagePath.length).toBeGreaterThan(0);

          // Every assembled EML must be RFC 5322-shaped: no foldable line
          // over the 998-octet limit anywhere in the message — headers fold,
          // and a body part with a longer physical line is re-encoded as
          // base64 rather than folded — plus a real Date header wherever
          // pffexport gave us a parseable client-submit time.
          //
          // One deliberate exemption keeps this from becoming a false alarm
          // on a future fixture. A header line with no space has no fold
          // point to promote to a continuation indent, so the driver emits it
          // intact rather than mutating the value — those lines are skipped
          // here. Lines split on /\r?\n/, not "\r\n": remaining 8bit bodies
          // may legally carry bare-LF endings, and splitting only on CRLF
          // would glue their lines into false over-long positives.
          const encoder = new TextEncoder();
          const foldable = (line: string): boolean => line.includes(" ");
          let datedEmlCount = 0;
          for (const child of emlChildren) {
            const eml = yield* fs.readFileString(path.join(exportRoot, child.relativePath));
            const headerBlock = eml.slice(0, eml.indexOf("\r\n\r\n"));
            const overLong = eml.split(/\r?\n/).filter((line) => foldable(line) && encoder.encode(line).length > 998);
            expect(overLong).toStrictEqual([]);
            expect(headerBlock).not.toContain("X-Beep-Libpff-Client-Submit-Time");
            if (headerBlock.includes("\r\nDate: ") || headerBlock.startsWith("Date: ")) {
              datedEmlCount += 1;
            }
          }
          expect(datedEmlCount).toBeGreaterThan(0);
        }
      },
      Effect.scoped,
      provideLive
    )
  );

  it.live(
    "keeps a missing live source inside the operation error contract",
    Effect.fnUntraced(
      function* () {
        const pstPath = yield* livePstPath;
        if (O.isNone(pstPath)) {
          return yield* skipNotice;
        }

        const fs = yield* FileSystem.FileSystem;
        const exportRoot = yield* fs.makeTempDirectoryScoped({ prefix: "libpff-pffexport-live-missing-" });
        const { operation } = yield* liveOperation(pstPath.value);
        const engine = yield* makePffexportFileProcessingEngine(PffexportEngineConfig.make({ exportRoot }));

        const missingSource = SourceArtifact.make({
          ...operation.source,
          locator: ArtifactLocator.make({
            kind: "file",
            value: yield* S.decodeUnknownEffect(PosixPath)("/nonexistent/beep-live-missing.pst"),
          }),
        });
        const error = yield* engine
          .exportArchive(ExportArchiveOperation.make({ ...operation, source: missingSource }))
          .pipe(Effect.flip);

        expect(error._tag).toBe("FileProcessingOperationError");
        expect(error.reason).toBe("archive-export-failed");
      },
      Effect.scoped,
      provideLive
    )
  );
});
