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
  decodeArchiveLedgerRecordJson,
  decodeCorpusProvenanceRecordJson,
  decodeRestorationAcceptanceRecordJson,
  decodeTransformationLedgerRecordJson,
  encodeCorpusProvenanceRecordJson,
  encodeTransformationLedgerRecordJson,
  extractCorpus,
  pairRecycleBinEntries,
  parseRecycleBinMetadata,
  preserveRestorationArchive,
  RecycleBinScanEntry,
  RestorationLegacyWordOptions,
  RestorationMailOptions,
  RestorationPreserveOptions,
  RestorationRecycleOptions,
  RestorationVerifyOptions,
  reconcileRestorationAcceptance,
  restoreLegacyWord,
  restoreMail,
  restoreRecycle,
  salvageCorpus,
  TransformationLedgerRecord,
  verifyRestorationArchive,
  verifySalvage,
} from "@beep/repo-cli/commands/Corpus";
import { NonNegativeInt, Sha256Hex } from "@beep/schema";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const testLayer = Layer.mergeAll(
  CorpusCommandServiceLive.pipe(Layer.provideMerge(NodeServices.layer)),
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
  it.effect(
    "parses a v2 $I metadata record",
    Effect.fnUntraced(function* () {
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

  it.effect(
    "parses a v1 $I metadata record with a fixed-width path",
    Effect.fnUntraced(function* () {
      const original = yield* parseRecycleBinMetadata(makeMetadataV1("C:\\old\\draft.doc", 11n, filetime2020));

      expect(original.version).toBe("v1");
      expect(original.originalPath).toBe("C:\\old\\draft.doc");
      expect(original.originalName).toBe("draft.doc");
    })
  );

  it.effect(
    "rejects records that are too short or have unknown versions",
    Effect.fnUntraced(function* () {
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
    expect(O.isNone(classifyRecycleBinName("$Recycle.Bin"))).toBe(true);
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
  it.effect(
    "builds the catalog, duplicate report, and restoration manifest from a synthetic corpus",
    Effect.fnUntraced(
      function* () {
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

        const restorationText = yield* fs.readFileString(
          path.join(corpusRoot, "catalog", "restoration-manifest.jsonl")
        );
        const duplicateText = yield* fs.readFileString(
          path.join(corpusRoot, "catalog", "reports", "duplicate-sets.json")
        );
        const summaryText = yield* fs.readFileString(
          path.join(corpusRoot, "catalog", "reports", "catalog-summary.json")
        );
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
      },
      Effect.scoped,
      provideTestLayer
    )
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
    sha256: Sha256Hex.make(input.sha256),
    sizeBytes: NonNegativeInt.make(input.sizeBytes),
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
  return yield* Effect.forEach(lines, (line) => decodeCorpusProvenanceRecordJson(line));
});

const decodeArchiveMoveManifestRecordJson = S.decodeUnknownEffect(S.fromJsonString(CorpusArchiveMoveManifestRecord));

const readArchiveMoveManifestRecords = Effect.fn("CorpusTest.readArchiveMoveManifestRecords")(function* (
  manifestPath: string
) {
  const lines = yield* readProvenanceLines(manifestPath);
  return yield* Effect.forEach(lines, (line) => decodeArchiveMoveManifestRecordJson(line));
});

describe("corpus catalog run manifests", () => {
  it.effect(
    "unions base and run-labeled manifests with provenance-only occurrences and per-run digest deltas",
    Effect.fnUntraced(
      function* () {
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
        const summaryText = yield* fs.readFileString(
          path.join(corpusRoot, "catalog", "reports", "catalog-summary.json")
        );
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
      },
      Effect.scoped,
      provideTestLayer
    )
  );
});

describe("corpus extract and salvage", () => {
  it.effect(
    "rejects traversal out labels before writing staging output",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const corpusRoot = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-extract-label-test-" });

        const error = yield* extractCorpus(
          CorpusExtractOptions.make({
            concurrency: 1,
            corpusRoot,
            exportChildren: false,
            includeDuplicates: false,
            outLabel: "../outside",
            overwrite: false,
            tikaJarPath: path.join(corpusRoot, "missing-tika.jar"),
          })
        ).pipe(Effect.flip);
        const escapedExists = yield* fs.exists(path.join(corpusRoot, "outside"));

        expect(error.message).toContain("Invalid corpus extract out-label");
        expect(escapedExists).toBe(false);
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "extracts a synthetic corpus through stub engines and verifies salvage",
    Effect.fnUntraced(
      function* () {
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
      },
      Effect.scoped,
      provideTestLayer
    )
  );
});

describe("corpus salvage run labels and dedupe", () => {
  it.effect(
    "writes copied files and provenance under the requested run label",
    Effect.fnUntraced(
      function* () {
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
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "writes every multi-source salvage provenance line as parseable JSON",
    Effect.fnUntraced(
      function* () {
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
        const records = yield* Effect.forEach(lines, (line) => decodeCorpusProvenanceRecordJson(line));
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
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "preserves POSIX filenames with punctuation and literal backslashes",
    Effect.fnUntraced(
      function* () {
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
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "uses the DuckDB catalog for dedupe-aware provenance-only salvage",
    Effect.fnUntraced(
      function* () {
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
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "falls back to scanning raw provenance manifests when the catalog is absent",
    Effect.fnUntraced(
      function* () {
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
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "dedupes files already recorded earlier in the same salvage run",
    Effect.fnUntraced(
      function* () {
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
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "decodes old-shape provenance records without copyMode or dedupeOfPath",
    Effect.fnUntraced(function* () {
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
  it.effect(
    "moves provenance-covered sources and writes a move manifest",
    Effect.fnUntraced(
      function* () {
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
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "fails archive-move without moving anything when a source file is uncovered",
    Effect.fnUntraced(
      function* () {
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
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "fails archive-move without moving anything when a raw digest mismatches",
    Effect.fnUntraced(
      function* () {
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
      },
      Effect.scoped,
      provideTestLayer
    )
  );
});

type PreservationDenominators = Pick<
  RestorationPreserveOptions,
  "expectedRootArchiveBytes" | "expectedSourceDirectoryCount" | "expectedSourceFileCount" | "expectedSourceTreeBytes"
>;

const measurePreservationDenominators = Effect.fn("CorpusTest.measurePreservationDenominators")(function* (
  sourceRoot: string,
  rootArchive: string
): Effect.fn.Return<PreservationDenominators, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let directoryCount = 1;
  let fileCount = 0;
  let sourceTreeBytes = 0;
  const visit = Effect.fn("CorpusTest.measurePreservationDenominators.visit")(function* (directory: string) {
    for (const name of yield* fs.readDirectory(directory).pipe(Effect.orDie)) {
      const entry = path.join(directory, name);
      const info = yield* fs.stat(entry).pipe(Effect.orDie);
      if (info.type === "Directory") {
        directoryCount += 1;
        yield* visit(entry);
      } else if (info.type === "File") {
        fileCount += 1;
        sourceTreeBytes += Number(info.size);
      }
    }
  });
  yield* visit(sourceRoot);
  const rootArchiveInfo = yield* fs.stat(rootArchive).pipe(Effect.orDie);
  return {
    expectedRootArchiveBytes: NonNegativeInt.make(Number(rootArchiveInfo.size)),
    expectedSourceDirectoryCount: NonNegativeInt.make(directoryCount),
    expectedSourceFileCount: NonNegativeInt.make(fileCount),
    expectedSourceTreeBytes: NonNegativeInt.make(sourceTreeBytes),
  };
});

const restorationOptions = (
  input: PreservationDenominators & {
    readonly absentTree: string;
    readonly capacityCeilingBytes: number;
    readonly collectorManifest: string;
    readonly corpusRoot: string;
    readonly crashPoint?: "after-payload-sync" | "after-rename" | "before-pass" | "none";
    readonly rootArchive: string;
    readonly sourceRoot: string;
  }
): RestorationPreserveOptions =>
  RestorationPreserveOptions.make({
    absentRecycleTreePath: input.absentTree,
    capacityCeilingBytes: NonNegativeInt.make(input.capacityCeilingBytes),
    chunkSizeBytes: NonNegativeInt.make(1_024),
    corpusRoot: input.corpusRoot,
    crashPoint: input.crashPoint ?? "none",
    expectedCollectorRowCount: NonNegativeInt.make(3),
    expectedMissingRecyclePayloadCount: NonNegativeInt.make(1),
    expectedMutatedDestinationCount: NonNegativeInt.make(1),
    expectedRootArchiveBytes: input.expectedRootArchiveBytes,
    expectedSourceDirectoryCount: input.expectedSourceDirectoryCount,
    expectedSourceFileCount: input.expectedSourceFileCount,
    expectedSourceTreeBytes: input.expectedSourceTreeBytes,
    minimumFreeAfterBytes: NonNegativeInt.make(0),
    rootArchivePath: input.rootArchive,
    runLabel: "synthetic-restoration",
    sourceManifestPath: input.collectorManifest,
    sourceRoot: input.sourceRoot,
  });

const makeRestorationFixture = Effect.fn("CorpusTest.makeRestorationFixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-restoration-test-" });
  const corpusRoot = path.join(root, "corpus");
  const sourceRoot = path.join(root, "source");
  const nestedRoot = path.join(sourceRoot, "nested");
  const rootArchive = path.join(root, "root-archive.zip");
  const collectorManifest = path.join(root, "collector.jsonl");
  const absentTree = path.join(root, "recorded-absent");
  yield* fs.makeDirectory(corpusRoot, { recursive: true });
  yield* fs.makeDirectory(nestedRoot, { recursive: true });
  const largeBytes = new Uint8Array(1024 * 1024 + 37);
  largeBytes.fill(0x5a);
  yield* fs.writeFile(path.join(nestedRoot, "large.bin"), largeBytes);
  yield* fs.writeFileString(rootArchive, "verbatim-root-archive");
  const collectorRows = [
    {
      dst: "F:\\salvage\\tree\\nested\\large.bin",
      size: largeBytes.length,
      src: "C:\\source\\large.bin",
      status: "copied",
    },
    { dst: "F:\\salvage\\tree\\missing.bin", size: 1, src: "C:\\source\\missing.bin", status: "resumed" },
    { dst: "F:\\salvage\\tree\\unreadable.bin", size: 0, src: "C:\\source\\unreadable.bin", status: "error" },
  ];
  yield* fs.writeFileString(collectorManifest, `${A.join(A.map(collectorRows, JSON.stringify), "\n")}\n`);
  return {
    absentTree,
    collectorManifest,
    corpusRoot,
    ...(yield* measurePreservationDenominators(sourceRoot, rootArchive)),
    rootArchive,
    sourceRoot,
  };
});

describe("corpus restoration preservation", () => {
  it.effect(
    "streams, resumes, seals, extends provenance, and independently verifies synthetic archive objects",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeRestorationFixture();
        const partialPath = path.join(
          fixture.corpusRoot,
          "raw",
          "synthetic-restoration",
          "payload",
          "tree",
          "nested",
          "large.bin.partial"
        );
        yield* fs.makeDirectory(path.dirname(partialPath), { recursive: true });
        yield* fs.writeFileString(partialPath, "ZZ");

        const summary = yield* preserveRestorationArchive(
          restorationOptions({ ...fixture, capacityCeilingBytes: 10 * 1024 * 1024 })
        );
        const verified = yield* verifyRestorationArchive(
          RestorationVerifyOptions.make({
            corpusRoot: fixture.corpusRoot,
            runLabel: "synthetic-restoration",
          })
        );
        const manifestPath = path.join(fixture.corpusRoot, "raw", "synthetic-restoration", "archive-ledger.jsonl");
        const lines = A.filter(Str.split(/\r?\n/u)(yield* fs.readFileString(manifestPath)), Str.isNonEmpty);
        const records = yield* Effect.forEach(lines, decodeArchiveLedgerRecordJson);
        const resumedPass = A.findFirst(
          records,
          (record) => record.recordType === "archive-file-pass" && record.sourceRelativePath === "nested/large.bin"
        );
        const provenance = yield* fs.readFileString(path.join(fixture.corpusRoot, "raw", "provenance.jsonl"));
        const reports = yield* fs.readDirectory(
          path.join(fixture.corpusRoot, "raw", "synthetic-restoration", "verification")
        );
        const rootArchiveExists = yield* fs.exists(
          path.join(fixture.corpusRoot, "raw", "synthetic-restoration", "payload", "root-archive.zip")
        );

        expect(summary.unapprovedCount).toBe(0);
        expect(summary.inputBytes).toBe(1024 * 1024 + 37 + "verbatim-root-archive".length);
        expect(verified.unapprovedCount).toBe(0);
        expect(verified.passCount).toBe(summary.passCount);
        expect(
          O.map(resumedPass, (record) => (record.recordType === "archive-file-pass" ? record.resumedBytes : 0))
        ).toStrictEqual(O.some(2));
        expect(provenance.trim().split("\n")).toHaveLength(2);
        expect(reports).toHaveLength(1);
        expect(rootArchiveExists).toBe(true);
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "recovers across payload sync, atomic promotion, and pre-PASS interruptions without a false PASS",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        for (const crashPoint of ["after-payload-sync", "after-rename", "before-pass"] as const) {
          const fixture = yield* makeRestorationFixture();
          const interrupted = yield* preserveRestorationArchive(
            restorationOptions({
              ...fixture,
              capacityCeilingBytes: 10 * 1024 * 1024,
              crashPoint,
            })
          ).pipe(Effect.flip);
          const manifestPath = path.join(fixture.corpusRoot, "raw", "synthetic-restoration", "archive-ledger.jsonl");
          const interruptedText = yield* fs.readFileString(manifestPath);
          expect(interrupted.message).toContain(crashPoint);
          expect(interruptedText).not.toContain('"recordType":"archive-file-pass"');

          yield* preserveRestorationArchive(restorationOptions({ ...fixture, capacityCeilingBytes: 10 * 1024 * 1024 }));
          const verified = yield* verifyRestorationArchive(
            RestorationVerifyOptions.make({
              corpusRoot: fixture.corpusRoot,
              runLabel: "synthetic-restoration",
            })
          );
          expect(verified.unapprovedCount).toBe(0);
        }
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "truncates and replaces a mismatched complete destination through the resumable path",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeRestorationFixture();
        const options = restorationOptions({ ...fixture, capacityCeilingBytes: 10 * 1024 * 1024 });
        yield* preserveRestorationArchive(options);
        const destinationPath = path.join(
          fixture.corpusRoot,
          "raw",
          "synthetic-restoration",
          "payload",
          "tree",
          "nested",
          "large.bin"
        );
        yield* fs.writeFileString(destinationPath, "mismatch");

        yield* preserveRestorationArchive(options);
        const verified = yield* verifyRestorationArchive(
          RestorationVerifyOptions.make({
            corpusRoot: fixture.corpusRoot,
            runLabel: "synthetic-restoration",
          })
        );
        const restored = yield* fs.readFile(destinationPath);
        expect(verified.unapprovedCount).toBe(0);
        expect(restored.length).toBe(1024 * 1024 + 37);
        expect(restored[0]).toBe(0x5a);
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "denies capacity before writing any payload bytes",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeRestorationFixture();
        const error = yield* preserveRestorationArchive(
          restorationOptions({ ...fixture, capacityCeilingBytes: 1 })
        ).pipe(Effect.flip);
        const payloadExists = yield* fs.exists(
          path.join(fixture.corpusRoot, "raw", "synthetic-restoration", "payload")
        );
        expect(error.message).toContain("capacity preflight denied");
        expect(payloadExists).toBe(false);
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "rejects a contradictory frozen source denominator before creating the archive run root",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeRestorationFixture();
        const error = yield* preserveRestorationArchive(
          restorationOptions({
            ...fixture,
            capacityCeilingBytes: 10 * 1024 * 1024,
            expectedSourceFileCount: NonNegativeInt.make(fixture.expectedSourceFileCount + 1),
          })
        ).pipe(Effect.flip);
        const archiveRootExists = yield* fs.exists(path.join(fixture.corpusRoot, "raw", "synthetic-restoration"));

        expect(error.message).toContain("denominator");
        expect(archiveRootExists).toBe(false);
      },
      Effect.scoped,
      provideTestLayer
    )
  );
});

const restorationPffexportStub = `#!/usr/bin/env bash
if [ "$1" = "-V" ]; then
  printf 'pffexport 20260608\n'
  exit 0
fi
target=""
previous=""
for argument in "$@"; do
  if [ "$previous" = "-t" ]; then target="$argument"; fi
  previous="$argument"
done
item="$target.export/Top of Personal Folders/Inbox/Message00001"
mkdir -p "$item/Attachment00001"
printf 'Subject:\\tSynthetic\\n' > "$item/OutlookHeaders.txt"
printf 'synthetic mail body' > "$item/Message.txt"
printf '%%PDF-1.4 synthetic attachment' > "$item/Attachment00001/report.bin"
exit 0
`;

const restorationTikaStub = `#!/usr/bin/env bash
exit 0
`;

const failingRestorationPffexportStub = (message: string): string => `#!/usr/bin/env bash
if [ "$1" = "-V" ]; then
  printf 'pffexport 20260608\\n'
  exit 0
fi
printf '%s\\n' '${message}' >&2
exit 2
`;

const makeMailRestorationFixture = Effect.fn("CorpusTest.makeMailRestorationFixture")(function* (
  pffexportScript: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-mail-restoration-test-" });
  const corpusRoot = path.join(root, "corpus");
  const sourceRoot = path.join(root, "source");
  const mailRoot = path.join(sourceRoot, "$Recycle.Bin", "surface-a");
  const mailPath = path.join(mailRoot, "$Rstore.pst");
  const rootArchive = path.join(root, "root-archive.zip");
  const collectorManifest = path.join(root, "collector.jsonl");
  const absentTree = path.join(root, "recorded-absent");
  const pffexportPath = path.join(root, "pffexport-stub");
  const tikaPath = path.join(root, "tika-stub");
  yield* fs.makeDirectory(corpusRoot, { recursive: true });
  yield* fs.makeDirectory(mailRoot, { recursive: true });
  const mailBytes = new Uint8Array(1024 * 1024 + 31);
  mailBytes.fill(0x42);
  yield* fs.writeFile(mailPath, mailBytes);
  yield* fs.writeFileString(rootArchive, "verbatim-root-archive");
  yield* fs.writeFileString(
    collectorManifest,
    `${JSON.stringify({
      dst: "F:\\salvage\\tree\\$Recycle.Bin\\surface-a\\$Rstore.pst",
      size: mailBytes.length,
      src: "C:\\source\\mail-store.pst",
      status: "copied",
    })}\n`
  );
  yield* writeStub(pffexportScript, pffexportPath);
  yield* writeStub(restorationTikaStub, tikaPath);
  const denominators = yield* measurePreservationDenominators(sourceRoot, rootArchive);
  yield* preserveRestorationArchive(
    RestorationPreserveOptions.make({
      absentRecycleTreePath: absentTree,
      capacityCeilingBytes: NonNegativeInt.make(10 * 1024 * 1024),
      chunkSizeBytes: NonNegativeInt.make(4_096),
      corpusRoot,
      expectedCollectorRowCount: NonNegativeInt.make(1),
      expectedMissingRecyclePayloadCount: NonNegativeInt.make(0),
      expectedMutatedDestinationCount: NonNegativeInt.make(0),
      ...denominators,
      minimumFreeAfterBytes: NonNegativeInt.make(0),
      rootArchivePath: rootArchive,
      runLabel: "synthetic-mail-restoration",
      sourceManifestPath: collectorManifest,
      sourceRoot,
    })
  );
  return { corpusRoot, pffexportPath, tikaPath };
});

const mailRestorationOptions = (fixture: {
  readonly corpusRoot: string;
  readonly pffexportPath: string;
  readonly tikaPath: string;
}): RestorationMailOptions =>
  RestorationMailOptions.make({
    corpusRoot: fixture.corpusRoot,
    expectedStoreCount: NonNegativeInt.make(1),
    javaPath: fixture.tikaPath,
    maxAmplificationRatio: 10,
    maxElapsedMillis: NonNegativeInt.make(30_000),
    maxTotalElapsedMillis: NonNegativeInt.make(30_000),
    maxTotalOutputBytes: NonNegativeInt.make(1024 * 1024 * 1024),
    pffexportPath: fixture.pffexportPath,
    runLabel: "synthetic-mail-restoration",
    scope: "slice",
    tikaJarPath: fixture.tikaPath,
  });

describe("corpus restoration mail", () => {
  it.effect(
    "runs the public source-path engine with all-item mode and accounts every raw and repaired child",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeMailRestorationFixture(restorationPffexportStub);
        const summary = yield* restoreMail(mailRestorationOptions(fixture));
        const ledgerPath = path.join(fixture.corpusRoot, "staging", "restoration", "transformation-ledger.jsonl");
        const lines = A.filter(Str.split(/\r?\n/u)(yield* fs.readFileString(ledgerPath)), Str.isNonEmpty);
        const records = yield* Effect.forEach(lines, decodeTransformationLedgerRecordJson);
        const pass = A.findFirst(records, (record) => record.recordType === "mail-store-pass");
        const repair = A.findFirst(
          records,
          (record) => record.recordType === "attachment-type-repair" && record.repairStatus === "repaired"
        );

        expect(summary.passCount).toBe(1);
        expect(summary.unapprovedCount).toBe(0);
        expect(
          O.map(pass, (record) =>
            record.recordType === "mail-store-pass" ? record.accountedChildCount === record.childCount : false
          )
        ).toStrictEqual(O.some(true));
        expect(O.isSome(repair)).toBe(true);
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "classifies corrupt, password, and codepage engine failures as unapproved terminal exceptions",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        for (const [message, expected] of [
          ["corrupt store", "corrupt"],
          ["password required", "password"],
          ["unsupported codepage", "codepage"],
        ] as const) {
          const fixture = yield* makeMailRestorationFixture(failingRestorationPffexportStub(message));
          yield* restoreMail(mailRestorationOptions(fixture)).pipe(Effect.flip);
          const ledgerPath = path.join(fixture.corpusRoot, "staging", "restoration", "transformation-ledger.jsonl");
          const lines = A.filter(Str.split(/\r?\n/u)(yield* fs.readFileString(ledgerPath)), Str.isNonEmpty);
          const records = yield* Effect.forEach(lines, decodeTransformationLedgerRecordJson);
          const terminal = A.findFirst(records, (record) => record.recordType === "mail-store-exception");
          expect(
            O.map(terminal, (record) =>
              record.recordType === "mail-store-exception" ? record.exceptionKind : "engine-failure"
            )
          ).toStrictEqual(O.some(expected));
        }
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "denies an unavailable cumulative output ceiling before creating mail attempt payloads",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeMailRestorationFixture(restorationPffexportStub);
        const error = yield* restoreMail(
          RestorationMailOptions.make({
            ...mailRestorationOptions(fixture),
            maxTotalOutputBytes: NonNegativeInt.make(Number.MAX_SAFE_INTEGER),
          })
        ).pipe(Effect.flip);
        const outputExists = yield* fs.exists(path.join(fixture.corpusRoot, "staging", "restoration", "mail", "slice"));

        expect(error.message).toContain("capacity preflight denied");
        expect(outputExists).toBe(false);
      },
      Effect.scoped,
      provideTestLayer
    )
  );
});

const makeRecycleRestorationFixture = Effect.fn("CorpusTest.makeRecycleRestorationFixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-recycle-restoration-test-" });
  const corpusRoot = path.join(root, "corpus");
  const sourceRoot = path.join(root, "source");
  const recycleRoot = path.join(sourceRoot, "$Recycle.Bin");
  const surfaceA = path.join(recycleRoot, "surface-a");
  const surfaceB = path.join(recycleRoot, "surface-b");
  const surfaceC = path.join(recycleRoot, "surface-c");
  const rootArchive = path.join(root, "root-archive.zip");
  const collectorManifest = path.join(root, "collector.jsonl");
  const absentTree = path.join(root, "recorded-absent");

  yield* fs.makeDirectory(corpusRoot, { recursive: true });
  yield* fs.makeDirectory(path.join(surfaceA, "duplicate-a"), { recursive: true });
  yield* fs.makeDirectory(path.join(surfaceA, "duplicate-b"), { recursive: true });
  yield* fs.makeDirectory(surfaceB, { recursive: true });
  yield* fs.makeDirectory(path.join(surfaceC, "$Rdirectory"), { recursive: true });
  yield* fs.writeFileString(path.join(surfaceA, "$Rcase-a.txt"), "first collision payload");
  yield* fs.writeFile(
    path.join(surfaceA, "$Icase-a.txt"),
    makeMetadataV2("C:\\Recovered\\Case.txt", 23n, filetime2020)
  );
  yield* fs.writeFileString(path.join(surfaceA, "$Rcase-b.txt"), "second collision payload");
  yield* fs.writeFile(
    path.join(surfaceA, "$Icase-b.txt"),
    makeMetadataV2("C:\\recovered\\case.txt", 24n, filetime2020)
  );
  yield* fs.writeFileString(path.join(surfaceA, "duplicate-a", "$Rduplicate.txt"), "duplicate payload");
  yield* fs.writeFile(
    path.join(surfaceA, "duplicate-a", "$Iduplicate.txt"),
    makeMetadataV2("C:\\Recovered\\Duplicate.txt", 17n, filetime2020)
  );
  yield* fs.writeFile(
    path.join(surfaceA, "duplicate-b", "$Iduplicate.txt"),
    makeMetadataV2("C:\\Recovered\\Duplicate.txt", 17n, filetime2020)
  );
  yield* fs.writeFile(
    path.join(surfaceB, "$Imissing.txt"),
    makeMetadataV2("D:\\Recovered\\Missing.txt", 99n, filetime2020)
  );
  yield* fs.writeFileString(path.join(surfaceC, "$Rorphan.txt"), "orphan payload");
  yield* fs.writeFileString(path.join(surfaceC, "$Rdirectory", "child.bin"), "directory payload");
  yield* fs.writeFile(
    path.join(surfaceC, "$Idirectory"),
    makeMetadataV2("E:\\Recovered\\..\\Directory", 17n, filetime2020)
  );
  yield* fs.writeFileString(rootArchive, "verbatim-root-archive");
  yield* fs.writeFileString(
    collectorManifest,
    `${JSON.stringify({ dst: "F:\\salvage\\tree\\unreadable.bin", size: 0, src: "C:\\source\\unreadable.bin", status: "error" })}\n`
  );
  const denominators = yield* measurePreservationDenominators(sourceRoot, rootArchive);
  yield* preserveRestorationArchive(
    RestorationPreserveOptions.make({
      absentRecycleTreePath: absentTree,
      capacityCeilingBytes: NonNegativeInt.make(10 * 1024 * 1024),
      chunkSizeBytes: NonNegativeInt.make(4_096),
      corpusRoot,
      expectedCollectorRowCount: NonNegativeInt.make(1),
      expectedMissingRecyclePayloadCount: NonNegativeInt.make(0),
      expectedMutatedDestinationCount: NonNegativeInt.make(0),
      ...denominators,
      minimumFreeAfterBytes: NonNegativeInt.make(0),
      rootArchivePath: rootArchive,
      runLabel: "synthetic-recycle-restoration",
      sourceManifestPath: collectorManifest,
      sourceRoot,
    })
  );
  return { corpusRoot };
});

describe("corpus restoration recycle", () => {
  it.effect(
    "joins three surfaces into all four classes and preserves file and directory occurrences",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeRecycleRestorationFixture();
        const summary = yield* restoreRecycle(
          RestorationRecycleOptions.make({
            corpusRoot: fixture.corpusRoot,
            expectedMissingContentCount: NonNegativeInt.make(1),
            expectedSurfaceCount: NonNegativeInt.make(3),
            maxTotalElapsedMillis: NonNegativeInt.make(30_000),
            maxTotalOutputBytes: NonNegativeInt.make(1024 * 1024 * 1024),
            runLabel: "synthetic-recycle-restoration",
          })
        );
        const ledgerPath = path.join(fixture.corpusRoot, "staging", "restoration", "transformation-ledger.jsonl");
        const lines = A.filter(Str.split(/\r?\n/u)(yield* fs.readFileString(ledgerPath)), Str.isNonEmpty);
        const records = yield* Effect.forEach(lines, decodeTransformationLedgerRecordJson);
        const joins = A.filter(records, (record) => record.recordType === "recycle-join");
        const mappings = A.filter(records, (record) => record.recordType === "recycle-mapping");
        const totals = new Map<string, number>();
        for (const join of joins) {
          if (join.recordType === "recycle-join") {
            totals.set(join.joinClass, (totals.get(join.joinClass) ?? 0) + join.count);
          }
        }
        const mappedPaths = A.getSomes(
          A.map(mappings, (record) =>
            record.recordType === "recycle-mapping" ? O.some(record.restoredRelativePath) : O.none<string>()
          )
        );
        const caseFolded = A.map(mappedPaths, Str.toLowerCase);

        expect(summary.passCount).toBe(4);
        expect(summary.exceptionCount).toBe(3);
        expect(summary.unapprovedCount).toBe(0);
        expect(joins).toHaveLength(12);
        expect(totals).toEqual(
          new Map([
            ["duplicate", 1],
            ["missing-content", 1],
            ["orphan-content", 1],
            ["valid-pair", 4],
          ])
        );
        expect(new Set(caseFolded).size).toBe(mappedPaths.length);
        expect(A.some(mappedPaths, Str.includes("__"))).toBe(true);
      },
      Effect.scoped,
      provideTestLayer
    )
  );
});

const legacyWordBwrapStub = `#!/usr/bin/env bash
set -eu
converter_host=""
input_host=""
output_host=""
saw_unshare="0"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --unshare-all)
      saw_unshare="1"
      shift
      ;;
    --ro-bind)
      if [ "$3" = "/tool/converter" ]; then converter_host="$2"; fi
      case "$3" in /input/source.*) input_host="$2" ;; esac
      shift 3
      ;;
    --bind)
      if [ "$3" = "/output" ]; then output_host="$2"; fi
      shift 3
      ;;
    --)
      shift
      break
      ;;
    *)
      shift
      ;;
  esac
done
if [ "$saw_unshare" != "1" ] || [ -z "$converter_host" ] || [ -z "$input_host" ] || [ -z "$output_host" ]; then
  exit 91
fi
shift
mapped=()
for argument in "$@"; do
  case "$argument" in
    /input/source.*) mapped+=("$input_host") ;;
    /output) mapped+=("$output_host") ;;
    *) mapped+=("$argument") ;;
  esac
done
exec "$converter_host" "\${mapped[@]}"
`;

const legacyWordConverterStub = `#!/usr/bin/env bash
set -eu
if [ "\${1:-}" = "--version" ]; then
  printf 'LibreOffice synthetic 1.0\\n'
  exit 0
fi
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
if [ "$format" = "docx" ]; then
  cp "$input" "$outdir/source.docx"
elif [ "$format" = "pdf" ]; then
  printf '%%PDF-1.4 synthetic legacy word page\\n' > "$outdir/source.pdf"
else
  exit 92
fi
`;

const legacyWordTikaStub = `#!/usr/bin/env bash
printf 'same normalized text\\n'
`;

const legacyWordPdfinfoStub = `#!/usr/bin/env bash
printf 'Pages:          1\\n'
`;

const legacyWordPdftoppmStub = `#!/usr/bin/env bash
prefix="\${@: -1}"
printf 'synthetic rendered page\\n' > "$prefix-1.png"
`;

const legacyWordCompareStub = `#!/usr/bin/env bash
printf '0 (0)\\n' >&2
exit 0
`;

const makeLegacyWordRestorationFixture = Effect.fn("CorpusTest.makeLegacyWordRestorationFixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-legacy-word-restoration-test-" });
  const corpusRoot = path.join(root, "corpus");
  const sourceRoot = path.join(root, "source");
  const rootArchive = path.join(root, "root-archive.zip");
  const collectorManifest = path.join(root, "collector.jsonl");
  const absentTree = path.join(root, "recorded-absent");
  const bwrapPath = path.join(root, "bwrap-stub");
  const converterPath = path.join(root, "converter-stub");
  const tikaPath = path.join(root, "tika-stub");
  const pdfinfoPath = path.join(root, "pdfinfo-stub");
  const pdftoppmPath = path.join(root, "pdftoppm-stub");
  const comparePath = path.join(root, "compare-stub");
  const cfb = new Uint8Array(64);
  cfb.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  cfb.fill(0x42, 8);

  yield* fs.makeDirectory(corpusRoot, { recursive: true });
  yield* fs.makeDirectory(path.join(sourceRoot, "set-a"), { recursive: true });
  yield* fs.makeDirectory(path.join(sourceRoot, "set-b"), { recursive: true });
  yield* fs.writeFile(path.join(sourceRoot, "set-a", "binary.doc"), cfb);
  yield* fs.writeFile(path.join(sourceRoot, "set-b", "duplicate.doc"), cfb);
  yield* fs.writeFileString(path.join(sourceRoot, "not-binary.doc"), "plain text with a legacy extension");
  yield* fs.writeFileString(rootArchive, "verbatim-root-archive");
  yield* fs.writeFileString(
    collectorManifest,
    `${JSON.stringify({ dst: "F:\\salvage\\tree\\unreadable.bin", size: 0, src: "C:\\source\\unreadable.bin", status: "error" })}\n`
  );
  yield* writeStub(legacyWordBwrapStub, bwrapPath);
  yield* writeStub(legacyWordConverterStub, converterPath);
  yield* writeStub(legacyWordTikaStub, tikaPath);
  yield* writeStub(legacyWordPdfinfoStub, pdfinfoPath);
  yield* writeStub(legacyWordPdftoppmStub, pdftoppmPath);
  yield* writeStub(legacyWordCompareStub, comparePath);
  const denominators = yield* measurePreservationDenominators(sourceRoot, rootArchive);
  yield* preserveRestorationArchive(
    RestorationPreserveOptions.make({
      absentRecycleTreePath: absentTree,
      capacityCeilingBytes: NonNegativeInt.make(10 * 1024 * 1024),
      chunkSizeBytes: NonNegativeInt.make(4_096),
      corpusRoot,
      expectedCollectorRowCount: NonNegativeInt.make(1),
      expectedMissingRecyclePayloadCount: NonNegativeInt.make(0),
      expectedMutatedDestinationCount: NonNegativeInt.make(0),
      ...denominators,
      minimumFreeAfterBytes: NonNegativeInt.make(0),
      rootArchivePath: rootArchive,
      runLabel: "synthetic-legacy-word-restoration",
      sourceManifestPath: collectorManifest,
      sourceRoot,
    })
  );
  return { bwrapPath, comparePath, converterPath, corpusRoot, pdfinfoPath, pdftoppmPath, tikaPath };
});

describe("corpus restoration legacy Word", () => {
  it.effect(
    "converts distinct CFB digests in a sandbox and approves only the explicit non-binary exception",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeLegacyWordRestorationFixture();
        const summary = yield* restoreLegacyWord(
          RestorationLegacyWordOptions.make({
            bwrapPath: fixture.bwrapPath,
            comparePath: fixture.comparePath,
            converterPath: fixture.converterPath,
            corpusRoot: fixture.corpusRoot,
            expectedConverterVersion: "LibreOffice synthetic 1.0",
            expectedOccurrenceCount: NonNegativeInt.make(3),
            javaPath: fixture.tikaPath,
            maxElapsedMillis: NonNegativeInt.make(30_000),
            maxTotalElapsedMillis: NonNegativeInt.make(30_000),
            maxTotalOutputBytes: NonNegativeInt.make(1024 * 1024 * 1024),
            maxVisualRmse: 0,
            pdfinfoPath: fixture.pdfinfoPath,
            pdftoppmPath: fixture.pdftoppmPath,
            runLabel: "synthetic-legacy-word-restoration",
            tikaJarPath: fixture.tikaPath,
          })
        );
        const ledgerPath = path.join(fixture.corpusRoot, "staging", "restoration", "transformation-ledger.jsonl");
        const lines = A.filter(Str.split(/\r?\n/u)(yield* fs.readFileString(ledgerPath)), Str.isNonEmpty);
        const records = yield* Effect.forEach(lines, decodeTransformationLedgerRecordJson);
        const passes = A.filter(records, (record) => record.recordType === "legacy-word-pass");
        const exceptions = A.filter(records, (record) => record.recordType === "legacy-word-exception");
        const acceptance = A.findFirst(
          records,
          (record) => record.recordType === "family-acceptance-pass" && record.family === "legacy-word"
        );

        expect(summary.sourceCount).toBe(3);
        expect(summary.passCount).toBe(1);
        expect(summary.exceptionCount).toBe(1);
        expect(summary.unapprovedCount).toBe(0);
        expect(passes).toHaveLength(1);
        expect(exceptions).toHaveLength(1);
        expect(
          O.map(exceptions[0] === undefined ? O.none() : O.some(exceptions[0]), (record) =>
            record.recordType === "legacy-word-exception"
              ? record.approved && record.exceptionKind === "not-binary-word"
              : false
          )
        ).toStrictEqual(O.some(true));
        expect(O.isSome(acceptance)).toBe(true);
      },
      Effect.scoped,
      provideTestLayer
    )
  );
});

describe("corpus restoration acceptance", () => {
  it.effect(
    "reconciles terminal detail into four separate immutable aggregate-only PASS records",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeRestorationFixture();
        yield* preserveRestorationArchive(restorationOptions({ ...fixture, capacityCeilingBytes: 10 * 1024 * 1024 }));
        const digest = Sha256Hex.make("a".repeat(64));
        const records = [
          TransformationLedgerRecord.cases["mail-child-pass"].make({
            attemptId: "mail-attempt",
            childRelativePath: "child.txt",
            recordType: "mail-child-pass",
            sha256: digest,
            sizeBytes: NonNegativeInt.make(4),
            sourceObjectId: "mail-object",
          }),
          TransformationLedgerRecord.cases["mail-store-pass"].make({
            accountedChildCount: NonNegativeInt.make(1),
            attemptId: "mail-attempt",
            childCount: NonNegativeInt.make(1),
            elapsedMillis: NonNegativeInt.make(10),
            inputBytes: NonNegativeInt.make(4),
            objectId: "mail-object",
            outputBytes: NonNegativeInt.make(4),
            recordType: "mail-store-pass",
            sha256: digest,
            warningCount: NonNegativeInt.make(0),
          }),
          TransformationLedgerRecord.cases["family-run-summary"].make({
            elapsedMillis: NonNegativeInt.make(10),
            exceptionCount: NonNegativeInt.make(0),
            family: "mail",
            inputBytes: NonNegativeInt.make(4),
            outputBytes: NonNegativeInt.make(4),
            passCount: NonNegativeInt.make(1),
            recordType: "family-run-summary",
            sourceCount: NonNegativeInt.make(1),
            unapprovedCount: NonNegativeInt.make(0),
          }),
          TransformationLedgerRecord.cases["family-acceptance-pass"].make({
            expectedCount: NonNegativeInt.make(1),
            family: "mail",
            recordType: "family-acceptance-pass",
            terminalCount: NonNegativeInt.make(1),
            unapprovedCount: 0,
          }),
          TransformationLedgerRecord.cases["recycle-mapping"].make({
            digest,
            originalPath: "C:\\Recovered\\file.txt",
            recordType: "recycle-mapping",
            restoredRelativePath: "surface/file.txt",
            sourceObjectId: "recycle-object",
            surfaceId: "surface",
          }),
          TransformationLedgerRecord.cases["recycle-join"].make({
            count: NonNegativeInt.make(1),
            joinClass: "valid-pair",
            recordType: "recycle-join",
            surfaceId: "surface",
          }),
          TransformationLedgerRecord.cases["family-run-summary"].make({
            elapsedMillis: NonNegativeInt.make(11),
            exceptionCount: NonNegativeInt.make(0),
            family: "recycle",
            inputBytes: NonNegativeInt.make(4),
            outputBytes: NonNegativeInt.make(4),
            passCount: NonNegativeInt.make(1),
            recordType: "family-run-summary",
            sourceCount: NonNegativeInt.make(2),
            unapprovedCount: NonNegativeInt.make(0),
          }),
          TransformationLedgerRecord.cases["family-acceptance-pass"].make({
            expectedCount: NonNegativeInt.make(1),
            family: "recycle",
            recordType: "family-acceptance-pass",
            terminalCount: NonNegativeInt.make(1),
            unapprovedCount: 0,
          }),
          TransformationLedgerRecord.cases["legacy-word-pass"].make({
            convertedSha256: digest,
            engineVersion: "pinned",
            normalizedTextSha256: digest,
            originalSha256: digest,
            pageCountDelta: 0,
            recordType: "legacy-word-pass",
            visualRmse: 0,
          }),
          TransformationLedgerRecord.cases["family-run-summary"].make({
            elapsedMillis: NonNegativeInt.make(12),
            exceptionCount: NonNegativeInt.make(0),
            family: "legacy-word",
            inputBytes: NonNegativeInt.make(4),
            outputBytes: NonNegativeInt.make(4),
            passCount: NonNegativeInt.make(1),
            recordType: "family-run-summary",
            sourceCount: NonNegativeInt.make(1),
            unapprovedCount: NonNegativeInt.make(0),
          }),
          TransformationLedgerRecord.cases["family-acceptance-pass"].make({
            expectedCount: NonNegativeInt.make(1),
            family: "legacy-word",
            recordType: "family-acceptance-pass",
            terminalCount: NonNegativeInt.make(1),
            unapprovedCount: 0,
          }),
        ];
        const encoded = yield* Effect.forEach(records, encodeTransformationLedgerRecordJson);
        const ledgerPath = path.join(fixture.corpusRoot, "staging", "restoration", "transformation-ledger.jsonl");
        yield* fs.makeDirectory(path.dirname(ledgerPath), { recursive: true });
        yield* fs.writeFileString(ledgerPath, `${A.join(encoded, "\n")}\n`);
        const acceptances = yield* reconcileRestorationAcceptance(
          RestorationVerifyOptions.make({ corpusRoot: fixture.corpusRoot, runLabel: "synthetic-restoration" })
        );
        const decoded = yield* Effect.forEach(acceptances, (acceptance) =>
          fs
            .readFileString(
              path.join(fixture.corpusRoot, "staging", "restoration", "acceptance", `${acceptance.family}.json`)
            )
            .pipe(Effect.flatMap((json) => decodeRestorationAcceptanceRecordJson(Str.trim(json))))
        );

        expect(acceptances).toHaveLength(4);
        expect(decoded).toHaveLength(4);
        expect(A.every(decoded, (record) => record.status === "pass" && record.unapprovedCount === 0)).toBe(true);
      },
      Effect.scoped,
      provideTestLayer
    )
  );
});
