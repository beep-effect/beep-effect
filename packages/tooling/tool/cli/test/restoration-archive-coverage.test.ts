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
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as ByteSize from "effect/ByteSize";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const PosInt = S.Int.check(S.isGreaterThan(0, { message: "Expected a positive integer" }));

const corpusLayer = CorpusCommandServiceLive.pipe(
  Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))
);
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
  it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "10 seconds" })((it) => {
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
        const requireContainedPath1 = yield* RA.requireContainedPath(path, root, source, "outside", true);
        expect(requireContainedPath1).toBe(source);
        (yield* RA.requireContainedPath(path, root, root, "equal", false).pipe(Effect.exit)).pipe(
          Exit.isFailure,
          assertTrue
        );
        (yield* RA.requireContainedPath(path, root, path.dirname(root), "outside", true).pipe(Effect.exit)).pipe(
          Exit.isFailure,
          assertTrue
        );
        const prefixMatches2 = yield* RA.prefixMatches(source, equal, 0, 2);
        expect(prefixMatches2).toBe(true);
        const prefixMatches3 = yield* RA.prefixMatches(source, equal, 6, 2);
        expect(prefixMatches3).toBe(true);
        const prefixMatches4 = yield* RA.prefixMatches(source, different, 6, 2);
        expect(prefixMatches4).toBe(false);
        const prefixMatches5 = yield* RA.prefixMatches(source, short, 6, 2);
        expect(prefixMatches5).toBe(false);
        const maybeCrash6 = yield* RA.maybeCrash("none", "after-copy");
        expect(maybeCrash6).toBeUndefined();
        (yield* RA.maybeCrash("after-rename", "after-rename").pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);
      })
    );
  });

  it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "10 seconds" })((it) => {
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

        const reconcileCollectorRecord7 = yield* RA.reconcileCollectorRecord(
          CollectorManifestRecord.cases.error.make({
            reason: "unreadable",
            src: "C:\\source\\unreadable.bin",
            status: "error",
          }),
          sourceRoot,
          2
        );
        expect(reconcileCollectorRecord7).toEqual({ kind: "collector-error" });
        const reconcileCollectorRecord8 = yield* RA.reconcileCollectorRecord(
          CollectorManifestRecord.cases["excluded-secret"].make({
            src: "C:\\source\\secret.bin",
            status: "excluded-secret",
          }),
          sourceRoot,
          2
        );
        expect(reconcileCollectorRecord8).toEqual({ kind: "ignored" });
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
        const reconcileCollectorRecord9 = yield* RA.reconcileCollectorRecord(
          collectorRecord("missing.bin", 4),
          sourceRoot,
          2
        );
        expect(reconcileCollectorRecord9).toEqual({
          kind: "mutated",
          recordedSize: 4,
          relativePath: "missing.bin",
        });
        const presentPath = path.join(sourceRoot, "present.bin");
        yield* fs.writeFileString(presentPath, "data");
        const reconcileCollectorRecord10 = yield* RA.reconcileCollectorRecord(
          collectorRecord("present.bin", 4),
          sourceRoot,
          2
        );
        expect(reconcileCollectorRecord10).toEqual({
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

  it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "10 seconds" })((it) => {
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
        const unknownInode = { ...identity, inode: O.none<number>() };
        expect(RA.sameSourceIdentityExceptMtime(unknownInode, { ...unknownInode, mtimeMillis: 1 })).toBe(true);
        expect(RA.sameSourceIdentity(unknownInode, { ...unknownInode, mtimeMillis: identity.mtimeMillis + 1 })).toBe(
          false
        );
        expect(RA.sameSourceIdentityExceptMtime(unknownInode, { ...identity, inode: O.some(17) })).toBe(false);
        expect(RA.sameSourceIdentityExceptMtime({ ...identity, inode: O.some(17) }, unknownInode)).toBe(false);
        expect(RA.sameDeviceAndInode(unknownInode, unknownInode)).toBe(false);
        expect(RA.archiveInventorySignature([directory], [{ ...file, sourceRelativePath: "other.bin" }])).not.toBe(
          signature
        );

        const reapedCoordinationPath11 = yield* RA.reapedCoordinationPath("/tmp/claim");
        expect(reapedCoordinationPath11).toContain(".reaped-");
        const reapClaim = RA.writerReapClaimPath("/tmp/claim", "observed");
        expect(reapClaim).toContain(".reap-");
        expect(RA.writerReapClaimTombstonePath(reapClaim, "observed")).toContain(".claim.reap-");
      })
    );
  });

  it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "10 seconds" })((it) => {
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
          { ...inventory, signature: Sha256Hex.make(Str.repeat(64)("0")) }
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

  it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "10 seconds" })((it) => {
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
          Layer.provide(
            Layer.merge(
              Layer.mergeAll(NodeServices.layer, NodeCrypto.layer),
              Layer.succeed(FileSystem.FileSystem, lateFileSystem)
            )
          )
        );
        // Name the late-appearance refusal: without the late write the same row fails
        // earlier, on the present-row denominator, so a bare failure check proves nothing.
        const error = yield* preserveRestorationArchive(options).pipe(
          Effect.provideServiceEffect(
            CorpusCommandService,
            layer.pipe(Layer.fresh, Layer.build, Effect.map(Context.get(CorpusCommandService)))
          ),
          Effect.flip
        );
        expect(error.message).toContain(
          "Inherited collector present destinations are not a subset of preservation files"
        );
      })
    );
  });

  it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "10 seconds" })((it) => {
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
            Layer.provide(
              Layer.merge(
                Layer.mergeAll(NodeServices.layer, NodeCrypto.layer),
                Layer.succeed(FileSystem.FileSystem, racingFileSystem)
              )
            )
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
              layer.pipe(Layer.fresh, Layer.build, Effect.map(Context.get(CorpusCommandService)))
            ),
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

  it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "10 seconds" })((it) => {
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
                if (!Str.endsWith("source.bin.partial")(filePath)) return file;
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
          Layer.provide(
            Layer.merge(
              Layer.mergeAll(NodeServices.layer, NodeCrypto.layer),
              Layer.succeed(FileSystem.FileSystem, racingFileSystem)
            )
          )
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
            layer.pipe(Layer.fresh, Layer.build, Effect.map(Context.get(CorpusCommandService)))
          ),
          Effect.exit
        );
        expect(mutation).toBe(3);
        expect(outcome).toMatchObject({ _tag: "Failure" });
      })
    );
  });

  it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "10 seconds" })((it) => {
    it.effect(
      "reclaims dead writer generations and rejects ambiguous verification artifacts",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "restoration-coordination-coverage-" });
        const bootId = yield* RA.currentBootId();
        const procStart = yield* RA.processStartTime(process.pid);
        if (O.isNone(procStart)) {
          return yield* Effect.die("Expected the current process identity.");
        }
        const claimText = `${yield* RA.encodeRestorationWriterClaim({
          bootId,
          pid: process.pid,
          procStart: procStart.value,
          schemaVersion: "oppold-preservation-writer/v2",
          startedAt: "2026-08-30T00:00:00.000Z",
          token: "live-claim-token",
        })}\n`;
        const liveClaim = yield* RA.decodeObservedWriterClaim(claimText, "claim decode failed");
        const writerClaimOwnerIsAlive12 = yield* RA.writerClaimOwnerIsAlive(liveClaim);
        expect(writerClaimOwnerIsAlive12).toBe(true);
        const writerClaimOwnerIsAlive13 = yield* RA.writerClaimOwnerIsAlive({ ...liveClaim, bootId: "different-boot" });
        expect(writerClaimOwnerIsAlive13).toBe(false);
        const writerClaimOwnerIsAlive14 = yield* RA.writerClaimOwnerIsAlive({ ...liveClaim, pid: 2_147_483_647 });
        expect(writerClaimOwnerIsAlive14).toBe(false);

        const claimPath = path.join(root, "writer.claim");
        const tryWriteExclusiveCoordinationFile15 = yield* RA.tryWriteExclusiveCoordinationFile(claimPath, claimText);
        expect(tryWriteExclusiveCoordinationFile15).toBe(true);
        const tryWriteExclusiveCoordinationFile16 = yield* RA.tryWriteExclusiveCoordinationFile(claimPath, claimText);
        expect(tryWriteExclusiveCoordinationFile16).toBe(false);
        const readCanonicalCoordinationFile17 = yield* RA.readCanonicalCoordinationFile(claimPath);
        assertSome(readCanonicalCoordinationFile17, claimText);
        const moveObservedCoordinationFile18 = yield* RA.moveObservedCoordinationFile(claimPath, "wrong-generation");
        expect(moveObservedCoordinationFile18).toBe(false);
        const moveObservedCoordinationFile19 = yield* RA.moveObservedCoordinationFile(claimPath, claimText);
        expect(moveObservedCoordinationFile19).toBe(true);
        const readCanonicalCoordinationFile20 = yield* RA.readCanonicalCoordinationFile(claimPath);
        assertNone(readCanonicalCoordinationFile20);

        const deadText = `${yield* RA.encodeRestorationWriterClaim({
          ...liveClaim,
          bootId: "dead-boot",
          token: "dead-claim-token",
        })}\n`;
        yield* fs.writeFileString(claimPath, deadText);
        const tryClaimWriterReapClaim21 = yield* RA.tryClaimWriterReapClaim(claimPath, claimText);
        expect(tryClaimWriterReapClaim21).toBe(true);
        const moveObservedCoordinationFile22 = yield* RA.moveObservedCoordinationFile(claimPath, claimText);
        expect(moveObservedCoordinationFile22).toBe(true);
        yield* fs.writeFileString(claimPath, claimText);
        const tryClaimWriterReapClaim23 = yield* RA.tryClaimWriterReapClaim(claimPath, deadText);
        expect(tryClaimWriterReapClaim23).toBe(false);
        const moveObservedCoordinationFile24 = yield* RA.moveObservedCoordinationFile(claimPath, claimText);
        expect(moveObservedCoordinationFile24).toBe(true);

        const reapPath = path.join(root, "reap.claim");
        yield* fs.writeFileString(reapPath, deadText);
        const tombstonePath = RA.writerReapClaimTombstonePath(reapPath, deadText);
        yield* fs.writeFileString(tombstonePath, claimText);
        const tryRecoverObservedWriterReapClaim25 = yield* RA.tryRecoverObservedWriterReapClaim(
          reapPath,
          claimText,
          deadText
        );
        expect(tryRecoverObservedWriterReapClaim25).toBe(false);
        const moveObservedCoordinationFile26 = yield* RA.moveObservedCoordinationFile(tombstonePath, claimText);
        expect(moveObservedCoordinationFile26).toBe(true);
        yield* fs.writeFileString(tombstonePath, deadText);
        (yield* RA.tryRecoverObservedWriterReapClaim(reapPath, claimText, deadText).pipe(Effect.exit)).pipe(
          Exit.isFailure,
          assertTrue
        );
        const moveObservedCoordinationFile27 = yield* RA.moveObservedCoordinationFile(tombstonePath, deadText);
        expect(moveObservedCoordinationFile27).toBe(true);
        const moveObservedCoordinationFile28 = yield* RA.moveObservedCoordinationFile(reapPath, deadText);
        expect(moveObservedCoordinationFile28).toBe(true);
        yield* fs.writeFileString(reapPath, "changed-generation");
        const tryRecoverObservedWriterReapClaim29 = yield* RA.tryRecoverObservedWriterReapClaim(
          reapPath,
          claimText,
          deadText
        );
        expect(tryRecoverObservedWriterReapClaim29).toBe(false);
        const moveObservedCoordinationFile30 = yield* RA.moveObservedCoordinationFile(reapPath, "changed-generation");
        expect(moveObservedCoordinationFile30).toBe(true);

        const acquiredPath = path.join(root, "acquired.claim");
        const lease = { claimPath: acquiredPath, claimText };
        const acquireObservedRestorationWriterClaim31 = yield* RA.acquireObservedRestorationWriterClaim(lease);
        expect(acquireObservedRestorationWriterClaim31).toEqual(lease);
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
        if (reportName === undefined) {
          return yield* Effect.die("Expected a verification report.");
        }
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
        const validateArchiveTerminalIndex32 = yield* RA.validateArchiveTerminalIndex(root, [failure], preflight);
        expect(HashMap.size(validateArchiveTerminalIndex32)).toBe(1);
        RA.indexArchiveTerminals([failure, failure, failure]).duplicateObjectId.pipe(O.isSome, assertTrue);
      })
    );
  });

  it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "10 seconds" })((it) => {
    it.effect(
      "fails closed when live reclamation generations block stale claim replacement",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "restoration-coordination-contention-" });
        const bootId = yield* RA.currentBootId();
        const procStart = yield* RA.processStartTime(process.pid);
        if (O.isNone(procStart)) {
          return yield* Effect.die("Expected the current process identity.");
        }
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
        const pipe33 = yield* RA.moveObservedCoordinationFile(liveClaimPath, liveText).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            rename: () => fs.rename(path.join(root, "missing-source"), path.join(root, "missing-target")),
          })
        );
        expect(pipe33).toBe(false);
        (yield* RA.moveObservedCoordinationFile(liveClaimPath, liveText).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            rename: () => fs.rename(liveClaimPath, root),
          }),
          Effect.exit
        )).pipe(Exit.isFailure, assertTrue);

        const interruptedReapPath = path.join(root, "interrupted-reap.claim");
        yield* fs.writeFileString(interruptedReapPath, staleText);
        const pipe34 = yield* RA.tryRecoverObservedWriterReapClaim(interruptedReapPath, liveText, staleText).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            rename: () => fs.rename(path.join(root, "missing-source"), path.join(root, "missing-target")),
          })
        );
        expect(pipe34).toBe(false);

        const vanishedReapPath = path.join(root, "vanished-reap.claim");
        yield* fs.writeFileString(vanishedReapPath, staleText);
        const vanishedTombstonePath = RA.writerReapClaimTombstonePath(vanishedReapPath, staleText);
        yield* fs.writeFileString(vanishedTombstonePath, liveText);
        const pipe35 = yield* RA.tryRecoverObservedWriterReapClaim(vanishedReapPath, staleText, staleText).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            exists: (filePath) => (filePath === vanishedTombstonePath ? Effect.succeed(false) : fs.exists(filePath)),
          })
        );
        expect(pipe35).toBe(false);

        const vanishedObservedPath = path.join(root, "vanished-observed.claim");
        yield* fs.writeFileString(vanishedObservedPath, staleText);
        const pipe36 = yield* RA.tryClaimWriterReapClaim(vanishedObservedPath, liveText).pipe(
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            exists: (filePath) => (filePath === vanishedObservedPath ? Effect.succeed(false) : fs.exists(filePath)),
          })
        );
        expect(pipe36).toBe(false);

        const staleClaimPath = path.join(root, "stale.claim");
        yield* fs.writeFileString(staleClaimPath, staleText);
        const reapClaimPath = RA.writerReapClaimPath(staleClaimPath, staleText);
        yield* fs.writeFileString(reapClaimPath, liveText);
        const tryMoveObservedWriterClaim37 = yield* RA.tryMoveObservedWriterClaim(staleClaimPath, staleText, staleText);
        expect(tryMoveObservedWriterClaim37).toBe(false);
        const tryReplaceStaleWriterClaim38 = yield* RA.tryReplaceStaleWriterClaim(staleClaimPath, staleText, staleText);
        expect(tryReplaceStaleWriterClaim38).toBe(false);
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
        const prefixMatches39 = yield* RA.prefixMatches(emptySource, emptyPartial, 1, 2);
        expect(prefixMatches39).toBe(false);
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

  it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "10 seconds" })((it) => {
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
        const inspectExpectedSourceFile40 = yield* RA.inspectExpectedSourceFile(object, "source changed");
        expect(inspectExpectedSourceFile40).toEqual(sourceInfo);
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
        const stat41 = yield* fs.stat(destinationDirectory);
        (yield* RA.inspectExpectedSourceDirectory(
          {
            destinationRelativePath: "payload/linked-directory",
            expectedInfo: RA.sourceIdentity(stat41),
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
        const pipe42 = yield* RA.reconcileCompleteArchiveDestination(
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
        );
        expect(pipe42).toMatchObject({ _tag: "Some", value: { recordType: "archive-changed-during-copy" } });
        const mismatchedDestination = path.join(destinationDirectory, "mismatched-destination.bin");
        const mismatchedPartial = `${mismatchedDestination}.partial`;
        yield* fs.writeFileString(mismatchedDestination, "mismatched-bytes");
        yield* fs.writeFileString(mismatchedPartial, "retained-partial");
        const reconcileCompleteArchiveDestination43 = yield* RA.reconcileCompleteArchiveDestination(
          { ...context, destinationPath: mismatchedDestination, partialPath: mismatchedPartial },
          sourceInfo
        );
        assertNone(reconcileCompleteArchiveDestination43);
        const exists44 = yield* fs.exists(`${mismatchedPartial}.rejected-${context.attemptId}`);
        expect(exists44).toBe(true);
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
        const resumableArchiveOffset45 = yield* RA.resumableArchiveOffset(context, sourceInfo);
        expect(resumableArchiveOffset45).toMatchObject({ resumeBytes: 0 });
        yield* fs.writeFileString(partialPath, "partial");

        const cleanPartialInfo = yield* fs.stat(partialPath);
        (yield* RA.validateOpenedArchiveCopy(
          { ...context, object: { ...object, expectedInfo: { ...object.expectedInfo, sizeBytes: 1 } } },
          { expectedInfo: O.none(), resumeBytes: 0 },
          sourceInfo,
          cleanPartialInfo
        ).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);
        const argument = { expectedInfo: O.none(), resumeBytes: 0 };
        const stat1 = yield* fs.stat(destinationDirectory);
        (yield* RA.validateOpenedArchiveCopy(context, argument, sourceInfo, stat1).pipe(Effect.exit)).pipe(
          Exit.isFailure,
          assertTrue
        );
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

        (yield* RA.hashResumedArchivePrefix(
          sourcePath,
          object.expectedSizeBytes + 1,
          2,
          RA.createStreamingSha256()
        ).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);

        const options = preserveOptions(sourceRoot, sourcePath, root, path.join(root, "collector.jsonl"));
        const sourceStat = RA.sourceStat(sourceInfo);
        const copiedDigest = Sha256Hex.make(Str.repeat(64)("0"));
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

describe("streaming hasher", () => {
  it.effect("uses Bun's native CryptoHasher when the runtime exposes one", () =>
    Effect.sync(() => {
      const bun = Reflect.get(globalThis, "Bun");
      // Both lanes have a Bun global: the real runtime, or the Node shim in
      // vitest.setup.ts (which now provides a CryptoHasher). Swap in a fake and
      // restore whatever was there, so the native branch is always exercised.
      if (!P.isObject(bun)) return;
      const original = Reflect.get(bun, "CryptoHasher");
      const seen: Array<number> = [];
      class FakeCryptoHasher {
        update(chunk: Uint8Array): FakeCryptoHasher {
          seen.push(chunk.length);
          return this;
        }
        digest(_encoding: "hex"): string {
          return Str.repeat(32)("ab");
        }
      }
      Reflect.set(bun, "CryptoHasher", FakeCryptoHasher);
      try {
        const hasher = RA.createStreamingSha256();
        hasher.update(Uint8Array.of(1, 2, 3));
        expect(hasher.digestHex()).toBe(Str.repeat(32)("ab"));
        expect(seen).toEqual([3]);
      } finally {
        Reflect.set(bun, "CryptoHasher", original);
      }
    })
  );

  it.effect("falls back to the portable hasher when the runtime has no native CryptoHasher", () =>
    Effect.sync(() => {
      // Hide the native hasher unconditionally (both lanes now have one) and
      // restore it afterwards, so the portable branch is always exercised.
      const bun = Reflect.get(globalThis, "Bun");
      const original = P.isObject(bun) ? Reflect.get(bun, "CryptoHasher") : undefined;
      if (P.isObject(bun)) Reflect.set(bun, "CryptoHasher", undefined);
      try {
        const hasher = RA.createStreamingSha256();
        hasher.update(new TextEncoder().encode("abc"));
        expect(hasher.digestHex()).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
      } finally {
        if (P.isObject(bun)) Reflect.set(bun, "CryptoHasher", original);
      }
    })
  );
});
