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
import { PosixPath } from "@beep/schema/PosixPath";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// `NodeServices` no longer bundles crypto; the archive engine hashes through `Digest`.
const TestServices = Layer.mergeAll(NodeServices.layer, NodeCrypto.layerDigest);

const decodePosixPath = S.decodeEffect(PosixPath);

const BEEP_TEST_LIBPFF_PST_ENV = "BEEP_TEST_LIBPFF_PST";

// Snapshot the opt-in lane key once, treating absent and blank values as "not
// configured" so the live registrations report skips instead of exporting a phantom PST.
// Operators can point this at any real PST — the documented public sample is
// Apache Tika's testPST.pst, pinned by commit URL and sha256 in the package
// README; no PST binary is committed to this public repository.
const livePstPath = Config.String(BEEP_TEST_LIBPFF_PST_ENV).pipe(Config.option, Effect.map(O.filter(Str.isNonEmpty)));
const decodeMessageRecord = S.decodeUnknownEffect(S.fromJsonString(PffexportMessageRecord));
const PffexportMessageRecordArbitrary = Arbitrary.schema(PffexportMessageRecord);

const liveOperation = Effect.fn("LibpffLive.operation")(function* (pstPath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const stat = yield* fs.stat(pstPath);
  const sourceBytes = yield* fs.readFile(pstPath);
  const exportRoot = yield* fs.makeTempDirectoryScoped({ prefix: "libpff-pffexport-live-" });

  const { artifactId, digest, operationId } = yield* decodeTestOperationIdentifiers();
  const locatorValue = yield* decodePosixPath(pstPath);
  const relativePath = yield* decodePosixPath(path.basename(pstPath));

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
      sizeBytes: S.Natural.make(Number(stat.size)),
      bytes: sourceBytes,
    }),
  });

  return { exportRoot, operation };
});

describe("@beep/libpff live pffexport", () => {
  // Deterministic even without the opt-in PST: proves the JSONL codec the
  // live assertions below decode through.
  it.effect.prop(
    "round-trips schema-derived message records through the JSONL string codec",
    [PffexportMessageRecordArbitrary],
    Effect.fnUntraced(function* ([record]) {
      const json = yield* encodePffexportMessageRecordJson(record);
      const decoded = yield* decodeMessageRecord(json);
      expect(yield* encodePffexportMessageRecordJson(decoded)).toBe(json);
    }),
    { arbitrary: fcRuns(25) }
  );

  it.layer(TestServices, { excludeTestServices: true })(
    "reports a runtime pffexport version and exports a real PST",
    (it) => {
      it.effect("reports a runtime pffexport version and exports a real PST", (context) =>
        Effect.gen(function* () {
          const pstPath = yield* livePstPath;
          if (O.isNone(pstPath)) {
            return yield* Effect.sync(() =>
              context.skip("BEEP_TEST_LIBPFF_PST is not configured; real PST integration did not run")
            );
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
          expect(A.every(result.children, (child) => pipe(child.id, Str.startsWith("artifact:")))).toBe(true);

          const jsonlName = `${operation.source.id}${PFFEXPORT_MESSAGES_SUFFIX}`;
          const hasItems = A.some(result.children, (child) => child.relativePath === jsonlName);
          if (hasItems) {
            const emlChildren = A.filter(result.children, (child) =>
              pipe(child.relativePath, Str.endsWith("/Message.eml"))
            );
            expect(emlChildren.length).toBeGreaterThan(0);
            const jsonl = yield* fs.readFileString(path.join(exportRoot, jsonlName));
            const record = yield* decodeMessageRecord(pipe(jsonl, Str.trimEnd, Str.split("\n"))[0]);
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
            const foldable = (line: string): boolean => pipe(line, Str.includes(" "));
            let datedEmlCount = 0;
            for (const child of emlChildren) {
              const eml = yield* fs.readFileString(path.join(exportRoot, child.relativePath));
              const headerBlock = pipe(
                eml,
                Str.indexOf("\r\n\r\n"),
                O.match({
                  onNone: () => pipe(eml, Str.slice(0, -1)),
                  onSome: (separator) => pipe(eml, Str.slice(0, separator)),
                })
              );
              const overLong = A.filter(
                pipe(eml, Str.split(/\r?\n/)),
                (line) => foldable(line) && encoder.encode(line).length > 998
              );
              expect(overLong).toStrictEqual([]);
              expect(headerBlock).not.toContain("X-Beep-Libpff-Client-Submit-Time");
              if (pipe(headerBlock, Str.includes("\r\nDate: ")) || pipe(headerBlock, Str.startsWith("Date: "))) {
                datedEmlCount += 1;
              }
            }
            expect(datedEmlCount).toBeGreaterThan(0);
          }
        })
      );
    }
  );

  it.layer(TestServices, { excludeTestServices: true })(
    "keeps a missing live source inside the operation error contract",
    (it) => {
      it.effect("keeps a missing live source inside the operation error contract", (context) =>
        Effect.gen(function* () {
          const pstPath = yield* livePstPath;
          if (O.isNone(pstPath)) {
            return yield* Effect.sync(() =>
              context.skip("BEEP_TEST_LIBPFF_PST is not configured; real PST integration did not run")
            );
          }

          const fs = yield* FileSystem.FileSystem;
          const exportRoot = yield* fs.makeTempDirectoryScoped({ prefix: "libpff-pffexport-live-missing-" });
          const { operation } = yield* liveOperation(pstPath.value);
          const engine = yield* makePffexportFileProcessingEngine(PffexportEngineConfig.make({ exportRoot }));

          const missingSource = SourceArtifact.make({
            ...operation.source,
            locator: ArtifactLocator.make({
              kind: "file",
              value: yield* decodePosixPath("/nonexistent/beep-live-missing.pst"),
            }),
          });
          const error = yield* engine
            .exportArchive(ExportArchiveOperation.make({ ...operation, source: missingSource }))
            .pipe(Effect.flip);

          expect(error._tag).toBe("FileProcessingOperationError");
          expect(error.reason).toBe("archive-export-failed");
        })
      );
    }
  );
});
