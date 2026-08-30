import {
  ArchiveLedgerRecord,
  encodeArchiveLedgerRecordJson,
  encodeRestorationAcceptanceRecordJson,
  encodeTransformationLedgerRecordJson,
  RestorationAcceptanceRecord,
  RestorationLegacyWordOptions,
  RestorationMailOptions,
  TransformationLedgerRecord,
} from "@beep/repo-cli/commands/Corpus";
import { restorationTransformationTesting as RT } from "@beep/repo-cli/test/Corpus";
import { NonNegativeInt, PosInt } from "@beep/schema";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { Effect, FileSystem, MutableHashMap, MutableHashSet, Path } from "effect";
import * as O from "effect/Option";

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

layer(NodeServices.layer, { timeout: 30_000 })("restoration transformation semantic helpers", (it) => {
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

    const partial = { sha256: sha("partial"), sizeBytes: 4 };
    const final = { sha256: sha("final"), sizeBytes: 6 };
    expect(RT.combineMailAttemptOutputDigests(partial, final)).toEqual({
      sha256: sha(`partial\u0000${partial.sha256}\u00004\nfinal\u0000${final.sha256}\u00006\n`),
      sizeBytes: 10,
    });
    expect(RT.emptyMailAttemptOutputDigest().sizeBytes).toBe(0);
    expect(O.getOrUndefined(RT.parseNormalizedRmse("123 (0.125)"))).toBe(0.125);
    expect(O.isNone(RT.parseNormalizedRmse("missing"))).toBe(true);
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

  it.effect("returns infinity without invoking page comparison for mismatched page sets", () =>
    Effect.gen(function* () {
      const value = yield* RT.maximumPageRmse(["one"], [], legacyOptions, legacyBudget);
      expect(value).toBe(Number.POSITIVE_INFINITY);
    })
  );

  it.effect("discovers mail, recycle, and distinct legacy candidates deterministically", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const ordinary = archivedFile("ordinary", "docs/readme.txt");
      const pst = archivedFile("pst", "$Recycle.Bin/S-1/$RSTORE.PST", 2 * 1024 * 1024);
      const pstLarger = archivedFile("pst-larger", "$Recycle.Bin/S-1/$RSTORE2.PST", 3 * 1024 * 1024);
      const eml = archivedFile("eml", "mail/one.EML");
      const residue = archivedFile("residue", "mail/folder.export/item.txt");
      const docA = archivedFile("doc-a", "legacy/a.doc");
      const docADuplicate = ArchiveLedgerRecord.cases["archive-file-pass"].make({
        ...archivedFile("doc-a-copy", "legacy/a-copy.doc"),
        sha256: docA.sha256,
      });
      const records = [ordinary, pst, pstLarger, eml, residue, docA, docADuplicate];

      const mail = RT.mailCandidates(path, "/archive", records);
      expect(mail.map((candidate) => candidate.family)).toEqual(["eml", "pst", "pst", "residue"]);
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

      const partial = `${destination}.partial`;
      yield* fs.writeFileString(partial, `${canonical}\n`);
      yield* RT.removeMatchingAcceptancePartial(directory, partial, canonical);
      expect(yield* fs.exists(partial)).toBe(false);

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
  });

  it.effect("runs bounded legacy subprocess probes and rejects exhausted budgets", () =>
    Effect.gen(function* () {
      const captured = yield* RT.runLegacyStep("sh", ["-c", "printf semantic-proof"], 2_000, "stdout");
      expect(captured.exitCode).toBe(0);
      expect(captured.output).toBe("semantic-proof");
      const exhausted = yield* RT.runLegacyStep("sh", ["-c", "exit 0"], 0).pipe(Effect.option);
      expect(O.isNone(exhausted)).toBe(true);
      expect(yield* RT.maximumPageRmse([], [], legacyOptions, legacyBudget)).toBe(0);
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
        unapprovedCount: NonNegativeInt.make(0),
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
          acceptance: { ...acceptance, unapprovedCount: NonNegativeInt.make(1) },
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
      const failure = TransformationLedgerRecord.cases["family-acceptance-failure"].make({
        ...acceptance,
        message: "rejected",
        recordType: "family-acceptance-failure",
      });
      expect(RT.familyEvidenceAccepted(context, { ...evidence, acceptance: failure }, outputTree)).toBe(false);

      expect(RT.recordIdentityMatches(runStart, context)).toBe(true);
      expect(RT.recordIdentityMatches({ ...runStart, runLabel: "other" }, context)).toBe(false);
      expect(RT.strictEvidenceSha256(["one", "summary", "acceptance"])).toBe(sha("one\n"));
      expect(RT.strictEvidenceSha256(["summary", "acceptance"])).toBe(sha(""));
      expect(yield* RT.requireStrictFamilyTerminalRows(context, [runStart, summary, acceptance])).toEqual({
        acceptance,
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
});
