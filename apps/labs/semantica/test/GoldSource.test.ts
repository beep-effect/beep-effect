// @vitest-environment node

import { ResolvedSourceText } from "@beep/file-processing/SourceText";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance";
import { Sha256Hex } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect } from "@effect/vitest";
import { Effect, FileSystem, Order, Path, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GOLD_SUBSETS } from "@/canary/Gold";
import { CorpusPaperId } from "@/corpus/Manifest";
import { GoldSourceLive } from "@/layers/GoldSourceLive";
import { contentDigest } from "@/schema/Digest";
import { Origin, SourceDocument } from "@/schema/Document";
import { GoldUnavailable } from "@/schema/Errors";
import { GoldFile, GoldFileEncoded, GoldRef, GoldSubset } from "@/schema/Gold";
import { DocumentId, ProvenanceEventId } from "@/schema/Ids";
import { LedgerDocumentSnapshot } from "@/schema/Ledger";
import { ModelIdentity } from "@/schema/Model";
import { ParseOutcome } from "@/schema/Text";
import { GoldSource } from "@/services/GoldSource";

const decodeGoldFileEncoded = S.decodeEffect(GoldFileEncoded);
const encodeGoldFile = S.encodeEffect(GoldFile);
const isCorpusPaperId = S.is(CorpusPaperId);

import { it } from "@beep/test-runner";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { assertTrue } from "@effect/vitest/utils";
import type { GoldFile as GoldFileValue } from "@/schema/Gold";

const GoldFileJson = S.fromJsonString(GoldFile, { space: 2 });
const encodeGoldFileJson = S.encodeEffect(GoldFileJson);

const GoldFileEncodedJson = S.fromJsonString(GoldFileEncoded, { space: 2 });
const encodeGoldFileEncodedJson = S.encodeEffect(GoldFileEncodedJson);

const GoldRefJson = S.fromJsonString(GoldRef, { space: 2 });
const encodeGoldRefJson = S.encodeEffect(GoldRefJson);
const goldFileOrder = Order.mapInput(Order.String, (file: GoldFileValue) => `${file.paperId}:${file.subset}`);
const goldPapers = A.map(
  [
    "000000000001",
    "000000000002",
    "000000000003",
    "000000000004",
    "000000000005",
    "000000000006",
    "000000000007",
    "000000000008",
    "000000000009",
    "00000000000a",
  ],
  (id) => CorpusPaperId.make(id)
);
const subsets = GoldSubset.make({
  structure: goldPapers,
  entity: A.take(goldPapers, 5),
  relation: A.take(goldPapers, 3),
});
const proposer = ModelIdentity.make({
  artifactHash: Sha256Hex.make("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
  name: "stub-gold-20260826",
  provider: "xai",
  revision: "stub-gold-20260826",
  taskType: "gold-proposal",
});
const encodedProposer = Result.getOrThrow(S.encodeResult(ModelIdentity)(proposer));
const writeGoldFixture = Effect.fn("GoldSourceTest.writeFixture")(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files = A.sort(
    yield* Effect.forEach(
      A.flatMap(GOLD_SUBSETS, (subset) => A.map(subsets[subset], (paperId) => ({ paperId, subset }))),
      ({ paperId, subset }) =>
        Effect.succeed(GoldFile.make({ labels: [], paperId, proposer, subset, version: "gold/v1" }))
    ),
    goldFileOrder
  );
  yield* Effect.forEach(files, (file) =>
    encodeGoldFileJson(file).pipe(
      Effect.flatMap((json) =>
        fs.writeFileString(path.join(directory, `${file.paperId}.${file.subset}.json`), `${json}\n`)
      )
    )
  );
  const encodedFiles = yield* Effect.forEach(files, (file) => encodeGoldFile(file));
  const digest = yield* contentDigest(S.Array(GoldFileEncoded))(encodedFiles);
  const reference = GoldRef.make({
    digest,
    proposer,
    spotCheckedFraction: UnitInterval.make(0),
    subsets,
    version: "gold/v1",
  });
  const referenceJson = yield* encodeGoldRefJson(reference);
  yield* fs.writeFileString(path.join(directory, "gold.json"), `${referenceJson}\n`);
  return { encodedFiles, files };
});

describe("C0 gold source", () => {
  it.prop(
    "generates schema-valid gold source paper ids",
    [Arbitrary.schema(CorpusPaperId)],
    ([paperId]) => assertTrue(isCorpusPaperId(paperId)),
    { arbitrary: fcRuns(20) }
  );

  it.layer(BunServices.layer, { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect("loads selected files and omits unreferenced subsets after verifying the complete gold reference", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-gold-source-" });
        const fixture = yield* writeGoldFixture(directory);
        const paperIds = [A.getUnsafe(goldPapers, 0), A.getUnsafe(goldPapers, 9)];

        const loaded = yield* GoldSource.pipe(
          Effect.flatMap((source) => source.load(paperIds, [])),
          provideScopedLayer(GoldSourceLive(directory))
        );

        expect(loaded).toEqual(A.filter(fixture.files, (file) => A.contains(paperIds, file.paperId)));
      })
    );
  });

  it.layer(BunServices.layer, { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect("returns GoldUnavailable for a malformed covered file", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-gold-malformed-" });
        yield* writeGoldFixture(directory);
        const paperId = A.getUnsafe(goldPapers, 0);
        yield* fs.writeFileString(path.join(directory, `${paperId}.entity.json`), "not-json");

        const error = yield* GoldSource.pipe(
          Effect.flatMap((source) => source.load([paperId], [])),
          provideScopedLayer(GoldSourceLive(directory)),
          Effect.flip
        );

        expect(error).toBeInstanceOf(GoldUnavailable);
        expect(error.reason).toBe("read-failed");
      })
    );
  });

  it.layer(BunServices.layer, { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect("fails typed when a covered label file no longer matches gold.json", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-gold-stale-reference-" });
        yield* writeGoldFixture(directory);
        const paperId = A.getUnsafe(goldPapers, 0);
        const tampered = yield* decodeGoldFileEncoded({
          labels: [
            {
              depth: 0,
              endChar: 4,
              quoteSha256: Sha256Hex.make("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
              role: "title",
              startChar: 0,
              verified: false,
            },
          ],
          paperId,
          proposer: encodedProposer,
          subset: "structure",
          version: "gold/v1",
        });
        const tamperedJson = yield* encodeGoldFileEncodedJson(tampered);
        yield* fs.writeFileString(path.join(directory, `${paperId}.structure.json`), `${tamperedJson}\n`);

        const error = yield* GoldSource.pipe(
          Effect.flatMap((source) => source.load([paperId], [])),
          provideScopedLayer(GoldSourceLive(directory)),
          Effect.flip
        );

        expect(error).toBeInstanceOf(GoldUnavailable);
        expect(error.reason).toBe("stale-reference");
      })
    );
  });

  it.layer(BunServices.layer, { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect("fails typed when a covered label digest mismatches its canonical document slice", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-gold-digest-mismatch-" });
        const fixture = yield* writeGoldFixture(directory);
        const paperId = A.getUnsafe(goldPapers, 0);
        const mismatched = yield* decodeGoldFileEncoded({
          labels: [
            {
              depth: 0,
              endChar: 4,
              quoteSha256: Sha256Hex.make(Str.repeat(64)("b")),
              role: "title",
              startChar: 0,
              verified: false,
            },
          ],
          paperId,
          proposer: encodedProposer,
          subset: "structure",
          version: "gold/v1",
        });
        const encodedFiles = A.map(fixture.encodedFiles, (file) =>
          Str.Equivalence(file.paperId, paperId) && Str.Equivalence(file.subset, "structure") ? mismatched : file
        );
        const mismatchedJson = yield* encodeGoldFileEncodedJson(mismatched);
        yield* fs.writeFileString(path.join(directory, `${paperId}.structure.json`), `${mismatchedJson}\n`);
        const digest = yield* contentDigest(S.Array(GoldFileEncoded))(encodedFiles);
        const referenceJson = yield* encodeGoldRefJson(
          GoldRef.make({
            digest,
            proposer,
            spotCheckedFraction: UnitInterval.make(0),
            subsets,
            version: "gold/v1",
          })
        );
        yield* fs.writeFileString(path.join(directory, "gold.json"), `${referenceJson}\n`);

        const documentId = DocumentId.make(Str.repeat(64)("c"));
        const extractor = SourceTextExtractor.make({ name: "gold-source-test", version: "0.0.0" });
        const identity = SourceTextIdentity.make({
          extractor,
          locator: PosixPath.make(`${paperId}.pdf`),
          normalizationVersion: "raw/1",
          scopeRef: "semantica-gold-source-test",
          sourceDigest: SourceTextDigest.make(`sha256:${documentId}`),
          sourceRef: documentId,
          textDigest: SourceTextDigest.make(`sha256:${Str.repeat(64)("d")}`),
        });
        const document = SourceDocument.make({
          acquired: ProvenanceEventId.make(Str.repeat(64)("e")),
          bytes: S.Natural.make(4),
          id: documentId,
          mediaType: "application/pdf",
          origin: Origin.cases.W1Paper.make({
            corpusId: "academia-2026-07",
            paperId,
            relativePath: `${paperId}.pdf`,
          }),
          sha256: documentId,
        });
        const snapshot = LedgerDocumentSnapshot.make({
          canonical: O.some(ResolvedSourceText.make({ identity, text: "Test" })),
          chunks: [],
          document,
          outcome: ParseOutcome.cases.Parsed.make({
            document: documentId,
            extractor,
            outcome: "Parsed",
            text: "Test",
          }),
        });

        const error = yield* GoldSource.pipe(
          Effect.flatMap((source) => source.load([paperId], [snapshot])),
          provideScopedLayer(GoldSourceLive(directory)),
          Effect.flip
        );

        expect(error).toBeInstanceOf(GoldUnavailable);
        expect(error.reason).toBe("digest-failed");
      })
    );
  });
});
