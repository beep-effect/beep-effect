/** Lossless compact oracle recipes; production recipe data remains unchanged.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationExtractorRecipe } from "@beep/law-practice-server/internal/Citation/ExtractorRecipes";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $LawPracticeServerId.create("test/CitationExtractorRecipes");
const EditionIndex = S.Natural.check(S.isLessThan(2533)).pipe(
  $I.annoteSchema("EditionIndex", { description: "Index into the complete ordered oracle edition-reference table." })
);
const ExtraIndex = S.Natural.check(S.isLessThan(6409)).pipe(
  $I.annoteSchema("ExtraIndex", { description: "Index into the losslessly interned source constructor extra values." })
);
const Extra = S.Tuple([
  CitationExtractorRecipe.fields.flags,
  CitationExtractorRecipe.fields.kind,
  S.Array(EditionIndex),
  S.Array(EditionIndex),
  S.Boolean,
]).pipe(
  $I.annoteSchema("Extra", {
    description: "Original flags, explicit bound class, ordered edition lists and short flag.",
  })
);
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-extractor-recipes/v2"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    producerSha256: S.tag("b618fceabb7bac1bfa23e0c0429359a697f274ba1ad393a5dc68eff096221324"),
    extractorsSha256: S.tag("8603461486e165c4cb98f238b58910c269e8d6b59f4a16323c075276e94eec3c"),
    counts: S.Record(S.String, S.Natural),
    editionRefs: S.Array(Sha256Hex).check(S.isBetweenLength(2533, 2533)),
    extras: S.Array(Extra).check(S.isBetweenLength(6409, 6409)),
    recipes: S.Array(S.Tuple([Sha256Hex, ExtraIndex])).check(S.isBetweenLength(6805, 6805)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "All original canonical extractor recipes with lossless reference/value tables.",
  })
);
/** Expand every occurrence into fresh production recipe arrays without inference.
 * Table-index bounds are schema checked before lookup; ordinal remains source id.
 * @internal @category testing @since 0.0.0
 */
export const decodeCitationExtractorRecipeCorpus = Effect.fn("ExtractorRecipeTest.decodeCorpus")(function* (
  raw: string
) {
  const corpus = yield* S.decodeEffect(Corpus)(raw);
  const recipes = A.map(corpus.recipes, ([patternSha256, extraIndex], id) => {
    const [flags, kind, exact, variation, short] = A.getUnsafe(corpus.extras, extraIndex);
    const ref = (index: number) => A.getUnsafe(corpus.editionRefs, index);
    return CitationExtractorRecipe.make({
      id,
      patternSha256,
      flags,
      kind,
      exact: A.map(exact, ref),
      variation: A.map(variation, ref),
      short,
    });
  });
  return { counts: corpus.counts, editionRefs: corpus.editionRefs, recipes };
});
