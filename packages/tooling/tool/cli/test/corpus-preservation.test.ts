import {
  ArchiveWriter,
  ArchiveWriterLive,
  ArchiveWriterLiveOptions,
  approveT7Preservation,
  CapacityPreflightService,
  CapacityPreflightServiceLive,
  CorpusCatalogOptions,
  CorpusCommandServiceLive,
  CorpusLedgerRecordJson,
  CorpusProvenanceRecord,
  catalogCorpus,
  corpusCommand,
  InheritedLossRow,
  makeArchiveWriterLive,
  PreservationManifestRow,
  PreservationManifestRowJson,
  PreservationManifestStore,
  PreservationManifestStoreLive,
  PreservationObjectIdentity,
  PreservationVerifier,
  PreservationVerifierLive,
  preflightT7Preservation,
  runT7Preservation,
  SourceStabilityObservation,
  StreamingHasher,
  StreamingHasherLive,
  T7ArchiveProvenanceRecord,
  T7PreservationOptions,
  verifyT7Preservation,
} from "@beep/repo-cli/commands/Corpus";
import {
  approveT7PreservationImpl,
  preflightT7PreservationImpl,
  runT7PreservationImpl,
  validateCopyTimeCapacityForTesting,
  validateRefreshedCapacityForTesting,
} from "@beep/repo-cli/commands/Corpus/internal/Preservation";
import { decodeProvenanceLinesForTesting } from "@beep/repo-cli/commands/Corpus/internal/ServicePrograms";
import { NonNegativeInt, Sha256HexFromBytes } from "@beep/schema";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { DateTime, Effect, FileSystem, Layer, Path, pipe, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Command } from "effect/unstable/cli";
import { ChildProcessSpawner } from "effect/unstable/process";

const hashBytes = S.decodeUnknownEffect(Sha256HexFromBytes);
const decodeInheritedLossRow = S.decodeUnknownEffect(S.fromJsonString(InheritedLossRow));
const encodeJson = UnknownFromJsonString.encodeUnknownSync;
const isT7ArchiveProvenanceRecord = S.is(T7ArchiveProvenanceRecord);
const runCorpusCommand = Command.runWith(corpusCommand, { version: "0.0.0" });
const utf8Encoder = new TextEncoder();

const capturedSpawnerFrom = (reply: () => readonly [exitCode: number, stdout: string, stderr: string]) =>
  ChildProcessSpawner.make(() => {
    const [exitCode, stdout, stderr] = reply();
    const stdoutStream = Stream.make(utf8Encoder.encode(stdout));
    const stderrStream = Stream.make(utf8Encoder.encode(stderr));
    return Effect.succeed(
      ChildProcessSpawner.makeHandle({
        all: Stream.concat(stdoutStream, stderrStream),
        exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
        getInputFd: () => Sink.drain,
        getOutputFd: () => Stream.empty,
        isRunning: Effect.succeed(false),
        kill: () => Effect.void,
        pid: ChildProcessSpawner.ProcessId(1),
        stderr: stderrStream,
        stdin: Sink.drain,
        stdout: stdoutStream,
        unref: Effect.succeed(Effect.void),
      })
    );
  });

const capturedSpawner = (exitCode: number, stdout: string, stderr: string) =>
  capturedSpawnerFrom(() => [exitCode, stdout, stderr]);

const syntheticBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    bytes[index] = index % 251;
  }
  return bytes;
};

const identityFor = Effect.fn("CorpusPreservationTest.identityFor")(function* (
  sourcePath: string,
  relativePath: string
) {
  const fs = yield* FileSystem.FileSystem;
  const info = yield* fs.stat(sourcePath);
  const mtimeEpoch = pipe(
    info.mtime,
    O.map((mtime) => DateTime.toEpochMillis(DateTime.makeUnsafe(mtime))),
    O.getOrElse(() => 0)
  );
  return PreservationObjectIdentity.make({
    mtimeEpoch,
    mtimeIso: "2026-08-27T00:00:00Z",
    relativePath,
    sizeBytes: NonNegativeInt.make(Number(info.size)),
    sourceClass: "salvage-tree",
  });
});

const rowFor = Effect.fn("CorpusPreservationTest.rowFor")(function* (
  object: PreservationObjectIdentity,
  destRelativePath: string,
  outcome: Parameters<typeof PreservationManifestRow.make>[0]["outcome"],
  attempt = 1
) {
  return PreservationManifestRow.make({
    archivedAt: "2026-08-27T00:00:00Z",
    attempt: NonNegativeInt.make(attempt),
    destRelativePath,
    object,
    outcome,
  });
});

const serviceLayer = (
  manifestPath: string,
  writerLayer: Layer.Layer<ArchiveWriter, never, FileSystem.FileSystem | Path.Path> = ArchiveWriterLive
) =>
  Layer.mergeAll(
    writerLayer,
    PreservationManifestStoreLive(manifestPath),
    PreservationVerifierLive(manifestPath),
    StreamingHasherLive
  ).pipe(Layer.provideMerge(NodeServices.layer));

describe("T7 corpus preservation", () => {
  it.effect("validates refreshed roots and copy-time destination capacity", () =>
    Effect.gen(function* () {
      const rootMismatch = yield* validateRefreshedCapacityForTesting("/approved", "/current", 1, 1, 1).pipe(
        Effect.flip
      );
      expect(rootMismatch._tag).toBe("PreservationPreflightUnapprovedError");

      const destinationFreeExceeded = yield* validateRefreshedCapacityForTesting(
        "/approved",
        "/approved",
        4,
        5,
        3
      ).pipe(Effect.flip);
      expect(destinationFreeExceeded._tag).toBe("PreservationCeilingExceededError");
      if (destinationFreeExceeded._tag === "PreservationCeilingExceededError") {
        expect(destinationFreeExceeded.ceilingBytes).toBe(3);
        expect(destinationFreeExceeded.measuredBytes).toBe(4);
      }
      yield* validateRefreshedCapacityForTesting("/approved", "/approved", 4, 5, 4);

      const destinationExceeded = yield* validateCopyTimeCapacityForTesting(4, 4, 5, 3).pipe(Effect.flip);
      expect(destinationExceeded._tag).toBe("PreservationCeilingExceededError");
      if (destinationExceeded._tag === "PreservationCeilingExceededError") {
        expect(destinationExceeded.ceilingBytes).toBe(3);
        expect(destinationExceeded.measuredBytes).toBe(4);
      }
      yield* validateCopyTimeCapacityForTesting(4, 1, 5, 1);
    })
  );
  it.effect("refuses missing, unapproved, and undersized capacity preflights", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const context = yield* Layer.build(CorpusCommandServiceLive.pipe(Layer.provideMerge(NodeServices.layer)));
        const fs = yield* FileSystem.FileSystem.pipe(Effect.provide(context));
        const path = yield* Path.Path.pipe(Effect.provide(context));
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "preservation-preflight-test-" });
        const corpusRoot = path.join(root, "corpus");
        const t7Root = path.join(root, "t7");
        const salvageRoot = path.join(t7Root, "oppold-salvage-2026-08-10");
        yield* fs.makeDirectory(corpusRoot, { recursive: true });
        yield* fs.makeDirectory(salvageRoot, { recursive: true });
        yield* fs.writeFile(path.join(salvageRoot, "synthetic.bin"), new Uint8Array([1, 2, 3]));
        yield* fs.writeFile(path.join(t7Root, "oppold-corpus.zip"), new Uint8Array([4]));
        const options = T7PreservationOptions.make({ corpusRoot, t7Root });

        const missing = yield* runT7Preservation(options).pipe(Effect.flip, Effect.provide(context));
        expect(missing._tag).toBe("PreservationPreflightMissingError");

        const proposed = yield* preflightT7Preservation(options).pipe(Effect.provide(context));
        expect(proposed.kind).toBe("proposed");
        const capacityContext = yield* Layer.build(
          CapacityPreflightServiceLive.pipe(Layer.provideMerge(NodeServices.layer))
        );
        const measured = yield* CapacityPreflightService.use((service) => service.measure(options)).pipe(
          Effect.provide(capacityContext)
        );
        expect(measured.objectCount).toBe(2);
        const unapproved = yield* runT7Preservation(options).pipe(Effect.flip, Effect.provide(context));
        expect(unapproved._tag).toBe("PreservationPreflightUnapprovedError");

        yield* approveT7Preservation(corpusRoot, 0, "synthetic-operator").pipe(Effect.provide(context));
        const exceeded = yield* runT7Preservation(options).pipe(Effect.flip, Effect.provide(context));
        expect(exceeded._tag).toBe("PreservationCeilingExceededError");

        yield* approveT7Preservation(corpusRoot, proposed.measurement.requiredBytes, "synthetic-operator").pipe(
          Effect.provide(context)
        );
        const otherT7Root = path.join(root, "other-t7");
        const otherSalvageRoot = path.join(otherT7Root, "oppold-salvage-2026-08-10");
        yield* fs.makeDirectory(otherSalvageRoot, { recursive: true });
        yield* fs.writeFile(path.join(otherSalvageRoot, "synthetic.bin"), new Uint8Array([1]));
        yield* fs.writeFile(path.join(otherT7Root, "oppold-corpus.zip"), new Uint8Array([2]));
        const wrongRoot = yield* runT7Preservation(
          T7PreservationOptions.make({ corpusRoot, t7Root: otherT7Root })
        ).pipe(Effect.flip, Effect.provide(context));
        expect(wrongRoot._tag).toBe("PreservationPreflightUnapprovedError");

        yield* fs.writeFile(path.join(salvageRoot, "growth.bin"), new Uint8Array([5]));
        const grewPastCeiling = yield* runT7Preservation(options).pipe(Effect.flip, Effect.provide(context));
        expect(grewPastCeiling._tag).toBe("PreservationCeilingExceededError");
      })
    )
  );

  it.effect("fails closed on unsuccessful and malformed destination capacity probes", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const baseContext = yield* Layer.build(NodeServices.layer);
        const fs = yield* FileSystem.FileSystem.pipe(Effect.provide(baseContext));
        const path = yield* Path.Path.pipe(Effect.provide(baseContext));
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "preservation-capacity-probe-test-" });
        const corpusRoot = path.join(root, "corpus");
        const t7Root = path.join(root, "t7");
        const salvageRoot = path.join(t7Root, "oppold-salvage-2026-08-10");
        yield* fs.makeDirectory(salvageRoot, { recursive: true });
        yield* fs.writeFile(path.join(salvageRoot, "synthetic.bin"), new Uint8Array([1]));
        yield* fs.writeFile(path.join(t7Root, "oppold-corpus.zip"), new Uint8Array([2]));
        const options = T7PreservationOptions.make({ corpusRoot, t7Root });
        for (const probe of [
          { expectedOperation: "capacity-stat", spawner: capturedSpawner(1, "", "synthetic failure") },
          { expectedOperation: "capacity-decode", spawner: capturedSpawner(0, "malformed", "") },
        ]) {
          const failure = yield* preflightT7PreservationImpl(options).pipe(
            Effect.flip,
            Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, probe.spawner),
            Effect.provide(baseContext)
          );
          expect(failure.operation).toBe(probe.expectedOperation);
        }
      })
    )
  );

  it.effect("runs the reconciled gate idempotently and rejects an incomplete verification denominator", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const context = yield* Layer.build(CorpusCommandServiceLive.pipe(Layer.provideMerge(NodeServices.layer)));
        const baseContext = yield* Layer.build(NodeServices.layer);
        const fs = yield* FileSystem.FileSystem.pipe(Effect.provide(context));
        const path = yield* Path.Path.pipe(Effect.provide(context));
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "preservation-run-test-" });
        const corpusRoot = path.join(root, "corpus");
        const t7Root = path.join(root, "t7");
        const salvageRoot = path.join(t7Root, "oppold-salvage-2026-08-10");
        const metaRoot = path.join(salvageRoot, "_meta");
        yield* fs.makeDirectory(corpusRoot, { recursive: true });
        yield* fs.makeDirectory(metaRoot, { recursive: true });
        yield* fs.makeDirectory(path.join(salvageRoot, "cognee-restic"), { recursive: true });
        yield* fs.writeFile(path.join(salvageRoot, "cognee-restic", "excluded.bin"), new Uint8Array([0]));
        yield* fs.writeFile(path.join(salvageRoot, "synthetic.bin"), new Uint8Array([1, 2, 3]));
        yield* fs.writeFile(path.join(t7Root, "oppold-corpus.zip"), new Uint8Array([4, 5]));
        const collectorLines = [
          encodeJson({
            dst: "H:\\oppold-salvage-2026-08-10\\synthetic.bin",
            size: 3,
            src: "synthetic-source",
            status: "copied",
          }),
          encodeJson({
            dst: "H:\\oppold-salvage-2026-08-10\\f-recyclebin-E\\missing.bin",
            size: 7,
            src: "synthetic-missing-source",
            status: "resumed",
          }),
          encodeJson({ status: "error" }),
          encodeJson({ status: "excluded-secret" }),
        ];
        const collectorManifestPath = path.join(metaRoot, "manifest.jsonl");
        const completeCollectorManifest = `${A.join(collectorLines, "\n")}\n`;
        yield* fs.writeFileString(collectorManifestPath, completeCollectorManifest);

        const archiveRoot = path.join(corpusRoot, "raw", "t7-salvage-2026-08-10");
        const stagedDestination = path.join(archiveRoot, "salvage-tree", "synthetic.bin");
        yield* fs.makeDirectory(path.dirname(stagedDestination), { recursive: true });
        yield* fs.writeFile(stagedDestination, new Uint8Array([9]));

        const options = T7PreservationOptions.make({ corpusRoot, t7Root });
        const proposed = yield* preflightT7Preservation(options).pipe(Effect.provide(context));
        yield* approveT7Preservation(
          corpusRoot,
          proposed.measurement.requiredBytes + 1_000_000,
          "synthetic-operator"
        ).pipe(Effect.provide(context));
        const first = yield* runT7Preservation(options).pipe(Effect.provide(context));
        expect(first.passed).toBe(3);
        expect(first.unapproved).toBe(0);
        expect(first.attempted).toBe(4);
        const second = yield* runT7Preservation(options).pipe(Effect.provide(context));
        expect(second.passed).toBe(3);
        expect(second.attempted).toBe(3);

        const verified = yield* verifyT7Preservation(corpusRoot).pipe(Effect.provide(context));
        expect(verified.summary.verified).toBe(3);
        yield* runCorpusCommand(["preserve", "verify", "--corpus-root", corpusRoot]).pipe(Effect.provide(baseContext));

        const provenancePath = path.join(corpusRoot, "raw", "provenance.jsonl");
        const provenanceLines = pipe(
          yield* fs.readFileString(provenancePath),
          Str.split(/\r?\n/u),
          A.filter(Str.isNonEmpty)
        );
        const provenance = yield* Effect.forEach(provenanceLines, CorpusLedgerRecordJson.decode);
        expect(A.filter(provenance, isT7ArchiveProvenanceRecord)).toHaveLength(3);

        const inheritedLossPath = path.join(archiveRoot, "inherited-loss.jsonl");
        const completeInheritedLoss = yield* fs.readFileString(inheritedLossPath);
        const inheritedLossLines = pipe(completeInheritedLoss, Str.split(/\r?\n/u), A.filter(Str.isNonEmpty));
        const inheritedLoss = yield* Effect.forEach(inheritedLossLines, (line) => decodeInheritedLossRow(line));
        expect(A.map(inheritedLoss, (row) => [row.lossClass, row.count])).toEqual([
          ["collector-error", 1],
          ["deliberate-exclusion", 1],
          ["exfat-stripped-metadata", 1],
          ["missing-recycle-r-record", 13],
          ["mutated-e-tree-destination", 1],
        ]);

        const legacyPath = path.join(corpusRoot, "raw", "legacy.bin");
        const legacyBytes = new Uint8Array([6, 7, 8]);
        yield* fs.writeFile(legacyPath, legacyBytes);
        const legacy = CorpusProvenanceRecord.make({
          destPath: legacyPath,
          mtimeEpoch: 0,
          mtimeIso: "2026-08-27T00:00:00Z",
          originPath: "/synthetic/source.bin",
          relativePath: "source.bin",
          salvagedAt: "2026-08-27T00:00:00Z",
          sha256: yield* hashBytes(legacyBytes).pipe(Effect.provide(baseContext)),
          sizeBytes: NonNegativeInt.make(legacyBytes.byteLength),
          sourceLabel: "synthetic-source",
        });
        yield* fs.writeFileString(provenancePath, `${yield* CorpusLedgerRecordJson.encode(legacy)}\n`, { flag: "a" });
        const catalog = yield* catalogCorpus(CorpusCatalogOptions.make({ corpusRoot })).pipe(Effect.provide(context));
        expect(catalog.sourceFiles).toBe(1);

        const manifestPath = path.join(archiveRoot, "preservation-manifest.jsonl");
        const completeManifest = yield* fs.readFileString(manifestPath);
        yield* fs.writeFileString(inheritedLossPath, `${A.head(inheritedLossLines).pipe(O.getOrElse(() => ""))}\n`, {
          flag: "w",
        });
        const ledgerDrift = yield* runT7Preservation(options).pipe(Effect.flip, Effect.provide(context));
        expect(ledgerDrift._tag).toBe("PreservationArchiveIoError");
        yield* fs.writeFileString(inheritedLossPath, completeInheritedLoss, { flag: "w" });

        yield* fs.remove(inheritedLossPath);
        const missingLossLedger = yield* verifyT7Preservation(corpusRoot).pipe(Effect.flip, Effect.provide(context));
        expect(missingLossLedger._tag).toBe("PreservationVerificationFailure");
        yield* fs.writeFileString(inheritedLossPath, completeInheritedLoss, { flag: "w" });

        yield* fs.writeFileString(
          collectorManifestPath,
          `${A.join(
            A.map(collectorLines, (line, index) => (index === 0 ? Str.replace('"size":3', '"size":99')(line) : line)),
            "\n"
          )}\n`,
          { flag: "w" }
        );
        const collectorSizeDrift = yield* verifyT7Preservation(corpusRoot).pipe(Effect.flip, Effect.provide(context));
        expect(collectorSizeDrift._tag).toBe("PreservationVerificationFailure");
        yield* fs.writeFileString(collectorManifestPath, completeCollectorManifest, { flag: "w" });

        yield* fs.utimes(path.join(salvageRoot, "synthetic.bin"), 1_787_850_001, 1_787_850_001);
        const sourceDrift = yield* verifyT7Preservation(corpusRoot).pipe(Effect.flip, Effect.provide(context));
        expect(sourceDrift._tag).toBe("PreservationVerificationFailure");

        const manifestLines = pipe(Str.split(/\r?\n/u)(completeManifest), A.filter(Str.isNonEmpty));
        yield* fs.writeFileString(manifestPath, `${A.join(A.take(manifestLines, 1), "\n")}\n`, { flag: "w" });
        const incomplete = yield* verifyT7Preservation(corpusRoot).pipe(Effect.flip, Effect.provide(context));
        expect(incomplete._tag).toBe("PreservationVerificationFailure");
      })
    )
  );

  it.effect("rejects absent, empty, malformed, escaping, and mismatched collector evidence", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const context = yield* Layer.build(CorpusCommandServiceLive.pipe(Layer.provideMerge(NodeServices.layer)));
        const fs = yield* FileSystem.FileSystem.pipe(Effect.provide(context));
        const path = yield* Path.Path.pipe(Effect.provide(context));
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "preservation-reconciliation-test-" });
        const cases = [
          { expectedTag: "PreservationArchiveIoError", manifest: O.none<string>(), name: "absent" },
          { expectedTag: "PreservationArchiveIoError", manifest: O.some(""), name: "empty" },
          {
            expectedTag: "PreservationArchiveIoError",
            manifest: O.some(encodeJson({ status: "error" })),
            name: "no-success",
          },
          {
            expectedTag: "PreservationArchiveIoError",
            manifest: O.some(encodeJson({ status: "copied" })),
            name: "missing-coordinates",
          },
          {
            expectedTag: "PreservationArchiveIoError",
            manifest: O.some(encodeJson({ dst: "H:\\foreign\\synthetic.bin", size: 3, status: "copied" })),
            name: "foreign",
          },
          {
            expectedTag: "PreservationArchiveIoError",
            manifest: O.some(
              encodeJson({
                dst: "H:\\oppold-salvage-2026-08-10\\..\\escape.bin",
                size: 3,
                status: "copied",
              })
            ),
            name: "escape",
          },
          {
            expectedTag: "PreservationUnapprovedRowsError",
            manifest: O.some(
              encodeJson({
                dst: "H:\\oppold-salvage-2026-08-10\\synthetic.bin",
                size: 99,
                status: "copied",
              })
            ),
            name: "size-mismatch",
          },
          {
            expectedTag: "PreservationUnapprovedRowsError",
            manifest: O.some(
              encodeJson({
                dst: "H:\\oppold-salvage-2026-08-10\\directory",
                size: 0,
                status: "resumed",
              })
            ),
            name: "non-file",
          },
        ] as const;

        for (const testCase of cases) {
          const corpusRoot = path.join(root, testCase.name, "corpus");
          const t7Root = path.join(root, testCase.name, "t7");
          const salvageRoot = path.join(t7Root, "oppold-salvage-2026-08-10");
          const metaRoot = path.join(salvageRoot, "_meta");
          yield* fs.makeDirectory(corpusRoot, { recursive: true });
          yield* fs.makeDirectory(metaRoot, { recursive: true });
          yield* fs.makeDirectory(path.join(salvageRoot, "directory"));
          yield* fs.writeFile(path.join(salvageRoot, "synthetic.bin"), new Uint8Array([1, 2, 3]));
          yield* fs.writeFile(path.join(t7Root, "oppold-corpus.zip"), new Uint8Array([4]));
          if (O.isSome(testCase.manifest)) {
            yield* fs.writeFileString(path.join(metaRoot, "manifest.jsonl"), `${testCase.manifest.value}\n`);
          }
          const options = T7PreservationOptions.make({ corpusRoot, t7Root });
          const proposed = yield* preflightT7Preservation(options).pipe(Effect.provide(context));
          yield* approveT7Preservation(
            corpusRoot,
            proposed.measurement.requiredBytes + 1_000_000,
            "synthetic-operator"
          ).pipe(Effect.provide(context));
          const failure = yield* runT7Preservation(options).pipe(Effect.flip, Effect.provide(context));
          expect(failure._tag).toBe(testCase.expectedTag);
        }
      })
    )
  );

  it.effect("refuses copy-time source growth beyond the approved aggregate ceiling", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const baseContext = yield* Layer.build(NodeServices.layer);
        const serviceContext = yield* Layer.build(
          CorpusCommandServiceLive.pipe(Layer.provideMerge(NodeServices.layer))
        );
        const fs = yield* FileSystem.FileSystem.pipe(Effect.provide(baseContext));
        const path = yield* Path.Path.pipe(Effect.provide(baseContext));
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "preservation-copy-growth-test-" });
        const corpusRoot = path.join(root, "corpus");
        const t7Root = path.join(root, "t7");
        const salvageRoot = path.join(t7Root, "oppold-salvage-2026-08-10");
        const metaRoot = path.join(salvageRoot, "_meta");
        const source = path.join(salvageRoot, "synthetic.bin");
        yield* fs.makeDirectory(corpusRoot, { recursive: true });
        yield* fs.makeDirectory(metaRoot, { recursive: true });
        yield* fs.writeFile(source, new Uint8Array([1, 2, 3]));
        yield* fs.writeFile(path.join(t7Root, "oppold-corpus.zip"), new Uint8Array([4]));
        yield* fs.writeFileString(
          path.join(metaRoot, "manifest.jsonl"),
          `${encodeJson({
            dst: "H:\\oppold-salvage-2026-08-10\\synthetic.bin",
            size: 3,
            status: "copied",
          })}\n`
        );
        const options = T7PreservationOptions.make({ corpusRoot, t7Root });
        const proposed = yield* preflightT7Preservation(options).pipe(Effect.provide(serviceContext));
        yield* approveT7Preservation(corpusRoot, proposed.measurement.requiredBytes, "synthetic-operator").pipe(
          Effect.provide(serviceContext)
        );

        let sourceStatCount = 0;
        const racingFileSystem = FileSystem.FileSystem.of({
          ...fs,
          stat: Effect.fn("CorpusPreservationTest.growBeforeCopy")(function* (target) {
            if (Str.Equivalence(target, source)) {
              sourceStatCount += 1;
              if (sourceStatCount === 4) {
                yield* fs.writeFile(source, new Uint8Array([1, 2, 3, 4]));
              }
            }
            const info = yield* fs.stat(target);
            return { ...info, mtime: O.none() };
          }),
        });
        const failure = yield* runT7PreservationImpl(options).pipe(
          Effect.flip,
          Effect.provideService(FileSystem.FileSystem, racingFileSystem),
          Effect.provide(baseContext)
        );

        expect(failure._tag).toBe("PreservationCeilingExceededError");
        if (failure._tag === "PreservationCeilingExceededError") {
          expect(failure.measuredBytes).toBe(proposed.measurement.requiredBytes + 1);
          expect(failure.ceilingBytes).toBe(proposed.measurement.requiredBytes);
        }
      })
    )
  );

  it.effect("refreshes destination free space before each copy attempt", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const baseContext = yield* Layer.build(NodeServices.layer);
        const fs = yield* FileSystem.FileSystem.pipe(Effect.provide(baseContext));
        const path = yield* Path.Path.pipe(Effect.provide(baseContext));
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "preservation-copy-capacity-refresh-test-" });
        const corpusRoot = path.join(root, "corpus");
        const t7Root = path.join(root, "t7");
        const salvageRoot = path.join(t7Root, "oppold-salvage-2026-08-10");
        const metaRoot = path.join(salvageRoot, "_meta");
        yield* fs.makeDirectory(corpusRoot, { recursive: true });
        yield* fs.makeDirectory(metaRoot, { recursive: true });
        yield* fs.writeFile(path.join(salvageRoot, "synthetic.bin"), new Uint8Array([1, 2, 3]));
        yield* fs.writeFile(path.join(t7Root, "oppold-corpus.zip"), new Uint8Array([4]));
        yield* fs.writeFileString(
          path.join(metaRoot, "manifest.jsonl"),
          `${encodeJson({
            dst: "H:\\oppold-salvage-2026-08-10\\synthetic.bin",
            size: 3,
            status: "copied",
          })}\n`
        );

        let capacityProbeCount = 0;
        const capacitySpawner = capturedSpawnerFrom(() => {
          capacityProbeCount += 1;
          const availableKiB = capacityProbeCount < 4 ? 1024 : 0;
          return [
            0,
            `Filesystem 1024-blocks Used Available Capacity Mounted on\nsynthetic 1024 0 ${availableKiB} 0% /\n`,
            "",
          ];
        });
        const provideCapacityServices = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
          effect.pipe(
            Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, capacitySpawner),
            Effect.provide(baseContext)
          );
        const options = T7PreservationOptions.make({ corpusRoot, t7Root });
        const proposed = yield* provideCapacityServices(preflightT7PreservationImpl(options));
        yield* provideCapacityServices(
          approveT7PreservationImpl(corpusRoot, proposed.measurement.requiredBytes, "synthetic-operator")
        );
        const failure = yield* provideCapacityServices(runT7PreservationImpl(options)).pipe(Effect.flip);

        expect(capacityProbeCount).toBe(4);
        expect(failure._tag).toBe("PreservationCeilingExceededError");
        if (failure._tag === "PreservationCeilingExceededError") {
          expect(failure.measuredBytes).toBe(proposed.measurement.requiredBytes);
          expect(failure.ceilingBytes).toBe(0);
        }
      })
    )
  );

  it.effect("checks later copies against only the uncopied destination bytes", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const baseContext = yield* Layer.build(NodeServices.layer);
        const fs = yield* FileSystem.FileSystem.pipe(Effect.provide(baseContext));
        const path = yield* Path.Path.pipe(Effect.provide(baseContext));
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "preservation-remaining-capacity-test-" });
        const corpusRoot = path.join(root, "corpus");
        const t7Root = path.join(root, "t7");
        const salvageRoot = path.join(t7Root, "oppold-salvage-2026-08-10");
        const metaRoot = path.join(salvageRoot, "_meta");
        yield* fs.makeDirectory(corpusRoot, { recursive: true });
        yield* fs.makeDirectory(metaRoot, { recursive: true });
        yield* fs.writeFile(path.join(salvageRoot, "synthetic.bin"), new Uint8Array(1024));
        yield* fs.writeFile(path.join(t7Root, "oppold-corpus.zip"), new Uint8Array(1024));
        yield* fs.writeFileString(
          path.join(metaRoot, "manifest.jsonl"),
          `${encodeJson({
            dst: "H:\\oppold-salvage-2026-08-10\\synthetic.bin",
            size: 1024,
            status: "copied",
          })}\n`
        );

        let capacityProbeCount = 0;
        const capacitySpawner = capturedSpawnerFrom(() => {
          capacityProbeCount += 1;
          const availableKiB = capacityProbeCount < 5 ? 3 : capacityProbeCount === 5 ? 2 : 1;
          return [
            0,
            `Filesystem 1024-blocks Used Available Capacity Mounted on\nsynthetic 2 0 ${availableKiB} 0% /\n`,
            "",
          ];
        });
        const provideCapacityServices = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
          effect.pipe(
            Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, capacitySpawner),
            Effect.provide(baseContext)
          );
        const options = T7PreservationOptions.make({ corpusRoot, t7Root });
        const proposed = yield* provideCapacityServices(preflightT7PreservationImpl(options));
        expect(proposed.measurement.requiredBytes).toBeGreaterThan(2048);
        expect(proposed.measurement.requiredBytes).toBeLessThanOrEqual(3072);
        yield* provideCapacityServices(
          approveT7PreservationImpl(corpusRoot, proposed.measurement.requiredBytes, "synthetic-operator")
        );
        const summary = yield* provideCapacityServices(runT7PreservationImpl(options));

        expect(capacityProbeCount).toBe(6);
        expect(summary.passed).toBe(3);
        expect(summary.unapproved).toBe(0);
      })
    )
  );

  it.effect("records an unreadable terminal row when a recensused source disappears before copy", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const baseContext = yield* Layer.build(NodeServices.layer);
        const serviceContext = yield* Layer.build(
          CorpusCommandServiceLive.pipe(Layer.provideMerge(NodeServices.layer))
        );
        const fs = yield* FileSystem.FileSystem.pipe(Effect.provide(baseContext));
        const path = yield* Path.Path.pipe(Effect.provide(baseContext));
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "preservation-source-race-test-" });
        const corpusRoot = path.join(root, "corpus");
        const t7Root = path.join(root, "t7");
        const salvageRoot = path.join(t7Root, "oppold-salvage-2026-08-10");
        const metaRoot = path.join(salvageRoot, "_meta");
        const source = path.join(salvageRoot, "synthetic.bin");
        yield* fs.makeDirectory(corpusRoot, { recursive: true });
        yield* fs.makeDirectory(metaRoot, { recursive: true });
        yield* fs.writeFile(source, new Uint8Array([1, 2, 3]));
        yield* fs.writeFile(path.join(t7Root, "oppold-corpus.zip"), new Uint8Array([4]));
        yield* fs.writeFileString(
          path.join(metaRoot, "manifest.jsonl"),
          `${encodeJson({
            dst: "H:\\oppold-salvage-2026-08-10\\synthetic.bin",
            size: 3,
            status: "copied",
          })}\n`
        );
        const options = T7PreservationOptions.make({ corpusRoot, t7Root });
        const proposed = yield* preflightT7Preservation(options).pipe(Effect.provide(serviceContext));
        yield* approveT7Preservation(
          corpusRoot,
          proposed.measurement.requiredBytes + 1_000_000,
          "synthetic-operator"
        ).pipe(Effect.provide(serviceContext));

        let sourceStatCount = 0;
        const racingFileSystem = FileSystem.FileSystem.of({
          ...fs,
          stat: Effect.fn("CorpusPreservationTest.removeBeforeCopy")(function* (target) {
            const info = yield* fs.stat(target);
            if (Str.Equivalence(target, source)) {
              sourceStatCount += 1;
              if (sourceStatCount === 4) {
                yield* fs.remove(source);
                return yield* fs.stat(source);
              }
            }
            return { ...info, mtime: O.none() };
          }),
        });
        const failure = yield* runT7PreservationImpl(options).pipe(
          Effect.flip,
          Effect.provideService(FileSystem.FileSystem, racingFileSystem),
          Effect.provide(baseContext)
        );
        expect(failure._tag).toBe("PreservationUnapprovedRowsError");
      })
    )
  );

  it.effect("streams, resumes, rejects corrupt prefixes, detects mutation, and recovers before PASS append", () =>
    Effect.scoped(
      // fallow-ignore-next-line complexity -- one ordered integration scenario proves writer state transitions and crash recovery against the same staged files; splitting it would discard the shared state-machine proof
      Effect.gen(function* () {
        const baseContext = yield* Layer.build(NodeServices.layer);
        const fs = yield* FileSystem.FileSystem.pipe(Effect.provide(baseContext));
        const path = yield* Path.Path.pipe(Effect.provide(baseContext));
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "preservation-writer-test-" });
        const manifestPath = path.join(root, "manifest.jsonl");
        const context = yield* Layer.build(serviceLayer(manifestPath));
        const sourceBytes = syntheticBytes(8 * 1024 * 1024);
        const expectedSha = yield* hashBytes(sourceBytes).pipe(Effect.provide(baseContext));
        const source = path.join(root, "source.bin");
        yield* fs.writeFile(source, sourceBytes);
        const identity = yield* identityFor(source, "source.bin").pipe(Effect.provide(baseContext));
        const writer = yield* ArchiveWriter.pipe(Effect.provide(context));
        const hasher = yield* StreamingHasher.pipe(Effect.provide(context));
        const streamed = yield* hasher.hashFile(source);
        expect(streamed.sha256).toBe(expectedSha);
        expect(streamed.bytes).toBe(sourceBytes.byteLength);
        const prefixHash = yield* hasher.hashFilePrefix(source, 2 * 1024 * 1024);
        const independentPrefixHash = yield* hashBytes(sourceBytes.subarray(0, prefixHash.bytes)).pipe(
          Effect.provide(baseContext)
        );
        expect(prefixHash.sha256).toBe(independentPrefixHash);

        const freshDest = path.join(root, "archive", "fresh.bin");
        const fresh = yield* writer.archiveObject(source, freshDest, identity);
        expect(fresh.kind).toBe("copied");
        expect(fresh.kind === "copied" && fresh.sha256).toBe(expectedSha);
        expect(fresh.kind === "copied" && fresh.bytesCopied).toBe(sourceBytes.byteLength);

        const complete = yield* writer.archiveObject(source, freshDest, identity);
        expect(complete.kind).toBe("already-complete");

        const streamingGrowthSource = path.join(root, "streaming-growth-source.bin");
        const streamingGrowthDest = path.join(root, "archive", "streaming-growth.bin");
        yield* fs.writeFile(streamingGrowthSource, new Uint8Array([1, 2, 3]));
        const streamingGrowthIdentity = yield* identityFor(streamingGrowthSource, "streaming-growth-source.bin").pipe(
          Effect.provide(baseContext)
        );
        let streamingGrowthInjected = false;
        const streamingGrowthFileSystem = FileSystem.FileSystem.of({
          ...fs,
          stream: (target, options) => {
            if (!Str.Equivalence(target, streamingGrowthSource) || streamingGrowthInjected) {
              return fs.stream(target, options);
            }
            streamingGrowthInjected = true;
            return Stream.unwrap(
              fs
                .writeFile(streamingGrowthSource, new Uint8Array([4]), { flag: "a" })
                .pipe(Effect.as(fs.stream(target, options)))
            );
          },
        });
        const streamingGrowthContext = yield* Layer.build(makeArchiveWriterLive()).pipe(
          Effect.provideService(FileSystem.FileSystem, streamingGrowthFileSystem),
          Effect.provide(baseContext)
        );
        const streamingGrowthWriter = yield* ArchiveWriter.pipe(Effect.provide(streamingGrowthContext));
        expect(
          (yield* streamingGrowthWriter.archiveObject(
            streamingGrowthSource,
            streamingGrowthDest,
            streamingGrowthIdentity
          )).kind
        ).toBe("changed-during-copy");
        expect(Number((yield* fs.stat(`${streamingGrowthDest}.preservation-partial`)).size)).toBe(
          streamingGrowthIdentity.sizeBytes
        );

        const settleMutationSource = path.join(root, "settle-mutation-source.bin");
        const settleMutationDest = path.join(root, "archive", "settle-mutation.bin");
        const settleMutationTimestamp = 1_787_850_002;
        yield* fs.writeFile(settleMutationSource, new Uint8Array([1, 2, 3]));
        yield* fs.writeFile(settleMutationDest, new Uint8Array([1, 2, 3]));
        yield* fs.utimes(settleMutationSource, settleMutationTimestamp, settleMutationTimestamp);
        const settleMutationIdentity = yield* identityFor(settleMutationSource, "settle-mutation-source.bin").pipe(
          Effect.provide(baseContext)
        );
        const mutateSettledSource = Effect.fn("CorpusPreservationTest.mutateSettledSource")(function* () {
          yield* fs.writeFile(settleMutationSource, new Uint8Array([4, 5, 6]));
          yield* fs.utimes(settleMutationSource, settleMutationTimestamp, settleMutationTimestamp);
        }, Effect.orDie);
        const settleMutationFileSystem = FileSystem.FileSystem.of({
          ...fs,
          stream: (target, options) => {
            const streamed = fs.stream(target, options);
            return Str.Equivalence(target, settleMutationDest)
              ? streamed.pipe(Stream.ensuring(mutateSettledSource()))
              : streamed;
          },
        });
        const settleMutationContext = yield* Layer.build(makeArchiveWriterLive()).pipe(
          Effect.provideService(FileSystem.FileSystem, settleMutationFileSystem),
          Effect.provide(baseContext)
        );
        const settleMutationWriter = yield* ArchiveWriter.pipe(Effect.provide(settleMutationContext));
        expect(
          (yield* settleMutationWriter.archiveObject(settleMutationSource, settleMutationDest, settleMutationIdentity))
            .kind
        ).toBe("resume-discarded");

        for (const race of ["unreadable", "changed"] as const) {
          const raceDest = path.join(root, "archive", `settle-${race}.bin`);
          yield* fs.writeFile(raceDest, sourceBytes);
          let sourceStatCount = 0;
          const racingFileSystem = FileSystem.FileSystem.of({
            ...fs,
            stat: Effect.fn(`CorpusPreservationTest.settle-${race}`)(function* (target) {
              const info = yield* fs.stat(target);
              if (!Str.Equivalence(target, source)) return info;
              sourceStatCount += 1;
              if (sourceStatCount !== 2) return info;
              if (race === "unreadable") return yield* fs.stat(path.join(root, "missing-settle-source.bin"));
              return { ...info, size: FileSystem.Size(info.size + 1n) };
            }),
          });
          const racingContext = yield* Layer.build(makeArchiveWriterLive()).pipe(
            Effect.provideService(FileSystem.FileSystem, racingFileSystem),
            Effect.provide(baseContext)
          );
          const racingWriter = yield* ArchiveWriter.pipe(Effect.provide(racingContext));
          expect((yield* racingWriter.archiveObject(source, raceDest, identity)).kind).toBe(
            race === "unreadable" ? "unreadable" : "changed-during-copy"
          );
        }

        const prefixDest = path.join(root, "archive", "prefix.bin");
        const prefixLength = 2 * 1024 * 1024;
        yield* fs.writeFile(prefixDest, sourceBytes.subarray(0, prefixLength));
        const resumed = yield* writer.archiveObject(source, prefixDest, identity);
        expect(resumed.kind).toBe("resume-completed");
        expect(resumed.kind === "resume-completed" && resumed.bytesReused).toBe(prefixLength);
        expect(resumed.kind === "resume-completed" && resumed.bytesCopied).toBe(sourceBytes.byteLength - prefixLength);

        const corruptDest = path.join(root, "archive", "corrupt.bin");
        const corrupt = sourceBytes.slice(0, prefixLength);
        corrupt[0] = corrupt[0] === 0 ? 1 : 0;
        yield* fs.writeFile(corruptDest, corrupt);
        const discarded = yield* writer.archiveObject(source, corruptDest, identity);
        expect(discarded.kind).toBe("resume-discarded");
        const copiedAfterDiscard = yield* writer.archiveObject(source, corruptDest, identity);
        expect(copiedAfterDiscard.kind).toBe("copied");

        const fullCorruptDest = path.join(root, "archive", "full-corrupt.bin");
        const fullCorrupt = sourceBytes.slice();
        fullCorrupt[0] = fullCorrupt[0] === 0 ? 1 : 0;
        yield* fs.writeFile(fullCorruptDest, fullCorrupt);
        expect((yield* writer.archiveObject(source, fullCorruptDest, identity)).kind).toBe("resume-discarded");

        const oversizedDest = path.join(root, "archive", "oversized.bin");
        yield* fs.writeFile(oversizedDest, new Uint8Array(sourceBytes.byteLength + 1));
        expect((yield* writer.archiveObject(source, oversizedDest, identity)).kind).toBe("resume-discarded");

        const unreadable = yield* writer.archiveObject(
          path.join(root, "missing.bin"),
          path.join(root, "missing-copy.bin"),
          identity
        );
        expect(unreadable.kind).toBe("unreadable");

        const mutationSource = path.join(root, "mutation-source.bin");
        const mutationDest = path.join(root, "archive", "mutation.bin");
        yield* fs.writeFile(mutationSource, sourceBytes);
        const mutationIdentity = yield* identityFor(mutationSource, "mutation-source.bin").pipe(
          Effect.provide(baseContext)
        );
        const mutationLayer = serviceLayer(
          path.join(root, "mutation-manifest.jsonl"),
          makeArchiveWriterLive(
            ArchiveWriterLiveOptions.make({
              afterPayloadSync: ({ sourceAbs }) =>
                fs.writeFile(sourceAbs, new Uint8Array([1]), { flag: "a" }).pipe(Effect.orDie),
            })
          )
        );
        const mutationContext = yield* Layer.build(mutationLayer);
        const mutationWriter = yield* ArchiveWriter.pipe(Effect.provide(mutationContext));
        const changed = yield* mutationWriter.archiveObject(mutationSource, mutationDest, mutationIdentity);
        expect(changed.kind).toBe("changed-during-copy");
        expect(yield* fs.exists(mutationDest)).toBe(false);
        expect(
          yield* PreservationManifestStore.use((store) => store.readAll).pipe(Effect.provide(mutationContext))
        ).toHaveLength(0);

        const removedSource = path.join(root, "removed-during-copy.bin");
        yield* fs.writeFile(removedSource, new Uint8Array([1, 2, 3]));
        const removedIdentity = yield* identityFor(removedSource, "removed-during-copy.bin").pipe(
          Effect.provide(baseContext)
        );
        const removalContext = yield* Layer.build(
          serviceLayer(
            path.join(root, "removal-manifest.jsonl"),
            makeArchiveWriterLive(
              ArchiveWriterLiveOptions.make({
                afterPayloadSync: ({ sourceAbs }) => fs.remove(sourceAbs).pipe(Effect.orDie),
              })
            )
          )
        );
        const removalWriter = yield* ArchiveWriter.pipe(Effect.provide(removalContext));
        expect(
          (yield* removalWriter.archiveObject(
            removedSource,
            path.join(root, "archive", "removed-copy.bin"),
            removedIdentity
          )).kind
        ).toBe("unreadable");

        const corruptBoundarySource = path.join(root, "corrupt-boundary.bin");
        yield* fs.writeFile(corruptBoundarySource, new Uint8Array([1, 2, 3]));
        const corruptBoundaryIdentity = yield* identityFor(corruptBoundarySource, "corrupt-boundary.bin").pipe(
          Effect.provide(baseContext)
        );
        const corruptBoundaryContext = yield* Layer.build(
          serviceLayer(
            path.join(root, "corrupt-boundary-manifest.jsonl"),
            makeArchiveWriterLive(
              ArchiveWriterLiveOptions.make({
                afterPayloadSync: ({ partialAbs }) =>
                  fs.writeFile(partialAbs, new Uint8Array([4]), { flag: "a" }).pipe(Effect.orDie),
              })
            )
          )
        );
        const corruptBoundaryWriter = yield* ArchiveWriter.pipe(Effect.provide(corruptBoundaryContext));
        const copyBoundaryFailure = yield* corruptBoundaryWriter
          .archiveObject(
            corruptBoundarySource,
            path.join(root, "archive", "corrupt-boundary-copy.bin"),
            corruptBoundaryIdentity
          )
          .pipe(Effect.flip);
        expect(copyBoundaryFailure.operation).toBe("copy-verify");

        const timestampSource = path.join(root, "timestamp-source.bin");
        const timestampDest = path.join(root, "archive", "timestamp.bin");
        yield* fs.writeFile(timestampSource, new Uint8Array([1, 2, 3]));
        yield* fs.utimes(timestampSource, 1_787_850_000.1, 1_787_850_000.1);
        const timestampIdentity = yield* identityFor(timestampSource, "timestamp-source.bin").pipe(
          Effect.provide(baseContext)
        );
        yield* fs.utimes(timestampSource, 1_787_850_000.2, 1_787_850_000.2);
        const timestampChanged = yield* writer.archiveObject(timestampSource, timestampDest, timestampIdentity);
        expect(timestampChanged.kind).toBe("changed-during-copy");
        const refreshedTimestampIdentity = yield* identityFor(timestampSource, "timestamp-source.bin").pipe(
          Effect.provide(baseContext)
        );
        expect((yield* writer.archiveObject(timestampSource, timestampDest, refreshedTimestampIdentity)).kind).toBe(
          "copied"
        );

        const coarseTimestampSource = path.join(root, "coarse-timestamp-source.bin");
        const coarseTimestampDest = path.join(root, "archive", "coarse-timestamp.bin");
        const coarseTimestamp = 1_787_850_001;
        yield* fs.writeFile(coarseTimestampSource, new Uint8Array([1, 2, 3]));
        yield* fs.utimes(coarseTimestampSource, coarseTimestamp, coarseTimestamp);
        const coarseTimestampIdentity = yield* identityFor(coarseTimestampSource, "coarse-timestamp-source.bin").pipe(
          Effect.provide(baseContext)
        );
        const coarseTimestampContext = yield* Layer.build(
          serviceLayer(
            path.join(root, "coarse-timestamp-manifest.jsonl"),
            makeArchiveWriterLive(
              ArchiveWriterLiveOptions.make({
                afterPayloadSync: Effect.fn("CorpusPreservationTest.coarseTimestampMutation")(function* ({
                  sourceAbs,
                }) {
                  yield* fs.writeFile(sourceAbs, new Uint8Array([4, 5, 6]));
                  yield* fs.utimes(sourceAbs, coarseTimestamp, coarseTimestamp);
                }, Effect.orDie),
              })
            )
          )
        );
        const coarseTimestampWriter = yield* ArchiveWriter.pipe(Effect.provide(coarseTimestampContext));
        const coarseTimestampFailure = yield* coarseTimestampWriter
          .archiveObject(coarseTimestampSource, coarseTimestampDest, coarseTimestampIdentity)
          .pipe(Effect.flip);
        expect(coarseTimestampFailure.operation).toBe("copy-verify");
        expect(yield* fs.exists(coarseTimestampDest)).toBe(false);

        const crashDest = path.join(root, "archive", "crash.bin");
        const landed = yield* writer.archiveObject(source, crashDest, identity);
        expect(landed.kind).toBe("copied");
        const store = yield* PreservationManifestStore.pipe(Effect.provide(context));
        expect(yield* store.readAll).toHaveLength(0);
        const recovered = yield* writer.archiveObject(source, crashDest, identity);
        expect(recovered.kind).toBe("already-complete");
        yield* store.append(yield* rowFor(identity, "crash.bin", recovered));
        expect(yield* store.readAll).toHaveLength(1);
        const recoveryReport = yield* PreservationVerifier.use((verifier) =>
          verifier.verify(path.join(root, "archive"))
        ).pipe(Effect.provide(context));
        expect(recoveryReport.summary.verified).toBe(1);
      })
    )
  );

  it.effect("reports tampered, truncated, and removed terminal destinations", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const baseContext = yield* Layer.build(NodeServices.layer);
        const fs = yield* FileSystem.FileSystem.pipe(Effect.provide(baseContext));
        const path = yield* Path.Path.pipe(Effect.provide(baseContext));
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "preservation-verifier-test-" });
        const archiveRoot = path.join(root, "archive");
        const manifestPath = path.join(root, "manifest.jsonl");
        const context = yield* Layer.build(serviceLayer(manifestPath));
        const writer = yield* ArchiveWriter.pipe(Effect.provide(context));
        const store = yield* PreservationManifestStore.pipe(Effect.provide(context));
        const bytes = syntheticBytes(1024 * 1024);
        const source = path.join(root, "source.bin");
        yield* fs.writeFile(source, bytes);
        const names = ["tampered.bin", "truncated.bin", "removed.bin"];
        for (const name of names) {
          const identity = yield* identityFor(source, name).pipe(Effect.provide(baseContext));
          const outcome = yield* writer.archiveObject(source, path.join(archiveRoot, name), identity);
          yield* store.append(yield* rowFor(identity, name, outcome));
        }
        const sourceSha = yield* hashBytes(bytes).pipe(Effect.provide(baseContext));
        const statBefore = SourceStabilityObservation.make({
          mtimeEpoch: 0,
          sizeBytes: NonNegativeInt.make(bytes.byteLength),
        });
        const statAfter = SourceStabilityObservation.make({
          mtimeEpoch: 1,
          sizeBytes: NonNegativeInt.make(bytes.byteLength),
        });
        const escapeIdentity = yield* identityFor(source, "escape.bin").pipe(Effect.provide(baseContext));
        yield* store.append(
          yield* rowFor(escapeIdentity, "../source.bin", {
            bytesReused: NonNegativeInt.make(bytes.byteLength),
            kind: "already-complete",
            sha256: sourceSha,
            statAfter,
            statBefore,
          })
        );
        const symlinkIdentity = yield* identityFor(source, "symlink.bin").pipe(Effect.provide(baseContext));
        yield* fs.symlink(source, path.join(archiveRoot, "symlink.bin"));
        yield* store.append(
          yield* rowFor(symlinkIdentity, "symlink.bin", {
            bytesReused: NonNegativeInt.make(bytes.byteLength),
            kind: "already-complete",
            sha256: sourceSha,
            statAfter,
            statBefore,
          })
        );
        const directoryIdentity = yield* identityFor(source, "directory.bin").pipe(Effect.provide(baseContext));
        yield* fs.makeDirectory(path.join(archiveRoot, "directory.bin"));
        yield* store.append(
          yield* rowFor(directoryIdentity, "directory.bin", {
            bytesReused: NonNegativeInt.make(bytes.byteLength),
            kind: "already-complete",
            sha256: sourceSha,
            statAfter,
            statBefore,
          })
        );
        const resumedIdentity = yield* identityFor(source, "resumed.bin").pipe(Effect.provide(baseContext));
        yield* fs.writeFile(path.join(archiveRoot, "resumed.bin"), bytes);
        yield* store.append(
          yield* rowFor(resumedIdentity, "resumed.bin", {
            bytesCopied: NonNegativeInt.make(0),
            bytesReused: NonNegativeInt.make(bytes.byteLength),
            kind: "resume-completed",
            sha256: sourceSha,
            statAfter,
            statBefore,
          })
        );
        yield* store.append(
          yield* rowFor(yield* identityFor(source, "changed.bin").pipe(Effect.provide(baseContext)), "changed.bin", {
            kind: "changed-during-copy",
            statAfter,
            statBefore,
          })
        );
        yield* store.append(
          yield* rowFor(
            yield* identityFor(source, "discarded.bin").pipe(Effect.provide(baseContext)),
            "discarded.bin",
            { bytesDiscarded: NonNegativeInt.make(1), kind: "resume-discarded" }
          )
        );
        yield* store.append(
          yield* rowFor(
            yield* identityFor(source, "unreadable.bin").pipe(Effect.provide(baseContext)),
            "unreadable.bin",
            { kind: "unreadable", message: "synthetic" }
          )
        );
        yield* fs.writeFile(path.join(archiveRoot, "changed.bin"), bytes);
        yield* fs.writeFile(path.join(archiveRoot, "discarded.bin"), bytes);
        yield* fs.writeFile(path.join(archiveRoot, "unreadable.bin"), bytes);
        const tampered = bytes.slice();
        tampered[0] = tampered[0] === 0 ? 1 : 0;
        yield* fs.writeFile(path.join(archiveRoot, "tampered.bin"), tampered);
        yield* fs.truncate(path.join(archiveRoot, "truncated.bin"), bytes.byteLength - 1);
        yield* fs.remove(path.join(archiveRoot, "removed.bin"));

        const report = yield* PreservationVerifier.use((verifier) => verifier.verify(archiveRoot)).pipe(
          Effect.provide(context)
        );
        expect(A.map(report.rows, (row) => row.outcome.kind)).toEqual([
          "hash-mismatch",
          "size-mismatch",
          "missing-destination",
          "missing-destination",
          "missing-destination",
          "missing-destination",
          "verified",
          "hash-mismatch",
          "hash-mismatch",
          "hash-mismatch",
        ]);
      })
    )
  );

  it.effect("round-trips preservation rows and decodes mixed ledger generations", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const baseContext = yield* Layer.build(NodeServices.layer);
        const sha = yield* hashBytes(new Uint8Array()).pipe(Effect.provide(baseContext));
        const object = PreservationObjectIdentity.make({
          mtimeEpoch: 0,
          mtimeIso: "2026-08-27T00:00:00Z",
          relativePath: "synthetic.bin",
          sizeBytes: NonNegativeInt.make(0),
          sourceClass: "salvage-tree",
        });
        const row = yield* rowFor(object, "synthetic.bin", {
          bytesReused: NonNegativeInt.make(0),
          kind: "already-complete",
          sha256: sha,
          statAfter: SourceStabilityObservation.make({ mtimeEpoch: 0, sizeBytes: NonNegativeInt.make(0) }),
          statBefore: SourceStabilityObservation.make({ mtimeEpoch: 0, sizeBytes: NonNegativeInt.make(0) }),
        });
        const encodedRow = yield* PreservationManifestRowJson.encode(row);
        expect(yield* PreservationManifestRowJson.decode(encodedRow)).toEqual(row);
        expect(
          S.is(PreservationManifestRow)({
            ...row,
            outcome: {
              bytesReused: NonNegativeInt.make(0),
              kind: "already-complete",
              sha256: sha,
            },
          })
        ).toBe(false);

        const legacy = CorpusProvenanceRecord.make({
          destPath: "/synthetic/archive.bin",
          mtimeEpoch: 0,
          mtimeIso: "2026-08-27T00:00:00Z",
          originPath: "/synthetic/source.bin",
          relativePath: "source.bin",
          salvagedAt: "2026-08-27T00:00:00Z",
          sha256: sha,
          sizeBytes: NonNegativeInt.make(0),
          sourceLabel: "synthetic-source",
        });
        const archive = T7ArchiveProvenanceRecord.make({
          archivedAt: "2026-08-27T00:00:00Z",
          destRelativePath: "synthetic.bin",
          mtimeEpoch: 0,
          mtimeIso: "2026-08-27T00:00:00Z",
          record: "t7-archive/v1",
          relativePath: "synthetic.bin",
          sha256: sha,
          sizeBytes: NonNegativeInt.make(0),
          sourceClass: "salvage-tree",
        });
        const stream = yield* Effect.forEach([legacy, archive], CorpusLedgerRecordJson.encode);
        const decoded = yield* Effect.forEach(stream, CorpusLedgerRecordJson.decode);
        const provenanceOnly = yield* decodeProvenanceLinesForTesting(`${A.join(stream, "\n")}\n`);
        const malformed = yield* decodeProvenanceLinesForTesting("{}\n").pipe(Effect.flip);
        expect(decoded).toEqual([legacy, archive]);
        expect(provenanceOnly).toEqual([legacy]);
        expect(malformed.message).toContain("Provenance manifest line 1 failed schema validation");
      })
    )
  );
});
