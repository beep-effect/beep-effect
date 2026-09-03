import { ArtifactId, ArtifactReference, ContentDigest, OperationId } from "@beep/file-processing/Artifact";
import { ArchiveExportResult } from "@beep/file-processing/Extraction";
import { FileProcessingOperationError } from "@beep/file-processing/Operation";
import {
  ArchiveLedgerRecord,
  CollectorManifestRecord,
  CorpusCommandServiceLive,
  decodeTransformationLedgerRecordJson,
  encodeArchiveLedgerRecordJson,
  encodeRestorationAcceptanceRecordJson,
  encodeTransformationLedgerRecordJson,
  preserveRestorationArchive,
  RestorationAcceptanceRecord,
  RestorationLegacyWordOptions,
  RestorationMailOptions,
  RestorationPreserveOptions,
  RestorationRecycleOptions,
  reconcileRestorationAcceptance,
  restoreLegacyWord,
  restoreMail,
  restoreRecycle,
  TransformationLedgerRecord,
} from "@beep/repo-cli/commands/Corpus";
import { restorationTransformationTesting as RT } from "@beep/repo-cli/test/Corpus";
import { NonNegativeInt, PosInt, PosixPath, Sha256Hex } from "@beep/schema";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { DateTime, Effect, FileSystem, Layer, MutableHashMap, MutableHashSet, Path } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const sha = RT.digestString;
const identity = {
  preservationRunId: "preservation-1",
  preservationSealSha256: sha("seal"),
  recordedAt: "2026-08-30T00:00:00.000Z",
  runLabel: "run-1",
  schemaVersion: "oppold-corpus-restoration/v1" as const,
  transformationRunId: "transformation-1",
};
const context = {
  archiveRoot: "/archive",
  corpusRoot: "/corpus",
  family: "legacy-word" as const,
  ledgerPath: "/corpus/ledger.jsonl",
  mailScope: O.none<"full" | "slice">(),
  outputRoot: "/corpus/output",
  preservationRecords: [],
  preservationRunId: identity.preservationRunId,
  preservationSealSha256: identity.preservationSealSha256,
  runLabel: identity.runLabel,
  runRoot: "/corpus/run",
  startedAt: 0,
  transformationRunId: identity.transformationRunId,
};
const legacyOptions = RestorationLegacyWordOptions.make({
  comparePath: "compare",
  converterPath: "soffice",
  corpusRoot: "/corpus",
  expectedConverterVersion: "LibreOffice test",
  expectedOccurrenceCount: NonNegativeInt.make(0),
  maxElapsedMillis: PosInt.make(100),
  maxTotalElapsedMillis: PosInt.make(100),
  maxTotalOutputBytes: PosInt.make(100),
  maxVisualRmse: 0.2,
  pdfinfoPath: "pdfinfo",
  pdftoppmPath: "pdftoppm",
  tikaJarPath: "/tika.jar",
});
const legacyBudget = { attemptStartedAt: 0, context, familyStartedAt: 0 };
const archivedFile = (objectId: string, sourceRelativePath: string, sizeBytes = 2) =>
  ArchiveLedgerRecord.cases["archive-file-pass"].make({
    attemptId: `attempt-${objectId}`,
    destinationRelativePath: `payload/tree/${sourceRelativePath}`,
    objectId,
    objectKind: "file",
    postCopySource: { mtimeMillis: NonNegativeInt.make(1), sizeBytes: NonNegativeInt.make(sizeBytes) },
    preCopySource: { mtimeMillis: NonNegativeInt.make(1), sizeBytes: NonNegativeInt.make(sizeBytes) },
    recordedAt: "2026-08-30T00:00:00.000Z",
    recordType: "archive-file-pass",
    resumedBytes: NonNegativeInt.make(0),
    runId: "run-1",
    schemaVersion: "oppold-corpus-restoration/v1",
    sha256: sha(objectId),
    sizeBytes: NonNegativeInt.make(sizeBytes),
    sourceLabel: "tree",
    sourceRelativePath,
  });

const recycleMetadataV2 = (originalPath: string, sizeBytes: bigint): Uint8Array => {
  const bytes = new Uint8Array(28 + (originalPath.length + 1) * 2);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, 2n, true);
  view.setBigUint64(8, sizeBytes, true);
  view.setBigUint64(16, 132_223_104_000_000_000n, true);
  view.setUint32(24, originalPath.length + 1, true);
  Array.from(originalPath).forEach((char, index) => {
    view.setUint16(28 + index * 2, char.charCodeAt(0), true);
  });
  return bytes;
};

const familyRunStart = (
  family: "legacy-word" | "mail" | "recycle",
  expectedCount: number,
  maxTotalElapsedMillis = 100,
  maxTotalOutputBytes = 100
) =>
  TransformationLedgerRecord.cases["family-run-start"].make({
    ...identity,
    expectedCount: NonNegativeInt.make(expectedCount),
    family,
    ...(family === "mail" ? { mailScope: "full" as const } : {}),
    maxTotalElapsedMillis: PosInt.make(maxTotalElapsedMillis),
    maxTotalOutputBytes: PosInt.make(maxTotalOutputBytes),
    policySha256: sha(`policy-${family}`),
    recordType: "family-run-start",
  });

const familyAttemptStart = (family: "legacy-word" | "mail" | "recycle", sourceId: string, sourceSha256: Sha256Hex) =>
  TransformationLedgerRecord.cases["family-attempt-start"].make({
    ...identity,
    attemptId: RT.familyAttemptId(family, sourceId, 0),
    family,
    inputBytes: NonNegativeInt.make(3),
    ...(family === "mail" ? { mailScope: "full" as const } : {}),
    recordType: "family-attempt-start",
    retryOrdinal: NonNegativeInt.make(0),
    sourceId,
    sourceSha256,
  });

const familySummary = (
  family: "legacy-word" | "mail" | "recycle",
  passCount: number,
  exceptionCount: number,
  sourceCount: number,
  unapprovedCount = 0
) =>
  TransformationLedgerRecord.cases["family-run-summary"].make({
    ...identity,
    elapsedMillis: NonNegativeInt.make(1),
    exceptionCount: NonNegativeInt.make(exceptionCount),
    family,
    inputBytes: NonNegativeInt.make(3),
    ...(family === "mail" ? { mailScope: "full" as const } : {}),
    maxTotalElapsedMillis: PosInt.make(100),
    maxTotalOutputBytes: PosInt.make(100),
    outputBytes: NonNegativeInt.make(3),
    outputTreeSha256: sha(`output-${family}`),
    passCount: NonNegativeInt.make(passCount),
    recordType: "family-run-summary",
    sourceCount: NonNegativeInt.make(sourceCount),
    unapprovedCount: NonNegativeInt.make(unapprovedCount),
  });

const testLayer = Layer.mergeAll(
  CorpusCommandServiceLive.pipe(Layer.provideMerge(NodeServices.layer)),
  NodeServices.layer
);

layer(testLayer, { timeout: 30_000 })("restoration transformation semantic helpers", (it) => {
  it("classifies bounded mail failures and attachment signatures", () => {
    expect(RT.classifyMailFailure("PASSWORD protected")).toBe("password");
    expect(RT.classifyMailFailure("encrypted store")).toBe("password");
    expect(RT.classifyMailFailure("unknown codepage")).toBe("codepage");
    expect(RT.classifyMailFailure("bad code page")).toBe("codepage");
    expect(RT.classifyMailFailure("corrupt data")).toBe("corrupt");
    expect(RT.classifyMailFailure("invalid header")).toBe("corrupt");
    expect(RT.classifyMailFailure("I/O failed")).toBe("engine-failure");
    expect(RT.classifyMailError("password required")).toBe("password");
    expect(RT.classifyMailError({ unexpected: true })).toBe("engine-failure");
    expect(
      RT.classifyMailError(
        FileProcessingOperationError.fromReason("archive-export-failed", {
          details: { processClassification: "codepage" },
          message: "driver failed",
        })
      )
    ).toBe("codepage");
    expect(
      RT.classifyMailError(
        FileProcessingOperationError.fromReason("archive-export-failed", {
          details: { processClassification: "unknown" },
          message: "corrupt payload",
        })
      )
    ).toBe("corrupt");
    expect(
      RT.classifyMailError(
        FileProcessingOperationError.fromReason("archive-export-failed", { message: "encrypted payload" })
      )
    ).toBe("password");

    expect(O.getOrUndefined(RT.signatureExtension(Uint8Array.of(0x25, 0x50, 0x44, 0x46)))).toBe("pdf");
    expect(O.getOrUndefined(RT.signatureExtension(Uint8Array.of(0x89, 0x50, 0x4e, 0x47)))).toBe("png");
    expect(O.getOrUndefined(RT.signatureExtension(Uint8Array.of(0xff, 0xd8, 0xff)))).toBe("jpg");
    expect(O.getOrUndefined(RT.signatureExtension(Uint8Array.of(0x47, 0x49, 0x46, 0x38)))).toBe("gif");
    expect(O.getOrUndefined(RT.signatureExtension(Uint8Array.of(0x50, 0x4b, 0x03, 0x04)))).toBe("zip");
    expect(O.isNone(RT.signatureExtension(Uint8Array.of(0x00)))).toBe(true);
  });

  it.effect("normalizes paths, allocates collisions, and binds sandbox tools", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      expect(RT.sourceExtension(path, "MAIL.PST")).toBe("pst");
      expect(O.getOrUndefined(RT.residueRootFor("a/folder.export/child/msg"))).toBe("a/folder.export");
      expect(O.getOrUndefined(RT.residueRootFor("a\\folder.orphans\\child"))).toBe("a/folder.orphans");
      expect(O.isNone(RT.residueRootFor("ordinary/file"))).toBe(true);
      expect(RT.safeRestoredPath(path, "C:\\bad<name>\\file. ")).toBe("bad_name_/file");
      expect(RT.safeRestoredPath(path, "")).toBe("_");
      expect(RT.safeRestoredPath(path, "x".repeat(200))).toContain("__");
      expect(RT.safeRestoredPath(path, Array.from({ length: 33 }, (_, index) => `s${index}`).join("/"))).toContain(
        "_long-path"
      );

      const used = MutableHashMap.empty<string, string>();
      const first = RT.collisionAllocatedPath(path, "mail/file.msg", "one", used);
      MutableHashMap.set(used, first.toLocaleLowerCase("en-US"), "occupied");
      expect(RT.collisionAllocatedPath(path, "mail/file.msg", "one", used)).not.toBe(first);

      expect(RT.sandboxedTool(path, "pffexport", "pff")).toEqual({ bindArgs: [], executable: "pffexport" });
      expect(RT.sandboxedTool(path, "/usr/bin/tool", "tool")).toEqual({ bindArgs: [], executable: "/usr/bin/tool" });
      expect(RT.sandboxedTool(path, "/opt/custom/tool", "custom")).toEqual({
        bindArgs: ["--dir", "/tool", "--ro-bind", "/opt/custom/tool", "/tool/custom"],
        executable: "/tool/custom",
      });
      expect(RT.sandboxBaseArgs(["--ro-bind", "/usr", "/usr"])).toContain("--clearenv");
      expect(RT.mailAttemptRelativeRoots(path, "attempt-1")).toEqual([
        "attempts/attempt-1.partial",
        "attempts/attempt-1",
      ]);
      expect(RT.relativePathIsUnder(path, "a/b/c", ["a/b"])).toBe(true);
      expect(RT.relativePathIsUnder(path, "a/bad", ["a/b"])).toBe(false);
    })
  );

  it("accounts counters, digests, parser results, and fidelity ceilings", () => {
    const empty = RT.emptyFamilyCounters();
    expect(empty).toEqual({ exceptionCount: 0, inputBytes: 0, outputBytes: 0, passCount: 0, unapprovedCount: 0 });
    expect(RT.addFamilyTerminal(empty, { inputBytes: 5, outputBytes: 7, passed: true, unapproved: false })).toEqual({
      exceptionCount: 0,
      inputBytes: 5,
      outputBytes: 7,
      passCount: 1,
      unapprovedCount: 0,
    });
    expect(RT.addFamilyTerminal(empty, { inputBytes: 1, outputBytes: 2, passed: false, unapproved: true })).toEqual({
      exceptionCount: 1,
      inputBytes: 1,
      outputBytes: 2,
      passCount: 0,
      unapprovedCount: 1,
    });
    expect(RT.nonNegative(-2.9)).toBe(0);
    expect(RT.nonNegative(2.9)).toBe(2);
    expect(RT.quarantineDisposition()).toEqual({ disposition: "quarantine" });
    expect(RT.transformationPolicySha256(["a", 2])).toBe(sha("a\u00002"));
    expect(RT.transformationLinesSha256(["a", "b"])).toBe(sha("a\nb\n"));
    expect(RT.transformationLinesSha256([])).toBe(sha(""));

    const partial = { sha256: sha("partial"), sizeBytes: 4 };
    const final = { sha256: sha("final"), sizeBytes: 6 };
    expect(RT.combineMailAttemptOutputDigests(partial, final)).toEqual({
      sha256: sha(`partial\u0000${partial.sha256}\u00004\nfinal\u0000${final.sha256}\u00006\n`),
      sizeBytes: 10,
    });
    expect(RT.emptyMailAttemptOutputDigest().sizeBytes).toBe(0);
    expect(O.getOrUndefined(RT.parseNormalizedRmse("123 (0.125)"))).toBe(0.125);
    expect(O.isNone(RT.parseNormalizedRmse("missing"))).toBe(true);
    expect(O.isNone(RT.parseNormalizedRmse(`(${"9".repeat(400)})`))).toBe(true);
    expect(RT.isCompoundFileBinary(Uint8Array.of(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1))).toBe(true);
    expect(RT.isCompoundFileBinary(Uint8Array.of(0xd0))).toBe(false);
    expect(
      RT.legacyFidelityPasses(
        { convertedPath: "/x", normalizedTextSha256: sha("x"), pageCountDelta: 0, visualRmse: 0.1 },
        100,
        legacyOptions
      )
    ).toBe(true);
    expect(
      RT.legacyFidelityPasses(
        { convertedPath: "/x", normalizedTextSha256: sha("x"), pageCountDelta: 1, visualRmse: 0 },
        0,
        legacyOptions
      )
    ).toBe(false);
  });

  it.effect("walks, measures, and hashes absent, file, and directory transformation trees", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "transformation-helpers-" });
      const absent = path.join(root, "absent");
      expect(yield* RT.measureTransformationTreeBytes(absent)).toBe(0);
      expect((yield* RT.hashTransformationTree(absent)).sizeBytes).toBe(0);

      const file = path.join(root, "single.bin");
      yield* fs.writeFileString(file, "abc");
      expect(yield* RT.measureTransformationTreeBytes(file)).toBe(3);
      expect((yield* RT.hashTransformationTree(file)).sizeBytes).toBe(3);

      const tree = path.join(root, "tree");
      yield* fs.makeDirectory(path.join(tree, "nested"), { recursive: true });
      yield* fs.writeFileString(path.join(tree, "a.txt"), "a");
      yield* fs.writeFileString(path.join(tree, "nested", "b.txt"), "bb");
      expect(yield* RT.measureTransformationTreeBytes(tree)).toBe(3);
      expect((yield* RT.walkFiles(tree)).map((entry) => entry.relativePath)).toEqual(["a.txt", "nested/b.txt"]);
      expect((yield* RT.walkTransformationEntries(tree)).map((entry) => entry.kind)).toEqual([
        "file",
        "directory",
        "file",
      ]);
      expect((yield* RT.hashTransformationTree(tree)).sizeBytes).toBe(3);
    })
  );

  it.effect("copies recycle files and directory trees exclusively with immutable digest checks", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "recycle-copy-" });
      const outputRoot = path.join(root, "output");
      yield* fs.makeDirectory(outputRoot, { recursive: true });
      const source = path.join(root, "source.txt");
      yield* fs.writeFileString(source, "recycle");
      const sourceDigest = sha("recycle");

      expect((yield* RT.hashRecycleContent(source)).sizeBytes).toBe(7);
      const direct = path.join(outputRoot, "direct.txt");
      yield* RT.exclusiveCopyFile(source, direct, outputRoot);
      expect(yield* fs.readFileString(direct)).toBe("recycle");
      expect(O.isNone(yield* RT.exclusiveCopyFile(source, direct, outputRoot).pipe(Effect.option))).toBe(true);

      const promoted = path.join(outputRoot, "promoted.txt");
      expect(yield* RT.copyRecycleContent(outputRoot, source, promoted, sourceDigest)).toBe(7);
      expect(yield* RT.copyRecycleContent(outputRoot, source, promoted, sourceDigest)).toBe(0);
      expect(
        O.isNone(yield* RT.copyRecycleContent(outputRoot, source, promoted, sha("wrong")).pipe(Effect.option))
      ).toBe(true);

      const partialDestination = path.join(outputRoot, "partial.txt");
      yield* fs.writeFileString(`${partialDestination}.partial`, "retained");
      expect(
        O.isNone(yield* RT.copyRecycleContent(outputRoot, source, partialDestination, sourceDigest).pipe(Effect.option))
      ).toBe(true);

      const wrongDigestDestination = path.join(outputRoot, "wrong-digest.txt");
      const wrongDigestError = yield* RT.copyRecycleContent(
        outputRoot,
        source,
        wrongDigestDestination,
        sha("wrong")
      ).pipe(Effect.flip);
      expect(wrongDigestError.message).toContain("copy digest does not match");

      const appearedDestination = path.join(outputRoot, "appeared.txt");
      let appearedChecks = 0;
      const appearingFileSystem: FileSystem.FileSystem = {
        ...fs,
        exists: (filePath) =>
          filePath === appearedDestination ? Effect.succeed((appearedChecks += 1) > 1) : fs.exists(filePath),
      };
      const appearedError = yield* RT.copyRecycleContent(outputRoot, source, appearedDestination, sourceDigest).pipe(
        Effect.provideService(FileSystem.FileSystem, appearingFileSystem),
        Effect.flip
      );
      expect(appearedError.message).toContain("destination appeared during staged copy");

      const identityDestination = path.join(outputRoot, "identity-race.txt");
      const identityFileSystem: FileSystem.FileSystem = {
        ...fs,
        stat: (filePath) =>
          fs
            .stat(filePath)
            .pipe(
              Effect.map((info) =>
                filePath === identityDestination ? { ...info, ino: O.map(info.ino, (inode) => inode + 1) } : info
              )
            ),
      };
      const identityError = yield* RT.exclusiveCopyFile(source, identityDestination, outputRoot).pipe(
        Effect.provideService(FileSystem.FileSystem, identityFileSystem),
        Effect.flip
      );
      expect(identityError.message).toContain("destination identity changed before first write");

      const sourceDirectory = path.join(root, "source-directory");
      yield* fs.makeDirectory(path.join(sourceDirectory, "nested"), { recursive: true });
      yield* fs.writeFileString(path.join(sourceDirectory, "a.txt"), "a");
      yield* fs.writeFileString(path.join(sourceDirectory, "nested/b.txt"), "bb");
      const directoryDigest = yield* RT.hashRecycleContent(sourceDirectory);
      const directoryDestination = path.join(outputRoot, "directory");
      expect(
        yield* RT.copyRecycleContent(outputRoot, sourceDirectory, directoryDestination, directoryDigest.sha256)
      ).toBe(3);
      expect((yield* RT.hashRecycleContent(directoryDestination)).sha256).toBe(directoryDigest.sha256);

      const fifo = path.join(root, "unsupported.fifo");
      expect((yield* RT.runLegacyStep("mkfifo", [fifo], 2_000)).exitCode).toBe(0);
      expect(O.isNone(yield* RT.hashRecycleContent(fifo).pipe(Effect.option))).toBe(true);
      const unsupportedDirectory = path.join(root, "unsupported-directory");
      const unsupportedDestination = path.join(outputRoot, "unsupported-directory");
      yield* fs.makeDirectory(unsupportedDirectory);
      expect((yield* RT.runLegacyStep("mkfifo", [path.join(unsupportedDirectory, "fifo")], 2_000)).exitCode).toBe(0);
      expect(
        O.isNone(
          yield* RT.exclusiveCopyDirectory(unsupportedDirectory, unsupportedDestination, outputRoot).pipe(Effect.option)
        )
      ).toBe(true);
    })
  );

  it.effect("denies recycle copies that exceed elapsed, output, or free-space ceilings", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "recycle-capacity-" });
      const options = RestorationRecycleOptions.make({
        corpusRoot: root,
        expectedMissingContentCount: NonNegativeInt.make(0),
        expectedSurfaceCount: NonNegativeInt.make(1),
        maxTotalElapsedMillis: PosInt.make(10_000),
        maxTotalOutputBytes: PosInt.make(100),
      });
      const capacityContext = (name: string) => ({
        ...context,
        corpusRoot: root,
        family: "recycle" as const,
        ledgerPath: path.join(root, `${name}.jsonl`),
        outputRoot: path.join(root, name),
        runRoot: root,
      });
      expect(
        O.isNone(
          yield* RT.requireRecycleCopyCapacity(
            capacityContext("elapsed"),
            { sha256: sha("payload"), sizeBytes: 1 },
            { inputBytes: 0, mappingCount: 0, outputBytes: 0 },
            options,
            -10_001
          ).pipe(Effect.option)
        )
      ).toBe(true);
      expect(
        O.isNone(
          yield* RT.requireRecycleCopyCapacity(
            capacityContext("output"),
            { sha256: sha("payload"), sizeBytes: 2 },
            { inputBytes: 0, mappingCount: 0, outputBytes: 99 },
            options,
            DateTime.toEpochMillis(yield* DateTime.now)
          ).pipe(Effect.option)
        )
      ).toBe(true);
      const enormousOptions = RestorationRecycleOptions.make({
        ...options,
        maxTotalOutputBytes: PosInt.make(Number.MAX_SAFE_INTEGER),
      });
      expect(
        O.isNone(
          yield* RT.requireRecycleCopyCapacity(
            capacityContext("free-space"),
            { sha256: sha("payload"), sizeBytes: Number.MAX_SAFE_INTEGER },
            { inputBytes: 0, mappingCount: 0, outputBytes: 0 },
            enormousOptions,
            DateTime.toEpochMillis(yield* DateTime.now)
          ).pipe(Effect.option)
        )
      ).toBe(true);
    })
  );

  it.effect("returns infinity without invoking page comparison for mismatched page sets", () =>
    Effect.gen(function* () {
      const value = yield* RT.maximumPageRmse(["one"], [], legacyOptions, legacyBudget);
      expect(value).toBe(Number.POSITIVE_INFINITY);
    })
  );

  it.effect("discovers mail, recycle, and distinct legacy candidates deterministically", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const ordinary = archivedFile("ordinary", "docs/readme.txt");
      const pst = archivedFile("pst", "$Recycle.Bin/S-1/$RSTORE.PST", 2 * 1024 * 1024);
      const pstLarger = archivedFile("pst-larger", "$Recycle.Bin/S-1/$RSTORE2.PST", 3 * 1024 * 1024);
      const rootPst = archivedFile("root-pst", "$RROOT.PST", 2 * 1024 * 1024);
      const undersizedPst = archivedFile("undersized-pst", "$RSMALL.PST", 1024);
      const eml = archivedFile("eml", "mail/one.EML");
      const residue = archivedFile("residue", "mail/folder.export/item.txt");
      const residueDuplicate = archivedFile("residue-duplicate", "mail/folder.export/other.txt");
      const docA = archivedFile("doc-a", "legacy/a.doc");
      const docADuplicate = ArchiveLedgerRecord.cases["archive-file-pass"].make({
        ...archivedFile("doc-a-copy", "legacy/a-copy.doc"),
        sha256: docA.sha256,
      });
      const records = [
        ordinary,
        pst,
        pstLarger,
        rootPst,
        undersizedPst,
        eml,
        residue,
        residueDuplicate,
        docA,
        docADuplicate,
      ];

      const mail = RT.mailCandidates(path, "/archive", records);
      expect(mail.map((candidate) => candidate.family)).toEqual(["eml", "pst", "pst", "pst", "pst", "residue"]);
      expect(RT.selectMailCandidates(path, "full", mail)).toEqual(mail);
      expect(RT.selectMailCandidates(path, "slice", mail).map((candidate) => candidate.objectId)).toEqual(["pst"]);

      const legacy = RT.legacyWordCandidates(path, "/archive", records);
      expect(legacy.occurrenceCount).toBe(2);
      expect(legacy.candidates).toHaveLength(1);
      expect(legacy.candidates[0]?.occurrenceCount).toBe(2);

      const recycleRecords = [
        archivedFile("meta", "$Recycle.Bin/S-1/$IABC"),
        archivedFile("content", "$Recycle.Bin/S-1/$RABC"),
        archivedFile("content-duplicate", "$Recycle.Bin/S-1/$RABC"),
      ];
      const entries = RT.recycleEntries(path, "/archive", [ordinary, ...recycleRecords]);
      expect(entries).toHaveLength(3);
      expect(RT.recycleSurfaceKey(path, "$Recycle.Bin/S-1/$RABC")).toBe("$Recycle.Bin/S-1");
      expect(RT.recycleSurfaceKey(path, "plain/$RABC")).toBe("plain");
      const groups = RT.recycleSurfaceCounts(RT.groupRecycleEntries(entries));
      expect(RT.recycleMissingContentCount(groups)).toBe(0);
      const grouped = RT.groupRecycleEntries(entries);
      expect(RT.sortedRecycleGroups(grouped)).toHaveLength(1);
      expect(RT.sortedRecyclePairs(grouped)).toHaveLength(1);
      const group = RT.sortedRecycleGroups(grouped)[0];
      expect(group === undefined ? O.none() : RT.recyclePair(group)).toMatchObject({ _tag: "Some" });
      if (group !== undefined) {
        expect(RT.recycleGroupSourceObjectIds(group, "valid-pair")).toEqual(["meta", "content"]);
        expect(RT.recycleGroupSourceObjectIds(group, "duplicate")).toEqual(["content-duplicate"]);
        expect(RT.recycleGroupSourceObjectIds(group, "missing-content")).toEqual([]);
        expect(RT.recycleGroupSourceObjectIds(group, "orphan-content")).toEqual([]);
      }
      expect(RT.recycleJoinClasses({ duplicate: 1, missing: 0, orphan: 0, valid: 1 })).toEqual([
        ["duplicate", 1],
        ["missing-content", 0],
        ["orphan-content", 0],
        ["valid-pair", 1],
      ]);
      expect(RT.recycleJoinClasses({ duplicate: 0, missing: 1, orphan: 0, valid: 0 })[1]).toEqual([
        "missing-content",
        1,
      ]);
      expect(RT.recycleJoinClasses({ duplicate: 0, missing: 0, orphan: 1, valid: 0 })[2]).toEqual([
        "orphan-content",
        1,
      ]);

      const root = yield* fs.makeTempDirectoryScoped({ prefix: "recycle-joins-" });
      const recycleContext = {
        ...context,
        corpusRoot: root,
        family: "recycle" as const,
        ledgerPath: path.join(root, "recycle.jsonl"),
        outputRoot: path.join(root, "output"),
        runRoot: root,
      };
      const outcome = yield* RT.appendRecycleJoins(grouped, RT.recycleSurfaceCounts(grouped), recycleContext, []);
      expect(outcome).toEqual({ joinOutcomeCount: 2, missingContentCount: 0 });
      const surfaceId = `surface-${sha("$Recycle.Bin/S-1").slice(0, 16)}`;
      const joins = (
        [
          ["duplicate", 1, ["content-duplicate"]],
          ["missing-content", 0, []],
          ["orphan-content", 0, []],
          ["valid-pair", 1, ["meta", "content"]],
        ] as const
      ).map(([joinClass, count, sourceObjectIds]) =>
        TransformationLedgerRecord.cases["recycle-join"].make({
          ...identity,
          count: NonNegativeInt.make(count),
          family: "recycle",
          joinClass,
          recordType: "recycle-join",
          sourceObjectIds,
          surfaceId,
        })
      );
      expect(
        RT.recycleJoinCheckpointMatches(joins[0]!, {
          count: 1,
          joinClass: "duplicate",
          sourceObjectIds: ["content-duplicate"],
          surfaceId,
        })
      ).toBe(true);
      const ledger = yield* fs.readFileString(recycleContext.ledgerPath);
      yield* RT.appendRecycleJoins(grouped, RT.recycleSurfaceCounts(grouped), recycleContext, joins);
      expect(yield* fs.readFileString(recycleContext.ledgerPath)).toBe(ledger);
      expect(
        O.isNone(
          yield* RT.appendRecycleJoins(grouped, RT.recycleSurfaceCounts(grouped), recycleContext, [
            { ...joins[0]!, count: NonNegativeInt.make(2) },
          ]).pipe(Effect.option)
        )
      ).toBe(true);
    })
  );

  it.effect("validates persisted recycle mapping prefixes against preserved and retained bytes", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "recycle-checkpoint-" });
      const archiveRoot = path.join(root, "archive");
      const outputRoot = path.join(root, "output", "restored");
      const metadataPath = path.join(archiveRoot, "payload/tree/$Recycle.Bin/S-1/$IABC");
      const contentPath = path.join(archiveRoot, "payload/tree/$Recycle.Bin/S-1/$RABC");
      const originalPath = "C:\\Recovered\\item.txt";
      const metadataBytes = recycleMetadataV2(originalPath, 7n);
      yield* fs.makeDirectory(path.dirname(metadataPath), { recursive: true });
      yield* fs.makeDirectory(outputRoot, { recursive: true });
      yield* fs.writeFile(metadataPath, metadataBytes);
      yield* fs.writeFileString(contentPath, "recycle");
      const metadataDigest = Sha256Hex.make(bytesToHex(sha256(metadataBytes)));
      const contentDigest = sha("recycle");
      const metadataRecord = ArchiveLedgerRecord.cases["archive-file-pass"].make({
        ...archivedFile("metadata", "$Recycle.Bin/S-1/$IABC", metadataBytes.length),
        sha256: metadataDigest,
        sizeBytes: NonNegativeInt.make(metadataBytes.length),
      });
      const contentRecord = ArchiveLedgerRecord.cases["archive-file-pass"].make({
        ...archivedFile("content", "$Recycle.Bin/S-1/$RABC", 7),
        sha256: contentDigest,
        sizeBytes: NonNegativeInt.make(7),
      });
      const groups = RT.groupRecycleEntries(RT.recycleEntries(path, archiveRoot, [metadataRecord, contentRecord]));
      const pair = RT.sortedRecyclePairs(groups)[0];
      if (pair === undefined) return yield* Effect.die("Expected one deterministic recycle pair.");

      const decoded = yield* RT.readRecycleMetadata(pair.metadata);
      expect(decoded.originalPath).toBe(originalPath);
      const digest = yield* RT.hashPreservedRecycleContent(pair.content);
      const usedPaths = MutableHashMap.empty<string, string>();
      const surfaceId = `surface-${sha(pair.group.surfaceKey).slice(0, 16)}`;
      const desired = path.join(surfaceId, RT.safeRestoredPath(path, originalPath));
      const restoredRelativePath = RT.collisionAllocatedPath(
        path,
        desired,
        `${pair.metadata.objectId}\u0000${pair.content.objectId}\u0000${pair.group.pairKey}`,
        usedPaths
      );
      const retainedPath = path.join(outputRoot, restoredRelativePath);
      yield* fs.makeDirectory(path.dirname(retainedPath), { recursive: true });
      yield* fs.writeFileString(retainedPath, "recycle");
      const recycleContext = {
        ...context,
        archiveRoot,
        corpusRoot: root,
        family: "recycle" as const,
        ledgerPath: path.join(root, "recycle.jsonl"),
        outputRoot: path.join(root, "output"),
        runRoot: root,
      };
      const mapping = TransformationLedgerRecord.cases["recycle-mapping"].make({
        ...identity,
        attemptId: RT.familyAttemptId("recycle", pair.content.objectId, 0),
        contentObjectId: pair.content.objectId,
        digest: digest.sha256,
        family: "recycle",
        metadataObjectId: pair.metadata.objectId,
        originalPath,
        recordType: "recycle-mapping",
        restoredRelativePath,
        surfaceId,
      });
      const expected = { restoredRelativePath, surfaceId };
      expect(RT.recycleMappingIdentityMatches(mapping, pair, digest, originalPath, expected)).toBe(true);
      for (const mismatch of [
        { ...mapping, contentObjectId: "different" },
        { ...mapping, metadataObjectId: "different" },
        { ...mapping, digest: sha("different") },
        { ...mapping, originalPath: "different" },
        { ...mapping, restoredRelativePath: "different" },
        { ...mapping, surfaceId: "different" },
      ]) {
        expect(RT.recycleMappingIdentityMatches(mismatch, pair, digest, originalPath, expected)).toBe(false);
      }
      expect(yield* RT.recycleRetainedCheckpointMatches(recycleContext, outputRoot, restoredRelativePath, digest)).toBe(
        true
      );
      expect(
        yield* RT.recycleRetainedCheckpointMatches(recycleContext, outputRoot, restoredRelativePath, {
          ...digest,
          sizeBytes: digest.sizeBytes + 1,
        })
      ).toBe(false);
      expect(
        yield* RT.validateRecycleMappingCheckpoint(recycleContext, outputRoot, pair, mapping, MutableHashMap.empty())
      ).toBe(7);
      expect(
        O.isNone(
          yield* RT.validateRecycleMappingCheckpoint(
            recycleContext,
            outputRoot,
            pair,
            { ...mapping, contentObjectId: "different" },
            MutableHashMap.empty()
          ).pipe(Effect.option)
        )
      ).toBe(true);
      expect(yield* RT.validateRecycleMappingPrefix(recycleContext, outputRoot, [mapping], [pair])).toMatchObject({
        inputBytes: 7,
      });
      expect(
        O.isNone(yield* RT.validateRecycleMappingPrefix(recycleContext, outputRoot, [mapping], []).pipe(Effect.option))
      ).toBe(true);

      const raceRunRoot = path.join(root, "race-output");
      const raceRestoredRoot = path.join(raceRunRoot, "restored");
      yield* fs.makeDirectory(raceRestoredRoot, { recursive: true });
      const raceContext = {
        ...recycleContext,
        ledgerPath: path.join(root, "race-recycle.jsonl"),
        outputRoot: raceRunRoot,
      };
      let restoreContentOpens = 0;
      const restoreRaceFileSystem: FileSystem.FileSystem = {
        ...fs,
        open: (filePath, options) => {
          if (filePath !== contentPath) return fs.open(filePath, options);
          restoreContentOpens += 1;
          return restoreContentOpens === 3
            ? fs.writeFileString(filePath, "changed").pipe(Effect.andThen(fs.open(filePath, options)))
            : fs.open(filePath, options);
        },
      };
      const restoreSourceDriftError = yield* RT.restoreRecyclePair(
        pair.metadata,
        pair.content,
        pair.group,
        raceContext,
        raceRestoredRoot,
        MutableHashMap.empty(),
        { inputBytes: 0, mappingCount: 0, outputBytes: 0 },
        RestorationRecycleOptions.make({
          corpusRoot: root,
          expectedMissingContentCount: NonNegativeInt.make(0),
          expectedSurfaceCount: NonNegativeInt.make(1),
          maxTotalElapsedMillis: PosInt.make(10_000),
          maxTotalOutputBytes: PosInt.make(1_000),
        }),
        DateTime.toEpochMillis(yield* DateTime.now)
      ).pipe(Effect.provideService(FileSystem.FileSystem, restoreRaceFileSystem), Effect.flip);
      expect(restoreSourceDriftError.message).toContain("source bytes changed while parsing or copying");
      yield* fs.writeFileString(contentPath, "recycle");

      yield* fs.writeFileString(retainedPath, "drifted");
      expect(
        O.isNone(
          yield* RT.validateRecycleMappingCheckpoint(
            recycleContext,
            outputRoot,
            pair,
            mapping,
            MutableHashMap.empty()
          ).pipe(Effect.option)
        )
      ).toBe(true);
      yield* fs.writeFileString(retainedPath, "recycle");
      let checkpointContentOpens = 0;
      const checkpointRaceFileSystem: FileSystem.FileSystem = {
        ...fs,
        open: (filePath, options) => {
          if (filePath !== contentPath) return fs.open(filePath, options);
          checkpointContentOpens += 1;
          return checkpointContentOpens === 2
            ? fs.writeFileString(filePath, "changed").pipe(Effect.andThen(fs.open(filePath, options)))
            : fs.open(filePath, options);
        },
      };
      const checkpointSourceDriftError = yield* RT.validateRecycleMappingCheckpoint(
        recycleContext,
        outputRoot,
        pair,
        mapping,
        MutableHashMap.empty()
      ).pipe(Effect.provideService(FileSystem.FileSystem, checkpointRaceFileSystem), Effect.flip);
      expect(checkpointSourceDriftError.message).toContain("checkpoint source bytes drifted from preservation");
      expect(O.isNone(yield* RT.hashPreservedRecycleContent(pair.content).pipe(Effect.option))).toBe(true);

      const oversized = {
        ...pair.metadata,
        preservationRecord: { ...metadataRecord, sizeBytes: NonNegativeInt.make(65 * 1024) },
      };
      expect(O.isNone(yield* RT.readRecycleMetadata(oversized).pipe(Effect.option))).toBe(true);
      const directoryMetadata = {
        ...pair.metadata,
        preservationRecord: ArchiveLedgerRecord.cases["archive-directory-pass"].make({
          destinationRelativePath: metadataRecord.destinationRelativePath,
          objectId: metadataRecord.objectId,
          objectKind: "directory",
          recordedAt: metadataRecord.recordedAt,
          recordType: "archive-directory-pass",
          runId: metadataRecord.runId,
          schemaVersion: metadataRecord.schemaVersion,
          sourceLabel: metadataRecord.sourceLabel,
          sourceRelativePath: metadataRecord.sourceRelativePath,
        }),
      };
      const directoryMetadataError = yield* RT.readRecycleMetadata(directoryMetadata).pipe(Effect.flip);
      expect(directoryMetadataError.message).toContain("Recycle metadata occurrence is not a preserved bounded file");
      yield* fs.writeFileString(metadataPath, "drift");
      expect(O.isNone(yield* RT.readRecycleMetadata(pair.metadata).pipe(Effect.option))).toBe(true);

      yield* fs.writeFile(metadataPath, metadataBytes);
      yield* fs.writeFileString(contentPath, "recycle");
      yield* fs.writeFileString(retainedPath, "recycle");
      const recycleStart = familyRunStart("recycle", 1);
      const recycleAttempt = familyAttemptStart("recycle", pair.content.objectId, digest.sha256);
      const encodedInterruptedSeed = yield* Effect.forEach(
        [recycleStart, recycleAttempt],
        encodeTransformationLedgerRecordJson
      );
      yield* fs.writeFileString(recycleContext.ledgerPath, `${encodedInterruptedSeed.join("\n")}\n`);
      yield* RT.recoverRecycleInterruptedAttempts(recycleContext, [pair]);
      expect(yield* fs.exists(path.join(recycleContext.outputRoot, `interrupted/${recycleAttempt.attemptId}`))).toBe(
        true
      );

      const encodedTooManyMappings = yield* Effect.forEach(
        [recycleStart, recycleAttempt, mapping],
        encodeTransformationLedgerRecordJson
      );
      yield* fs.writeFileString(recycleContext.ledgerPath, `${encodedTooManyMappings.join("\n")}\n`);
      const tooManyMappingsError = yield* RT.recycleResumeState(
        recycleContext,
        MutableHashMap.empty(),
        outputRoot,
        0
      ).pipe(Effect.flip);
      expect(tooManyMappingsError.message).toContain(
        "Prior recycle checkpoints do not form a complete deterministic mapping prefix"
      );

      yield* fs.writeFileString(recycleContext.ledgerPath, `${encodedInterruptedSeed.join("\n")}\n`);
      const invalidLifecycleError = yield* RT.recycleResumeState(
        recycleContext,
        MutableHashMap.empty(),
        outputRoot,
        0
      ).pipe(Effect.flip);
      expect(invalidLifecycleError.message).toContain("Prior recycle checkpoints contain unsupported or out-of-order");

      const prematureJoin = TransformationLedgerRecord.cases["recycle-join"].make({
        ...identity,
        count: NonNegativeInt.make(1),
        family: "recycle",
        joinClass: "valid-pair",
        recordType: "recycle-join",
        sourceObjectIds: [pair.metadata.objectId, pair.content.objectId],
        surfaceId: mapping.surfaceId,
      });
      const encodedPrematureJoin = yield* Effect.forEach(
        [recycleStart, prematureJoin],
        encodeTransformationLedgerRecordJson
      );
      yield* fs.writeFileString(recycleContext.ledgerPath, `${encodedPrematureJoin.join("\n")}\n`);
      const prematureJoinError = yield* RT.recycleResumeState(
        recycleContext,
        RT.groupRecycleEntries([pair.metadata, pair.content]),
        outputRoot,
        0
      ).pipe(Effect.flip);
      expect(prematureJoinError.message).toContain("complete deterministic mapping prefix");
    })
  );

  it.effect("resumes approved mail and legacy exception checkpoints without replaying processed candidates", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "family-resume-" });
      const writeRecords = Effect.fnUntraced(function* (
        ledgerPath: string,
        records: ReadonlyArray<TransformationLedgerRecord>
      ) {
        const encoded = yield* Effect.forEach(records, encodeTransformationLedgerRecordJson);
        yield* fs.writeFileString(ledgerPath, `${encoded.join("\n")}\n`);
      });

      const mailLedger = path.join(root, "mail.jsonl");
      const mailOutput = path.join(root, "mail-output");
      yield* fs.makeDirectory(mailOutput);
      const mailContext = {
        ...context,
        corpusRoot: root,
        family: "mail" as const,
        ledgerPath: mailLedger,
        mailScope: O.some<"full" | "slice">("full"),
        outputRoot: mailOutput,
        runRoot: root,
      };
      const processedMail = "processed-mail";
      const mailStart = familyAttemptStart("mail", processedMail, sha("processed-source"));
      const mailException = TransformationLedgerRecord.cases["mail-store-exception"].make({
        ...identity,
        approved: true,
        attemptId: mailStart.attemptId,
        disposition: "quarantine",
        exceptionKind: "password",
        family: "mail",
        mailScope: "full",
        message: "Password protected",
        objectId: processedMail,
        recordType: "mail-store-exception",
        retainedOutputBytes: NonNegativeInt.make(0),
        retainedOutputSha256: RT.emptyMailAttemptOutputDigest().sha256,
        sourceFamily: "pst",
      });
      const unmatchedMailStart = familyAttemptStart("mail", "unmatched-mail", sha("unmatched-source"));
      const unmatchedMailException = TransformationLedgerRecord.cases["mail-store-exception"].make({
        ...mailException,
        attemptId: unmatchedMailStart.attemptId,
        objectId: "unmatched-mail",
      });
      yield* writeRecords(mailLedger, [
        familyRunStart("mail", 2),
        mailStart,
        mailException,
        unmatchedMailStart,
        unmatchedMailException,
      ]);
      const processedPass = archivedFile("processed-pass", "mail/processed.pst", 3);
      const pendingPass = archivedFile("pending-pass", "mail/pending.pst", 5);
      const mailResume = yield* RT.mailResumeState(
        mailContext,
        [
          { family: "pst" as const, objectId: processedMail, pass: O.some(processedPass), sourcePath: "/processed" },
          { family: "residue" as const, objectId: "unmatched-mail", pass: O.none(), sourcePath: "/residue" },
          { family: "pst" as const, objectId: "pending-mail", pass: O.some(pendingPass), sourcePath: "/pending" },
        ],
        11
      );
      expect(mailResume.candidates.map((candidate) => candidate.objectId)).toEqual(["pending-mail"]);
      expect(mailResume.counters).toMatchObject({ exceptionCount: 2, inputBytes: 3, outputBytes: 11 });
      const unknownCandidateError = yield* RT.mailResumeState(
        mailContext,
        [{ family: "pst" as const, objectId: processedMail, pass: O.some(processedPass), sourcePath: "/processed" }],
        0
      ).pipe(Effect.flip);
      expect(unknownCandidateError.message).toContain(
        "Prior mail exception references unknown candidate unmatched-mail"
      );
      yield* writeRecords(mailLedger, [familyRunStart("mail", 1), mailStart]);
      expect(O.isNone(yield* RT.mailResumeState(mailContext, [], 0).pipe(Effect.option))).toBe(true);

      const legacyLedger = path.join(root, "legacy.jsonl");
      const legacyOutput = path.join(root, "legacy-output");
      yield* fs.makeDirectory(legacyOutput);
      const legacyContext = { ...context, corpusRoot: root, ledgerPath: legacyLedger, outputRoot: legacyOutput };
      const processedDigest = sha("processed-legacy");
      const legacyStart = familyAttemptStart("legacy-word", processedDigest, processedDigest);
      const legacyException = TransformationLedgerRecord.cases["legacy-word-exception"].make({
        ...identity,
        approved: true,
        attemptId: legacyStart.attemptId,
        exceptionKind: "not-binary-word",
        family: "legacy-word",
        message: "Preserved non-binary input",
        originalSha256: processedDigest,
        recordType: "legacy-word-exception",
      });
      const passedDigest = sha("passed-legacy");
      const legacyPassStart = familyAttemptStart("legacy-word", passedDigest, passedDigest);
      const convertedPath = path.join(legacyOutput, `converted/${passedDigest}.docx`);
      yield* fs.makeDirectory(path.dirname(convertedPath), { recursive: true });
      yield* fs.writeFileString(convertedPath, "converted");
      const legacyPass = TransformationLedgerRecord.cases["legacy-word-pass"].make({
        ...identity,
        attemptId: legacyPassStart.attemptId,
        convertedSha256: sha("converted"),
        engineVersion: "LibreOffice test",
        family: "legacy-word",
        normalizedTextSha256: sha("normalized"),
        originalSha256: passedDigest,
        pageCountDelta: 0,
        postProcessOriginalSha256: passedDigest,
        recordType: "legacy-word-pass",
        visualRmse: 0,
      });
      yield* writeRecords(legacyLedger, [
        familyRunStart("legacy-word", 2),
        legacyStart,
        legacyException,
        legacyPassStart,
        legacyPass,
      ]);
      const legacyResume = yield* RT.legacyResumeState(
        legacyContext,
        [
          {
            digest: processedDigest,
            occurrenceCount: 1,
            pass: archivedFile("legacy-processed", "legacy/processed.doc", 3),
            sourcePath: "/processed.doc",
          },
          {
            digest: sha("pending-legacy"),
            occurrenceCount: 1,
            pass: archivedFile("legacy-pending", "legacy/pending.doc", 5),
            sourcePath: "/pending.doc",
          },
          {
            digest: passedDigest,
            occurrenceCount: 1,
            pass: archivedFile("legacy-passed", "legacy/passed.doc", 3),
            sourcePath: "/passed.doc",
          },
        ],
        13
      );
      expect(legacyResume.candidates.map((candidate) => candidate.digest)).toEqual([sha("pending-legacy")]);
      expect(legacyResume.counters).toMatchObject({ exceptionCount: 1, inputBytes: 6, outputBytes: 13, passCount: 1 });
      yield* writeRecords(legacyLedger, [familyRunStart("legacy-word", 1), legacyStart]);
      expect(O.isNone(yield* RT.legacyResumeState(legacyContext, [], 0).pipe(Effect.option))).toBe(true);
    })
  );

  it.effect("publishes immutable acceptance evidence idempotently and rejects conflicting bytes", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const corpusRoot = yield* fs.makeTempDirectoryScoped({ prefix: "transformation-acceptance-" });
      const digest = sha("acceptance");
      const record = RestorationAcceptanceRecord.make({
        elapsedMillis: NonNegativeInt.make(1),
        evidenceSha256: digest,
        exceptionCount: NonNegativeInt.make(0),
        expectedTerminalCount: NonNegativeInt.make(1),
        family: "preservation",
        inputBytes: NonNegativeInt.make(2),
        outputBytes: NonNegativeInt.make(2),
        outputTreeSha256: digest,
        passCount: NonNegativeInt.make(1),
        preservationRunId: "preservation-1",
        preservationSealSha256: digest,
        recordedAt: "2026-08-30T00:00:00.000Z",
        runLabel: "run-1",
        schemaVersion: "oppold-corpus-restoration/v1",
        sourceCount: NonNegativeInt.make(1),
        status: "pass",
        terminalCount: NonNegativeInt.make(1),
        unapprovedCount: 0,
      });
      yield* RT.writeAcceptanceRecord(corpusRoot, "run-1", record);
      yield* RT.writeAcceptanceRecord(corpusRoot, "run-1", record);
      const directory = path.join(corpusRoot, "staging/restoration/runs/run-1/acceptance");
      const destination = path.join(directory, "preservation.json");
      const canonical = yield* RT.readCanonicalAcceptance(directory, destination, "acceptance");
      expect(canonical).toContain('"family":"preservation"');
      expect(O.isNone(yield* RT.readCanonicalAcceptance(directory, directory, "acceptance").pipe(Effect.option))).toBe(
        true
      );

      const partial = `${destination}.partial`;
      yield* fs.writeFileString(partial, `${canonical}\n`);
      yield* RT.removeMatchingAcceptancePartial(directory, partial, canonical);
      expect(yield* fs.exists(partial)).toBe(false);

      const changed = RestorationAcceptanceRecord.make({
        ...record,
        evidenceSha256: sha("changed-acceptance"),
      });
      const changedCanonical = yield* encodeRestorationAcceptanceRecordJson(changed);
      yield* fs.writeFileString(partial, `${changedCanonical}\n`);
      expect(
        O.isNone(yield* RT.removeMatchingAcceptancePartial(directory, partial, canonical).pipe(Effect.option))
      ).toBe(true);
      yield* fs.remove(partial);
      expect(O.isNone(yield* RT.writeAcceptanceRecord(corpusRoot, "run-1", changed).pipe(Effect.option))).toBe(true);

      const recycle = RestorationAcceptanceRecord.make({
        ...record,
        family: "recycle",
        transformationRunId: "recycle-1",
      });
      const recycleDirectory = path.join(corpusRoot, "staging/restoration/runs/run-2/acceptance");
      yield* fs.makeDirectory(recycleDirectory, { recursive: true });
      const recyclePartial = path.join(recycleDirectory, "recycle.json.partial");
      const encodedRecycle = yield* encodeRestorationAcceptanceRecordJson(recycle);
      yield* fs.writeFileString(recyclePartial, `${encodedRecycle}\n`);
      yield* RT.writeAcceptanceRecord(corpusRoot, "run-2", recycle);
      expect(yield* fs.exists(path.join(recycleDirectory, "recycle.json"))).toBe(true);

      const conflictingPartialDirectory = path.join(corpusRoot, "staging/restoration/runs/run-3/acceptance");
      yield* fs.makeDirectory(conflictingPartialDirectory, { recursive: true });
      yield* fs.writeFileString(
        path.join(conflictingPartialDirectory, "preservation.json.partial"),
        `${changedCanonical}\n`
      );
      expect(O.isNone(yield* RT.writeAcceptanceRecord(corpusRoot, "run-3", record).pipe(Effect.option))).toBe(true);

      const outside = path.join(corpusRoot, "outside");
      yield* fs.writeFileString(outside, "x");
      const escaped = yield* RT.requireCanonicalContainedPath(directory, outside).pipe(Effect.option);
      expect(O.isNone(escaped)).toBe(true);
    })
  );

  it("validates resumable family and attempt checkpoint ordering", () => {
    const runStart = TransformationLedgerRecord.cases["family-run-start"].make({
      ...identity,
      expectedCount: NonNegativeInt.make(1),
      family: "legacy-word",
      maxTotalElapsedMillis: PosInt.make(100),
      maxTotalOutputBytes: PosInt.make(100),
      policySha256: sha("policy"),
      recordType: "family-run-start",
    });
    const attemptId = RT.familyAttemptId("legacy-word", sha("source"), 0);
    const attempt = TransformationLedgerRecord.cases["family-attempt-start"].make({
      ...identity,
      attemptId,
      family: "legacy-word",
      inputBytes: NonNegativeInt.make(2),
      recordType: "family-attempt-start",
      retryOrdinal: NonNegativeInt.make(0),
      sourceId: sha("source"),
      sourceSha256: sha("source"),
    });
    const interrupted = TransformationLedgerRecord.cases["family-attempt-interrupted"].make({
      ...identity,
      attemptId,
      disposition: "retained-for-retry",
      family: "legacy-word",
      recordType: "family-attempt-interrupted",
      retainedOutputBytes: NonNegativeInt.make(0),
      retainedOutputRelativePath: "proof/attempt",
      retainedOutputSha256: sha("empty"),
      retryOrdinal: NonNegativeInt.make(0),
      sourceId: sha("source"),
    });
    const terminal = TransformationLedgerRecord.cases["legacy-word-exception"].make({
      ...identity,
      approved: true,
      attemptId,
      exceptionKind: "not-binary-word",
      family: "legacy-word",
      message: "Not a binary Word document.",
      originalSha256: sha("source"),
      recordType: "legacy-word-exception",
    });
    const summary = TransformationLedgerRecord.cases["family-run-summary"].make({
      ...identity,
      elapsedMillis: NonNegativeInt.make(1),
      exceptionCount: NonNegativeInt.make(1),
      family: "legacy-word",
      inputBytes: NonNegativeInt.make(2),
      maxTotalElapsedMillis: PosInt.make(100),
      maxTotalOutputBytes: PosInt.make(100),
      outputBytes: NonNegativeInt.make(0),
      outputTreeSha256: sha("empty"),
      passCount: NonNegativeInt.make(0),
      recordType: "family-run-summary",
      sourceCount: NonNegativeInt.make(1),
      unapprovedCount: NonNegativeInt.make(0),
    });

    expect(RT.familyStartStateIsResumable([])).toBe(true);
    expect(RT.familyStartStateIsResumable([runStart])).toBe(true);
    expect(RT.familyStartStateIsResumable([attempt])).toBe(false);
    expect(RT.familyStartStateIsResumable([runStart, runStart])).toBe(false);
    expect(RT.familySummaryStateIsResumable([])).toBe(true);
    expect(RT.familySummaryStateIsResumable([runStart, summary])).toBe(true);
    expect(RT.familySummaryStateIsResumable([summary, runStart])).toBe(false);
    expect(RT.familySummaryStateIsResumable([summary, summary])).toBe(false);
    expect(RT.recycleCheckpointOrderValid([])).toBe(true);
    expect(RT.recycleCheckpointOrderValid([runStart, attempt, interrupted])).toBe(true);
    expect(RT.unsettledAttemptStarts([attempt])).toEqual([attempt]);
    expect(RT.unsettledAttemptStarts([attempt, interrupted])).toEqual([]);
    expect(MutableHashSet.size(RT.terminalAttemptIds([attempt]))).toBe(0);
    expect(MutableHashSet.size(RT.terminalAttemptIds([terminal]))).toBe(1);
    expect(RT.unsettledAttemptStarts([attempt, terminal])).toEqual([]);
    expect(RT.attemptRetryOrdinalsReconcile([attempt])).toBe(true);
    expect(RT.attemptRetryOrdinalsReconcile([attempt, attempt])).toBe(false);
    expect(RT.attemptSettlementsReconcile([attempt], [interrupted], [])).toBe(true);
    expect(RT.attemptBindingsReconcile([attempt], [interrupted], [])).toBe(true);
    expect(RT.latestAttemptsAreTerminal([attempt], [])).toBe(false);
    expect(RT.resumableAttemptLifecycleReconciles([attempt, interrupted])).toBe(true);
    expect(RT.legacyInterruptedAttemptRoots(attempt)).toEqual([
      { label: "proof", relativePath: `proof/${attempt.sourceId}/${attempt.attemptId}` },
      { label: "converted", relativePath: `converted/${attempt.sourceSha256}.docx` },
      { label: "converted-partial", relativePath: `converted/${attempt.sourceSha256}.docx.partial` },
    ]);
  });

  it.effect("runs bounded legacy subprocess probes and rejects exhausted budgets", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const runtimeFileSystem: FileSystem.FileSystem = {
        ...fs,
        exists: (filePath) => (filePath === "/lib64" ? Effect.succeed(false) : fs.exists(filePath)),
      };
      expect(
        yield* RT.sandboxRuntimeBinds().pipe(Effect.provideService(FileSystem.FileSystem, runtimeFileSystem))
      ).not.toContain("/lib64");
      const captured = yield* RT.runLegacyStep("sh", ["-c", "printf semantic-proof"], 2_000, "stdout");
      expect(captured.exitCode).toBe(0);
      expect(captured.output).toBe("semantic-proof");
      const exhausted = yield* RT.runLegacyStep("sh", ["-c", "exit 0"], 0).pipe(Effect.option);
      expect(O.isNone(exhausted)).toBe(true);
      expect(yield* RT.maximumPageRmse([], [], legacyOptions, legacyBudget)).toBe(0);
    })
  );

  it.effect("exercises bounded legacy tool failures, probes, promotion, and terminal recovery", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "legacy-boundaries-" });
      const outputRoot = path.join(root, "output");
      yield* fs.makeDirectory(outputRoot, { recursive: true });
      const legacyContext = {
        ...context,
        corpusRoot: root,
        ledgerPath: path.join(root, "legacy.jsonl"),
        outputRoot,
        runRoot: root,
        startedAt: 0,
      };
      const now = DateTime.toEpochMillis(yield* DateTime.now);
      const budget = { attemptStartedAt: now, context: legacyContext, familyStartedAt: now };
      const input = path.join(root, "source.doc");
      yield* fs.writeFileString(input, "not-doc");
      const baseOptions = RestorationLegacyWordOptions.make({
        ...legacyOptions,
        corpusRoot: root,
        maxElapsedMillis: PosInt.make(5_000),
        maxTotalElapsedMillis: PosInt.make(5_000),
        maxTotalOutputBytes: PosInt.make(100),
      });

      yield* fs.writeFileString(path.join(outputRoot, "over.bin"), "over");
      expect(
        O.isNone(
          yield* RT.legacyOutputWatchdog(
            legacyContext,
            RestorationLegacyWordOptions.make({ ...baseOptions, maxTotalOutputBytes: PosInt.make(1) })
          ).pipe(Effect.option)
        )
      ).toBe(true);
      yield* fs.remove(path.join(outputRoot, "over.bin"));

      const failedOptions = RestorationLegacyWordOptions.make({ ...baseOptions, bwrapPath: "/bin/false" });
      expect(
        O.isNone(
          yield* RT.runSandboxedConversion(
            input,
            "doc",
            "docx",
            path.join(root, "failed-convert"),
            failedOptions,
            budget
          ).pipe(Effect.option)
        )
      ).toBe(true);
      const emptyOptions = RestorationLegacyWordOptions.make({ ...baseOptions, bwrapPath: "/bin/true" });
      expect(
        O.isNone(
          yield* RT.runSandboxedConversion(
            input,
            "doc",
            "docx",
            path.join(root, "empty-convert"),
            emptyOptions,
            budget
          ).pipe(Effect.option)
        )
      ).toBe(true);
      expect(O.isNone(yield* RT.normalizedTikaText(input, failedOptions, budget).pipe(Effect.option))).toBe(true);
      expect(O.isNone(yield* RT.normalizedTikaText(input, emptyOptions, budget).pipe(Effect.option))).toBe(true);
      expect(O.isNone(yield* RT.pdfPageCount(input, failedOptions, budget).pipe(Effect.option))).toBe(true);
      expect(O.isNone(yield* RT.pdfPageCount(input, emptyOptions, budget).pipe(Effect.option))).toBe(true);

      const probe = path.join(root, "probe.sh");
      yield* fs.writeFileString(probe, "#!/bin/sh\nprintf 'Pages: 2\\n'\n");
      expect((yield* RT.runLegacyStep("chmod", ["+x", probe], 2_000)).exitCode).toBe(0);
      const probeOptions = RestorationLegacyWordOptions.make({ ...baseOptions, bwrapPath: probe });
      expect(yield* RT.pdfPageCount(input, probeOptions, budget)).toBe(2);

      const rendered = path.join(root, "rendered");
      yield* fs.makeDirectory(rendered);
      yield* fs.writeFileString(path.join(rendered, "page-1.png"), "png");
      yield* fs.writeFileString(path.join(rendered, "page-2.png"), "png");
      expect(yield* RT.renderPdfPages(input, rendered, emptyOptions, budget)).toEqual([
        path.join(rendered, "page-1.png"),
        path.join(rendered, "page-2.png"),
      ]);
      expect(
        O.isNone(
          yield* RT.renderPdfPages(input, path.join(root, "render-fail"), failedOptions, budget).pipe(Effect.option)
        )
      ).toBe(true);

      const compare = path.join(root, "compare.sh");
      yield* fs.writeFileString(compare, "#!/bin/sh\nprintf '0 (0.25)\\n'\n");
      expect((yield* RT.runLegacyStep("chmod", ["+x", compare], 2_000)).exitCode).toBe(0);
      const compareOptions = RestorationLegacyWordOptions.make({ ...baseOptions, bwrapPath: compare });
      expect(yield* RT.comparePageRmse(input, input, compareOptions, budget)).toBe(0.25);
      expect(O.isNone(yield* RT.comparePageRmse(input, input, failedOptions, budget).pipe(Effect.option))).toBe(true);
      expect(O.isNone(yield* RT.comparePageRmse(input, input, emptyOptions, budget).pipe(Effect.option))).toBe(true);
      const compareFailure = path.join(root, "compare-failure.sh");
      yield* fs.writeFileString(compareFailure, "#!/bin/sh\nexit 2\n");
      expect((yield* RT.runLegacyStep("chmod", ["+x", compareFailure], 2_000)).exitCode).toBe(0);
      const compareFailureError = yield* RT.comparePageRmse(
        input,
        input,
        RestorationLegacyWordOptions.make({ ...baseOptions, bwrapPath: compareFailure }),
        budget
      ).pipe(Effect.flip);
      expect(compareFailureError.message).toContain("Rendered-page comparison failed or exceeded");

      const workRoot = yield* RT.makeLegacyWorkRoot(outputRoot, sha("work"), "attempt-work");
      expect(yield* fs.exists(workRoot)).toBe(true);
      expect(O.isNone(yield* RT.makeLegacyWorkRoot(outputRoot, sha("work"), "attempt-work").pipe(Effect.option))).toBe(
        true
      );

      const converted = path.join(root, "converted.docx");
      yield* fs.writeFileString(converted, "docx");
      const promotedRoot = path.join(root, "promoted");
      yield* fs.makeDirectory(promotedRoot);
      expect(
        (yield* RT.promoteLegacyWordOutput(converted, sha("legacy"), promotedRoot, root, PosInt.make(100))).sizeBytes
      ).toBe(4);
      expect(
        O.isNone(
          yield* RT.promoteLegacyWordOutput(converted, sha("legacy"), promotedRoot, root, PosInt.make(100)).pipe(
            Effect.option
          )
        )
      ).toBe(true);
      const capacityRoot = path.join(root, "capacity");
      yield* fs.makeDirectory(capacityRoot);
      expect(
        O.isNone(
          yield* RT.promoteLegacyWordOutput(converted, sha("capacity"), capacityRoot, root, PosInt.make(1)).pipe(
            Effect.option
          )
        )
      ).toBe(true);
      const stagedRaceRoot = path.join(root, "staged-race");
      yield* fs.makeDirectory(stagedRaceRoot);
      const stagedRaceDigest = sha("staged-race");
      const stagedRacePartial = path.join(stagedRaceRoot, "converted", `${stagedRaceDigest}.docx.partial`);
      let stagedRaceOpens = 0;
      const stagedRaceFileSystem: FileSystem.FileSystem = {
        ...fs,
        open: (filePath, options) => {
          if (filePath !== stagedRacePartial) return fs.open(filePath, options);
          stagedRaceOpens += 1;
          return stagedRaceOpens === 2
            ? fs.writeFileString(filePath, "drift").pipe(Effect.andThen(fs.open(filePath, options)))
            : fs.open(filePath, options);
        },
      };
      const stagedRaceError = yield* RT.promoteLegacyWordOutput(
        converted,
        stagedRaceDigest,
        stagedRaceRoot,
        root,
        PosInt.make(100)
      ).pipe(Effect.provideService(FileSystem.FileSystem, stagedRaceFileSystem), Effect.flip);
      expect(stagedRaceError.message).toContain("atomic staging digest does not match");

      const pass = ArchiveLedgerRecord.cases["archive-file-pass"].make({
        ...archivedFile("legacy-source", "legacy/source.doc", 7),
        sha256: sha("not-doc"),
      });
      const candidate = { digest: pass.sha256, occurrenceCount: 1, pass, sourcePath: input };
      expect(yield* RT.processLegacyWordCandidate(candidate, "LibreOffice test", legacyContext, baseOptions)).toEqual({
        inputBytes: 7,
        outputBytes: 0,
        passed: false,
        unapproved: false,
      });
      expect(
        O.isNone(
          yield* RT.processLegacyWordCandidate(
            { ...candidate, digest: sha("drift") },
            "LibreOffice test",
            legacyContext,
            baseOptions
          ).pipe(Effect.option)
        )
      ).toBe(true);
      expect(O.isNone(yield* RT.legacyFailureTerminal(legacyContext, candidate).pipe(Effect.option))).toBe(true);

      const expiredCandidate = { ...candidate, digest: sha("expired"), pass: { ...pass, sha256: sha("expired") } };
      expect(
        yield* RT.processLegacyWordTerminal(
          expiredCandidate,
          "LibreOffice test",
          legacyContext,
          baseOptions,
          -10_000,
          0
        )
      ).toEqual({
        inputBytes: 7,
        outputBytes: 0,
        passed: false,
        unapproved: true,
      });
    })
  );

  it.effect("fails closed on genuine legacy fidelity loss and mid-conversion source drift", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "legacy-fidelity-" });
      const outputRoot = path.join(root, "output");
      yield* fs.makeDirectory(outputRoot, { recursive: true });
      const writeExecutable = Effect.fnUntraced(function* (name: string, script: string) {
        const filePath = path.join(root, name);
        yield* fs.writeFileString(filePath, script);
        yield* fs.chmod(filePath, 0o755);
        return filePath;
      });
      const bwrapPath = yield* writeExecutable(
        "bwrap",
        `#!/usr/bin/env bash
set -eu
hosts=()
targets=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --ro-bind|--bind) hosts+=("$2"); targets+=("$3"); shift 3 ;;
    --) shift; break ;;
    *) shift ;;
  esac
done
command="$1"
shift
mapped_command="$command"
for index in "\${!targets[@]}"; do
  if [ "$command" = "\${targets[$index]}" ]; then mapped_command="\${hosts[$index]}"; fi
done
mapped=()
for argument in "$@"; do
  value="$argument"
  for index in "\${!targets[@]}"; do
    target="\${targets[$index]}"
    host="\${hosts[$index]}"
    if [ "$argument" = "$target" ]; then value="$host";
    elif [[ "$argument" = "$target/"* ]]; then value="$host\${argument#$target}"; fi
  done
  mapped+=("$value")
done
exec "$mapped_command" "\${mapped[@]}"
`
      );
      const converterPath = yield* writeExecutable(
        "converter",
        `#!/usr/bin/env bash
set -eu
format=""
outdir=""
input=""
previous=""
for argument in "$@"; do
  if [ "$previous" = "--convert-to" ]; then format="$argument"; fi
  if [ "$previous" = "--outdir" ]; then outdir="$argument"; fi
  previous="$argument"
  input="$argument"
done
mkdir -p "$outdir"
if [ "$format" = "docx" ]; then cp "$input" "$outdir/source.docx";
elif [ "$format" = "pdf" ]; then printf '%%PDF-1.4 page\n' > "$outdir/source.pdf";
else exit 92; fi
`
      );
      const mutatingConverterPath = yield* writeExecutable(
        "mutating-converter",
        `#!/usr/bin/env bash
set -eu
format=""
outdir=""
input=""
previous=""
for argument in "$@"; do
  if [ "$previous" = "--convert-to" ]; then format="$argument"; fi
  if [ "$previous" = "--outdir" ]; then outdir="$argument"; fi
  previous="$argument"
  input="$argument"
done
mkdir -p "$outdir"
if [ "$format" = "docx" ]; then cp "$input" "$outdir/source.docx"; printf x >> "$input";
elif [ "$format" = "pdf" ]; then printf '%%PDF-1.4 page\n' > "$outdir/source.pdf";
else exit 92; fi
`
      );
      const tikaPath = yield* writeExecutable(
        "tika",
        "#!/bin/sh\nlast=''\nfor argument in \"$@\"; do last=\"$argument\"; done\ncase \"$last\" in *.docx) printf 'converted text\\n' ;; *) printf 'original text\\n' ;; esac\n"
      );
      const pdfinfoPath = yield* writeExecutable("pdfinfo", "#!/bin/sh\nprintf 'Pages: 1\\n'\n");
      const pdftoppmPath = yield* writeExecutable(
        "pdftoppm",
        '#!/bin/sh\nprefix=""\nfor argument do prefix="$argument"; done\nprintf page > "$prefix-1.png"\n'
      );
      const comparePath = yield* writeExecutable("compare", "#!/bin/sh\nprintf '0 (0.25)\\n' >&2\nexit 0\n");
      const optionsFor = (selectedConverter: string) =>
        RestorationLegacyWordOptions.make({
          bwrapPath,
          comparePath,
          converterPath: selectedConverter,
          corpusRoot: root,
          expectedConverterVersion: "unused",
          expectedOccurrenceCount: NonNegativeInt.make(1),
          javaPath: tikaPath,
          maxElapsedMillis: PosInt.make(10_000),
          maxTotalElapsedMillis: PosInt.make(10_000),
          maxTotalOutputBytes: PosInt.make(1_000_000),
          maxVisualRmse: 0,
          pdfinfoPath,
          pdftoppmPath,
          tikaJarPath: tikaPath,
        });
      const legacyContext = {
        ...context,
        corpusRoot: root,
        ledgerPath: path.join(root, "legacy.jsonl"),
        outputRoot,
        runRoot: root,
        startedAt: DateTime.toEpochMillis(yield* DateTime.now),
      };
      const cfb = new Uint8Array(64);
      cfb.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
      cfb.fill(0x42, 8);
      const sourcePath = path.join(root, "source.doc");
      yield* fs.writeFile(sourcePath, cfb);
      const digest = Sha256Hex.make(bytesToHex(sha256(cfb)));
      const pass = ArchiveLedgerRecord.cases["archive-file-pass"].make({
        ...archivedFile("legacy-fidelity", "legacy/source.doc", cfb.length),
        sha256: digest,
      });
      const candidate = { digest, occurrenceCount: 1, pass, sourcePath };
      const fidelityFailure = yield* RT.processLegacyWordCandidate(
        candidate,
        "engine",
        legacyContext,
        optionsFor(converterPath)
      );
      expect(fidelityFailure.inputBytes).toBe(cfb.length);
      expect(fidelityFailure.outputBytes).toBeGreaterThan(0);
      expect(fidelityFailure.passed).toBe(false);
      expect(fidelityFailure.unapproved).toBe(true);

      const driftSourcePath = path.join(root, "drift.doc");
      yield* fs.writeFile(driftSourcePath, cfb);
      const driftPass = ArchiveLedgerRecord.cases["archive-file-pass"].make({
        ...archivedFile("legacy-drift", "legacy/drift.doc", cfb.length),
        sha256: digest,
      });
      expect(
        O.isNone(
          yield* RT.processLegacyWordCandidate(
            { digest, occurrenceCount: 1, pass: driftPass, sourcePath: driftSourcePath },
            "engine",
            legacyContext,
            optionsFor(mutatingConverterPath)
          ).pipe(Effect.option)
        )
      ).toBe(true);
    })
  );

  it.effect("rejects invalid persisted run-state shapes at each resumability boundary", () =>
    Effect.gen(function* () {
      const runStart = TransformationLedgerRecord.cases["family-run-start"].make({
        ...identity,
        expectedCount: NonNegativeInt.make(0),
        family: "legacy-word",
        maxTotalElapsedMillis: PosInt.make(100),
        maxTotalOutputBytes: PosInt.make(100),
        policySha256: sha("policy"),
        recordType: "family-run-start",
      });
      const summary = TransformationLedgerRecord.cases["family-run-summary"].make({
        ...identity,
        elapsedMillis: NonNegativeInt.make(1),
        exceptionCount: NonNegativeInt.make(0),
        family: "legacy-word",
        inputBytes: NonNegativeInt.make(0),
        maxTotalElapsedMillis: PosInt.make(100),
        maxTotalOutputBytes: PosInt.make(100),
        outputBytes: NonNegativeInt.make(0),
        outputTreeSha256: sha("empty"),
        passCount: NonNegativeInt.make(0),
        recordType: "family-run-summary",
        sourceCount: NonNegativeInt.make(0),
        unapprovedCount: NonNegativeInt.make(0),
      });
      const acceptance = TransformationLedgerRecord.cases["family-acceptance-failure"].make({
        ...identity,
        evidenceSha256: sha("evidence"),
        expectedCount: NonNegativeInt.make(0),
        family: "legacy-word",
        maxTotalElapsedMillis: PosInt.make(100),
        maxTotalOutputBytes: PosInt.make(100),
        message: "rejected",
        outputTreeSha256: sha("empty"),
        recordType: "family-acceptance-failure",
        terminalCount: NonNegativeInt.make(0),
        unapprovedCount: NonNegativeInt.make(1),
      });

      expect(O.isSome(yield* RT.resumableFamilyStart(context, []).pipe(Effect.option))).toBe(true);
      expect(O.isSome(yield* RT.resumableFamilyStart(context, [runStart]).pipe(Effect.option))).toBe(true);
      expect(O.isNone(yield* RT.resumableFamilyStart(context, [acceptance]).pipe(Effect.option))).toBe(true);
      expect(O.isNone(yield* RT.resumableFamilyStart(context, [summary, runStart]).pipe(Effect.option))).toBe(true);
      expect(O.isNone(yield* RT.resumableFamilyStart(context, [summary]).pipe(Effect.option))).toBe(true);
      expect((yield* RT.contextFromFamilyStart(context, runStart)).startedAt).toBeGreaterThan(0);
      const invalidStart = { ...runStart, recordedAt: "not-a-date" };
      expect(O.isNone(yield* RT.contextFromFamilyStart(context, invalidStart).pipe(Effect.option))).toBe(true);
      expect(O.isNone(yield* RT.requireMailScope(context).pipe(Effect.option))).toBe(true);
      expect(
        yield* RT.requireMailScope({ ...context, family: "mail", mailScope: O.some<"full" | "slice">("full") })
      ).toBe("full");
      expect(
        O.isNone(
          yield* RT.rejectFamilyPreflight(
            true,
            context,
            0,
            PosInt.make(100),
            PosInt.make(100),
            "denied",
            "preflight rejected"
          ).pipe(Effect.option)
        )
      ).toBe(true);
    })
  );

  it.effect("derives preservation elapsed time and rejects unsealed evidence", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "transformation-preservation-" });
      const corpusRoot = path.join(root, "corpus");
      const ledgerDirectory = path.join(corpusRoot, "raw/run-1");
      yield* fs.makeDirectory(ledgerDirectory, { recursive: true });

      const preflight = ArchiveLedgerRecord.cases["archive-preflight"].make({
        approved: true,
        approvedCeilingBytes: NonNegativeInt.make(10),
        availableBytes: NonNegativeInt.make(10),
        directoryCount: NonNegativeInt.make(0),
        fileCount: NonNegativeInt.make(0),
        minimumFreeAfterBytes: NonNegativeInt.make(0),
        recordedAt: "2026-08-30T00:00:00.000Z",
        recordType: "archive-preflight",
        requiredBytes: NonNegativeInt.make(0),
        runId: "preservation-1",
        schemaVersion: "oppold-corpus-restoration/v1",
      });
      const seal = ArchiveLedgerRecord.cases["archive-manifest-seal"].make({
        manifestSha256: sha("manifest"),
        recordCount: NonNegativeInt.make(1),
        recordedAt: "2026-08-30T00:00:00.125Z",
        recordType: "archive-manifest-seal",
        runId: "preservation-1",
        schemaVersion: "oppold-corpus-restoration/v1",
      });
      expect(yield* RT.deterministicPreservationElapsed([preflight, seal], seal)).toBe(125);
      const invalidElapsed = yield* RT.deterministicPreservationElapsed([], seal).pipe(Effect.option);
      expect(O.isNone(invalidElapsed)).toBe(true);

      yield* fs.writeFileString(path.join(ledgerDirectory, "archive-ledger.jsonl"), "");
      const unsealed = yield* RT.currentPreservationEvidence(corpusRoot, "run-1").pipe(Effect.option);
      expect(O.isNone(unsealed)).toBe(true);
      const encoded = yield* Effect.forEach([preflight, seal], encodeArchiveLedgerRecordJson);
      yield* fs.writeFileString(path.join(ledgerDirectory, "archive-ledger.jsonl"), `${encoded.join("\n")}\n`);
      const evidence = yield* RT.currentPreservationEvidence(corpusRoot, "run-1");
      expect(evidence.records).toHaveLength(2);
      expect(evidence.seal.runId).toBe("preservation-1");

      const emptyFile = path.join(root, "empty.bin");
      yield* fs.writeFile(emptyFile, new Uint8Array());
      expect((yield* RT.readPrefix(emptyFile)).byteLength).toBe(0);
    })
  );

  it.effect("reads strict terminal family evidence and rejects incomplete ledgers", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "strict-family-evidence-" });
      const ledgerPath = path.join(root, "legacy.jsonl");
      const strictContext = {
        ...context,
        corpusRoot: root,
        ledgerPath,
        outputRoot: path.join(root, "output"),
        runRoot: root,
      };
      const runStart = familyRunStart("legacy-word", 0);
      yield* fs.writeFileString(ledgerPath, `${yield* encodeTransformationLedgerRecordJson(runStart)}\n`);
      expect(O.isNone(yield* RT.readStrictFamilyEvidence(strictContext).pipe(Effect.option))).toBe(true);

      const summary = familySummary("legacy-word", 0, 0, 0);
      const acceptance = TransformationLedgerRecord.cases["family-acceptance-pass"].make({
        ...identity,
        evidenceSha256: sha("evidence"),
        expectedCount: NonNegativeInt.make(0),
        family: "legacy-word",
        maxTotalElapsedMillis: PosInt.make(100),
        maxTotalOutputBytes: PosInt.make(100),
        outputTreeSha256: summary.outputTreeSha256,
        recordType: "family-acceptance-pass",
        terminalCount: NonNegativeInt.make(0),
        unapprovedCount: 0,
      });
      const encoded = yield* Effect.forEach([runStart, summary, acceptance], encodeTransformationLedgerRecordJson);
      yield* fs.writeFileString(ledgerPath, `${encoded.join("\n")}\n`);
      const evidence = yield* RT.readStrictFamilyEvidence(strictContext);
      expect(evidence.segment).toEqual([runStart]);
      expect(evidence.summary).toEqual(summary);
      expect(evidence.acceptance).toEqual(acceptance);
    })
  );

  it.effect("checkpoints attachment repairs idempotently and rejects identity conflicts", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "attachment-checkpoints-" });
      const ledgerPath = path.join(root, "ledgers/mail/full.jsonl");
      yield* fs.makeDirectory(path.dirname(ledgerPath), { recursive: true });
      const mailContext = {
        ...context,
        corpusRoot: root,
        family: "mail" as const,
        ledgerPath,
        mailScope: O.some<"full" | "slice">("full"),
        outputRoot: path.join(root, "output"),
        runRoot: root,
      };
      yield* RT.appendAttachmentRepair(
        mailContext,
        "attempt-1",
        "object-1",
        "attachments/file.bin",
        "pdf",
        "attachments/file.pdf",
        "unsupported",
        O.none()
      );
      const first = yield* fs.readFileString(ledgerPath);
      yield* RT.appendAttachmentRepair(
        mailContext,
        "attempt-1",
        "object-1",
        "attachments/file.bin",
        "pdf",
        "attachments/file.pdf",
        "unsupported",
        O.none()
      );
      expect(yield* fs.readFileString(ledgerPath)).toBe(first);
      const conflict = yield* RT.appendAttachmentRepair(
        mailContext,
        "attempt-1",
        "object-1",
        "attachments/file.bin",
        "png",
        "attachments/file.pdf",
        "unsupported",
        O.none()
      ).pipe(Effect.option);
      expect(O.isNone(conflict)).toBe(true);

      yield* RT.appendAttachmentRepair(
        mailContext,
        "attempt-2",
        "object-2",
        "attachments/typed.bin",
        "pdf",
        "derived/typed.pdf",
        "repaired",
        O.some({ sha256: sha("typed"), sizeBytes: PosInt.make(1) })
      );
      yield* RT.appendAttachmentRepair(
        mailContext,
        "attempt-2",
        "object-2",
        "attachments/typed.bin",
        "pdf",
        "derived/typed.pdf",
        "repaired",
        O.some({ sha256: sha("typed"), sizeBytes: PosInt.make(1) })
      );
      expect(yield* fs.readFileString(ledgerPath)).toContain('"derivedSizeBytes":1');

      const unterminatedPath = path.join(root, "ledgers/mail/unterminated.jsonl");
      yield* fs.writeFileString(unterminatedPath, first.trimEnd());
      expect(
        O.isNone(
          yield* RT.appendAttachmentRepair(
            { ...mailContext, ledgerPath: unterminatedPath },
            "attempt-3",
            "object-3",
            "attachments/file.bin",
            "pdf",
            "attachments/file.pdf",
            "unsupported",
            O.none()
          ).pipe(Effect.option)
        )
      ).toBe(true);

      const blankRowPath = path.join(root, "ledgers/mail/blank-row.jsonl");
      yield* fs.writeFileString(blankRowPath, `${first}\n`);
      expect(
        O.isNone(
          yield* RT.appendAttachmentRepair(
            { ...mailContext, ledgerPath: blankRowPath },
            "attempt-4",
            "object-4",
            "attachments/file.bin",
            "pdf",
            "attachments/file.pdf",
            "unsupported",
            O.none()
          ).pipe(Effect.option)
        )
      ).toBe(true);

      const terminalPath = path.join(root, "ledgers/mail/terminal.jsonl");
      const terminal = TransformationLedgerRecord.cases["family-acceptance-failure"].make({
        ...identity,
        evidenceSha256: sha("terminal"),
        expectedCount: NonNegativeInt.make(0),
        family: "mail",
        mailScope: "full",
        maxTotalElapsedMillis: PosInt.make(100),
        maxTotalOutputBytes: PosInt.make(100),
        message: "terminal",
        outputTreeSha256: sha(""),
        recordType: "family-acceptance-failure",
        terminalCount: NonNegativeInt.make(0),
        unapprovedCount: NonNegativeInt.make(1),
      });
      yield* fs.writeFileString(terminalPath, `${yield* encodeTransformationLedgerRecordJson(terminal)}\n`);
      expect(
        O.isNone(
          yield* RT.appendAttachmentRepair(
            { ...mailContext, ledgerPath: terminalPath },
            "attempt-5",
            "object-5",
            "attachments/file.bin",
            "pdf",
            "attachments/file.pdf",
            "unsupported",
            O.none()
          ).pipe(Effect.option)
        )
      ).toBe(true);

      const invalidPendingPath = path.join(root, "ledgers/mail/invalid-pending.jsonl");
      const pendingSummary = familySummary("mail", 0, 0, 0);
      yield* fs.writeFileString(
        invalidPendingPath,
        `${yield* encodeTransformationLedgerRecordJson(pendingSummary)}\n${first}`
      );
      expect(
        O.isNone(
          yield* RT.appendAttachmentRepair(
            { ...mailContext, ledgerPath: invalidPendingPath },
            "attempt-6",
            "object-6",
            "attachments/file.bin",
            "pdf",
            "attachments/file.pdf",
            "unsupported",
            O.none()
          ).pipe(Effect.option)
        )
      ).toBe(true);
    })
  );

  it.effect("resumes empty and persisted family ledgers through their distinct callbacks", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "family-resume-" });
      const ledgerPath = path.join(root, "legacy.jsonl");
      const runContext = {
        ...context,
        corpusRoot: root,
        ledgerPath,
        outputRoot: path.join(root, "output"),
        runRoot: root,
      };
      const fresh = yield* RT.resumeFamilyCandidates(runContext, ["candidate"], 7, () => Effect.die("unreachable"));
      expect(fresh).toEqual({
        candidates: ["candidate"],
        counters: { exceptionCount: 0, inputBytes: 0, outputBytes: 7, passCount: 0, unapprovedCount: 0 },
      });

      const runStart = TransformationLedgerRecord.cases["family-run-start"].make({
        ...identity,
        expectedCount: NonNegativeInt.make(1),
        family: "legacy-word",
        maxTotalElapsedMillis: PosInt.make(100),
        maxTotalOutputBytes: PosInt.make(100),
        policySha256: sha("policy"),
        recordType: "family-run-start",
      });
      yield* fs.writeFileString(ledgerPath, `${yield* encodeTransformationLedgerRecordJson(runStart)}\n`);
      const resumed = yield* RT.resumeFamilyCandidates(runContext, ["candidate"], 7, (records) =>
        Effect.succeed({ candidates: [], counters: { ...RT.emptyFamilyCounters(), inputBytes: records.length } })
      );
      expect(resumed.candidates).toEqual([]);
      expect(resumed.counters.inputBytes).toBe(1);
      expect(yield* RT.currentLedgerDigest(path.join(root, "absent.jsonl"))).toBe(sha(""));
      expect(RT.familyRunStartMatches(runStart, runContext, 1, PosInt.make(100), PosInt.make(100), sha("policy"))).toBe(
        true
      );
      expect(
        RT.familyRunStartMatches(
          runStart,
          { ...runContext, mailScope: O.some<"full" | "slice">("full") },
          1,
          PosInt.make(100),
          PosInt.make(100),
          sha("policy")
        )
      ).toBe(false);
      expect((yield* RT.applyFamilyCeiling(RT.emptyFamilyCounters(), -1, 0, 100)).unapprovedCount).toBe(1);
      expect(
        O.isNone(
          yield* RT.rejectFamilyPreflight(
            true,
            runContext,
            1,
            PosInt.make(100),
            PosInt.make(100),
            "rejected",
            "pending rejection"
          ).pipe(Effect.option)
        )
      ).toBe(true);
      const summary = familySummary("legacy-word", 0, 0, 0);
      expect(
        O.isNone(
          yield* RT.completePendingFamilySummary({
            context: runContext,
            contractMatches: false,
            counters: RT.emptyFamilyCounters(),
            decoded: { lines: [yield* encodeTransformationLedgerRecordJson(summary)], records: [summary] },
            expectedTerminalCount: 0,
            maxTotalElapsedMillis: PosInt.make(100),
            maxTotalOutputBytes: PosInt.make(100),
            outputTree: { sha256: sha(""), sizeBytes: 0 },
            sourceCount: 0,
            terminalCount: 0,
          }).pipe(Effect.option)
        )
      ).toBe(true);
    })
  );

  it.effect("fails closed when a PST candidate has no preservation pass", () =>
    Effect.gen(function* () {
      const options = RestorationMailOptions.make({
        corpusRoot: "/corpus",
        expectedStoreCount: NonNegativeInt.make(0),
        maxAmplificationRatio: 1,
        maxElapsedMillis: PosInt.make(100),
        maxTotalElapsedMillis: PosInt.make(100),
        maxTotalOutputBytes: PosInt.make(100),
        pffexportPath: "pffexport",
        scope: "full",
        tikaJarPath: "/tika.jar",
      });
      const now = DateTime.toEpochMillis(yield* DateTime.now);
      expect(yield* RT.familyElapsedMillis(-1)).toBeGreaterThan(0);
      expect(O.isNone(yield* RT.familyElapsedMillis(now + 60_000).pipe(Effect.option))).toBe(true);
      const expiredAttachmentError = yield* RT.extractAttachmentText(
        "/missing",
        "expired",
        options,
        { ...context, family: "mail", mailScope: O.some<"full" | "slice">("full") },
        -1_000
      ).pipe(Effect.flip);
      expect(expiredAttachmentError.message).toContain("Attachment repair exhausted the elapsed-time budget");
      expect(
        yield* RT.processPstCandidate(
          { family: "pst", objectId: "missing", pass: O.none(), sourcePath: "/missing.pst" },
          options,
          { ...context, family: "mail", mailScope: O.some<"full" | "slice">("full") },
          100,
          100,
          "attempt-1"
        )
      ).toEqual({ inputBytes: 0, outputBytes: 0, passed: false, unapproved: true });
    })
  );

  it.effect("matches PST engine children by path, digest, and optional size", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "pst-engine-child-" });
      const absolutePath = path.join(root, "child.eml");
      yield* fs.writeFileString(absolutePath, "child");
      const file = { absolutePath, relativePath: "messages/child.eml", sizeBytes: 5 };
      const artifactId = ArtifactId.make(`artifact:${sha("child")}`);
      const operationId = OperationId.make(`operation:${sha("operation")}`);
      const sourceArtifactId = ArtifactId.make(`artifact:${sha("source")}`);
      const child = ArtifactReference.make({
        digest: ContentDigest.make(`sha256:${sha("child")}`),
        id: artifactId,
        relativePath: PosixPath.make("messages/child.eml"),
        sizeBytes: NonNegativeInt.make(5),
      });
      const result = ArchiveExportResult.make({
        children: [child],
        engine: "libpff",
        operationId,
        sourceArtifactId,
        warnings: [],
      });
      expect(yield* RT.pstEngineChildMatches(result, file)).toBe(true);
      expect(yield* RT.pstEngineChildMatches({ ...result, children: [] }, file)).toBe(false);
      expect(
        yield* RT.pstEngineChildMatches(
          { ...result, children: [{ ...child, digest: ContentDigest.make(`sha256:${sha("different")}`) }] },
          file
        )
      ).toBe(false);
      const { digest: _digest, ...childWithoutDigest } = child;
      expect(yield* RT.pstEngineChildMatches({ ...result, children: [childWithoutDigest] }, file)).toBe(true);
      const { sizeBytes: _sizeBytes, ...childWithoutSize } = child;
      expect(yield* RT.pstEngineChildMatches({ ...result, children: [childWithoutSize] }, file)).toBe(true);
    })
  );

  it.effect("fails PST finalization on cumulative output exhaustion and source drift", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "pst-finalization-" });
      const sourcePath = path.join(root, "store.pst");
      const ledgerPath = path.join(root, "ledgers/mail/full.jsonl");
      yield* fs.writeFileString(sourcePath, "before");
      yield* fs.makeDirectory(path.dirname(ledgerPath), { recursive: true });
      const pass = ArchiveLedgerRecord.cases["archive-file-pass"].make({
        ...archivedFile("pst-finalization", "mail/store.pst", 6),
        sha256: sha("before"),
      });
      const candidate = {
        family: "pst" as const,
        objectId: pass.objectId,
        pass: O.some(pass),
        sourcePath,
      };
      const mailContext = {
        ...context,
        corpusRoot: root,
        family: "mail" as const,
        ledgerPath,
        mailScope: O.some<"full" | "slice">("full"),
        outputRoot: path.join(root, "output"),
        runRoot: root,
      };
      const options = RestorationMailOptions.make({
        corpusRoot: root,
        expectedStoreCount: NonNegativeInt.make(1),
        maxAmplificationRatio: 100,
        maxElapsedMillis: PosInt.make(10_000),
        maxTotalElapsedMillis: PosInt.make(10_000),
        maxTotalOutputBytes: PosInt.make(1_000),
        pffexportPath: "pffexport",
        scope: "full",
        tikaJarPath: "/tika.jar",
      });
      const result = ArchiveExportResult.make({
        children: [],
        engine: "libpff",
        operationId: OperationId.make(`operation:${sha("pst-finalization")}`),
        sourceArtifactId: ArtifactId.make(`artifact:${sha("pst-finalization")}`),
        warnings: [],
      });
      const validated = { engineFiles: [], enginePaths: MutableHashSet.empty<string>(), result };
      const sourceBefore = { sha256: sha("before"), sizeBytes: 6 };
      const startedAt = DateTime.toEpochMillis(yield* DateTime.now);
      const exhaustedPartial = path.join(root, "attempts/exhausted.partial");
      yield* fs.makeDirectory(exhaustedPartial, { recursive: true });
      yield* fs.writeFileString(path.join(exhaustedPartial, "message.eml"), "message");
      const exhausted = yield* RT.finishPstAttempt(
        {
          attemptId: "attempt-exhausted",
          attemptOutputCeiling: 100,
          candidate,
          context: mailContext,
          finalRoot: path.join(root, "attempts/exhausted"),
          options,
          partialRoot: exhaustedPartial,
          pass,
          sourceBefore,
          startedAt,
        },
        validated,
        0
      );
      expect(exhausted).toEqual({ inputBytes: 6, outputBytes: 7, passed: false, unapproved: true });

      const driftPartial = path.join(root, "attempts/drift.partial");
      yield* fs.makeDirectory(driftPartial, { recursive: true });
      yield* fs.writeFileString(path.join(driftPartial, "message.eml"), "message");
      yield* fs.writeFileString(sourcePath, "after!");
      const drifted = yield* RT.finishPstAttempt(
        {
          attemptId: "attempt-drift",
          attemptOutputCeiling: 100,
          candidate,
          context: mailContext,
          finalRoot: path.join(root, "attempts/drift"),
          options,
          partialRoot: driftPartial,
          pass,
          sourceBefore,
          startedAt: DateTime.toEpochMillis(yield* DateTime.now),
        },
        validated,
        100
      );
      expect(drifted).toEqual({ inputBytes: 6, outputBytes: 7, passed: false, unapproved: true });
      const ledger = yield* fs.readFileString(ledgerPath);
      expect(ledger).toContain("exceeded its approved elapsed-time or disk-amplification ceiling");
      expect(ledger).toContain("source bytes changed before terminal PASS publication");
    })
  );

  it.effect("rejects drifted PST bytes and records an exhausted-budget terminal", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "pst-preflight-" });
      const sourcePath = path.join(root, "store.pst");
      const ledgerPath = path.join(root, "ledgers/mail/full.jsonl");
      yield* fs.writeFileString(sourcePath, "abc");
      yield* fs.makeDirectory(path.dirname(ledgerPath), { recursive: true });
      const pass = ArchiveLedgerRecord.cases["archive-file-pass"].make({
        ...archivedFile("pst-budget", "mail/store.pst", 3),
        sha256: sha("abc"),
      });
      const mailContext = {
        ...context,
        corpusRoot: root,
        family: "mail" as const,
        ledgerPath,
        mailScope: O.some<"full" | "slice">("full"),
        outputRoot: path.join(root, "output"),
        runRoot: root,
      };
      const options = RestorationMailOptions.make({
        corpusRoot: root,
        expectedStoreCount: NonNegativeInt.make(1),
        maxAmplificationRatio: 1,
        maxElapsedMillis: PosInt.make(100),
        maxTotalElapsedMillis: PosInt.make(100),
        maxTotalOutputBytes: PosInt.make(100),
        pffexportPath: "pffexport",
        scope: "full",
        tikaJarPath: "/tika.jar",
      });
      const candidate = { family: "pst" as const, objectId: pass.objectId, pass: O.some(pass), sourcePath };
      const exhausted = yield* RT.processPstCandidate(candidate, options, mailContext, 0, 100, "attempt-budget");
      expect(exhausted).toEqual({ inputBytes: 3, outputBytes: 0, passed: false, unapproved: true });
      expect(yield* fs.readFileString(ledgerPath)).toContain("no remaining approved cumulative output budget");

      const drifted = { ...candidate, pass: O.some({ ...pass, sha256: sha("different") }) };
      expect(
        O.isNone(
          yield* RT.processPstCandidate(drifted, options, mailContext, 100, 100, "attempt-drift").pipe(Effect.option)
        )
      ).toBe(true);

      const noSpaceOptions = RestorationMailOptions.make({
        ...options,
        maxAmplificationRatio: Number.MAX_SAFE_INTEGER,
      });
      const noSpace = yield* RT.processPstCandidate(
        candidate,
        noSpaceOptions,
        mailContext,
        Number.MAX_SAFE_INTEGER,
        100,
        "attempt-space"
      );
      expect(noSpace).toEqual({ inputBytes: 3, outputBytes: 0, passed: false, unapproved: true });
      expect(yield* fs.readFileString(ledgerPath)).toContain(
        "Available bytes are below the next mail attempt output ceiling"
      );
    })
  );

  it.effect("checkpoints bounded mail candidates and retains interrupted attempts", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "mail-candidates-" });
      const outputRoot = path.join(root, "output");
      const mailContext = {
        ...context,
        corpusRoot: root,
        family: "mail" as const,
        ledgerPath: path.join(root, "mail.jsonl"),
        mailScope: O.some<"full" | "slice">("full"),
        outputRoot,
        runRoot: root,
      };
      yield* fs.makeDirectory(outputRoot, { recursive: true });
      const options = RestorationMailOptions.make({
        corpusRoot: root,
        expectedStoreCount: NonNegativeInt.make(3),
        maxAmplificationRatio: 1,
        maxElapsedMillis: PosInt.make(100),
        maxTotalElapsedMillis: PosInt.make(100),
        maxTotalOutputBytes: PosInt.make(100),
        pffexportPath: "pffexport",
        scope: "full",
        tikaJarPath: "/tika.jar",
      });
      const now = DateTime.toEpochMillis(yield* DateTime.now);
      const residue = { family: "residue" as const, objectId: "residue-1", pass: O.none(), sourcePath: "/absent" };
      expect(yield* RT.processMailCandidate(residue, options, mailContext, -1_000, 0)).toEqual({
        inputBytes: 0,
        outputBytes: 0,
        passed: false,
        unapproved: true,
      });
      const deferred = { ...residue, objectId: "residue-2" };
      expect(yield* RT.processMailCandidate(deferred, options, mailContext, now, 0)).toEqual({
        inputBytes: 0,
        outputBytes: 0,
        passed: false,
        unapproved: false,
      });
      const pst = { family: "pst" as const, objectId: "pst-missing", pass: O.none(), sourcePath: "/absent" };
      expect(yield* RT.processMailCandidate(pst, options, mailContext, now, 0)).toEqual({
        inputBytes: 0,
        outputBytes: 0,
        passed: false,
        unapproved: true,
      });
      expect(
        O.isNone(
          yield* RT.appendFamilyAttemptStart(mailContext, pst.objectId, sha(pst.objectId), 0).pipe(Effect.option)
        )
      ).toBe(true);

      const ledger = yield* fs.readFileString(mailContext.ledgerPath);
      expect(ledger).toContain("exhausted its approved total elapsed-time");
      expect(ledger).toContain('"disposition":"defer"');

      const pstStart = TransformationLedgerRecord.cases["family-attempt-start"].make({
        ...identity,
        attemptId: RT.familyAttemptId("mail", pst.objectId, 0),
        family: "mail",
        inputBytes: NonNegativeInt.make(0),
        mailScope: "full",
        recordType: "family-attempt-start",
        retryOrdinal: NonNegativeInt.make(0),
        sourceId: pst.objectId,
        sourceSha256: sha(pst.objectId),
      });
      const partialRelative = `attempts/${pstStart.attemptId}.partial`;
      const partial = path.join(outputRoot, partialRelative);
      yield* fs.makeDirectory(path.dirname(partial), { recursive: true });
      yield* fs.writeFileString(partial, "partial");
      yield* RT.retainInterruptedAttempt(mailContext, pstStart, [{ label: "partial", relativePath: partialRelative }]);
      yield* fs.writeFileString(partial, "second");
      expect(
        O.isNone(
          yield* RT.retainInterruptedAttempt(mailContext, pstStart, [
            { label: "partial", relativePath: partialRelative },
          ]).pipe(Effect.option)
        )
      ).toBe(true);
    })
  );

  it.effect("rejects non-file trees and enforces attachment content addresses", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "transformation-content-addresses-" });
      const outside = path.join(root, "outside.bin");
      const tree = path.join(root, "tree");
      const attemptRoot = path.join(root, "attempt");
      const ledgerPath = path.join(root, "mail.jsonl");
      yield* fs.writeFileString(outside, "outside");
      yield* fs.makeDirectory(tree, { recursive: true });
      yield* fs.symlink(outside, path.join(tree, "escape.bin"));
      expect(O.isNone(yield* RT.walkTransformationEntries(tree).pipe(Effect.option))).toBe(true);

      yield* fs.remove(path.join(tree, "escape.bin"));
      const fifo = path.join(tree, "unsupported.fifo");
      expect((yield* RT.runLegacyStep("mkfifo", [fifo], 2_000)).exitCode).toBe(0);
      expect(O.isNone(yield* RT.walkTransformationEntries(tree).pipe(Effect.option))).toBe(true);
      expect(O.isNone(yield* RT.hashTransformationTree(fifo).pipe(Effect.option))).toBe(true);
      expect(O.isNone(yield* RT.hashTransformationTree(tree).pipe(Effect.option))).toBe(true);
      expect(O.isNone(yield* RT.measureTransformationTreeBytes(fifo).pipe(Effect.option))).toBe(true);
      yield* fs.remove(fifo);

      yield* fs.makeDirectory(attemptRoot, { recursive: true });
      const source = path.join(root, "source.bin");
      const derived = path.join(attemptRoot, "derived", "source.bin");
      yield* fs.writeFileString(source, "abc");
      const expected = { sha256: sha("abc"), sizeBytes: 3 };
      const mailContext = {
        ...context,
        corpusRoot: root,
        family: "mail" as const,
        ledgerPath,
        mailScope: O.some<"full" | "slice">("full"),
        outputRoot: attemptRoot,
        runRoot: root,
      };
      yield* RT.requireAttachmentCapacity(mailContext, attemptRoot, 3, 3, "capacity");
      expect(
        O.isNone(yield* RT.requireAttachmentCapacity(mailContext, attemptRoot, 4, 3, "capacity").pipe(Effect.option))
      ).toBe(true);
      yield* RT.materializeAttachmentRepair(source, derived, attemptRoot, expected, mailContext, 3);
      yield* RT.materializeAttachmentRepair(source, derived, attemptRoot, expected, mailContext, 3);
      yield* fs.writeFileString(derived, "drift");
      expect(
        O.isNone(
          yield* RT.materializeAttachmentRepair(source, derived, attemptRoot, expected, mailContext, 10).pipe(
            Effect.option
          )
        )
      ).toBe(true);

      yield* fs.remove(derived);
      const tikaRelativePath = path.join("derived", "source.tika.txt");
      yield* RT.persistAttachmentText(attemptRoot, tikaRelativePath, "text\n", mailContext, 100);
      yield* RT.persistAttachmentText(attemptRoot, tikaRelativePath, "text\n", mailContext, 100);
      yield* fs.writeFileString(path.join(attemptRoot, tikaRelativePath), "drift");
      expect(
        O.isNone(
          yield* RT.persistAttachmentText(attemptRoot, tikaRelativePath, "text\n", mailContext, 100).pipe(Effect.option)
        )
      ).toBe(true);

      const options = RestorationMailOptions.make({
        corpusRoot: root,
        expectedStoreCount: NonNegativeInt.make(0),
        maxAmplificationRatio: 1,
        maxElapsedMillis: PosInt.make(100),
        maxTotalElapsedMillis: PosInt.make(100),
        maxTotalOutputBytes: PosInt.make(100),
        pffexportPath: "pffexport",
        scope: "full",
        tikaJarPath: "/tika.jar",
      });
      const unknownAttachment = path.join(attemptRoot, "Attachment-unknown.bin");
      yield* fs.writeFile(unknownAttachment, Uint8Array.of(0x00));
      expect(
        yield* RT.repairAttachment(
          { absolutePath: unknownAttachment, relativePath: "Attachment-unknown.bin" },
          attemptRoot,
          "attempt-unknown",
          "object-unknown",
          options,
          mailContext,
          0,
          100
        )
      ).toBe(0);
      const matchingAttachment = path.join(attemptRoot, "Attachment-document.pdf");
      yield* fs.writeFile(matchingAttachment, Uint8Array.of(0x25, 0x50, 0x44, 0x46));
      expect(
        yield* RT.repairAttachment(
          { absolutePath: matchingAttachment, relativePath: "Attachment-document.pdf" },
          attemptRoot,
          "attempt-matching",
          "object-matching",
          options,
          mailContext,
          0,
          100
        )
      ).toBe(0);
      const mismatchedAttachment = path.join(attemptRoot, "Attachment-document.bin");
      yield* fs.writeFile(mismatchedAttachment, Uint8Array.of(0x25, 0x50, 0x44, 0x46));
      expect(
        O.isNone(
          yield* RT.repairAttachment(
            { absolutePath: mismatchedAttachment, relativePath: "Attachment-document.bin" },
            attemptRoot,
            "attempt-mismatched",
            "object-mismatched",
            options,
            mailContext,
            0,
            100
          ).pipe(Effect.option)
        )
      ).toBe(true);
      const repairRecords = yield* fs.readFileString(ledgerPath);
      expect(repairRecords).toContain('"repairStatus":"unsupported"');
      expect(repairRecords).toContain('"repairStatus":"unchanged"');
      const zeroAttachment = path.join(attemptRoot, "Attachment-empty.bin");
      const emptyTika = path.join(root, "empty-tika");
      yield* fs.writeFile(zeroAttachment, new Uint8Array());
      yield* fs.writeFileString(emptyTika, "#!/bin/sh\nprintf text\n");
      yield* fs.chmod(emptyTika, 0o755);
      const emptyRepairError = yield* RT.repairDetectedAttachment(
        { absolutePath: zeroAttachment, relativePath: "Attachment-empty.bin" },
        "pdf",
        attemptRoot,
        "attempt-empty",
        "object-empty",
        RestorationMailOptions.make({
          ...options,
          bwrapPath: emptyTika,
          javaPath: emptyTika,
          maxElapsedMillis: PosInt.make(10_000),
          tikaJarPath: emptyTika,
        }),
        mailContext,
        DateTime.toEpochMillis(yield* DateTime.now),
        100
      ).pipe(Effect.flip);
      expect(emptyRepairError.message).toContain("produced an empty derived file");
      yield* RT.syncTree(attemptRoot);
    })
  );

  it.effect("reconciles strict family acceptance fields independently", () =>
    Effect.gen(function* () {
      const digest = sha("strict-output");
      const runStart = TransformationLedgerRecord.cases["family-run-start"].make({
        ...identity,
        expectedCount: NonNegativeInt.make(0),
        family: "legacy-word",
        maxTotalElapsedMillis: PosInt.make(100),
        maxTotalOutputBytes: PosInt.make(100),
        policySha256: sha("policy"),
        recordType: "family-run-start",
      });
      const summary = TransformationLedgerRecord.cases["family-run-summary"].make({
        ...identity,
        elapsedMillis: NonNegativeInt.make(1),
        exceptionCount: NonNegativeInt.make(0),
        family: "legacy-word",
        inputBytes: NonNegativeInt.make(0),
        maxTotalElapsedMillis: PosInt.make(100),
        maxTotalOutputBytes: PosInt.make(100),
        outputBytes: NonNegativeInt.make(3),
        outputTreeSha256: digest,
        passCount: NonNegativeInt.make(0),
        recordType: "family-run-summary",
        sourceCount: NonNegativeInt.make(0),
        unapprovedCount: NonNegativeInt.make(0),
      });
      const acceptance = TransformationLedgerRecord.cases["family-acceptance-pass"].make({
        ...identity,
        evidenceSha256: sha("evidence"),
        expectedCount: NonNegativeInt.make(0),
        family: "legacy-word",
        maxTotalElapsedMillis: PosInt.make(100),
        maxTotalOutputBytes: PosInt.make(100),
        outputTreeSha256: digest,
        recordType: "family-acceptance-pass",
        terminalCount: NonNegativeInt.make(0),
        unapprovedCount: 0,
      });
      const failure = TransformationLedgerRecord.cases["family-acceptance-failure"].make({
        ...acceptance,
        message: "rejected",
        recordType: "family-acceptance-failure",
        unapprovedCount: NonNegativeInt.make(1),
      });
      const evidence = {
        acceptance,
        evidenceSha256: acceptance.evidenceSha256,
        segment: [runStart],
        summary,
      };
      const outputTree = { sha256: digest, sizeBytes: 3 };

      expect(RT.familyEvidenceDigestsMatch(evidence, outputTree)).toBe(true);
      expect(RT.familyEvidenceDigestsMatch({ ...evidence, evidenceSha256: sha("drift") }, outputTree)).toBe(false);
      expect(
        RT.familyEvidenceDigestsMatch(
          { ...evidence, acceptance: { ...acceptance, outputTreeSha256: sha("drift") } },
          outputTree
        )
      ).toBe(false);
      expect(
        RT.familyEvidenceDigestsMatch(
          { ...evidence, summary: { ...summary, outputTreeSha256: sha("drift") } },
          outputTree
        )
      ).toBe(false);
      expect(RT.familyEvidenceDigestsMatch(evidence, { ...outputTree, sizeBytes: 4 })).toBe(false);

      expect(RT.familyEvidenceCeilingsMatch(evidence)).toBe(true);
      expect(
        RT.familyEvidenceCeilingsMatch({
          ...evidence,
          summary: { ...summary, elapsedMillis: NonNegativeInt.make(101) },
        })
      ).toBe(false);
      expect(
        RT.familyEvidenceCeilingsMatch({ ...evidence, summary: { ...summary, outputBytes: NonNegativeInt.make(101) } })
      ).toBe(false);
      expect(
        RT.familyEvidenceCeilingsMatch({
          ...evidence,
          acceptance: { ...acceptance, maxTotalElapsedMillis: PosInt.make(99) },
        })
      ).toBe(false);
      expect(
        RT.familyEvidenceCeilingsMatch({
          ...evidence,
          acceptance: { ...acceptance, maxTotalOutputBytes: PosInt.make(99) },
        })
      ).toBe(false);

      expect(RT.familyEvidenceTerminalsMatch(evidence)).toBe(true);
      expect(
        RT.familyEvidenceTerminalsMatch({
          ...evidence,
          acceptance: failure,
        })
      ).toBe(false);
      expect(
        RT.familyEvidenceTerminalsMatch({
          ...evidence,
          acceptance: { ...acceptance, expectedCount: NonNegativeInt.make(1) },
        })
      ).toBe(false);
      expect(
        RT.familyEvidenceTerminalsMatch({
          ...evidence,
          acceptance: { ...acceptance, terminalCount: NonNegativeInt.make(1) },
        })
      ).toBe(false);

      expect(RT.familyEvidenceAccepted(context, evidence, outputTree)).toBe(true);
      expect(RT.familyEvidenceAccepted(context, { ...evidence, acceptance: failure }, outputTree)).toBe(false);

      expect(RT.recordIdentityMatches(runStart, context)).toBe(true);
      expect(RT.recordIdentityMatches({ ...runStart, runLabel: "other" }, context)).toBe(false);
      expect(RT.strictEvidenceSha256(["one", "summary", "acceptance"])).toBe(sha("one\n"));
      expect(RT.strictEvidenceSha256(["summary", "acceptance"])).toBe(sha(""));
      expect(yield* RT.requireStrictFamilyTerminalRows(context, [runStart, summary, acceptance])).toEqual({
        acceptance,
        summary,
      });
      expect(yield* RT.requireStrictFamilyTerminalRows(context, [runStart, summary, failure])).toEqual({
        acceptance: failure,
        summary,
      });
      expect(
        O.isNone(yield* RT.requireStrictFamilyTerminalRows(context, [runStart, acceptance]).pipe(Effect.option))
      ).toBe(true);
      expect(yield* RT.requireStrictFamilySegment(context, [runStart, summary, acceptance])).toEqual([runStart]);
      expect(
        O.isNone(
          yield* RT.requireStrictFamilySegment(context, [runStart, summary, summary, acceptance]).pipe(Effect.option)
        )
      ).toBe(true);
    })
  );

  it.effect("rehashes retained mail, recycle, interrupted, and legacy evidence", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "transformation-rehash-" });

      const mailRoot = path.join(root, "mail");
      yield* fs.makeDirectory(mailRoot);
      const mailContext = {
        ...context,
        corpusRoot: root,
        family: "mail" as const,
        ledgerPath: path.join(root, "mail.jsonl"),
        mailScope: O.some<"full" | "slice">("full"),
        outputRoot: mailRoot,
        runRoot: root,
      };
      const emptyAttempt = RT.emptyMailAttemptOutputDigest();
      const exception = TransformationLedgerRecord.cases["mail-store-exception"].make({
        ...identity,
        approved: true,
        attemptId: "mail-exception",
        disposition: "quarantine",
        exceptionKind: "password",
        family: "mail",
        mailScope: "full",
        message: "password",
        objectId: "mail-object",
        recordType: "mail-store-exception",
        retainedOutputBytes: NonNegativeInt.make(0),
        retainedOutputSha256: emptyAttempt.sha256,
        sourceFamily: "pst",
      });
      yield* RT.rehashMailExceptionOutputs(mailContext, [exception]);
      expect(
        O.isNone(
          yield* RT.rehashMailExceptionOutputs(mailContext, [
            { ...exception, retainedOutputSha256: sha("drift") },
          ]).pipe(Effect.option)
        )
      ).toBe(true);
      yield* RT.requireMailPhysicalFilesOwned(mailContext, [], [], []);
      yield* fs.writeFileString(path.join(mailRoot, "rogue.txt"), "rogue");
      expect(O.isNone(yield* RT.requireMailPhysicalFilesOwned(mailContext, [], [], []).pipe(Effect.option))).toBe(true);
      yield* fs.remove(path.join(mailRoot, "rogue.txt"));

      const childPath = path.join(mailRoot, "attempts/mail-pass/child.txt");
      yield* fs.makeDirectory(path.dirname(childPath), { recursive: true });
      yield* fs.writeFileString(childPath, "child");
      const child = TransformationLedgerRecord.cases["mail-child-pass"].make({
        ...identity,
        attemptId: "mail-pass",
        childRelativePath: "child.txt",
        engineReported: true,
        family: "mail",
        mailScope: "full",
        recordType: "mail-child-pass",
        sha256: sha("child"),
        sizeBytes: NonNegativeInt.make(5),
        sourceObjectId: "mail-object",
      });
      yield* RT.rehashMailChildren(mailContext, [child], []);
      yield* fs.writeFileString(childPath, "drift");
      expect(O.isNone(yield* RT.rehashMailChildren(mailContext, [child], []).pipe(Effect.option))).toBe(true);

      const interruptedRoot = path.join(mailRoot, "interrupted/attempt-1");
      yield* fs.makeDirectory(interruptedRoot, { recursive: true });
      yield* fs.writeFileString(path.join(interruptedRoot, "retained.txt"), "retained");
      const interruptedChildPath = path.join(interruptedRoot, "final/child.txt");
      yield* fs.makeDirectory(path.dirname(interruptedChildPath), { recursive: true });
      yield* fs.writeFileString(interruptedChildPath, "child");
      const interruptedDigest = yield* RT.hashTransformationTree(interruptedRoot);
      const interrupted = TransformationLedgerRecord.cases["family-attempt-interrupted"].make({
        ...identity,
        attemptId: "attempt-1",
        disposition: "retained-for-retry",
        family: "mail",
        mailScope: "full",
        recordType: "family-attempt-interrupted",
        retainedOutputBytes: NonNegativeInt.make(interruptedDigest.sizeBytes),
        retainedOutputRelativePath: "interrupted/attempt-1",
        retainedOutputSha256: interruptedDigest.sha256,
        retryOrdinal: NonNegativeInt.make(0),
        sourceId: "source-1",
      });
      yield* RT.rehashMailChildren(mailContext, [{ ...child, attemptId: interrupted.attemptId }], [interrupted]);
      expect(
        O.isNone(
          yield* RT.rehashMailChildren(
            mailContext,
            [{ ...child, attemptId: interrupted.attemptId }],
            [{ ...interrupted, retainedOutputRelativePath: "../../escape" }]
          ).pipe(Effect.option)
        )
      ).toBe(true);
      yield* RT.rehashInterruptedOutputs(mailContext, [interrupted]);
      expect(
        O.isNone(
          yield* RT.rehashInterruptedOutputs(mailContext, [
            { ...interrupted, retainedOutputSha256: sha("wrong") },
          ]).pipe(Effect.option)
        )
      ).toBe(true);

      const recycleRoot = path.join(root, "recycle");
      yield* fs.makeDirectory(path.join(recycleRoot, "restored"), { recursive: true });
      const recycleContext = { ...context, corpusRoot: root, family: "recycle" as const, outputRoot: recycleRoot };
      yield* RT.rehashRetainedFamilyOutputs(recycleContext, []);
      yield* RT.requireRecyclePhysicalEntriesOwned(recycleContext, [], []);
      yield* fs.writeFileString(path.join(recycleRoot, "rogue.txt"), "rogue");
      expect(O.isNone(yield* RT.requireRecyclePhysicalEntriesOwned(recycleContext, [], []).pipe(Effect.option))).toBe(
        true
      );
      yield* fs.remove(path.join(recycleRoot, "rogue.txt"));
      const restored = path.join(recycleRoot, "restored/item.txt");
      yield* fs.writeFileString(restored, "item");
      const mapping = TransformationLedgerRecord.cases["recycle-mapping"].make({
        ...identity,
        attemptId: "recycle-attempt",
        contentObjectId: "content",
        digest: sha("item"),
        family: "recycle",
        metadataObjectId: "metadata",
        originalPath: "C:/item.txt",
        recordType: "recycle-mapping",
        restoredRelativePath: "item.txt",
        surfaceId: "surface-1",
      });
      yield* RT.requireRecyclePhysicalEntriesOwned(recycleContext, [mapping], []);
      const { mailScope: _mailScope, ...interruptedWithoutScope } = interrupted;
      yield* RT.requireRecyclePhysicalEntriesOwned(
        recycleContext,
        [mapping],
        [{ ...interruptedWithoutScope, family: "recycle" }]
      );
      yield* RT.rehashRecycleOutputs(recycleContext, [mapping]);
      expect(
        O.isNone(
          yield* RT.rehashRecycleOutputs(recycleContext, [{ ...mapping, digest: sha("wrong") }]).pipe(Effect.option)
        )
      ).toBe(true);

      const legacyRoot = path.join(root, "legacy");
      const originalSha256 = sha("legacy-original");
      const convertedPath = path.join(legacyRoot, `converted/${originalSha256}.docx`);
      yield* fs.makeDirectory(path.dirname(convertedPath), { recursive: true });
      yield* fs.writeFileString(convertedPath, "converted");
      const legacyContext = { ...context, corpusRoot: root, outputRoot: legacyRoot };
      const legacyPass = TransformationLedgerRecord.cases["legacy-word-pass"].make({
        ...identity,
        attemptId: "legacy-attempt",
        convertedSha256: sha("converted"),
        engineVersion: "LibreOffice test",
        family: "legacy-word",
        normalizedTextSha256: sha("normalized"),
        originalSha256,
        pageCountDelta: 0,
        postProcessOriginalSha256: originalSha256,
        recordType: "legacy-word-pass",
        visualRmse: 0,
      });
      yield* RT.rehashLegacyOutputs(legacyContext, [legacyPass]);
      expect(
        O.isNone(
          yield* RT.rehashLegacyOutputs(legacyContext, [{ ...legacyPass, convertedSha256: sha("wrong") }]).pipe(
            Effect.option
          )
        )
      ).toBe(true);
    })
  );

  it("reconciles complete mail evidence and rejects malformed ownership or accounting", () => {
    const objectId = "mail-object";
    const start = familyAttemptStart("mail", objectId, sha("mail-source"));
    const runStart = familyRunStart("mail", 1);
    const pass = TransformationLedgerRecord.cases["mail-store-pass"].make({
      ...identity,
      accountedChildCount: NonNegativeInt.make(1),
      attemptId: start.attemptId,
      childCount: NonNegativeInt.make(1),
      elapsedMillis: NonNegativeInt.make(1),
      family: "mail",
      inputBytes: NonNegativeInt.make(3),
      mailScope: "full",
      objectId,
      outputBytes: NonNegativeInt.make(3),
      postProcessSha256: sha("mail-source"),
      recordType: "mail-store-pass",
      sha256: sha("mail-output"),
      warningCount: NonNegativeInt.make(0),
    });
    const child = TransformationLedgerRecord.cases["mail-child-pass"].make({
      ...identity,
      attemptId: start.attemptId,
      childRelativePath: "messages/one.eml",
      engineReported: true,
      family: "mail",
      mailScope: "full",
      recordType: "mail-child-pass",
      sha256: sha("mail-child"),
      sizeBytes: NonNegativeInt.make(3),
      sourceObjectId: objectId,
    });
    const summary = familySummary("mail", 1, 0, 1);
    const segment = [runStart, start, child, pass];

    expect(RT.safeAttemptId(start.attemptId)).toBe(true);
    expect(RT.safeAttemptId(".")).toBe(false);
    expect(RT.safeAttemptId("..")).toBe(false);
    expect(RT.safeAttemptId("bad/name")).toBe(false);
    expect(RT.safeAttemptId("bad\\name")).toBe(false);
    expect(RT.mailPassReconciles(pass, [child], [])).toBe(true);
    expect(RT.mailPassReconciles({ ...pass, childCount: NonNegativeInt.make(0) }, [child], [])).toBe(false);
    expect(RT.mailPassReconciles(pass, [{ ...child, childRelativePath: "duplicate" }, child], [])).toBe(false);
    expect(RT.mailTerminalCountsReconcile(summary, [pass], [])).toBe(true);
    expect(RT.mailTerminalIdentitiesReconcile([pass])).toBe(true);
    expect(RT.mailTerminalIdentitiesReconcile([pass, { ...pass }])).toBe(false);
    expect(RT.mailOwnedEvidenceReconciles([pass], [], [], [child], [])).toBe(true);
    expect(RT.mailOwnedEvidenceReconciles([], [], [], [child], [])).toBe(false);
    expect(RT.attemptTerminalBindings([pass])).toEqual([{ attemptId: start.attemptId, sourceId: objectId }]);
    expect(RT.familyRunStartReconciles(summary, segment)).toBe(true);
    expect(RT.transformationAttemptLifecycleReconciles(summary, segment)).toBe(true);
    expect(RT.mailSegmentReconciles(summary, segment)).toBe(true);
    expect(RT.transformationSegmentReconciles("mail", summary, segment)).toBe(true);
    expect(RT.transformationSegmentReconciles("mail", familySummary("mail", 1, 0, 1, 1), segment)).toBe(false);

    const exception = TransformationLedgerRecord.cases["mail-store-exception"].make({
      ...identity,
      approved: true,
      attemptId: start.attemptId,
      disposition: "quarantine",
      exceptionKind: "password",
      family: "mail",
      mailScope: "full",
      message: "Password protected",
      objectId,
      recordType: "mail-store-exception",
      retainedOutputBytes: NonNegativeInt.make(0),
      retainedOutputSha256: sha(""),
      sourceFamily: "pst",
    });
    const { disposition: _disposition, ...exceptionWithoutDisposition } = exception;
    expect(RT.mailExceptionIsApproved(exception)).toBe(true);
    expect(RT.mailExceptionIsApproved(exceptionWithoutDisposition)).toBe(false);
    expect(RT.mailExceptionIsApproved({ ...exception, approved: false })).toBe(false);

    const warning = TransformationLedgerRecord.cases["mail-warning"].make({
      ...identity,
      attemptId: exception.attemptId,
      family: "mail",
      mailScope: "full",
      message: "bounded warning",
      objectId,
      recordType: "mail-warning",
    });
    expect(RT.mailPassReconciles(pass, [child], [warning])).toBe(false);
    const interrupted = TransformationLedgerRecord.cases["family-attempt-interrupted"].make({
      ...identity,
      attemptId: "interrupted-attempt",
      disposition: "retained-for-retry",
      family: "mail",
      mailScope: "full",
      recordType: "family-attempt-interrupted",
      retainedOutputBytes: NonNegativeInt.make(0),
      retainedOutputRelativePath: "attempts/interrupted.partial",
      retainedOutputSha256: sha(""),
      retryOrdinal: NonNegativeInt.make(0),
      sourceId: "interrupted-object",
    });
    expect(RT.mailOwnedEvidenceReconciles([], [exception], [], [], [warning])).toBe(true);
    expect(
      RT.mailOwnedEvidenceReconciles(
        [],
        [],
        [interrupted],
        [],
        [{ ...warning, attemptId: interrupted.attemptId, objectId: interrupted.sourceId }]
      )
    ).toBe(true);
    expect(RT.mailOwnedEvidenceReconciles([], [], [], [], [{ ...warning, attemptId: "unowned" }])).toBe(false);
  });

  it("reconciles attachment repair identities with copied and Tika derivatives", () => {
    const attemptId = RT.familyAttemptId("mail", "mail-object", 0);
    const digest = sha("derived");
    const repair = TransformationLedgerRecord.cases["attachment-type-repair"].make({
      ...identity,
      attemptId,
      detectedExtension: "pdf",
      derivedRelativePath: `derived/${digest}.pdf`,
      derivedSha256: digest,
      derivedSizeBytes: PosInt.make(3),
      family: "mail",
      mailScope: "full",
      originalRelativePath: "Attachment.bin",
      recordType: "attachment-type-repair",
      repairStatus: "repaired",
      sourceObjectId: "mail-object",
    });
    const child = (childRelativePath: string, childSha256: Sha256Hex, engineReported = false) =>
      TransformationLedgerRecord.cases["mail-child-pass"].make({
        ...identity,
        attemptId,
        childRelativePath,
        engineReported,
        family: "mail",
        mailScope: "full",
        recordType: "mail-child-pass",
        sha256: childSha256,
        sizeBytes: NonNegativeInt.make(3),
        sourceObjectId: "mail-object",
      });
    const copied = child(repair.derivedRelativePath, digest);
    const tika = child(`derived/${digest}.tika.txt`, sha("text"));
    const owners = [{ attemptId, sourceId: "mail-object" }];
    const { derivedSha256: _derivedSha256, ...repairWithoutDigest } = repair;
    const { derivedSha256: _unchangedDigest, derivedSizeBytes: _unchangedSize, ...repairWithoutDerived } = repair;

    expect(RT.attachmentRepairsReconcile([repair], [copied, tika], owners)).toBe(true);
    expect(RT.attachmentRepairsReconcile([repair, repair], [copied, tika], owners)).toBe(false);
    expect(RT.attachmentRepairsReconcile([{ ...repair, attemptId: "../escape" }], [copied, tika], owners)).toBe(false);
    expect(RT.attachmentRepairsReconcile([repair], [copied], owners)).toBe(false);
    expect(RT.attachmentRepairsReconcile([repairWithoutDigest], [copied, tika], owners)).toBe(false);
    expect(RT.attachmentRepairsReconcile([{ ...repairWithoutDerived, repairStatus: "unchanged" }], [], owners)).toBe(
      true
    );
  });

  it("reconciles recycle and legacy terminal segments against their durable attempts", () => {
    const recycleStart = familyAttemptStart("recycle", "content-object", sha("content"));
    const recycleRunStart = familyRunStart("recycle", 1);
    const mapping = TransformationLedgerRecord.cases["recycle-mapping"].make({
      ...identity,
      attemptId: recycleStart.attemptId,
      contentObjectId: "content-object",
      digest: sha("content"),
      family: "recycle",
      metadataObjectId: "metadata-object",
      originalPath: "C:/restored.txt",
      recordType: "recycle-mapping",
      restoredRelativePath: "restored.txt",
      surfaceId: "surface-1",
    });
    const join = TransformationLedgerRecord.cases["recycle-join"].make({
      ...identity,
      count: NonNegativeInt.make(1),
      family: "recycle",
      joinClass: "valid-pair",
      recordType: "recycle-join",
      sourceObjectIds: ["metadata-object", "content-object"],
      surfaceId: "surface-1",
    });
    const recycleSummary = familySummary("recycle", 1, 0, 1);
    const recycleSegment = [recycleRunStart, recycleStart, join, mapping];
    expect(RT.recycleCheckpointOrderValid([mapping, join])).toBe(true);
    expect(RT.recycleCheckpointOrderValid([join, mapping])).toBe(false);
    expect(RT.attemptTerminalBindings([mapping])).toEqual([
      { attemptId: recycleStart.attemptId, sourceId: "content-object" },
    ]);
    expect(RT.recycleSegmentReconciles(recycleSummary, recycleSegment)).toBe(true);
    expect(RT.transformationSegmentReconciles("recycle", recycleSummary, recycleSegment)).toBe(true);
    expect(
      RT.recycleSegmentReconciles(recycleSummary, [
        recycleRunStart,
        recycleStart,
        { ...join, count: NonNegativeInt.make(2) },
        mapping,
      ])
    ).toBe(false);
    expect(
      RT.recycleSegmentReconciles(recycleSummary, [
        recycleRunStart,
        recycleStart,
        join,
        { ...mapping, metadataObjectId: "content-object" },
      ])
    ).toBe(false);

    const originalSha256 = sha("legacy-source");
    const legacyStart = familyAttemptStart("legacy-word", originalSha256, originalSha256);
    const legacyRunStart = familyRunStart("legacy-word", 1);
    const legacyPass = TransformationLedgerRecord.cases["legacy-word-pass"].make({
      ...identity,
      attemptId: legacyStart.attemptId,
      convertedSha256: sha("converted"),
      engineVersion: "LibreOffice test",
      family: "legacy-word",
      normalizedTextSha256: sha("normalized"),
      originalSha256,
      pageCountDelta: 0,
      postProcessOriginalSha256: originalSha256,
      recordType: "legacy-word-pass",
      visualRmse: 0,
    });
    const legacySummary = familySummary("legacy-word", 1, 0, 1);
    const legacySegment = [legacyRunStart, legacyStart, legacyPass];
    expect(RT.attemptTerminalBindings([legacyPass])).toEqual([
      { attemptId: legacyStart.attemptId, sourceId: originalSha256 },
    ]);
    expect(RT.legacySegmentReconciles(legacySummary, legacySegment)).toBe(true);
    expect(RT.transformationSegmentReconciles("legacy-word", legacySummary, legacySegment)).toBe(true);
    expect(RT.legacySegmentReconciles(legacySummary, [...legacySegment, legacyPass])).toBe(false);
  });

  it.effect(
    "resumes a pending legacy summary and reconciles all four acceptance families",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "all-family-acceptance-" });
        const corpusRoot = path.join(root, "corpus");
        const sourceRoot = path.join(root, "source");
        const mailRoot = path.join(sourceRoot, "$Recycle.Bin", "surface-a");
        const mailPath = path.join(mailRoot, "$Rstore.pst");
        const rootArchive = path.join(root, "root-archive.zip");
        const collectorManifest = path.join(root, "collector.jsonl");
        const absentTree = path.join(root, "recorded-absent");
        const pffexportPath = path.join(root, "pffexport");
        const tikaPath = path.join(root, "tika");
        const bwrapPath = path.join(root, "bwrap");
        const systemdRunPath = path.join(root, "systemd-run");
        const converterPath = path.join(root, "converter");
        yield* fs.makeDirectory(corpusRoot, { recursive: true });
        yield* fs.makeDirectory(mailRoot, { recursive: true });
        const mailBytes = new Uint8Array(1024 * 1024 + 31);
        mailBytes.fill(0x42);
        yield* fs.writeFile(mailPath, mailBytes);
        yield* fs.writeFileString(rootArchive, "verbatim-root-archive");
        const collectorRow = yield* S.encodeEffect(S.fromJsonString(CollectorManifestRecord))(
          CollectorManifestRecord.cases.copied.make({
            dst: "F:\\salvage\\$Recycle.Bin\\surface-a\\$Rstore.pst",
            size: NonNegativeInt.make(mailBytes.length),
            src: "C:\\source\\mail-store.pst",
            status: "copied",
          })
        );
        yield* fs.writeFileString(collectorManifest, `${collectorRow}\n`);
        const writeExecutable = Effect.fnUntraced(function* (filePath: string, script: string) {
          yield* fs.writeFileString(filePath, script);
          yield* fs.chmod(filePath, 0o755);
        });
        yield* writeExecutable(
          bwrapPath,
          `#!/usr/bin/env bash
set -eu
hosts=()
targets=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --ro-bind|--bind) hosts+=("$2"); targets+=("$3"); shift 3 ;;
    --) shift; break ;;
    *) shift ;;
  esac
done
command="$1"
shift
quota_root=""
if [ "$command" = "/bin/sh" ] && [ "\${1:-}" = "-c" ]; then
  shift 3
  command="$1"
  shift
  quota_root="$(mktemp -d -p "$(dirname "$0")" quota-output.XXXXXX)"
  trap 'rm -rf -- "$quota_root"' EXIT
fi
mapped_command="$command"
for index in "\${!targets[@]}"; do
  target="\${targets[$index]}"
  host="\${hosts[$index]}"
  if [ "$command" = "$target" ]; then mapped_command="$host";
  elif [[ "$command" = "$target/"* ]]; then mapped_command="$host\${command#$target}"; fi
done
mapped=()
for argument in "$@"; do
  value="$argument"
  for index in "\${!targets[@]}"; do
    target="\${targets[$index]}"
    host="\${hosts[$index]}"
    if [ "$argument" = "$target" ]; then value="$host";
    elif [[ "$argument" = "$target/"* ]]; then value="$host\${argument#$target}"; fi
  done
  if [ -n "$quota_root" ]; then
    if [ "$argument" = "/output" ]; then value="$quota_root";
    elif [[ "$argument" = "/output/"* ]]; then value="$quota_root\${argument#/output}"; fi
  fi
  mapped+=("$value")
done
if [ -n "$quota_root" ]; then
  set +e
  "$mapped_command" "\${mapped[@]}" 1>&2
  status="$?"
  set -e
  if [ "$status" -ne 0 ]; then exit "$status"; fi
  exec /usr/bin/tar --format=posix --sort=name --numeric-owner --owner=0 --group=0 -C "$quota_root" -cf - .
fi
exec "$mapped_command" "\${mapped[@]}"
`
        );
        yield* writeExecutable(
          systemdRunPath,
          `#!/usr/bin/env bash
set -eu
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--" ]; then shift; break; fi
  shift
done
exec "$@"
`
        );
        yield* writeExecutable(
          pffexportPath,
          `#!/usr/bin/env bash
if [ "$1" = "-V" ]; then printf 'pffexport 20260608\n'; exit 0; fi
target=""
previous=""
for argument in "$@"; do
  if [ "$previous" = "-t" ]; then target="$argument"; fi
  previous="$argument"
done
item="$target.export/Top of Personal Folders/Inbox/Message00001"
mkdir -p "$item/Attachment00001"
printf 'Subject:\tSynthetic\n' > "$item/OutlookHeaders.txt"
printf 'synthetic mail body' > "$item/Message.txt"
printf '%%PDF-1.4 synthetic attachment' > "$item/Attachment00001/report.bin"
`
        );
        yield* writeExecutable(tikaPath, "#!/bin/sh\nprintf 'synthetic extracted attachment text\\n'\n");
        yield* writeExecutable(
          converterPath,
          '#!/bin/sh\nif [ "${1:-}" = "--version" ]; then printf \'LibreOffice synthetic 1.0\\n\'; exit 0; fi\nexit 2\n'
        );
        const preserveRun = (preservationRunLabel: string) =>
          RestorationPreserveOptions.make({
            absentRecycleTreePath: absentTree,
            capacityCeilingBytes: PosInt.make(10 * 1024 * 1024),
            chunkSizeBytes: PosInt.make(4_096),
            collectorDestinationPrefixSegments: NonNegativeInt.make(2),
            corpusRoot,
            expectedCollectorCopiedCount: NonNegativeInt.make(1),
            expectedCollectorErrorCount: NonNegativeInt.make(0),
            expectedCollectorExcludedSecretCount: NonNegativeInt.make(0),
            expectedCollectorPresentSuccessfulRowCount: NonNegativeInt.make(1),
            expectedCollectorResumedCount: NonNegativeInt.make(0),
            expectedCollectorRowCount: NonNegativeInt.make(1),
            expectedCollectorUniqueSuccessfulDestinationCount: NonNegativeInt.make(1),
            expectedMissingRecyclePayloadCount: NonNegativeInt.make(0),
            expectedMutatedDestinationCount: NonNegativeInt.make(0),
            expectedRootArchiveBytes: NonNegativeInt.make("verbatim-root-archive".length),
            expectedSourceDirectoryCount: NonNegativeInt.make(3),
            expectedSourceFileCount: NonNegativeInt.make(1),
            expectedSourceTreeBytes: NonNegativeInt.make(mailBytes.length),
            minimumFreeAfterBytes: NonNegativeInt.make(0),
            rootArchivePath: rootArchive,
            runLabel: preservationRunLabel,
            sourceManifestPath: collectorManifest,
            sourceRoot,
          });
        const mailOptions = (mailRunLabel: string, expectedStoreCount = 1, maxTotalOutputBytes = 1024 * 1024 * 1024) =>
          RestorationMailOptions.make({
            bwrapPath,
            corpusRoot,
            expectedStoreCount: NonNegativeInt.make(expectedStoreCount),
            javaPath: tikaPath,
            maxAmplificationRatio: 10,
            maxElapsedMillis: PosInt.make(30_000),
            maxTotalElapsedMillis: PosInt.make(30_000),
            maxTotalOutputBytes: PosInt.make(maxTotalOutputBytes),
            pffexportPath,
            runLabel: mailRunLabel,
            scope: "full",
            systemdRunPath,
            tikaJarPath: tikaPath,
          });
        const recycleOptions = (recycleRunLabel: string, expectedSurfaceCount = 1, maxTotalOutputBytes = 1024 ** 3) =>
          RestorationRecycleOptions.make({
            corpusRoot,
            expectedMissingContentCount: NonNegativeInt.make(0),
            expectedSurfaceCount: NonNegativeInt.make(expectedSurfaceCount),
            maxTotalElapsedMillis: PosInt.make(30_000),
            maxTotalOutputBytes: PosInt.make(maxTotalOutputBytes),
            runLabel: recycleRunLabel,
          });
        const legacyOptions = (legacyRunLabel: string, expectedOccurrenceCount = 0, maxTotalOutputBytes = 1024 ** 3) =>
          RestorationLegacyWordOptions.make({
            comparePath: "/bin/true",
            converterPath,
            corpusRoot,
            expectedConverterVersion: "LibreOffice synthetic 1.0",
            expectedOccurrenceCount: NonNegativeInt.make(expectedOccurrenceCount),
            maxElapsedMillis: PosInt.make(30_000),
            maxTotalElapsedMillis: PosInt.make(30_000),
            maxTotalOutputBytes: PosInt.make(maxTotalOutputBytes),
            maxVisualRmse: 0,
            pdfinfoPath: "/bin/true",
            pdftoppmPath: "/bin/true",
            runLabel: legacyRunLabel,
            tikaJarPath: tikaPath,
          });
        const runLabel = "all-family";
        yield* preserveRestorationArchive(preserveRun(runLabel));
        yield* restoreMail(mailOptions(runLabel));
        yield* restoreRecycle(recycleOptions(runLabel));
        const recycleLedgerPath = path.join(
          corpusRoot,
          "staging/restoration/runs",
          runLabel,
          "ledgers/recycle/full.jsonl"
        );
        const recycleLines = (yield* fs.readFileString(recycleLedgerPath)).trimEnd().split("\n");
        const lastRecycleLine = recycleLines.at(-1);
        if (lastRecycleLine === undefined) return yield* Effect.die("Recycle ledger was unexpectedly empty.");
        expect((yield* decodeTransformationLedgerRecordJson(lastRecycleLine)).recordType).toBe(
          "family-acceptance-pass"
        );
        yield* fs.writeFileString(recycleLedgerPath, `${recycleLines.slice(0, -1).join("\n")}\n`);
        yield* restoreRecycle(recycleOptions(runLabel));
        const legacyWordOptions = legacyOptions(runLabel);
        yield* restoreLegacyWord(legacyWordOptions);
        const legacyLedgerPath = path.join(
          corpusRoot,
          "staging/restoration/runs",
          runLabel,
          "ledgers/legacy-word/full.jsonl"
        );
        const legacyLines = (yield* fs.readFileString(legacyLedgerPath)).trimEnd().split("\n");
        const lastLegacyLine = legacyLines.at(-1);
        if (lastLegacyLine === undefined) return yield* Effect.die("Legacy ledger was unexpectedly empty.");
        expect((yield* decodeTransformationLedgerRecordJson(lastLegacyLine)).recordType).toBe("family-acceptance-pass");
        yield* fs.writeFileString(legacyLedgerPath, `${legacyLines.slice(0, -1).join("\n")}\n`);
        yield* restoreLegacyWord(legacyWordOptions);
        const acceptances = yield* reconcileRestorationAcceptance({ corpusRoot, runLabel });
        expect(acceptances.map((acceptance) => acceptance.family)).toEqual([
          "preservation",
          "mail",
          "recycle",
          "legacy-word",
        ]);
        expect(acceptances.every((acceptance) => acceptance.status === "pass")).toBe(true);

        yield* preserveRestorationArchive(preserveRun("mail-denominator"));
        const mailDenominatorError = yield* restoreMail(mailOptions("mail-denominator", 2)).pipe(Effect.flip);
        expect(mailDenominatorError.message).toContain("denominator");

        yield* preserveRestorationArchive(preserveRun("recycle-denominator"));
        const recycleDenominatorError = yield* restoreRecycle(recycleOptions("recycle-denominator", 2)).pipe(
          Effect.flip
        );
        expect(recycleDenominatorError.message).toContain("denominator");

        yield* preserveRestorationArchive(preserveRun("legacy-denominator"));
        const legacyDenominatorError = yield* restoreLegacyWord(legacyOptions("legacy-denominator", 1)).pipe(
          Effect.flip
        );
        expect(legacyDenominatorError.message).toContain("occurrence or converter-version gate");

        yield* preserveRestorationArchive(preserveRun("mail-retained"));
        const mailOutputRoot = path.join(corpusRoot, "staging/restoration/runs/mail-retained/output/mail/full");
        yield* fs.makeDirectory(mailOutputRoot, { recursive: true });
        yield* fs.writeFileString(path.join(mailOutputRoot, "retained.bin"), "over");
        const mailRetainedError = yield* restoreMail(mailOptions("mail-retained", 1, 1)).pipe(Effect.flip);
        expect(mailRetainedError.message).toContain("retained");

        yield* preserveRestorationArchive(preserveRun("recycle-retained"));
        const recycleOutputRoot = path.join(
          corpusRoot,
          "staging/restoration/runs/recycle-retained/output/recycle/full"
        );
        yield* fs.makeDirectory(recycleOutputRoot, { recursive: true });
        yield* fs.writeFileString(path.join(recycleOutputRoot, "retained.bin"), "over");
        const recycleRetainedError = yield* restoreRecycle(recycleOptions("recycle-retained", 1, 1)).pipe(Effect.flip);
        expect(recycleRetainedError.message).toContain("retained");

        yield* preserveRestorationArchive(preserveRun("legacy-retained"));
        const legacyOutputRoot = path.join(
          corpusRoot,
          "staging/restoration/runs/legacy-retained/output/legacy-word/full"
        );
        yield* fs.makeDirectory(legacyOutputRoot, { recursive: true });
        yield* fs.writeFileString(path.join(legacyOutputRoot, "retained.bin"), "over");
        const legacyRetainedError = yield* restoreLegacyWord(legacyOptions("legacy-retained", 0, 1)).pipe(Effect.flip);
        expect(legacyRetainedError.message).toContain("retained");
      }),
    { concurrent: false, timeout: 600_000 }
  );
});
