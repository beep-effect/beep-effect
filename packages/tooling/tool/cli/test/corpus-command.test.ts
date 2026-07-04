import {
  archiveMoveCorpus,
  CorpusArchiveMoveManifestRecord,
  CorpusArchiveMoveOptions,
  CorpusCatalogOptions,
  CorpusCommandServiceLive,
  CorpusExtractOptions,
  CorpusProvenanceRecord,
  CorpusSalvageOptions,
  CorpusSalvageSourceSpec,
  catalogCorpus,
  classifyRecycleBinName,
  decodeCorpusProvenanceRecordJson,
  encodeCorpusProvenanceRecordJson,
  extractCorpus,
  pairRecycleBinEntries,
  parseRecycleBinMetadata,
  RecycleBinScanEntry,
  salvageCorpus,
  verifySalvage,
} from "@beep/repo-cli/commands/Corpus";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeChildProcessSpawner, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const testLayer = Layer.mergeAll(
  CorpusCommandServiceLive.pipe(
    Layer.provideMerge(NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(NodeServices.layer)))
  ),
  NodeServices.layer
);

const provideTestLayer = provideScopedLayer(testLayer);

const filetime2020 = 132_223_104_000_000_000n;

const setUint64 = (view: DataView, offset: number, value: bigint): void => {
  view.setBigUint64(offset, value, true);
};

const writeUtf16 = (view: DataView, offset: number, text: string): void => {
  Array.from(text).forEach((char, index) => {
    view.setUint16(offset + index * 2, char.charCodeAt(0), true);
  });
};

const makeMetadataV2 = (originalPath: string, sizeBytes: bigint, filetime: bigint): Uint8Array => {
  const bytes = new Uint8Array(28 + (originalPath.length + 1) * 2);
  const view = new DataView(bytes.buffer);
  setUint64(view, 0, 2n);
  setUint64(view, 8, sizeBytes);
  setUint64(view, 16, filetime);
  view.setUint32(24, originalPath.length + 1, true);
  writeUtf16(view, 28, originalPath);
  return bytes;
};

const makeMetadataV1 = (originalPath: string, sizeBytes: bigint, filetime: bigint): Uint8Array => {
  const bytes = new Uint8Array(24 + 520);
  const view = new DataView(bytes.buffer);
  setUint64(view, 0, 1n);
  setUint64(view, 8, sizeBytes);
  setUint64(view, 16, filetime);
  writeUtf16(view, 24, originalPath);
  return bytes;
};

describe("Corpus recycle-bin parsing", () => {
  it.effect("parses a v2 $I metadata record", () =>
    Effect.gen(function* () {
      const original = yield* parseRecycleBinMetadata(
        makeMetadataV2("H:\\Clients\\Acme\\Spec (final).docx", 54_805n, filetime2020)
      );

      expect(original.version).toBe("v2");
      expect(original.originalPath).toBe("H:\\Clients\\Acme\\Spec (final).docx");
      expect(original.originalName).toBe("Spec (final).docx");
      expect(original.originalSizeBytes).toBe(54_805);
      expect(original.deletedAtIso).toBe("2020-01-01T00:00:00.000Z");
      expect(original.deletedAtFiletime).toBe(filetime2020.toString());
    })
  );

  it.effect("parses a v1 $I metadata record with a fixed-width path", () =>
    Effect.gen(function* () {
      const original = yield* parseRecycleBinMetadata(makeMetadataV1("C:\\old\\draft.doc", 11n, filetime2020));

      expect(original.version).toBe("v1");
      expect(original.originalPath).toBe("C:\\old\\draft.doc");
      expect(original.originalName).toBe("draft.doc");
    })
  );

  it.effect("rejects records that are too short or have unknown versions", () =>
    Effect.gen(function* () {
      const shortResult = yield* parseRecycleBinMetadata(new Uint8Array(8)).pipe(Effect.flip);
      expect(shortResult.message).toContain("header bytes");

      const badVersion = makeMetadataV2("C:\\x.txt", 1n, filetime2020);
      new DataView(badVersion.buffer).setBigUint64(0, 9n, true);
      const versionResult = yield* parseRecycleBinMetadata(badVersion).pipe(Effect.flip);
      expect(versionResult.message).toContain("unsupported format version");
    })
  );

  it("classifies $I and $R names and ignores everything else", () => {
    expect(O.map(classifyRecycleBinName("$I0CB4M9.docx"), (entry) => `${entry.kind}:${entry.pairKey}`)).toStrictEqual(
      O.some("metadata:0CB4M9.docx")
    );
    expect(O.map(classifyRecycleBinName("$R0CB4M9.docx"), (entry) => `${entry.kind}:${entry.pairKey}`)).toStrictEqual(
      O.some("content:0CB4M9.docx")
    );
    expect(O.isNone(classifyRecycleBinName("README.md"))).toBe(true);
    expect(O.isNone(classifyRecycleBinName("$Xnope.txt"))).toBe(true);
  });

  it("pairs metadata with content and reports leftovers", () => {
    const pairing = pairRecycleBinEntries([
      RecycleBinScanEntry.make({ kind: "metadata", pairKey: "A1.docx", relativePath: "$IA1.docx" }),
      RecycleBinScanEntry.make({ kind: "content", pairKey: "A1.docx", relativePath: "$RA1.docx" }),
      RecycleBinScanEntry.make({ kind: "metadata", pairKey: "B2.pdf", relativePath: "$IB2.pdf" }),
      RecycleBinScanEntry.make({ kind: "content", pairKey: "C3.txt", relativePath: "$RC3.txt" }),
    ]);

    expect(pairing.matched.map((pair) => pair.pairKey)).toStrictEqual(["A1.docx"]);
    expect(pairing.unmatchedMetadata.map((entry) => entry.relativePath)).toStrictEqual(["$IB2.pdf"]);
    expect(pairing.unmatchedContent.map((entry) => entry.relativePath)).toStrictEqual(["$RC3.txt"]);
  });
});

describe("corpus catalog", () => {
  it.effect("builds the catalog, duplicate report, and restoration manifest from a synthetic corpus", () =>
    Effect.gen(function* () {
      const digestA = "a".repeat(64);
      const digestB = "b".repeat(64);
      const digestMeta = "c".repeat(64);
      const digestContent = "d".repeat(64);
      const digestLoose = "e".repeat(64);

      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const corpusRoot = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-catalog-test-" });
      const rawDir = path.join(corpusRoot, "raw");
      const sourceADir = path.join(rawDir, "source-a");
      yield* fs.makeDirectory(sourceADir, { recursive: true });

      const metadataDest = path.join(sourceADir, "$IAB12CD.docx");
      yield* fs.writeFile(metadataDest, makeMetadataV2("H:\\Clients\\Acme\\Spec v3.docx", 1_024n, filetime2020));

      const record = (
        sourceLabel: string,
        relativePath: string,
        sha256: string,
        sizeBytes: number,
        destPath: string
      ): string =>
        JSON.stringify({
          destPath,
          mtimeEpoch: 1_700_000_000,
          mtimeIso: "2023-11-14T22:13:20Z",
          originPath: `/origin/${sourceLabel}/${relativePath}`,
          relativePath,
          salvagedAt: "2026-06-11T15:00:00Z",
          sha256,
          sizeBytes,
          sourceLabel,
        });

      const manifestLines = [
        record("source-a", "docs/a.txt", digestA, 100, path.join(sourceADir, "docs/a.txt")),
        record("source-a", "docs/b.txt", digestB, 200, path.join(sourceADir, "docs/b.txt")),
        record("source-b", "copy/a.txt", digestA, 100, path.join(rawDir, "source-b/copy/a.txt")),
        record("source-a", "$IAB12CD.docx", digestMeta, 146, metadataDest),
        record("source-a", "$RAB12CD.docx", digestContent, 1_024, path.join(sourceADir, "$RAB12CD.docx")),
        record("source-a", "$RZZ99XX.pdf", digestLoose, 5_000, path.join(sourceADir, "$RZZ99XX.pdf")),
      ];
      yield* fs.writeFileString(path.join(rawDir, "provenance.jsonl"), `${manifestLines.join("\n")}\n`);

      const summary = yield* catalogCorpus(CorpusCatalogOptions.make({ corpusRoot }));

      const restorationText = yield* fs.readFileString(path.join(corpusRoot, "catalog", "restoration-manifest.jsonl"));
      const duplicateText = yield* fs.readFileString(
        path.join(corpusRoot, "catalog", "reports", "duplicate-sets.json")
      );
      const summaryText = yield* fs.readFileString(path.join(corpusRoot, "catalog", "reports", "catalog-summary.json"));
      const databaseExists = yield* fs.exists(path.join(corpusRoot, "catalog", "corpus.duckdb"));

      expect(summary.sourceFiles).toBe(6);
      expect(summary.totalBytes).toBe(100 + 200 + 100 + 146 + 1_024 + 5_000);
      expect(summary.distinctDigests).toBe(5);
      expect(summary.duplicateSets).toBe(1);
      expect(summary.duplicateFiles).toBe(1);
      expect(summary.redundantBytes).toBe(100);
      expect(summary.matchedRestorations).toBe(1);
      expect(summary.unmatchedMetadataFiles).toBe(0);
      expect(summary.unmatchedContentFiles).toBe(1);

      expect(databaseExists).toBe(true);
      expect(duplicateText).toContain(`sha256:${digestA}`);
      expect(duplicateText).toContain("source-a/docs/a.txt | source-b/copy/a.txt");
      expect(summaryText).toContain('"sourceFiles":6');

      const restorationLines = restorationText.trim().split("\n");
      expect(restorationLines).toHaveLength(2);
      expect(restorationText).toContain("Spec v3.docx");
      expect(restorationText).toContain("unmatched-content");
    }).pipe(Effect.scoped, provideTestLayer)
  );
});

const stubPffexport = `#!/usr/bin/env bash
target=""
prev=""
for arg in "$@"; do
  if [ "$prev" = "-t" ]; then target="$arg"; fi
  prev="$arg"
done
source="\${@: -1}"
[ -f "$source" ] || exit 2
mkdir -p "$target.export/Top of Personal Folders/Inbox/Message00001/Attachments"
printf 'hello body' > "$target.export/Top of Personal Folders/Inbox/Message00001/Message.txt"
printf 'pdfbytes' > "$target.export/Top of Personal Folders/Inbox/Message00001/Attachments/report.pdf"
exit 0
`;

const stubJava = `#!/usr/bin/env bash
printf '%s' '[{"Content-Type":"text/plain","X-TIKA:content":"\\n  stub text body\\n"}]'
exit 0
`;

const writeStub = Effect.fn("CorpusTest.writeStub")(function* (script: string, stubPath: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(stubPath, script);
  yield* fs.chmod(stubPath, 0o755);
});

const alphaDigest = "8ed3f6ad685b959ead7022518e1af76cd816f8e8ec7ccdda1ed4018e8f2223f8";

const sourceSpec = (sourceLabel: string, sourcePath: string): CorpusSalvageSourceSpec =>
  CorpusSalvageSourceSpec.make({ sourceLabel, sourcePath });

const provenanceRecord = (input: {
  readonly copyMode?: "copied" | "provenance-only";
  readonly dedupeOfPath?: string;
  readonly destPath: string;
  readonly originPath: string;
  readonly relativePath: string;
  readonly sha256: string;
  readonly sizeBytes: number;
  readonly sourceLabel: string;
}): CorpusProvenanceRecord =>
  CorpusProvenanceRecord.make({
    destPath: input.destPath,
    mtimeEpoch: 1_700_000_000,
    mtimeIso: "2023-11-14T22:13:20Z",
    originPath: input.originPath,
    relativePath: input.relativePath,
    salvagedAt: "2026-06-11T15:00:00Z",
    sha256: input.sha256,
    sizeBytes: input.sizeBytes,
    sourceLabel: input.sourceLabel,
    ...(input.copyMode === undefined ? {} : { copyMode: input.copyMode }),
    ...(input.dedupeOfPath === undefined ? {} : { dedupeOfPath: input.dedupeOfPath }),
  });

const encodeProvenanceLine = Effect.fn("CorpusTest.encodeProvenanceLine")(function* (record: CorpusProvenanceRecord) {
  return yield* encodeCorpusProvenanceRecordJson(record);
});

const readProvenanceLines = Effect.fn("CorpusTest.readProvenanceLines")(function* (manifestPath: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(manifestPath);
  return A.filter(Str.split(text, "\n"), Str.isNonEmpty);
});

const readProvenanceRecords = Effect.fn("CorpusTest.readProvenanceRecords")(function* (manifestPath: string) {
  const lines = yield* readProvenanceLines(manifestPath);
  return yield* Effect.forEach(lines, decodeCorpusProvenanceRecordJson);
});

const decodeArchiveMoveManifestRecordJson = S.decodeUnknownEffect(S.fromJsonString(CorpusArchiveMoveManifestRecord));

const readArchiveMoveManifestRecords = Effect.fn("CorpusTest.readArchiveMoveManifestRecords")(function* (
  manifestPath: string
) {
  const lines = yield* readProvenanceLines(manifestPath);
  return yield* Effect.forEach(lines, decodeArchiveMoveManifestRecordJson);
});

describe("corpus catalog run manifests", () => {
  it.effect("unions base and run-labeled manifests with provenance-only occurrences and per-run digest deltas", () =>
    Effect.gen(function* () {
      const digestB = "b".repeat(64);
      const digestC = "c".repeat(64);
      const digestD = "d".repeat(64);
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const corpusRoot = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-catalog-runs-test-" });
      const rawRoot = path.join(corpusRoot, "raw");
      const baseSourceDir = path.join(rawRoot, "source-a");
      const runLabel = "2026-07-refresh";
      const runSourceDir = path.join(rawRoot, runLabel, "source-c");
      yield* fs.makeDirectory(baseSourceDir, { recursive: true });
      yield* fs.makeDirectory(runSourceDir, { recursive: true });

      const baseAlphaPath = path.join(baseSourceDir, "alpha.txt");
      const baseBravoPath = path.join(baseSourceDir, "bravo.txt");
      const runCharliePath = path.join(runSourceDir, "charlie.txt");
      const runDeltaOnePath = path.join(runSourceDir, "delta-one.txt");
      const runDeltaTwoPath = path.join(runSourceDir, "delta-two.txt");
      yield* fs.writeFileString(baseAlphaPath, "alpha");
      yield* fs.writeFileString(baseBravoPath, "bravo");
      yield* fs.writeFileString(runCharliePath, "charlie");
      yield* fs.writeFileString(runDeltaOnePath, "delta");
      yield* fs.writeFileString(runDeltaTwoPath, "delta");

      const baseLines = yield* Effect.forEach(
        [
          provenanceRecord({
            copyMode: "copied",
            destPath: baseAlphaPath,
            originPath: path.join(corpusRoot, "origin", "base-alpha.txt"),
            relativePath: "alpha.txt",
            sha256: alphaDigest,
            sizeBytes: 5,
            sourceLabel: "source-a",
          }),
          provenanceRecord({
            copyMode: "copied",
            destPath: baseBravoPath,
            originPath: path.join(corpusRoot, "origin", "base-bravo.txt"),
            relativePath: "bravo.txt",
            sha256: digestB,
            sizeBytes: 5,
            sourceLabel: "source-a",
          }),
        ],
        encodeProvenanceLine
      );
      const runLines = yield* Effect.forEach(
        [
          provenanceRecord({
            copyMode: "provenance-only",
            dedupeOfPath: baseAlphaPath,
            destPath: path.join(runSourceDir, "cross-run-alpha.txt"),
            originPath: path.join(corpusRoot, "origin", "refresh-alpha.txt"),
            relativePath: "cross-run-alpha.txt",
            sha256: alphaDigest,
            sizeBytes: 5,
            sourceLabel: "source-c",
          }),
          provenanceRecord({
            copyMode: "copied",
            destPath: runCharliePath,
            originPath: path.join(corpusRoot, "origin", "refresh-charlie.txt"),
            relativePath: "charlie.txt",
            sha256: digestC,
            sizeBytes: 7,
            sourceLabel: "source-c",
          }),
          provenanceRecord({
            copyMode: "copied",
            destPath: runDeltaOnePath,
            originPath: path.join(corpusRoot, "origin", "refresh-delta-one.txt"),
            relativePath: "delta-one.txt",
            sha256: digestD,
            sizeBytes: 5,
            sourceLabel: "source-c",
          }),
          provenanceRecord({
            copyMode: "copied",
            destPath: runDeltaTwoPath,
            originPath: path.join(corpusRoot, "origin", "refresh-delta-two.txt"),
            relativePath: "delta-two.txt",
            sha256: digestD,
            sizeBytes: 5,
            sourceLabel: "source-c",
          }),
        ],
        encodeProvenanceLine
      );
      yield* fs.writeFileString(path.join(rawRoot, "provenance.jsonl"), `${A.join(baseLines, "\n")}\n`);
      yield* fs.writeFileString(path.join(rawRoot, runLabel, "provenance.jsonl"), `${A.join(runLines, "\n")}\n`);

      const summary = yield* catalogCorpus(CorpusCatalogOptions.make({ corpusRoot }));
      const duplicateText = yield* fs.readFileString(
        path.join(corpusRoot, "catalog", "reports", "duplicate-sets.json")
      );
      const summaryText = yield* fs.readFileString(path.join(corpusRoot, "catalog", "reports", "catalog-summary.json"));
      const refreshRun = yield* Effect.fromOption(A.findFirst(summary.runs, (run) => run.runLabel === runLabel));

      expect(summary.sourceFiles).toBe(6);
      expect(summary.distinctDigests).toBe(4);
      expect(summary.duplicateSets).toBe(2);
      expect(refreshRun.recordCount).toBe(4);
      expect(refreshRun.distinctDigests).toBe(3);
      expect(refreshRun.newDistinctDigests).toBe(2);
      expect(duplicateText).toContain('"duplicateScope":"cross-run"');
      expect(duplicateText).toContain(`${runLabel}:source-c/cross-run-alpha.txt`);
      expect(duplicateText).toContain('"duplicateScope":"intra-run"');
      expect(summaryText).toContain(`"runLabel":"${runLabel}"`);
      expect(summaryText).toContain('"newDistinctDigests":2');
    }).pipe(Effect.scoped, provideTestLayer)
  );
});

describe("corpus extract and salvage", () => {
  it.effect("extracts a synthetic corpus through stub engines and verifies salvage", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const corpusRoot = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-extract-test-" });
      const rawDir = path.join(corpusRoot, "raw", "source-a");
      yield* fs.makeDirectory(rawDir, { recursive: true });

      const pffexportStubPath = path.join(corpusRoot, "pffexport-stub");
      const javaStubPath = path.join(corpusRoot, "java-stub");
      yield* writeStub(stubPffexport, pffexportStubPath);
      yield* writeStub(stubJava, javaStubPath);

      const pstPath = path.join(rawDir, "mailbox.pst");
      const txtPath = path.join(rawDir, "note.txt");
      yield* fs.writeFileString(pstPath, "not a real pst");
      yield* fs.writeFileString(txtPath, "stub text body");

      const record = (relativePath: string, hash: string, sizeBytes: number, destPath: string): string =>
        JSON.stringify({
          destPath,
          mtimeEpoch: 1_700_000_000,
          mtimeIso: "2023-11-14T22:13:20Z",
          originPath: `/origin/source-a/${relativePath}`,
          relativePath,
          salvagedAt: "2026-06-11T15:00:00Z",
          sha256: hash,
          sizeBytes,
          sourceLabel: "source-a",
        });

      // Real digests so salvage verification passes: sha256("not a real pst") / sha256("stub text body")
      const pstDigest = "166df44db090f14dbb3ec7730fc17e78c170477163a6c913e5485d075c4b92d0";
      const txtDigest = "ed17e4908506d9bfe380ef2aa2b226c484600dc77ada8ee21a6b3380242228c1";

      const manifestLines = [
        record("mailbox.pst", pstDigest, 14, pstPath),
        record("note.txt", txtDigest, 14, txtPath),
        record("copy/note-copy.txt", txtDigest, 14, txtPath),
      ];
      yield* fs.writeFileString(path.join(corpusRoot, "raw", "provenance.jsonl"), `${manifestLines.join("\n")}\n`);

      const summary = yield* extractCorpus(
        CorpusExtractOptions.make({
          concurrency: 2,
          corpusRoot,
          exportChildren: true,
          includeDuplicates: false,
          javaPath: javaStubPath,
          overwrite: false,
          pffexportPath: pffexportStubPath,
          tikaJarPath: path.join(corpusRoot, "raw", "provenance.jsonl"),
        })
      );

      const outDir = path.join(corpusRoot, "staging", "extract");
      const sourcesText = yield* fs.readFileString(path.join(outDir, "sources.jsonl"));
      const runExists = yield* fs.exists(path.join(outDir, "run.json"));
      const pstArtifactId = `artifact:${pstDigest}`;
      const childrenText = yield* fs.readFileString(path.join(outDir, "children", pstArtifactId, "artifacts.jsonl"));

      const salvage = yield* verifySalvage(CorpusSalvageOptions.make({ corpusRoot }));

      expect(summary.sourceCount).toBe(2);
      expect(summary.duplicatesSkipped).toBe(1);
      expect(summary.succeededCount).toBe(2);
      expect(summary.failedCount).toBe(0);
      expect(summary.childArtifactCount).toBe(2);
      expect(summary.textArtifactCount).toBe(1);
      expect(runExists).toBe(true);
      expect(sourcesText).toContain('"status":"succeeded"');
      expect(childrenText).toContain("Attachments/report.pdf");
      expect(salvage.matched).toBe(3);
      expect(salvage.mismatched).toBe(0);
      expect(salvage.missing).toBe(0);
    }).pipe(Effect.scoped, provideTestLayer)
  );
});

describe("corpus salvage run labels and dedupe", () => {
  it.effect("writes copied files and provenance under the requested run label", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-run-label-test-" });
      const corpusRoot = path.join(root, "corpus");
      const sourceDir = path.join(root, "source-a");
      yield* fs.makeDirectory(sourceDir, { recursive: true });
      yield* fs.writeFileString(path.join(sourceDir, "a.txt"), "alpha");

      const summary = yield* salvageCorpus(
        CorpusSalvageOptions.make({
          corpusRoot,
          runLabel: "run-a",
          sources: [sourceSpec("source-a", sourceDir)],
        })
      );

      const copiedExists = yield* fs.exists(path.join(corpusRoot, "raw", "run-a", "source-a", "a.txt"));
      const runManifestExists = yield* fs.exists(path.join(corpusRoot, "raw", "run-a", "provenance.jsonl"));
      const rootManifestExists = yield* fs.exists(path.join(corpusRoot, "raw", "provenance.jsonl"));
      const records = yield* readProvenanceRecords(path.join(corpusRoot, "raw", "run-a", "provenance.jsonl"));

      expect(summary.recordsChecked).toBe(1);
      expect(copiedExists).toBe(true);
      expect(runManifestExists).toBe(true);
      expect(rootManifestExists).toBe(false);
      expect(A.head(records).pipe(O.map((record) => record.copyMode))).toStrictEqual(O.some("copied"));
    }).pipe(Effect.scoped, provideTestLayer)
  );

  it.effect("writes every multi-source salvage provenance line as parseable JSON", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-multi-source-manifest-test-" });
      const corpusRoot = path.join(root, "corpus");
      const sourceADir = path.join(root, "source-a");
      const sourceBDir = path.join(root, "source-b");
      const sourceCDir = path.join(root, "source-c");
      const sourceDDir = path.join(root, "source-d");
      yield* Effect.forEach([sourceADir, sourceBDir, sourceCDir, sourceDDir], (sourceDir) =>
        fs.makeDirectory(sourceDir, { recursive: true })
      );

      const firstFileName = "~first-walked.pst.tmp";
      const firstFileBytes = new Uint8Array(131_072);
      firstFileBytes.fill(0x41);
      yield* fs.writeFile(path.join(sourceADir, firstFileName), firstFileBytes);

      const sharedFiles = [
        { body: "shared-zero", name: "shared-0.txt" },
        { body: "shared-one", name: "shared-1.txt" },
        { body: "shared-two", name: "shared-2.txt" },
        { body: "shared-three", name: "shared-3.txt" },
      ];
      yield* Effect.forEach(
        [sourceBDir, sourceCDir, sourceDDir],
        (sourceDir) =>
          Effect.forEach(sharedFiles, (file) => fs.writeFileString(path.join(sourceDir, file.name), file.body), {
            discard: true,
          }),
        { discard: true }
      );

      const summary = yield* salvageCorpus(
        CorpusSalvageOptions.make({
          corpusRoot,
          dedupe: true,
          runLabel: "run-multi-source",
          sources: [
            sourceSpec("source-a", sourceADir),
            sourceSpec("source-b", sourceBDir),
            sourceSpec("source-c", sourceCDir),
            sourceSpec("source-d", sourceDDir),
          ],
        })
      );

      const manifestPath = path.join(corpusRoot, "raw", "run-multi-source", "provenance.jsonl");
      const lines = yield* readProvenanceLines(manifestPath);
      const records = yield* Effect.forEach(lines, decodeCorpusProvenanceRecordJson);
      const firstLine = yield* Effect.fromOption(A.head(lines));
      const firstRecord = yield* Effect.fromOption(A.head(records));

      expect(A.length(lines)).toBe(summary.recordsChecked);
      expect(A.length(records)).toBe(summary.recordsChecked);
      expect(firstLine.startsWith("{")).toBe(true);
      expect(firstLine.includes("\u0000")).toBe(false);
      expect(firstRecord.relativePath).toBe(firstFileName);
      expect(firstRecord.sizeBytes).toBe(131_072);
      expect(firstRecord.copyMode).toBe("copied");
      expect(A.length(A.filter(records, (record) => record.copyMode === "provenance-only"))).toBe(8);
    }).pipe(Effect.scoped, provideTestLayer)
  );

  it.effect("preserves POSIX filenames with punctuation and literal backslashes", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-weird-path-test-" });
      const corpusRoot = path.join(root, "corpus");
      const sourceDir = path.join(root, "source-d");
      const nestedDirName = "nested files";
      const nestedDir = path.join(sourceDir, nestedDirName);
      const weirdName = "weird; (name) [x].docx";
      const backslashName = "back\\slash.txt";
      const weirdRelativePath = path.join(nestedDirName, weirdName);
      const backslashRelativePath = path.join(nestedDirName, backslashName);
      yield* fs.makeDirectory(nestedDir, { recursive: true });
      yield* fs.writeFileString(path.join(sourceDir, weirdRelativePath), "punctuation");
      yield* fs.writeFileString(path.join(sourceDir, backslashRelativePath), "backslash");

      const summary = yield* salvageCorpus(
        CorpusSalvageOptions.make({
          corpusRoot,
          dedupe: true,
          runLabel: "run-weird",
          sources: [sourceSpec("source-d", sourceDir)],
        })
      );

      const weirdDest = path.join(corpusRoot, "raw", "run-weird", "source-d", weirdRelativePath);
      const backslashDest = path.join(corpusRoot, "raw", "run-weird", "source-d", backslashRelativePath);
      const weirdExists = yield* fs.exists(weirdDest);
      const backslashExists = yield* fs.exists(backslashDest);
      const provenancePath = path.join(corpusRoot, "raw", "run-weird", "provenance.jsonl");
      const records = yield* readProvenanceRecords(provenancePath);
      const weirdRecord = yield* Effect.fromOption(
        A.findFirst(records, (record) => record.relativePath === weirdRelativePath)
      );
      const backslashRecord = yield* Effect.fromOption(
        A.findFirst(records, (record) => record.relativePath === backslashRelativePath)
      );

      expect(summary.recordsChecked).toBe(2);
      expect(weirdExists).toBe(true);
      expect(backslashExists).toBe(true);
      expect(weirdRecord.copyMode).toBe("copied");
      expect(weirdRecord.destPath).toBe(weirdDest);
      expect(weirdRecord.originPath).toBe(path.join(sourceDir, weirdRelativePath));
      expect(weirdRecord.sourceLabel).toBe("source-d");
      expect(backslashRecord.copyMode).toBe("copied");
      expect(backslashRecord.destPath).toBe(backslashDest);
      expect(backslashRecord.originPath).toBe(path.join(sourceDir, backslashRelativePath));
      expect(backslashRecord.sourceLabel).toBe("source-d");

      const archiveRoot = path.join(root, "archive");
      const archiveSummary = yield* archiveMoveCorpus(
        CorpusArchiveMoveOptions.make({
          archiveRoot,
          provenancePaths: [provenancePath],
          sourcePaths: [sourceDir],
        })
      );

      const sourceStillExists = yield* fs.exists(sourceDir);
      const weirdArchiveExists = yield* fs.exists(path.join(archiveRoot, "source-d", weirdRelativePath));
      const backslashArchiveExists = yield* fs.exists(path.join(archiveRoot, "source-d", backslashRelativePath));
      const moveManifestPath = path.join(corpusRoot, "raw", "run-weird", "move-manifest.jsonl");
      const moveRecords = yield* readArchiveMoveManifestRecords(moveManifestPath);
      const moveRecord = yield* Effect.fromOption(A.head(moveRecords));

      expect(archiveSummary.sourcesMoved).toBe(1);
      expect(archiveSummary.filesCovered).toBe(2);
      expect(archiveSummary.copiedRecords).toBe(2);
      expect(archiveSummary.provenanceOnlyRecords).toBe(0);
      expect(sourceStillExists).toBe(false);
      expect(weirdArchiveExists).toBe(true);
      expect(backslashArchiveExists).toBe(true);
      expect(A.length(moveRecords)).toBe(1);
      expect(moveRecord.originPath).toBe(sourceDir);
      expect(moveRecord.archivePath).toBe(path.join(archiveRoot, "source-d"));
      expect(moveRecord.fileCount).toBe(2);
    }).pipe(Effect.scoped, provideTestLayer)
  );

  it.effect("uses the DuckDB catalog for dedupe-aware provenance-only salvage", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-catalog-dedupe-test-" });
      const corpusRoot = path.join(root, "corpus");
      const rawSourceDir = path.join(corpusRoot, "raw", "source-a");
      yield* fs.makeDirectory(rawSourceDir, { recursive: true });
      const existingRawPath = path.join(rawSourceDir, "existing.txt");
      yield* fs.writeFileString(existingRawPath, "alpha");
      const existingLine = yield* encodeProvenanceLine(
        provenanceRecord({
          copyMode: "copied",
          destPath: existingRawPath,
          originPath: path.join(root, "origin-a", "existing.txt"),
          relativePath: "existing.txt",
          sha256: alphaDigest,
          sizeBytes: 5,
          sourceLabel: "source-a",
        })
      );
      yield* fs.writeFileString(path.join(corpusRoot, "raw", "provenance.jsonl"), `${existingLine}\n`);
      yield* catalogCorpus(CorpusCatalogOptions.make({ corpusRoot }));

      const sourceDir = path.join(root, "source-b");
      yield* fs.makeDirectory(sourceDir, { recursive: true });
      yield* fs.writeFileString(path.join(sourceDir, "duplicate.txt"), "alpha");

      yield* salvageCorpus(
        CorpusSalvageOptions.make({
          corpusRoot,
          dedupe: true,
          sources: [sourceSpec("source-b", sourceDir)],
        })
      );

      const records = yield* readProvenanceRecords(path.join(corpusRoot, "raw", "provenance.jsonl"));
      const deduped = A.findFirst(records, (record) => record.sourceLabel === "source-b");
      const duplicateCopyExists = yield* fs.exists(path.join(corpusRoot, "raw", "source-b", "duplicate.txt"));

      expect(O.isSome(deduped)).toBe(true);
      if (O.isSome(deduped)) {
        expect(deduped.value.copyMode).toBe("provenance-only");
        expect(deduped.value.destPath).toBe(existingRawPath);
        expect(deduped.value.dedupeOfPath).toBe(existingRawPath);
      }
      expect(duplicateCopyExists).toBe(false);
    }).pipe(Effect.scoped, provideTestLayer)
  );

  it.effect("falls back to scanning raw provenance manifests when the catalog is absent", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-manifest-dedupe-test-" });
      const corpusRoot = path.join(root, "corpus");
      const priorRawDir = path.join(corpusRoot, "raw", "run-one", "source-a");
      yield* fs.makeDirectory(priorRawDir, { recursive: true });
      const existingRawPath = path.join(priorRawDir, "existing.txt");
      yield* fs.writeFileString(existingRawPath, "alpha");
      const existingLine = yield* encodeProvenanceLine(
        provenanceRecord({
          copyMode: "copied",
          destPath: existingRawPath,
          originPath: path.join(root, "origin-a", "existing.txt"),
          relativePath: "existing.txt",
          sha256: alphaDigest,
          sizeBytes: 5,
          sourceLabel: "source-a",
        })
      );
      yield* fs.writeFileString(path.join(corpusRoot, "raw", "run-one", "provenance.jsonl"), `${existingLine}\n`);

      const sourceDir = path.join(root, "source-b");
      yield* fs.makeDirectory(sourceDir, { recursive: true });
      yield* fs.writeFileString(path.join(sourceDir, "duplicate.txt"), "alpha");
      yield* salvageCorpus(
        CorpusSalvageOptions.make({
          corpusRoot,
          dedupe: true,
          runLabel: "run-two",
          sources: [sourceSpec("source-b", sourceDir)],
        })
      );

      const records = yield* readProvenanceRecords(path.join(corpusRoot, "raw", "run-two", "provenance.jsonl"));
      const record = yield* Effect.fromOption(A.head(records));
      const duplicateCopyExists = yield* fs.exists(
        path.join(corpusRoot, "raw", "run-two", "source-b", "duplicate.txt")
      );

      expect(record.copyMode).toBe("provenance-only");
      expect(record.destPath).toBe(existingRawPath);
      expect(duplicateCopyExists).toBe(false);
    }).pipe(Effect.scoped, provideTestLayer)
  );

  it.effect("dedupes files already recorded earlier in the same salvage run", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-same-run-dedupe-test-" });
      const corpusRoot = path.join(root, "corpus");
      const sourceDir = path.join(root, "source-a");
      yield* fs.makeDirectory(sourceDir, { recursive: true });
      yield* fs.writeFileString(path.join(sourceDir, "a.txt"), "alpha");
      yield* fs.writeFileString(path.join(sourceDir, "b.txt"), "alpha");

      yield* salvageCorpus(
        CorpusSalvageOptions.make({
          corpusRoot,
          dedupe: true,
          sources: [sourceSpec("source-a", sourceDir)],
        })
      );

      const records = yield* readProvenanceRecords(path.join(corpusRoot, "raw", "provenance.jsonl"));
      const copiedExists = yield* fs.exists(path.join(corpusRoot, "raw", "source-a", "a.txt"));
      const duplicateCopyExists = yield* fs.exists(path.join(corpusRoot, "raw", "source-a", "b.txt"));

      expect(A.length(A.filter(records, (record) => record.copyMode === "copied"))).toBe(1);
      expect(A.length(A.filter(records, (record) => record.copyMode === "provenance-only"))).toBe(1);
      expect(copiedExists).toBe(true);
      expect(duplicateCopyExists).toBe(false);
    }).pipe(Effect.scoped, provideTestLayer)
  );

  it.effect("decodes old-shape provenance records without copyMode or dedupeOfPath", () =>
    Effect.gen(function* () {
      const line =
        '{"destPath":"/tmp/corpus/raw/source-a/a.txt","mtimeEpoch":1700000000,"mtimeIso":"2023-11-14T22:13:20Z","originPath":"/tmp/source-a/a.txt","relativePath":"a.txt","salvagedAt":"2026-06-11T15:00:00Z","sha256":"8ed3f6ad685b959ead7022518e1af76cd816f8e8ec7ccdda1ed4018e8f2223f8","sizeBytes":5,"sourceLabel":"source-a"}';
      const record = yield* decodeCorpusProvenanceRecordJson(line);

      expect(record.sourceLabel).toBe("source-a");
      expect(O.isNone(O.fromUndefinedOr(record.copyMode))).toBe(true);
      expect(O.isNone(O.fromUndefinedOr(record.dedupeOfPath))).toBe(true);
    })
  );
});

describe("corpus archive-move", () => {
  it.effect("moves provenance-covered sources and writes a move manifest", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-archive-move-test-" });
      const corpusRoot = path.join(root, "corpus");
      const sourceADir = path.join(root, "source-a");
      const sourceBDir = path.join(root, "source-b");
      yield* fs.makeDirectory(sourceADir, { recursive: true });
      yield* fs.makeDirectory(sourceBDir, { recursive: true });
      yield* fs.writeFileString(path.join(sourceADir, "a.txt"), "alpha");
      yield* fs.writeFileString(path.join(sourceBDir, "b.txt"), "alpha");

      yield* salvageCorpus(
        CorpusSalvageOptions.make({
          corpusRoot,
          dedupe: true,
          runLabel: "run-a",
          sources: [sourceSpec("source-a", sourceADir), sourceSpec("source-b", sourceBDir)],
        })
      );

      const archiveRoot = path.join(root, "archive");
      const provenancePath = path.join(corpusRoot, "raw", "run-a", "provenance.jsonl");
      const summary = yield* archiveMoveCorpus(
        CorpusArchiveMoveOptions.make({
          archiveRoot,
          provenancePaths: [provenancePath],
          sourcePaths: [sourceADir, sourceBDir],
        })
      );

      const sourceAExists = yield* fs.exists(sourceADir);
      const sourceBExists = yield* fs.exists(sourceBDir);
      const archiveAExists = yield* fs.exists(path.join(archiveRoot, "source-a", "a.txt"));
      const archiveBExists = yield* fs.exists(path.join(archiveRoot, "source-b", "b.txt"));
      const moveManifestExists = yield* fs.exists(path.join(corpusRoot, "raw", "run-a", "move-manifest.jsonl"));

      expect(summary.sourcesMoved).toBe(2);
      expect(summary.filesCovered).toBe(2);
      expect(summary.copiedRecords).toBe(1);
      expect(summary.provenanceOnlyRecords).toBe(1);
      expect(sourceAExists).toBe(false);
      expect(sourceBExists).toBe(false);
      expect(archiveAExists).toBe(true);
      expect(archiveBExists).toBe(true);
      expect(moveManifestExists).toBe(true);
    }).pipe(Effect.scoped, provideTestLayer)
  );

  it.effect("fails archive-move without moving anything when a source file is uncovered", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-archive-uncovered-test-" });
      const corpusRoot = path.join(root, "corpus");
      const sourceDir = path.join(root, "source-a");
      yield* fs.makeDirectory(sourceDir, { recursive: true });
      yield* fs.writeFileString(path.join(sourceDir, "a.txt"), "alpha");

      yield* salvageCorpus(
        CorpusSalvageOptions.make({
          corpusRoot,
          runLabel: "run-a",
          sources: [sourceSpec("source-a", sourceDir)],
        })
      );
      yield* fs.writeFileString(path.join(sourceDir, "extra.txt"), "bravo");

      const archiveRoot = path.join(root, "archive");
      const error = yield* archiveMoveCorpus(
        CorpusArchiveMoveOptions.make({
          archiveRoot,
          provenancePaths: [path.join(corpusRoot, "raw", "run-a", "provenance.jsonl")],
          sourcePaths: [sourceDir],
        })
      ).pipe(Effect.flip);
      const sourceStillExists = yield* fs.exists(sourceDir);
      const archiveExists = yield* fs.exists(path.join(archiveRoot, "source-a"));

      expect(error._tag).toBe("CorpusArchiveMoveUncoveredFileError");
      expect(sourceStillExists).toBe(true);
      expect(archiveExists).toBe(false);
    }).pipe(Effect.scoped, provideTestLayer)
  );

  it.effect("fails archive-move without moving anything when a raw digest mismatches", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-archive-mismatch-test-" });
      const corpusRoot = path.join(root, "corpus");
      const sourceDir = path.join(root, "source-a");
      yield* fs.makeDirectory(sourceDir, { recursive: true });
      yield* fs.writeFileString(path.join(sourceDir, "a.txt"), "alpha");

      yield* salvageCorpus(
        CorpusSalvageOptions.make({
          corpusRoot,
          runLabel: "run-a",
          sources: [sourceSpec("source-a", sourceDir)],
        })
      );
      yield* fs.writeFileString(path.join(corpusRoot, "raw", "run-a", "source-a", "a.txt"), "changed");

      const archiveRoot = path.join(root, "archive");
      const error = yield* archiveMoveCorpus(
        CorpusArchiveMoveOptions.make({
          archiveRoot,
          provenancePaths: [path.join(corpusRoot, "raw", "run-a", "provenance.jsonl")],
          sourcePaths: [sourceDir],
        })
      ).pipe(Effect.flip);
      const sourceStillExists = yield* fs.exists(sourceDir);
      const archiveExists = yield* fs.exists(path.join(archiveRoot, "source-a"));

      expect(error._tag).toBe("CorpusArchiveMoveDigestMismatchError");
      expect(sourceStillExists).toBe(true);
      expect(archiveExists).toBe(false);
    }).pipe(Effect.scoped, provideTestLayer)
  );
});
