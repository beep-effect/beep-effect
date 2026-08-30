import { CollectorManifestRecord, RestorationPreserveOptions } from "@beep/repo-cli/commands/Corpus";
import { restorationArchiveTesting as RA } from "@beep/repo-cli/test/Corpus";
import { NonNegativeInt, PosInt } from "@beep/schema";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, HashMap, Path } from "effect";
import * as O from "effect/Option";

const provideTestLayer = provideScopedLayer(NodeServices.layer);

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
    collectorDestinationPrefixSegments: NonNegativeInt.make(2),
    corpusRoot,
    crashPoint: "none",
    expectedCollectorCopiedCount: NonNegativeInt.make(0),
    expectedCollectorErrorCount: NonNegativeInt.make(0),
    expectedCollectorExcludedSecretCount: NonNegativeInt.make(0),
    expectedCollectorPresentSuccessfulRowCount: NonNegativeInt.make(0),
    expectedCollectorResumedCount: NonNegativeInt.make(0),
    expectedCollectorRowCount: NonNegativeInt.make(0),
    expectedCollectorUniqueSuccessfulDestinationCount: NonNegativeInt.make(0),
    expectedMissingRecyclePayloadCount: NonNegativeInt.make(0),
    expectedMutatedDestinationCount: NonNegativeInt.make(0),
    expectedRootArchiveBytes: NonNegativeInt.make(0),
    expectedSourceDirectoryCount: NonNegativeInt.make(0),
    expectedSourceFileCount: NonNegativeInt.make(0),
    expectedSourceTreeBytes: NonNegativeInt.make(0),
    minimumFreeAfterBytes: NonNegativeInt.make(0),
    rootArchivePath,
    runLabel: "archive-boundary-test",
    sourceManifestPath,
    sourceRoot,
  });

describe("restoration archive boundary helpers", () => {
  it.effect(
    "fails closed for canonical type, containment, crash, and prefix mismatches",
    Effect.fnUntraced(
      function* () {
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

        expect(
          yield* RA.inspectCanonicalPath(source, "File", "wrong type", "symbolic link").pipe(Effect.exit)
        ).toMatchObject({ _tag: "Success" });
        expect(
          yield* RA.inspectCanonicalPath(source, "Directory", "wrong type", "symbolic link").pipe(Effect.exit)
        ).toMatchObject({ _tag: "Failure" });
        expect(yield* RA.requireContainedPath(path, root, source, "outside", true)).toBe(source);
        expect(yield* RA.requireContainedPath(path, root, root, "equal", false).pipe(Effect.exit)).toMatchObject({
          _tag: "Failure",
        });
        expect(
          yield* RA.requireContainedPath(path, root, path.dirname(root), "outside", true).pipe(Effect.exit)
        ).toMatchObject({ _tag: "Failure" });
        expect(yield* RA.prefixMatches(source, equal, 0, 2)).toBe(true);
        expect(yield* RA.prefixMatches(source, equal, 6, 2)).toBe(true);
        expect(yield* RA.prefixMatches(source, different, 6, 2)).toBe(false);
        expect(yield* RA.prefixMatches(source, short, 6, 2)).toBe(false);
        expect(yield* RA.maybeCrash("none", "after-copy")).toBeUndefined();
        expect(yield* RA.maybeCrash("after-rename", "after-rename").pipe(Effect.exit)).toMatchObject({
          _tag: "Failure",
        });
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "rejects overlapping canonical inputs and invalid collector destinations",
    Effect.fnUntraced(
      function* () {
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

        expect(
          yield* RA.validateCanonicalArchivePaths(preserveOptions(sourceRoot, rootArchive, corpusRoot, manifest)).pipe(
            Effect.exit
          )
        ).toMatchObject({ _tag: "Failure" });

        const separateArchive = path.join(root, "separate.zip");
        yield* fs.writeFileString(separateArchive, "archive");
        expect(
          yield* RA.validateCanonicalArchivePaths(
            preserveOptions(sourceRoot, separateArchive, sourceRoot, manifest)
          ).pipe(Effect.exit)
        ).toMatchObject({ _tag: "Failure" });

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
        expect(
          yield* RA.reconcileCollectorRecord(
            CollectorManifestRecord.cases.copied.make({
              dst: "C:\\root",
              size: NonNegativeInt.make(0),
              src: "C:\\source\\bad.bin",
              status: "copied",
            }),
            sourceRoot,
            2
          ).pipe(Effect.exit)
        ).toMatchObject({ _tag: "Failure" });

        const collectorRecord = (name: string, size: number) =>
          CollectorManifestRecord.cases.copied.make({
            dst: `C:\\root\\${name}`,
            size: NonNegativeInt.make(size),
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
        expect(
          yield* RA.reconcileCollectorRecord(collectorRecord("present.bin", 5), sourceRoot, 2).pipe(Effect.exit)
        ).toMatchObject({ _tag: "Failure" });
        const directoryPath = path.join(sourceRoot, "directory");
        yield* fs.makeDirectory(directoryPath);
        expect(
          yield* RA.reconcileCollectorRecord(collectorRecord("directory", 0), sourceRoot, 2).pipe(Effect.exit)
        ).toMatchObject({ _tag: "Failure" });
        const outside = path.join(root, "outside.bin");
        const symlink = path.join(sourceRoot, "symlink.bin");
        yield* fs.writeFileString(outside, "data");
        yield* fs.symlink(outside, symlink);
        expect(
          yield* RA.reconcileCollectorRecord(collectorRecord("symlink.bin", 4), sourceRoot, 2).pipe(Effect.exit)
        ).toMatchObject({ _tag: "Failure" });
        const availableBytes = yield* RA.availableRestorationBytesAt(root);
        expect(availableBytes).toBeGreaterThan(0);
        expect(yield* RA.availableRestorationBytesAt(path.join(root, "missing")).pipe(Effect.exit)).toMatchObject({
          _tag: "Failure",
        });
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "derives stable inventory and writer-coordination identities",
    Effect.fnUntraced(
      function* () {
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
        expect(RA.archiveInventorySignature([directory], [{ ...file, sourceRelativePath: "other.bin" }])).not.toBe(
          signature
        );

        expect(RA.reapedCoordinationPath("/tmp/claim")).toContain(".reaped-");
        const reapClaim = RA.writerReapClaimPath("/tmp/claim", "observed");
        expect(reapClaim).toContain(".reap-");
        expect(RA.writerReapClaimTombstonePath(reapClaim, "observed")).toContain(".claim.reap-");
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "reclaims dead writer generations and rejects ambiguous verification artifacts",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "restoration-coordination-coverage-" });
        const bootId = yield* RA.currentBootId();
        const procStart = yield* RA.processStartTime(process.pid);
        if (O.isNone(procStart)) return yield* Effect.die("Expected the current process identity.");
        const claimText = `${JSON.stringify({
          bootId,
          pid: process.pid,
          procStart: procStart.value,
          schemaVersion: "oppold-preservation-writer/v2",
          startedAt: new Date().toISOString(),
          token: "live-claim-token",
        })}\n`;
        const liveClaim = yield* RA.decodeObservedWriterClaim(claimText, "claim decode failed");
        expect(yield* RA.writerClaimOwnerIsAlive(liveClaim)).toBe(true);
        expect(yield* RA.writerClaimOwnerIsAlive({ ...liveClaim, bootId: "different-boot" })).toBe(false);
        expect(yield* RA.writerClaimOwnerIsAlive({ ...liveClaim, pid: 2_147_483_647 })).toBe(false);

        const claimPath = path.join(root, "writer.claim");
        expect(yield* RA.tryWriteExclusiveCoordinationFile(claimPath, claimText)).toBe(true);
        expect(yield* RA.tryWriteExclusiveCoordinationFile(claimPath, claimText)).toBe(false);
        expect(yield* RA.readCanonicalCoordinationFile(claimPath)).toEqual(O.some(claimText));
        expect(yield* RA.moveObservedCoordinationFile(claimPath, "wrong-generation")).toBe(false);
        expect(yield* RA.moveObservedCoordinationFile(claimPath, claimText)).toBe(true);
        expect(yield* RA.readCanonicalCoordinationFile(claimPath)).toEqual(O.none());

        const deadText = `${JSON.stringify({ ...liveClaim, bootId: "dead-boot", token: "dead-claim-token" })}\n`;
        yield* fs.writeFileString(claimPath, deadText);
        expect(yield* RA.tryClaimWriterReapClaim(claimPath, claimText)).toBe(true);
        expect(yield* RA.moveObservedCoordinationFile(claimPath, claimText)).toBe(true);

        const acquiredPath = path.join(root, "acquired.claim");
        const lease = { claimPath: acquiredPath, claimText };
        expect(yield* RA.acquireObservedRestorationWriterClaim(lease)).toEqual(lease);
        yield* RA.releaseArchiveWriterClaim(lease);

        const validationRoot = path.join(root, "validation-root");
        yield* fs.makeDirectory(validationRoot);
        expect(yield* RA.validateArchiveManifestSeal(validationRoot, [], []).pipe(Effect.exit)).toMatchObject({
          _tag: "Failure",
        });
        expect(
          yield* RA.validateArchiveManifestSeal(validationRoot, ["synthetic-line"], []).pipe(Effect.exit)
        ).toMatchObject({ _tag: "Failure" });

        const reportRoot = path.join(root, "report-root");
        yield* fs.makeDirectory(reportRoot);
        yield* RA.persistVerificationReport(reportRoot, []);
        yield* RA.persistVerificationReport(reportRoot, []);
        const reportDirectory = path.join(reportRoot, "verification");
        const reportName = (yield* fs.readDirectory(reportDirectory))[0];
        if (reportName === undefined) return yield* Effect.die("Expected a verification report.");
        const reportPath = path.join(reportDirectory, reportName);
        yield* fs.writeFileString(reportPath, "drift");
        expect(yield* RA.persistVerificationReport(reportRoot, []).pipe(Effect.exit)).toMatchObject({
          _tag: "Failure",
        });
        yield* fs.writeFileString(reportPath, "");
        yield* fs.rename(reportPath, `${reportPath}.partial`);
        yield* RA.persistVerificationReport(reportRoot, []);
        yield* fs.rename(reportPath, `${reportPath}.partial`);
        yield* fs.writeFileString(`${reportPath}.partial`, "drift");
        expect(yield* RA.persistVerificationReport(reportRoot, []).pipe(Effect.exit)).toMatchObject({
          _tag: "Failure",
        });

        const payloadRoot = path.join(root, "payload-root");
        yield* fs.makeDirectory(path.join(payloadRoot, "payload"), { recursive: true });
        yield* RA.requireArchivePayloadOwned(payloadRoot, HashMap.empty());
        const outside = path.join(root, "outside-payload.bin");
        yield* fs.writeFileString(outside, "outside");
        yield* fs.symlink(outside, path.join(payloadRoot, "payload", "alias.bin"));
        expect(yield* RA.requireArchivePayloadOwned(payloadRoot, HashMap.empty()).pipe(Effect.exit)).toMatchObject({
          _tag: "Failure",
        });
      },
      Effect.scoped,
      provideTestLayer
    )
  );
});
