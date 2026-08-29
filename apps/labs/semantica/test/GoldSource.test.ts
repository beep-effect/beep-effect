// @vitest-environment node

import { ResolvedSourceText } from "@beep/file-processing/SourceText";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance";
import { NonNegativeInt, Sha256Hex } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, FileSystem, Layer, Order, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";
import { describe, expect, it } from "vitest";
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
import type { GoldFile as GoldFileValue } from "@/schema/Gold";

const GoldFileJson = S.fromJsonString(GoldFile, { space: 2 });
const GoldFileEncodedJson = S.fromJsonString(GoldFileEncoded, { space: 2 });
const GoldRefJson = S.fromJsonString(GoldRef, { space: 2 });
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

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

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
    S.encodeEffect(GoldFileJson)(file).pipe(
      Effect.flatMap((json) =>
        fs.writeFileString(path.join(directory, `${file.paperId}.${file.subset}.json`), `${json}\n`)
      )
    )
  );
  const encodedFiles = yield* Effect.forEach(files, (file) => S.encodeEffect(GoldFile)(file));
  const digest = yield* contentDigest(S.Array(GoldFileEncoded))(encodedFiles);
  const reference = GoldRef.make({
    digest,
    proposer,
    spotCheckedFraction: UnitInterval.make(0),
    subsets,
    version: "gold/v1",
  });
  const referenceJson = yield* S.encodeEffect(GoldRefJson)(reference);
  yield* fs.writeFileString(path.join(directory, "gold.json"), `${referenceJson}\n`);
  return { encodedFiles, files };
});

describe("C0 gold source", () => {
  it("generates schema-valid gold source paper ids", () => {
    fc.assert(
      fc.property(S.toArbitrary(CorpusPaperId)(fc), (paperId) => S.is(CorpusPaperId)(paperId)),
      { numRuns: 20 }
    );
  });

  it("loads selected files and omits unreferenced subsets after verifying the complete gold reference", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.scoped(
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
        )
      )
    ));

  it("returns GoldUnavailable for a malformed covered file", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.scoped(
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
        )
      )
    ));

  it("fails typed when a covered label file no longer matches gold.json", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.scoped(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const directory = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-gold-stale-reference-" });
            yield* writeGoldFixture(directory);
            const paperId = A.getUnsafe(goldPapers, 0);
            const tampered = yield* S.decodeEffect(GoldFileEncoded)({
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
              proposer,
              subset: "structure",
              version: "gold/v1",
            });
            const tamperedJson = yield* S.encodeEffect(GoldFileEncodedJson)(tampered);
            yield* fs.writeFileString(path.join(directory, `${paperId}.structure.json`), `${tamperedJson}\n`);

            const error = yield* GoldSource.pipe(
              Effect.flatMap((source) => source.load([paperId], [])),
              provideScopedLayer(GoldSourceLive(directory)),
              Effect.flip
            );

            expect(error).toBeInstanceOf(GoldUnavailable);
            expect(error.reason).toBe("stale-reference");
          })
        )
      )
    ));

  it("fails typed when a covered label digest mismatches its canonical document slice", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.scoped(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const directory = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-gold-digest-mismatch-" });
            const fixture = yield* writeGoldFixture(directory);
            const paperId = A.getUnsafe(goldPapers, 0);
            const mismatched = yield* S.decodeEffect(GoldFileEncoded)({
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
              proposer,
              subset: "structure",
              version: "gold/v1",
            });
            const encodedFiles = A.map(fixture.encodedFiles, (file) =>
              Str.Equivalence(file.paperId, paperId) && Str.Equivalence(file.subset, "structure") ? mismatched : file
            );
            const mismatchedJson = yield* S.encodeEffect(GoldFileEncodedJson)(mismatched);
            yield* fs.writeFileString(path.join(directory, `${paperId}.structure.json`), `${mismatchedJson}\n`);
            const digest = yield* contentDigest(S.Array(GoldFileEncoded))(encodedFiles);
            const referenceJson = yield* S.encodeEffect(GoldRefJson)(
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
              bytes: NonNegativeInt.make(4),
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
        )
      )
    ));
});
