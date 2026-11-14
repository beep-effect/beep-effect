/** Independent builtin dataclass observations from eyecite 2.7.6, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationTokenEditionBinding } from "@beep/law-practice-server/internal/Citation/TokenEditions";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { CitationTokenSeedHex } from "./CitationTokenSeed.fixtures.ts";

const Pair = S.Struct({ left: CitationTokenSeedHex, right: CitationTokenSeedHex });
const Corpus = S.Struct({
  schemaVersion: S.tag("citation-builtin-token-equality/v1"),
  oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
  python: S.tag("3.11.15"),
  license: S.tag("BSD-2-Clause"),
  producerSha256: S.String,
  editionProfileSha256: S.tag("b42419aa8c06a5ccb3a15ea6e46650219e1f50445dbd827224b4d771e9f2932c"),
  editionBindings: S.Array(S.Struct({ ...CitationTokenEditionBinding.fields, hash: S.BigIntFromString })),
  comparisonFields: S.Record(S.String, S.Array(S.String)),
  cases: S.Array(S.Struct({ ...Pair.fields, label: S.String, equal: S.Boolean })).check(S.isBetweenLength(1454, 1454)),
  histories: S.Array(
    S.Struct({
      ...Pair.fields,
      before: S.Boolean,
      after: S.Boolean,
      outcome: S.Literals(["left", "none", "error"]),
    })
  ).check(S.isBetweenLength(3, 3)),
}).pipe(S.fromJsonString);

/** Authenticate corpus, frozen edition profile and actual producer before replay.
 * @internal @category testing @since 0.0.0
 */
export const readCitationTokenEquality = Effect.fn("TokenEqualityTest.read")(function* () {
  const text = yield* readCitationOracleFixture(
    "token-equality",
    "44e0f3ad528c7d939cf48d388f9fd3a6aa4ac4b8b359d789a40a480922414eaa"
  );
  const corpus = yield* S.decodeEffect(Corpus)(text);
  yield* readCitationOracleFixture("token-editions", corpus.editionProfileSha256);
  // The Python producer was removed with the repository's Python (goal python-free-repo). Its
  // digest stays pinned in the corpus as `producerSha256`; recover the exact producer with
  // `git show 05ed8bc6b6cc50f2a284ed02caaab16f216bb9c3:goals/citation-extraction-engine/ops/probe-token-equality.py`.
  return corpus;
});
