/** Authenticated default source catalog and parameterized edition observations.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationExtractorRecipe } from "@beep/law-practice-server/internal/Citation/ExtractorRecipes";
import { CitationRegexPatternDescriptor } from "@beep/law-practice-server/internal/Citation/RegexDescriptors";
import { CitationTokenizerEdition } from "@beep/law-practice-server/internal/Citation/Tokenizer";
import { Sha256Hex } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { loadCitationExtractorSelectionControls } from "./CitationExtractorSelection.fixtures.ts";
import { CitationTokenizerSourceCase } from "./CitationTokenizer.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationCanonicalTokenizer");
const InputNames = S.Literals([
  "operation-cases.json",
  "extractor-recipes.json",
  "extractor-selection.json",
  "regex-program-facts.json",
]);
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-canonical-tokenizer/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    hashSeed: S.tag("0"),
    hashProfile: S.tag("captured-source-runtime"),
    producerSha256: S.tag("e6940fe79d80c7710d22e2aff2bf9523d4eadedcefaa34e65dfd0f3c80d352ab"),
    extractorsSha256: S.tag("8603461486e165c4cb98f238b58910c269e8d6b59f4a16323c075276e94eec3c"),
    inputs: S.Record(InputNames, Sha256Hex),
    extractorCount: S.tag(6805),
    editionCount: S.tag(2533),
    editions: S.Array(S.Struct({ ...CitationTokenizerEdition.fields, hash: S.BigIntFromString })).check(
      S.isBetweenLength(2533, 2533)
    ),
    cases: S.Array(CitationTokenizerSourceCase).check(S.isBetweenLength(17, 17)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Actual default source tokenizer outcomes under the explicitly captured edition hash profile.",
  })
);
const Operations = S.fromJsonString(S.Struct({ artifacts: S.Record(S.String, S.Unknown) }));
const Artifact = S.Struct({ kind: S.tag("tokenizer-extractors"), payload: S.String });
const Recipes = S.fromJsonString(
  S.Struct({ recipes: S.Array(CitationExtractorRecipe).check(S.isBetweenLength(6805, 6805)) })
);
const Facts = S.fromJsonString(
  S.Struct({
    descriptors: S.Array(CitationRegexPatternDescriptor).check(S.isBetweenLength(13258, 13258)),
    artifactDescriptorIndices: S.Record(S.String, S.Array(S.Natural)),
  })
);
/** @internal @category testing @since 0.0.0 */
export const loadCitationCanonicalTokenizerControls = Effect.fn("CanonicalTokenizerTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const digest = yield* Digest.Digest;
  const raw = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/canonical-tokenizer.json", import.meta.url))
  );
  const hash = yield* digest.digestHex(Digest.sha256, raw);
  expect(hash).toBe("9b59b41956d07ae2086d5dd339babd564c1bc6edfa51d49045ac85fc77748a30");
  const corpus = yield* S.decodeEffect(Corpus)(new TextDecoder().decode(raw));
  const read = Effect.fn("CanonicalTokenizerTest.readInput")(function* (name: typeof InputNames.Type) {
    const bytes = yield* fs.readFile(
      NodeURL.fileURLToPath(new URL(`../../use-cases/test/fixtures/eyecite/${name}`, import.meta.url))
    );
    const hash = yield* digest.digestHex(Digest.sha256, bytes);
    expect(hash, name).toBe(corpus.inputs[name]);
    return new TextDecoder().decode(bytes);
  });
  const operationRaw = yield* read("operation-cases.json");
  const operations = yield* S.decodeEffect(Operations)(operationRaw);
  const captured = yield* Effect.fromOption(R.get(operations.artifacts, corpus.extractorsSha256));
  const artifact = yield* S.decodeUnknownEffect(Artifact)(captured);
  const recipeRaw = yield* read("extractor-recipes.json");
  const recipes = yield* S.decodeEffect(Recipes)(recipeRaw);
  const factsRaw = yield* read("regex-program-facts.json");
  const facts = yield* S.decodeEffect(Facts)(factsRaw);
  const indices = yield* Effect.fromOption(R.get(facts.artifactDescriptorIndices, corpus.extractorsSha256));
  expect(indices).toHaveLength(6805);
  const descriptors = A.map(A.dedupe(indices), (index) => A.getUnsafe(facts.descriptors, index));
  const ordering = yield* loadCitationExtractorSelectionControls();
  const selectionRaw = yield* read("extractor-selection.json");
  expect(selectionRaw.length).toBeGreaterThan(0);
  return {
    corpus,
    payload: artifact.payload,
    metadata: { recipes: recipes.recipes, hashes: ordering.canonical.hashes, descriptors, editions: corpus.editions },
  };
});
