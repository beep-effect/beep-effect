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
        expect(RA.sourceIdentityToken({ ...identity, inode: O.none() })).toContain("\u0000-1\u0000");
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
    "rejects unsupported inventories and contradictory denominators",
    Effect.fnUntraced(
      function* () {
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

        expect(
          yield* RA.collectArchiveInventory({ ...canonicalPaths, sourceRoot: sourceFile }).pipe(Effect.exit)
        ).toMatchObject({ _tag: "Failure" });
        const alias = path.join(sourceRoot, "alias.bin");
        yield* fs.symlink(rootArchive, alias);
        expect(yield* RA.collectArchiveInventory(canonicalPaths).pipe(Effect.exit)).toMatchObject({ _tag: "Failure" });
        yield* fs.remove(alias);
        expect(
          yield* RA.collectArchiveInventory({ ...canonicalPaths, rootArchivePath: sourceRoot }).pipe(Effect.exit)
        ).toMatchObject({ _tag: "Failure" });
        expect(
          yield* RA.collectArchiveInventory({ ...canonicalPaths, rootArchivePath: sourceFile }).pipe(Effect.exit)
        ).toMatchObject({ _tag: "Failure" });

        expect(yield* RA.requireInventoryDenominator("files", 1, 2).pipe(Effect.exit)).toMatchObject({
          _tag: "Failure",
        });
        expect(yield* RA.requireCollectorDenominator("rows", 1, 2).pipe(Effect.exit)).toMatchObject({
          _tag: "Failure",
        });
        expect(
          yield* RA.reconcileCollectorHistoricalIdentities([
            { kind: "present", recordedSize: 1, relativePath: "same.bin" },
            { kind: "mutated", recordedSize: 2, relativePath: "same.bin" },
          ]).pipe(Effect.exit)
        ).toMatchObject({ _tag: "Failure" });
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
        expect(yield* RA.readCanonicalCoordinationFile(claimPath)).toEqual(O.some(claimText));
        expect(yield* RA.moveObservedCoordinationFile(claimPath, "wrong-generation")).toBe(false);
        expect(yield* RA.moveObservedCoordinationFile(claimPath, claimText)).toBe(true);
        expect(yield* RA.readCanonicalCoordinationFile(claimPath)).toEqual(O.none());

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
        expect(
          yield* RA.tryRecoverObservedWriterReapClaim(reapPath, claimText, deadText).pipe(Effect.exit)
        ).toMatchObject({ _tag: "Failure" });
        expect(yield* RA.moveObservedCoordinationFile(tombstonePath, deadText)).toBe(true);
        expect(yield* RA.moveObservedCoordinationFile(reapPath, deadText)).toBe(true);
        yield* fs.writeFileString(reapPath, "changed-generation");
        expect(yield* RA.tryRecoverObservedWriterReapClaim(reapPath, claimText, deadText)).toBe(false);
        expect(yield* RA.moveObservedCoordinationFile(reapPath, "changed-generation")).toBe(true);

        const acquiredPath = path.join(root, "acquired.claim");
        const lease = { claimPath: acquiredPath, claimText };
        expect(yield* RA.acquireObservedRestorationWriterClaim(lease)).toEqual(lease);
        yield* RA.releaseArchiveWriterClaim(lease);
        expect(yield* RA.releaseArchiveWriterClaim(lease).pipe(Effect.exit)).toMatchObject({ _tag: "Failure" });

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

  it.effect(
    "rejects changed sources, aliased partials, and opened-copy identity drift",
    Effect.fnUntraced(
      function* () {
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
        const partialInfo = yield* fs.stat(partialPath);
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
        expect(
          yield* RA.inspectExpectedSourceFile(
            { ...object, expectedSizeBytes: object.expectedSizeBytes + 1 },
            "source changed"
          ).pipe(Effect.exit)
        ).toMatchObject({ _tag: "Failure" });
        expect(
          yield* RA.inspectArchiveAttemptSource(
            { ...object, expectedSizeBytes: object.expectedSizeBytes + 1 },
            true
          ).pipe(Effect.exit)
        ).toMatchObject({ _tag: "Failure" });

        const sourceRootInfo = yield* fs.stat(sourceRoot);
        expect(
          yield* RA.inspectExpectedSourceDirectory(
            {
              destinationRelativePath: "payload/tree",
              expectedInfo: { ...RA.sourceIdentity(sourceRootInfo), mode: Number(sourceRootInfo.mode) + 1 },
              objectId: "directory-object",
              sourceLabel: "tree",
              sourceRelativePath: ".",
            },
            sourceRoot
          ).pipe(Effect.exit)
        ).toMatchObject({ _tag: "Failure" });
        const linkedDirectory = path.join(sourceRoot, "linked-directory");
        yield* fs.symlink(destinationDirectory, linkedDirectory);
        expect(
          yield* RA.inspectExpectedSourceDirectory(
            {
              destinationRelativePath: "payload/linked-directory",
              expectedInfo: RA.sourceIdentity(yield* fs.stat(destinationDirectory)),
              objectId: "linked-directory-object",
              sourceLabel: "tree",
              sourceRelativePath: "linked-directory",
            },
            sourceRoot
          ).pipe(Effect.exit)
        ).toMatchObject({ _tag: "Failure" });

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
        yield* fs.remove(destinationPath);
        yield* fs.link(sourcePath, destinationPath);
        expect(yield* RA.reconcileCompleteArchiveDestination(context, sourceInfo).pipe(Effect.exit)).toMatchObject({
          _tag: "Failure",
        });
        yield* fs.remove(destinationPath);
        yield* fs.remove(partialPath);
        yield* fs.link(sourcePath, partialPath);
        expect(yield* RA.resumableArchiveOffset(context, sourceInfo).pipe(Effect.exit)).toMatchObject({
          _tag: "Failure",
        });
        yield* fs.remove(partialPath);
        yield* fs.writeFileString(partialPath, "source-bytes-with-extra-data");
        expect(yield* RA.resumableArchiveOffset(context, sourceInfo)).toMatchObject({ resumeBytes: 0 });
        yield* fs.writeFileString(partialPath, "partial");

        const cleanPartialInfo = yield* fs.stat(partialPath);
        expect(
          yield* RA.validateOpenedArchiveCopy(
            { ...context, object: { ...object, expectedInfo: { ...object.expectedInfo, sizeBytes: 1 } } },
            { expectedInfo: O.none(), resumeBytes: 0 },
            sourceInfo,
            cleanPartialInfo
          ).pipe(Effect.exit)
        ).toMatchObject({ _tag: "Failure" });
        expect(
          yield* RA.validateOpenedArchiveCopy(
            context,
            { expectedInfo: O.none(), resumeBytes: 0 },
            sourceInfo,
            yield* fs.stat(destinationDirectory)
          ).pipe(Effect.exit)
        ).toMatchObject({ _tag: "Failure" });
        expect(
          yield* RA.validateOpenedArchiveCopy(
            context,
            { expectedInfo: O.some({ ...RA.sourceIdentity(cleanPartialInfo), sizeBytes: 1 }), resumeBytes: 0 },
            sourceInfo,
            cleanPartialInfo
          ).pipe(Effect.exit)
        ).toMatchObject({ _tag: "Failure" });
        expect(
          yield* RA.validateOpenedArchiveCopy(
            context,
            { expectedInfo: O.none(), resumeBytes: 0 },
            sourceInfo,
            destinationInfo
          ).pipe(Effect.exit)
        ).toMatchObject({ _tag: "Failure" });
        expect(
          yield* RA.validateOpenedArchiveCopy(
            { ...context, partialPath: sourcePath },
            { expectedInfo: O.none(), resumeBytes: 0 },
            sourceInfo,
            sourceInfo
          ).pipe(Effect.exit)
        ).toMatchObject({ _tag: "Failure" });
      },
      Effect.scoped,
      provideTestLayer
    )
  );
});
