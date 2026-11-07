import {
  ClaimInputCollection,
  ClaimInputQualification,
  ClaimLexicalEvidence,
  ClaimLexicalToken,
  decomposePreparedClaimRoles,
  PreparedClaimInspection,
} from "@beep/law-practice-domain/values/ClaimElement";
import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const fixture = S.Struct({
  source: S.NonEmptyString,
  qualifiedParts: S.Struct({ preamble: S.NonEmptyString, transition: S.NonEmptyString, body: S.NonEmptyString }),
  tokens: S.Array(S.Struct({ anchor: TextAnchor, pos: S.NonEmptyString, lemma: S.NullOr(S.NonEmptyString) })),
});

/**
 * Compile supplied source qualification and injected lexical evidence separately
 * from the normal preparation/provider route.
 * **Example** (Use the source control)
 * ```ts
 * import { decomposeFiniteSourceFixture } from "./helpers/ClaimElementFiniteSource.ts"
 * console.log(typeof decomposeFiniteSourceFixture) // "function"
 * ```
 * @category testing
 * @since 0.0.0
 */
export const decomposeFiniteSourceFixture = Effect.fn("FiniteSource.supplied")(function* (inputRow: unknown) {
  const row = yield* S.decodeUnknownEffect(fixture)(inputRow);
  const input = yield* S.decodeEffect(ClaimInputCollection)({
    sourceKey: "finite-source-only",
    records: [{ kind: "text", sourceOrdinal: 1, numberText: "1", sourceText: row.source, canonicalText: row.source }],
  });
  const claim = yield* S.decodeUnknownEffect(PatentClaim)({
    claimType: "independent",
    claimNumber: 1,
    claimText: row.source,
    ...row.qualifiedParts,
  });
  const record = O.getOrThrow(O.filter(A.head(input.records), (entry) => entry.kind === "text"));
  const prepared = PreparedClaimInspection.make({
    input,
    qualifications: [ClaimInputQualification.cases["context-ready"].make({ record, claim })],
  });
  const evidence = ClaimLexicalEvidence.cases.aligned.make({
    sourceKey: input.sourceKey,
    sourceOrdinal: 1,
    qualifiedText: row.source,
    provider: "reviewed-source-only-no-provider",
    assetDigest: "injected-no-model",
    tokens: A.map(row.tokens, (token) => ClaimLexicalToken.make({ ...token, lemma: O.fromNullOr(token.lemma) })),
  });
  return yield* decomposePreparedClaimRoles(prepared, [evidence]);
});
