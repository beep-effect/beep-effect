import {
  ArchiveLedgerRecord,
  CollectorManifestRecord,
  CorpusCommandService,
  CorpusCommandServiceLive,
  preserveRestorationArchive,
  RestorationPreserveOptions,
} from "@beep/repo-cli/commands/Corpus";
import { restorationArchiveTesting as RA, withRestorationWriterClaim } from "@beep/repo-cli/test/Corpus";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { sha256 } from "@noble/hashes/sha2.js";
import { ByteSize, Context, Effect, FileSystem, HashMap, Layer, Path } from "effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const PosInt = S.Int.check(S.isGreaterThan(0, { message: "Expected a positive integer" }));

const corpusLayer = CorpusCommandServiceLive.pipe(Layer.provideMerge(NodeServices.layer));
const collectorManifestJson = S.fromJsonString(CollectorManifestRecord);

type ArchiveLedgerRace = "append-current" | "append-existing" | "append-type" | "repair-current" | "repair-opened";

const archiveLedgerOpenMutation = (
  race: ArchiveLedgerRace,
  flag: FileSystem.OpenFlag | undefined
): "directory" | "none" | "size" => {
  if (race === "repair-opened" && flag === "r+") return "directory";
  if (race === "append-type" && flag === "ax+") return "directory";
  if (race === "append-existing" && flag === "a") return "size";
  return "none";
};

const preserveOptions = (
  sourceRoot: string,
  rootArchivePath: string,
  corpusRoot: string,
  sourceManifestPath: string
): RestorationPreserveOptions =>
  RestorationPreserveOptions.make({
    absentRecycleTreePath: `${sourceRoot}-absent`,
    capacityCeilingBytes: PosInt.make(1),
    chunkSizeBytes: PosInt.make(1),
    collectorDestinationPrefixSegments: S.Natural.make(2),
    corpusRoot,
    crashPoint: "none",
    expectedCollectorCopiedCount: S.Natural.make(0),
    expectedCollectorErrorCount: S.Natural.make(0),
    expectedCollectorExcludedSecretCount: S.Natural.make(0),
    expectedCollectorPresentSuccessfulRowCount: S.Natural.make(0),
    expectedCollectorResumedCount: S.Natural.make(0),
    expectedCollectorRowCount: S.Natural.make(0),
    expectedCollectorUniqueSuccessfulDestinationCount: S.Natural.make(0),
    expectedMissingRecyclePayloadCount: S.Natural.make(0),
    expectedMutatedDestinationCount: S.Natural.make(0),
    expectedRootArchiveBytes: S.Natural.make(0),
    expectedSourceDirectoryCount: S.Natural.make(0),
    expectedSourceFileCount: S.Natural.make(0),
    expectedSourceTreeBytes: S.Natural.make(0),
    minimumFreeAfterBytes: S.Natural.make(0),
    rootArchivePath,
    runLabel: "archive-boundary-test",
    sourceManifestPath,
    sourceRoot,
  });

describe("restoration archive boundary helpers", () => {
  it.layer(NodeServices.layer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "fails closed for canonical type, containment, crash, and prefix mismatches",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "restoration-archive-boundaries-" });
        const source = path.join(root, "source.bin");
        const equal = path.join(root, "equal.bin");
        const different = path.join(root, "different.bin");
        const short = path.join(root, "short.bin");
        yield* fs.writeFileString(source, "abcdef");
        yield* fs.writeFileString(equal, "abcdef");
        yield* fs.writeFileString(different, "abcxef");
        yield* fs.writeFileString(short, "abc");

        (yield* RA.inspectCanonicalPath(source, "File", "wrong type", "symbolic link").pipe(Effect.exit)).pipe(
          Exit.isSuccess,
          assertTrue
        );
        (yield* RA.inspectCanonicalPath(source, "Directory", "wrong type", "symbolic link").pipe(Effect.exit)).pipe(
          Exit.isFailure,
          assertTrue
        );
        expect(yield* RA.requireContainedPath(path, root, source, "outside", true)).toBe(source);
        (yield* RA.requireContainedPath(path, root, root, "equal", false).pipe(Effect.exit)).pipe(
          Exit.isFailure,
          assertTrue
        );
        (yield* RA.requireContainedPath(path, root, path.dirname(root), "outside", true).pipe(Effect.exit)).pipe(
          Exit.isFailure,
          assertTrue
        );
        expect(yield* RA.prefixMatches(source, equal, 0, 2)).toBe(true);
        expect(yield* RA.prefixMatches(source, equal, 6, 2)).toBe(true);
        expect(yield* RA.prefixMatches(source, different, 6, 2)).toBe(false);
        expect(yield* RA.prefixMatches(source, short, 6, 2)).toBe(false);
        expect(yield* RA.maybeCrash("none", "after-copy")).toBeUndefined();
        (yield* RA.maybeCrash("after-rename", "after-rename").pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);
      })
    );
  });

  it.layer(NodeServices.layer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "rejects overlapping canonical inputs and invalid collector destinations",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "restoration-canonical-overlap-" });
        const sourceRoot = path.join(root, "source");
        const corpusRoot = path.join(root, "corpus");
        const rootArchive = path.join(sourceRoot, "root.zip");
        const manifest = path.join(root, "collector.jsonl");
        yield* fs.makeDirectory(sourceRoot, { recursive: true });
        yield* fs.makeDirectory(corpusRoot, { recursive: true });
        yield* fs.writeFileString(rootArchive, "archive");
        yield* fs.writeFileString(manifest, "");

        (yield* RA.validateCanonicalArchivePaths(preserveOptions(sourceRoot, rootArchive, corpusRoot, manifest)).pipe(
          Effect.exit
        )).pipe(Exit.isFailure, assertTrue);

        const separateArchive = path.join(root, "separate.zip");
        yield* fs.writeFileString(separateArchive, "archive");
        (yield* RA.validateCanonicalArchivePaths(
          preserveOptions(sourceRoot, separateArchive, sourceRoot, manifest)
        ).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);

        expect(
          yield* RA.reconcileCollectorRecord(
            CollectorManifestRecord.cases.error.make({
              reason: "unreadable",
              src: "C:\\source\\unreadable.bin",
              status: "error",
            }),
            sourceRoot,
            2
          )
        ).toEqual({ kind: "collector-error" });
        expect(
          yield* RA.reconcileCollectorRecord(
            CollectorManifestRecord.cases["excluded-secret"].make({
              src: "C:\\source\\secret.bin",
              status: "excluded-secret",
            }),
            sourceRoot,
            2
          )
        ).toEqual({ kind: "ignored" });
        (yield* RA.reconcileCollectorRecord(
          CollectorManifestRecord.cases.copied.make({
            dst: "C:\\root",
            size: S.Natural.make(0),
            src: "C:\\source\\bad.bin",
            status: "copied",
          }),
          sourceRoot,
          2
        ).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);

        const collectorRecord = (name: string, size: number) =>
          CollectorManifestRecord.cases.copied.make({
            dst: `C:\\root\\${name}`,
            size: S.Natural.make(size),
            src: `C:\\source\\${name}`,
            status: "copied",
          });
        expect(yield* RA.reconcileCollectorRecord(collectorRecord("missing.bin", 4), sourceRoot, 2)).toEqual({
          kind: "mutated",
          recordedSize: 4,
          relativePath: "missing.bin",
        });
        const presentPath = path.join(sourceRoot, "present.bin");
        yield* fs.writeFileString(presentPath, "data");
        expect(yield* RA.reconcileCollectorRecord(collectorRecord("present.bin", 4), sourceRoot, 2)).toEqual({
          kind: "present",
          recordedSize: 4,
          relativePath: "present.bin",
        });
        (yield* RA.reconcileCollectorRecord(collectorRecord("present.bin", 5), sourceRoot, 2).pipe(Effect.exit)).pipe(
          Exit.isFailure,
          assertTrue
        );
        const directoryPath = path.join(sourceRoot, "directory");
        yield* fs.makeDirectory(directoryPath);
        (yield* RA.reconcileCollectorRecord(collectorRecord("directory", 0), sourceRoot, 2).pipe(Effect.exit)).pipe(
          Exit.isFailure,
          assertTrue
        );
        const outside = path.join(root, "outside.bin");
        const symlink = path.join(sourceRoot, "symlink.bin");
        yield* fs.writeFileString(outside, "data");
        yield* fs.symlink(outside, symlink);
        (yield* RA.reconcileCollectorRecord(collectorRecord("symlink.bin", 4), sourceRoot, 2).pipe(Effect.exit)).pipe(
          Exit.isFailure,
          assertTrue
        );
        const availableBytes = yield* RA.availableRestorationBytesAt(root);
        expect(availableBytes).toBeGreaterThan(0);
        (yield* RA.availableRestorationBytesAt(path.join(root, "missing")).pipe(Effect.exit)).pipe(
          Exit.isFailure,
          assertTrue
        );
      })
    );
  });

  it.layer(NodeServices.layer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "derives stable inventory and writer-coordination identities",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "restoration-archive-identity-" });
        const info = yield* fs.stat(root);
        const identity = RA.sourceIdentity(info);
        const directory = {
          destinationRelativePath: "tree",
          expectedInfo: identity,
          objectId: "directory-id",
          sourceLabel: "tree",
          sourceRelativePath: ".",
        };
        const file = {
          destinationRelativePath: "tree/file.bin",
          expectedInfo: { ...identity, sizeBytes: 6, type: "File" as const },
          expectedSizeBytes: 6,
          objectId: "file-id",
          objectKind: "file" as const,
          sourceLabel: "tree",
          sourcePath: "/source/file.bin",
          sourceRelativePath: "file.bin",
        };
        const signature = RA.archiveInventorySignature([directory], [file]);
        expect(signature).toHaveLength(64);
        expect(RA.sourceIdentityToken({ ...identity, inode: O.none() })).toContain("\u0000-1\u0000");
        expect(RA.archiveInventorySignature([directory], [{ ...file, sourceRelativePath: "other.bin" }])).not.toBe(
          signature
        );

        expect(yield* RA.reapedCoordinationPath("/tmp/claim")).toContain(".reaped-");
        const reapClaim = RA.writerReapClaimPath("/tmp/claim", "observed");
        expect(reapClaim).toContain(".reap-");
        expect(RA.writerReapClaimTombstonePath(reapClaim, "observed")).toContain(".claim.reap-");
      })
    );
  });

  it.layer(NodeServices.layer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "rejects unsupported inventories and contradictory denominators",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "restoration-inventory-coverage-" });
        const sourceRoot = path.join(root, "source");
        const sourceFile = path.join(sourceRoot, "source.bin");
        const rootArchive = path.join(root, "root.zip");
        const sourceManifest = path.join(root, "collector.jsonl");
        const corpusRoot = path.join(root, "corpus");
        const archiveRoot = path.join(corpusRoot, "raw", "run");
        yield* fs.makeDirectory(sourceRoot);
        yield* fs.makeDirectory(corpusRoot);
        yield* fs.writeFileString(sourceFile, "source");
        yield* fs.writeFileString(rootArchive, "archive");
        yield* fs.writeFileString(sourceManifest, "");
        const canonicalPaths = {
          archiveRoot,
          corpusRoot,
          rootArchivePath: rootArchive,
          sourceManifestPath: sourceManifest,
          sourceRoot,
        };

        (yield* RA.collectArchiveInventory({ ...canonicalPaths, sourceRoot: sourceFile }).pipe(Effect.exit)).pipe(
          Exit.isFailure,
          assertTrue
        );
        const alias = path.join(sourceRoot, "alias.bin");
        yield* fs.symlink(rootArchive, alias);
        (yield* RA.collectArchiveInventory(canonicalPaths).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);
        yield* fs.remove(alias);
        const fifo = path.join(sourceRoot, "unsupported.fifo");
        expect(Bun.spawnSync(["mkfifo", fifo], { stderr: "pipe", stdout: "pipe" }).exitCode).toBe(0);
        (yield* RA.collectArchiveInventory(canonicalPaths).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);
        yield* fs.remove(fifo);
        (yield* RA.collectArchiveInventory({ ...canonicalPaths, rootArchivePath: sourceRoot }).pipe(Effect.exit)).pipe(
          Exit.isFailure,
          assertTrue
        );
        (yield* RA.collectArchiveInventory({ ...canonicalPaths, rootArchivePath: sourceFile }).pipe(Effect.exit)).pipe(
          Exit.isFailure,
          assertTrue
        );

        const inventory = yield* RA.collectArchiveInventory(canonicalPaths);
        const approvedOptions = RestorationPreserveOptions.make({
          ...preserveOptions(sourceRoot, rootArchive, corpusRoot, sourceManifest),
          capacityCeilingBytes: PosInt.make(1024),
          expectedRootArchiveBytes: S.Natural.make("archive".length),
          expectedSourceDirectoryCount: S.Natural.make(1),
          expectedSourceFileCount: S.Natural.make(1),
          expectedSourceTreeBytes: S.Natural.make("source".length),
        });
        const context = {
          archiveRoot,
          availableBytes: 1024,
          canonicalPaths,
          capacityApproved: true,
          collector: { collectorErrorCount: 0, mutatedDestinationCount: 0, rowCount: 0 },
          inventory,
          manifestPath: path.join(archiveRoot, "final-inventory.jsonl"),
          options: approvedOptions,
          provenancePath: path.join(archiveRoot, "provenance.jsonl"),
          runId: "final-inventory-run",
          startedAt: 0,
        };
        (yield* RA.validateFinalArchiveInventory(
          {
            ...context,
            canonicalPaths: { ...canonicalPaths, sourceRoot: sourceFile },
            manifestPath: path.join(archiveRoot, "collect-failure.jsonl"),
          },
          inventory
        ).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);
        (yield* RA.validateFinalArchiveInventory(
          {
            ...context,
            manifestPath: path.join(archiveRoot, "denominator-failure.jsonl"),
            options: RestorationPreserveOptions.make({
              ...approvedOptions,
              expectedSourceFileCount: S.Natural.make(2),
            }),
          },
          inventory
        ).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);
        (yield* RA.validateFinalArchiveInventory(
          { ...context, manifestPath: path.join(archiveRoot, "signature-failure.jsonl") },
          { ...inventory, signature: Sha256Hex.make("0".repeat(64)) }
        ).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);
        (yield* RA.validateFinalArchiveInventory(
          {
            ...context,
            manifestPath: path.join(archiveRoot, "capacity-failure.jsonl"),
            options: RestorationPreserveOptions.make({ ...approvedOptions, capacityCeilingBytes: PosInt.make(1) }),
          },
          inventory
        ).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);

        (yield* RA.requireInventoryDenominator("files", 1, 2).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);
        (yield* RA.requireCollectorDenominator("rows", 1, 2).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);
        (yield* RA.reconcileCollectorHistoricalIdentities([
          { kind: "present", recordedSize: 1, relativePath: "same.bin" },
          { kind: "mutated", recordedSize: 2, relativePath: "same.bin" },
        ]).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);
      })
    );
  });

  it.layer(corpusLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "rejects an absent recycle tree that reappears before preservation",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "restoration-absent-tree-" });
        const sourceRoot = path.join(root, "source");
        const corpusRoot = path.join(root, "corpus");
        const rootArchive = path.join(root, "root.zip");
        const sourceManifest = path.join(root, "collector.jsonl");
        const reappearedTree = path.join(root, "reappeared-tree");
        yield* fs.makeDirectory(sourceRoot);
        yield* fs.makeDirectory(corpusRoot);
        yield* fs.makeDirectory(reappearedTree);
        yield* fs.writeFileString(path.join(sourceRoot, "source.bin"), "source");
        yield* fs.writeFileString(rootArchive, "archive");
        yield* fs.writeFileString(sourceManifest, "");
        const options = RestorationPreserveOptions.make({
          ...preserveOptions(sourceRoot, rootArchive, corpusRoot, sourceManifest),
          absentRecycleTreePath: reappearedTree,
          capacityCeilingBytes: PosInt.make(1024),
          expectedRootArchiveBytes: S.Natural.make("archive".length),
          expectedSourceDirectoryCount: S.Natural.make(1),
          expectedSourceFileCount: S.Natural.make(1),
          expectedSourceTreeBytes: S.Natural.make("source".length),
        });
        (yield* preserveRestorationArchive(options).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);
      })
    );
  });

  it.layer(NodeServices.layer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "rejects collector destinations that appear only after inventory capture",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "restoration-late-collector-file-" });
        const sourceRoot = path.join(root, "source");
        const corpusRoot = path.join(root, "corpus");
        const rootArchive = path.join(root, "root.zip");
        const sourceManifest = path.join(root, "collector.jsonl");
        const lateFile = path.join(sourceRoot, "present.bin");
        yield* fs.makeDirectory(sourceRoot);
        yield* fs.makeDirectory(corpusRoot);
        yield* fs.writeFileString(rootArchive, "archive");
        const collectorRow = yield* S.encodeEffect(collectorManifestJson)(
          CollectorManifestRecord.make({
            dst: "C:\\root\\present.bin",
            size: S.Natural.make(4),
            src: "C:\\source\\present.bin",
            status: "copied",
          })
        );
        yield* fs.writeFileString(sourceManifest, `${collectorRow}\n`);
        const options = RestorationPreserveOptions.make({
          ...preserveOptions(sourceRoot, rootArchive, corpusRoot, sourceManifest),
          capacityCeilingBytes: PosInt.make(1024),
          expectedCollectorCopiedCount: S.Natural.make(1),
          expectedCollectorPresentSuccessfulRowCount: S.Natural.make(1),
          expectedCollectorRowCount: S.Natural.make(1),
          expectedCollectorUniqueSuccessfulDestinationCount: S.Natural.make(1),
          expectedRootArchiveBytes: S.Natural.make("archive".length),
          expectedSourceDirectoryCount: S.Natural.make(1),
        });
        const lateFileSystem = {
          ...fs,
          readFileString: (filePath: string, encoding?: string) =>
            filePath === sourceManifest
              ? fs.writeFileString(lateFile, "data").pipe(Effect.andThen(fs.readFileString(filePath, encoding)))
              : fs.readFileString(filePath, encoding),
        };
        const layer = CorpusCommandServiceLive.pipe(
          Layer.provide(Layer.merge(NodeServices.layer, Layer.succeed(FileSystem.FileSystem, lateFileSystem)))
        );
        (yield* preserveRestorationArchive(options).pipe(
          Effect.provideServiceEffect(
            CorpusCommandService,
            Layer.build(Layer.fresh(layer)).pipe(Effect.map(Context.get(CorpusCommandService)))
          ),
          Effect.scoped,
          Effect.exit
        )).pipe(Exit.isFailure, assertTrue);
      })
    );
  });

  it.layer(NodeServices.layer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "fails closed when archive ledgers drift across repair and append boundaries",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const runRace = Effect.fn("RestorationArchiveCoverage.runRace")(function* (race: ArchiveLedgerRace) {
          const root = yield* fs.makeTempDirectoryScoped({ prefix: `restoration-${race}-` });
          const sourceRoot = path.join(root, "source");
          const corpusRoot = path.join(root, "corpus");
          const rootArchive = path.join(root, "root.zip");
          const sourceManifest = path.join(root, "collector.jsonl");
          const archiveRoot = path.join(corpusRoot, "raw", "archive-boundary-test");
          const ledgerPath = path.join(archiveRoot, "archive-ledger.jsonl");
          yield* fs.makeDirectory(sourceRoot);
          yield* fs.makeDirectory(archiveRoot, { recursive: true });
          yield* fs.writeFileString(rootArchive, "archive");
          yield* fs.writeFileString(sourceManifest, "");
          if (race === "repair-current" || race === "repair-opened") {
            yield* fs.writeFileString(ledgerPath, "incomplete");
          } else if (race === "append-existing") {
            yield* fs.writeFileString(ledgerPath, "\n");
          }

          let ledgerStatCount = 0;
          const racingFileSystem = {
            ...fs,
            open: (filePath: string, options?: Parameters<FileSystem.FileSystem["open"]>[1]) =>
              fs.open(filePath, options).pipe(
                Effect.map((file) => {
                  if (filePath !== ledgerPath) return file;
                  const mutation = archiveLedgerOpenMutation(race, options?.flag);
                  if (mutation === "none") return file;
                  return {
                    ...file,
                    stat: file.stat.pipe(
                      Effect.map((info) =>
                        mutation === "directory"
                          ? { ...info, type: "Directory" as const }
                          : { ...info, size: ByteSize.sum(info.size, ByteSize.bytes(1)) }
                      )
                    ),
                  };
                })
              ),
            stat: (filePath: string) =>
              fs.stat(filePath).pipe(
                Effect.map((info) => {
                  if (filePath !== ledgerPath) return info;
                  ledgerStatCount += 1;
                  const shouldDrift = (race === "repair-current" && ledgerStatCount === 2) || race === "append-current";
                  return shouldDrift ? { ...info, size: ByteSize.sum(info.size, ByteSize.bytes(1)) } : info;
                })
              ),
          };
          const layer = CorpusCommandServiceLive.pipe(
            Layer.provide(Layer.merge(NodeServices.layer, Layer.succeed(FileSystem.FileSystem, racingFileSystem)))
          );
          const options = RestorationPreserveOptions.make({
            ...preserveOptions(sourceRoot, rootArchive, corpusRoot, sourceManifest),
            capacityCeilingBytes: PosInt.make(1024),
            expectedRootArchiveBytes: S.Natural.make("archive".length),
            expectedSourceDirectoryCount: S.Natural.make(1),
          });
          (yield* preserveRestorationArchive(options).pipe(
            Effect.provideServiceEffect(
              CorpusCommandService,
              Layer.build(Layer.fresh(layer)).pipe(Effect.map(Context.get(CorpusCommandService)))
            ),
            Effect.scoped,
            Effect.exit
          )).pipe(Exit.isFailure, assertTrue);
        });

        yield* runRace("repair-opened");
        yield* runRace("repair-current");
        yield* runRace("append-type");
        yield* runRace("append-existing");
        yield* runRace("append-current");
      })
    );
  });

  it.layer(NodeServices.layer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "stops after the bounded attempts when a source changes after every payload sync",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "restoration-bounded-source-race-" });
        const sourceRoot = path.join(root, "source");
        const sourceFile = path.join(sourceRoot, "source.bin");
        const corpusRoot = path.join(root, "corpus");
        const rootArchive = path.join(root, "root.zip");
        const sourceManifest = path.join(root, "collector.jsonl");
        yield* fs.makeDirectory(sourceRoot);
        yield* fs.makeDirectory(corpusRoot);
        yield* fs.writeFileString(sourceFile, "source");
        yield* fs.writeFileString(rootArchive, "archive");
        yield* fs.writeFileString(sourceManifest, "");

        let mutation = 0;
        const racingFileSystem = {
          ...fs,
          open: (filePath: string, options?: Parameters<FileSystem.FileSystem["open"]>[1]) =>
            fs.open(filePath, options).pipe(
              Effect.map((file) => {
                if (!filePath.endsWith("source.bin.partial")) return file;
                let mutatedThisAttempt = false;
                return new Proxy(file, {
                  get: (target, property) =>
                    property === "sync"
                      ? target.sync.pipe(
                          Effect.tap(() =>
                            Effect.sync(() => {
                              if (mutatedThisAttempt) return;
                              mutatedThisAttempt = true;
                              mutation += 1;
                              const changedAt = 1_800_000_000 + mutation;
                              const result = Bun.spawnSync(["touch", "-m", "-d", `@${changedAt}`, sourceFile]);
                              if (result.exitCode !== 0) throw new Error("Failed mutating source timestamp.");
                            })
                          )
                        )
                      : Reflect.get(target, property),
                });
              })
            ),
        };
        const layer = CorpusCommandServiceLive.pipe(
          Layer.provide(Layer.merge(NodeServices.layer, Layer.succeed(FileSystem.FileSystem, racingFileSystem)))
        );
        const options = RestorationPreserveOptions.make({
          ...preserveOptions(sourceRoot, rootArchive, corpusRoot, sourceManifest),
          capacityCeilingBytes: PosInt.make(1024),
          expectedRootArchiveBytes: S.Natural.make("archive".length),
          expectedSourceDirectoryCount: S.Natural.make(1),
          expectedSourceFileCount: S.Natural.make(1),
          expectedSourceTreeBytes: S.Natural.make("source".length),
        });
        const outcome = yield* preserveRestorationArchive(options).pipe(
          Effect.provideServiceEffect(
            CorpusCommandService,
            Layer.build(Layer.fresh(layer)).pipe(Effect.map(Context.get(CorpusCommandService)))
          ),
          Effect.scoped,
          Effect.exit
        );
        expect(mutation).toBe(3);
        expect(outcome).toMatchObject({ _tag: "Failure" });
      })
    );
  });

  it.layer(NodeServices.layer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "reclaims dead writer generations and rejects ambiguous verification artifacts",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "restoration-coordination-coverage-" });
        const bootId = yield* RA.currentBootId();
        const procStart = yield* RA.processStartTime(process.pid);
        if (O.isNone(procStart)) return yield* Effect.die("Expected the current process identity.");
        const claimText = `${yield* RA.encodeRestorationWriterClaim({
          bootId,
          pid: process.pid,
          procStart: procStart.value,
          schemaVersion: "oppold-preservation-writer/v2",
          startedAt: "2026-08-30T00:00:00.000Z",
          token: "live-claim-token",
        })}\n`;
        const liveClaim = yield* RA.decodeObservedWriterClaim(claimText, "claim decode failed");
        expect(yield* RA.writerClaimOwnerIsAlive(liveClaim)).toBe(true);
        expect(yield* RA.writerClaimOwnerIsAlive({ ...liveClaim, bootId: "different-boot" })).toBe(false);
        expect(yield* RA.writerClaimOwnerIsAlive({ ...liveClaim, pid: 2_147_483_647 })).toBe(false);

        const claimPath = path.join(root, "writer.claim");
        expect(yield* RA.tryWriteExclusiveCoordinationFile(claimPath, claimText)).toBe(true);
        expect(yield* RA.tryWriteExclusiveCoordinationFile(claimPath, claimText)).toBe(false);
        assertSome(yield* RA.readCanonicalCoordinationFile(claimPath), claimText);
        expect(yield* RA.moveObservedCoordinationFile(claimPath, "wrong-generation")).toBe(false);
        expect(yield* RA.moveObservedCoordinationFile(claimPath, claimText)).toBe(true);
        assertNone(yield* RA.readCanonicalCoordinationFile(claimPath));

        const deadText = `${yield* RA.encodeRestorationWriterClaim({
          ...liveClaim,
          bootId: "dead-boot",
          token: "dead-claim-token",
        })}\n`;
        yield* fs.writeFileString(claimPath, deadText);
        expect(yield* RA.tryClaimWriterReapClaim(claimPath, claimText)).toBe(true);
        expect(yield* RA.moveObservedCoordinationFile(claimPath, claimText)).toBe(true);
        yield* fs.writeFileString(claimPath, claimText);
        expect(yield* RA.tryClaimWriterReapClaim(claimPath, deadText)).toBe(false);
        expect(yield* RA.moveObservedCoordinationFile(claimPath, claimText)).toBe(true);

        const reapPath = path.join(root, "reap.claim");
        yield* fs.writeFileString(reapPath, deadText);
        const tombstonePath = RA.writerReapClaimTombstonePath(reapPath, deadText);
        yield* fs.writeFileString(tombstonePath, claimText);
        expect(yield* RA.tryRecoverObservedWriterReapClaim(reapPath, claimText, deadText)).toBe(false);
        expect(yield* RA.moveObservedCoordinationFile(tombstonePath, claimText)).toBe(true);
        yield* fs.writeFileString(tombstonePath, deadText);
        (yield* RA.tryRecoverObservedWriterReapClaim(reapPath, claimText, deadText).pipe(Effect.exit)).pipe(
          Exit.isFailure,
          assertTrue
        );
        expect(yield* RA.moveObservedCoordinationFile(tombstonePath, deadText)).toBe(true);
        expect(yield* RA.moveObservedCoordinationFile(reapPath, deadText)).toBe(true);
        yield* fs.writeFileString(reapPath, "changed-generation");
        expect(yield* RA.tryRecoverObservedWriterReapClaim(reapPath, claimText, deadText)).toBe(false);
        expect(yield* RA.moveObservedCoordinationFile(reapPath, "changed-generation")).toBe(true);

        const acquiredPath = path.join(root, "acquired.claim");
        const lease = { claimPath: acquiredPath, claimText };
        expect(yield* RA.acquireObservedRestorationWriterClaim(lease)).toEqual(lease);
        yield* RA.releaseArchiveWriterClaim(lease);
        (yield* RA.releaseArchiveWriterClaim(lease).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);

        const validationRoot = path.join(root, "validation-root");
        yield* fs.makeDirectory(validationRoot);
        (yield* RA.validateArchiveManifestSeal(validationRoot, [], []).pipe(Effect.exit)).pipe(
          Exit.isFailure,
          assertTrue
        );
        (yield* RA.validateArchiveManifestSeal(validationRoot, ["synthetic-line"], []).pipe(Effect.exit)).pipe(
          Exit.isFailure,
          assertTrue
        );

        const reportRoot = path.join(root, "report-root");
        yield* fs.makeDirectory(reportRoot);
        yield* RA.persistVerificationReport(reportRoot, []);
        yield* RA.persistVerificationReport(reportRoot, []);
        const reportDirectory = path.join(reportRoot, "verification");
        const reportName = (yield* fs.readDirectory(reportDirectory))[0];
        if (reportName === undefined) return yield* Effect.die("Expected a verification report.");
        const reportPath = path.join(reportDirectory, reportName);
        yield* fs.writeFileString(reportPath, "drift");
        (yield* RA.persistVerificationReport(reportRoot, []).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);
        yield* fs.writeFileString(reportPath, "");
        yield* fs.rename(reportPath, `${reportPath}.partial`);
        yield* RA.persistVerificationReport(reportRoot, []);
        yield* fs.rename(reportPath, `${reportPath}.partial`);
        yield* fs.writeFileString(`${reportPath}.partial`, "drift");
        (yield* RA.persistVerificationReport(reportRoot, []).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);

        const payloadRoot = path.join(root, "payload-root");
        yield* fs.makeDirectory(path.join(payloadRoot, "payload"), { recursive: true });
        yield* RA.requireArchivePayloadOwned(payloadRoot, HashMap.empty());
        const outside = path.join(root, "outside-payload.bin");
        yield* fs.writeFileString(outside, "outside");
        yield* fs.symlink(outside, path.join(payloadRoot, "payload", "alias.bin"));
        (yield* RA.requireArchivePayloadOwned(payloadRoot, HashMap.empty()).pipe(Effect.exit)).pipe(
          Exit.isFailure,
          assertTrue
        );

        const preflight = ArchiveLedgerRecord.cases["archive-preflight"].make({
          approved: true,
          approvedCeilingBytes: S.Natural.make(1),
          availableBytes: S.Natural.make(1),
          directoryCount: S.Natural.make(0),
          fileCount: S.Natural.make(1),
          minimumFreeAfterBytes: S.Natural.make(0),
          recordedAt: "2026-08-30T00:00:00.000Z",
          recordType: "archive-preflight",
          requiredBytes: S.Natural.make(1),
          runId: "failure-terminal-run",
          schemaVersion: "oppold-corpus-restoration/v1",
        });
        const failure = ArchiveLedgerRecord.cases["archive-failure"].make({
          approved: false,
          failureKind: "unreadable",
          message: "synthetic terminal failure",
          objectId: "failure-terminal-object",
          recordedAt: preflight.recordedAt,
          recordType: "archive-failure",
          runId: preflight.runId,
          schemaVersion: preflight.schemaVersion,
          sourceLabel: "synthetic-source",
          sourceRelativePath: "synthetic.bin",
        });
        expect(HashMap.size(yield* RA.validateArchiveTerminalIndex(root, [failure], preflight))).toBe(1);
        RA.indexArchiveTerminals([failure, failure, failure]).duplicateObjectId.pipe(O.isSome, assertTrue);
      })
    );
  });

  it.layer(NodeServices.layer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "fails closed when live reclamation generations block stale claim replacement",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "restoration-coordination-contention-" });
        const bootId = yield* RA.currentBootId();
        const procStart = yield* RA.processStartTime(process.pid);
        if (O.isNone(procStart)) return yield* Effect.die("Expected the current process identity.");
        const claim = (token: string, claimBootId = bootId) =>
          RA.encodeRestorationWriterClaim({
            bootId: claimBootId,
            pid: process.pid,
            procStart: procStart.value,
            schemaVersion: "oppold-preservation-writer/v2",
            startedAt: "2026-08-30T00:00:00.000Z",
            token,
          }).pipe(Effect.map((text) => `${text}\n`));
        const liveText = yield* claim("live-contention-owner");
        const staleText = yield* claim("stale-contention-owner", "retired-boot");

        (yield* RA.processStartTime(process.pid).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            readFileString: () => Effect.succeed("malformed process stat"),
          }),
          Effect.exit
        )).pipe(Exit.isFailure, assertTrue);
        (yield* RA.processStartTime(process.pid).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            readFileString: () => fs.readFileString(root),
          }),
          Effect.exit
        )).pipe(Exit.isFailure, assertTrue);
        (yield* RA.currentBootId().pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            readFileString: () => Effect.succeed("  \n"),
          }),
          Effect.exit
        )).pipe(Exit.isFailure, assertTrue);
        (yield* withRestorationWriterClaim(root, "unavailable-process.claim", Effect.void).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            readFileString: (filePath, encoding) =>
              filePath === `/proc/${process.pid}/stat`
                ? fs.readFileString(path.join(root, "missing-proc-stat"), encoding)
                : fs.readFileString(filePath, encoding),
          }),
          Effect.exit
        )).pipe(Exit.isFailure, assertTrue);

        const racedClaimPath = path.join(root, "raced.claim");
        const collisionTargetPath = path.join(root, "collision-target.claim");
        yield* fs.writeFileString(collisionTargetPath, liveText);
        (yield* RA.acquireObservedRestorationWriterClaim({ claimPath: racedClaimPath, claimText: staleText }).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            open: (filePath, options) =>
              filePath === racedClaimPath && options?.flag === "wx"
                ? fs.open(collisionTargetPath, options)
                : fs.open(filePath, options),
          }),
          Effect.exit
        )).pipe(Exit.isFailure, assertTrue);

        const liveClaimPath = path.join(root, "live.claim");
        yield* fs.writeFileString(liveClaimPath, liveText);
        (yield* RA.readCanonicalCoordinationFile(liveClaimPath).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            open: (filePath, options) =>
              fs.open(filePath, options).pipe(
                Effect.map((file) => ({
                  ...file,
                  stat: file.stat.pipe(Effect.map((info) => ({ ...info, type: "Directory" as const }))),
                }))
              ),
          }),
          Effect.exit
        )).pipe(Exit.isFailure, assertTrue);
        (yield* RA.acquireObservedRestorationWriterClaim({ claimPath: liveClaimPath, claimText: staleText }).pipe(
          Effect.exit
        )).pipe(Exit.isFailure, assertTrue);
        expect(
          yield* RA.moveObservedCoordinationFile(liveClaimPath, liveText).pipe(
            Effect.provideService(FileSystem.FileSystem, {
              ...fs,
              rename: () => fs.rename(path.join(root, "missing-source"), path.join(root, "missing-target")),
            })
          )
        ).toBe(false);
        (yield* RA.moveObservedCoordinationFile(liveClaimPath, liveText).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            rename: () => fs.rename(liveClaimPath, root),
          }),
          Effect.exit
        )).pipe(Exit.isFailure, assertTrue);

        const interruptedReapPath = path.join(root, "interrupted-reap.claim");
        yield* fs.writeFileString(interruptedReapPath, staleText);
        expect(
          yield* RA.tryRecoverObservedWriterReapClaim(interruptedReapPath, liveText, staleText).pipe(
            Effect.provideService(FileSystem.FileSystem, {
              ...fs,
              rename: () => fs.rename(path.join(root, "missing-source"), path.join(root, "missing-target")),
            })
          )
        ).toBe(false);

        const vanishedReapPath = path.join(root, "vanished-reap.claim");
        yield* fs.writeFileString(vanishedReapPath, staleText);
        const vanishedTombstonePath = RA.writerReapClaimTombstonePath(vanishedReapPath, staleText);
        yield* fs.writeFileString(vanishedTombstonePath, liveText);
        expect(
          yield* RA.tryRecoverObservedWriterReapClaim(vanishedReapPath, staleText, staleText).pipe(
            Effect.provideService(FileSystem.FileSystem, {
              ...fs,
              exists: (filePath) => (filePath === vanishedTombstonePath ? Effect.succeed(false) : fs.exists(filePath)),
            })
          )
        ).toBe(false);

        const vanishedObservedPath = path.join(root, "vanished-observed.claim");
        yield* fs.writeFileString(vanishedObservedPath, staleText);
        expect(
          yield* RA.tryClaimWriterReapClaim(vanishedObservedPath, liveText).pipe(
            Effect.provideService(FileSystem.FileSystem, {
              ...fs,
              exists: (filePath) => (filePath === vanishedObservedPath ? Effect.succeed(false) : fs.exists(filePath)),
            })
          )
        ).toBe(false);

        const staleClaimPath = path.join(root, "stale.claim");
        yield* fs.writeFileString(staleClaimPath, staleText);
        const reapClaimPath = RA.writerReapClaimPath(staleClaimPath, staleText);
        yield* fs.writeFileString(reapClaimPath, liveText);
        expect(yield* RA.tryMoveObservedWriterClaim(staleClaimPath, staleText, staleText)).toBe(false);
        expect(yield* RA.tryReplaceStaleWriterClaim(staleClaimPath, staleText, staleText)).toBe(false);
        (yield* RA.acquireObservedRestorationWriterClaim({ claimPath: staleClaimPath, claimText: liveText }).pipe(
          Effect.exit
        )).pipe(Exit.isFailure, assertTrue);

        (yield* RA.tryWriteExclusiveCoordinationFile(path.join(root, "missing", "claim"), liveText).pipe(
          Effect.exit
        )).pipe(Exit.isFailure, assertTrue);

        const emptySource = path.join(root, "empty-source.bin");
        const emptyPartial = path.join(root, "empty-partial.bin");
        yield* fs.writeFileString(emptySource, "");
        yield* fs.writeFileString(emptyPartial, "");
        expect(yield* RA.prefixMatches(emptySource, emptyPartial, 1, 2)).toBe(false);
      })
    );
  });

  it.effect(
    "handles empty capacity output and rejects thrown or invalid probes",
    Effect.fnUntraced(function* () {
      const originalSpawnSync = Bun.spawnSync;
      yield* Effect.acquireUseRelease(
        Effect.sync(() => {
          Object.defineProperty(Bun, "spawnSync", {
            value: () => {
              throw new Error("synthetic capacity probe failure");
            },
          });
        }),
        () =>
          RA.availableRestorationBytesAt("/synthetic").pipe(
            Effect.exit,
            Effect.map((exit) => expect(exit).toMatchObject({ _tag: "Failure" }))
          ),
        () =>
          Effect.sync(() => {
            Object.defineProperty(Bun, "spawnSync", { value: originalSpawnSync });
          })
      );
      yield* Effect.acquireUseRelease(
        Effect.sync(() => {
          Object.defineProperty(Bun, "spawnSync", {
            value: () => ({ exitCode: 0, stdout: new Uint8Array() }),
          });
        }),
        () =>
          RA.availableRestorationBytesAt("/synthetic").pipe(
            Effect.map((availableBytes) => expect(availableBytes).toBe(0))
          ),
        () =>
          Effect.sync(() => {
            Object.defineProperty(Bun, "spawnSync", { value: originalSpawnSync });
          })
      );
      yield* Effect.acquireUseRelease(
        Effect.sync(() => {
          Object.defineProperty(Bun, "spawnSync", {
            value: () => ({ exitCode: 0, stdout: new TextEncoder().encode("not-a-number\n") }),
          });
        }),
        () =>
          RA.availableRestorationBytesAt("/synthetic").pipe(
            Effect.exit,
            Effect.map((exit) => expect(exit).toMatchObject({ _tag: "Failure" }))
          ),
        () =>
          Effect.sync(() => {
            Object.defineProperty(Bun, "spawnSync", { value: originalSpawnSync });
          })
      );
    })
  );

  it.layer(NodeServices.layer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "rejects changed sources, aliased partials, and opened-copy identity drift",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "restoration-copy-identity-" });
        const sourceRoot = path.join(root, "source");
        const destinationDirectory = path.join(root, "destination");
        yield* fs.makeDirectory(sourceRoot);
        yield* fs.makeDirectory(destinationDirectory);
        const sourcePath = path.join(sourceRoot, "source.bin");
        const destinationPath = path.join(destinationDirectory, "destination.bin");
        const partialPath = `${destinationPath}.partial`;
        yield* fs.writeFileString(sourcePath, "source-bytes");
        yield* fs.writeFileString(destinationPath, "destination-bytes");
        yield* fs.writeFileString(partialPath, "partial");
        const sourceInfo = yield* fs.stat(sourcePath);
        const destinationInfo = yield* fs.stat(destinationPath);
        const object = {
          destinationRelativePath: "payload/source.bin",
          expectedInfo: RA.sourceIdentity(sourceInfo),
          expectedSizeBytes: Number(sourceInfo.size),
          objectId: "source-object",
          objectKind: "file" as const,
          sourceLabel: "tree",
          sourcePath,
          sourceRelativePath: "source.bin",
        };
        expect(yield* RA.inspectExpectedSourceFile(object, "source changed")).toEqual(sourceInfo);
        (yield* RA.inspectExpectedSourceFile(
          { ...object, expectedSizeBytes: object.expectedSizeBytes + 1 },
          "source changed"
        ).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);
        (yield* RA.inspectArchiveAttemptSource(
          { ...object, expectedSizeBytes: object.expectedSizeBytes + 1 },
          true
        ).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);

        const sourceRootInfo = yield* fs.stat(sourceRoot);
        (yield* RA.inspectExpectedSourceDirectory(
          {
            destinationRelativePath: "payload/tree",
            expectedInfo: { ...RA.sourceIdentity(sourceRootInfo), mode: Number(sourceRootInfo.mode) + 1 },
            objectId: "directory-object",
            sourceLabel: "tree",
            sourceRelativePath: ".",
          },
          sourceRoot
        ).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);
        const linkedDirectory = path.join(sourceRoot, "linked-directory");
        yield* fs.symlink(destinationDirectory, linkedDirectory);
        (yield* RA.inspectExpectedSourceDirectory(
          {
            destinationRelativePath: "payload/linked-directory",
            expectedInfo: RA.sourceIdentity(yield* fs.stat(destinationDirectory)),
            objectId: "linked-directory-object",
            sourceLabel: "tree",
            sourceRelativePath: "linked-directory",
          },
          sourceRoot
        ).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);

        const context = {
          attemptId: "attempt-1",
          chunkSize: 2,
          destinationDirectory,
          destinationPath,
          manifestPath: path.join(root, "manifest.jsonl"),
          object,
          partialPath,
          runId: "run-1",
        };
        const changingDestination = path.join(destinationDirectory, "changing-destination.bin");
        yield* fs.writeFileString(changingDestination, "source-bytes");
        expect(
          yield* RA.reconcileCompleteArchiveDestination(
            { ...context, destinationPath: changingDestination },
            sourceInfo
          ).pipe(
            Effect.provideService(FileSystem.FileSystem, {
              ...fs,
              stat: (filePath) =>
                fs
                  .stat(filePath)
                  .pipe(
                    Effect.map((info) => (filePath === sourcePath ? { ...info, size: Number(info.size) + 1 } : info))
                  ),
            })
          )
        ).toMatchObject({ _tag: "Some", value: { recordType: "archive-changed-during-copy" } });
        const mismatchedDestination = path.join(destinationDirectory, "mismatched-destination.bin");
        const mismatchedPartial = `${mismatchedDestination}.partial`;
        yield* fs.writeFileString(mismatchedDestination, "mismatched-bytes");
        yield* fs.writeFileString(mismatchedPartial, "retained-partial");
        assertNone(
          yield* RA.reconcileCompleteArchiveDestination(
            { ...context, destinationPath: mismatchedDestination, partialPath: mismatchedPartial },
            sourceInfo
          )
        );
        expect(yield* fs.exists(`${mismatchedPartial}.rejected-${context.attemptId}`)).toBe(true);
        yield* fs.remove(destinationPath);
        yield* fs.link(sourcePath, destinationPath);
        (yield* RA.reconcileCompleteArchiveDestination(context, sourceInfo).pipe(Effect.exit)).pipe(
          Exit.isFailure,
          assertTrue
        );
        yield* fs.remove(destinationPath);
        yield* fs.remove(partialPath);
        yield* fs.link(sourcePath, partialPath);
        (yield* RA.resumableArchiveOffset(context, sourceInfo).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);
        yield* fs.remove(partialPath);
        yield* fs.writeFileString(partialPath, "source-bytes-with-extra-data");
        expect(yield* RA.resumableArchiveOffset(context, sourceInfo)).toMatchObject({ resumeBytes: 0 });
        yield* fs.writeFileString(partialPath, "partial");

        const cleanPartialInfo = yield* fs.stat(partialPath);
        (yield* RA.validateOpenedArchiveCopy(
          { ...context, object: { ...object, expectedInfo: { ...object.expectedInfo, sizeBytes: 1 } } },
          { expectedInfo: O.none(), resumeBytes: 0 },
          sourceInfo,
          cleanPartialInfo
        ).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);
        (yield* RA.validateOpenedArchiveCopy(
          context,
          { expectedInfo: O.none(), resumeBytes: 0 },
          sourceInfo,
          yield* fs.stat(destinationDirectory)
        ).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);
        (yield* RA.validateOpenedArchiveCopy(
          context,
          { expectedInfo: O.some({ ...RA.sourceIdentity(cleanPartialInfo), sizeBytes: 1 }), resumeBytes: 0 },
          sourceInfo,
          cleanPartialInfo
        ).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);
        (yield* RA.validateOpenedArchiveCopy(
          context,
          { expectedInfo: O.none(), resumeBytes: 0 },
          sourceInfo,
          destinationInfo
        ).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);
        (yield* RA.validateOpenedArchiveCopy(
          { ...context, partialPath: sourcePath },
          { expectedInfo: O.none(), resumeBytes: 0 },
          sourceInfo,
          sourceInfo
        ).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);

        (yield* Effect.scoped(
          RA.hashResumedArchivePrefix(sourcePath, object.expectedSizeBytes + 1, 2, sha256.create())
        ).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);

        const options = preserveOptions(sourceRoot, sourcePath, root, path.join(root, "collector.jsonl"));
        const sourceStat = RA.sourceStat(sourceInfo);
        const copiedDigest = Sha256Hex.make("0".repeat(64));
        const promotedDestination = path.join(destinationDirectory, "promoted.bin");
        const promotedPartial = `${promotedDestination}.partial`;
        const promoteContext = {
          ...context,
          destinationPath: promotedDestination,
          partialPath: promotedPartial,
        };
        yield* fs.link(sourcePath, promotedPartial);
        (yield* RA.promoteAndVerifyArchiveCopy(promoteContext, options, sourceStat, sourceStat, copiedDigest, 0).pipe(
          Effect.exit
        )).pipe(Exit.isFailure, assertTrue);
        yield* fs.writeFileString(promotedPartial, "source-bytes");
        (yield* RA.promoteAndVerifyArchiveCopy(promoteContext, options, sourceStat, sourceStat, copiedDigest, 0).pipe(
          Effect.exit
        )).pipe(Exit.isFailure, assertTrue);
      })
    );
  });
});
