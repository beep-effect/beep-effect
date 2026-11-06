/** Source-aligned lexical inspection adapter over the existing NLP capability. @packageDocumentation @since 0.0.0 */
import {
  ClaimInputQualification,
  ClaimLexicalEvidence,
  ClaimLexicalToken,
  inspectPreparedClaimRoles,
  prepareClaimInspection,
  validClaimLexicalTokens,
} from "@beep/law-practice-domain/values/ClaimElement";
import { Tokenization, TokenizationError } from "@beep/nlp-processing/Core/Tokenization";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { ClaimInspection, claimInspectionService } from "./ClaimInspection.service.ts";
import { UsptoClaimInputs } from "./ClaimSelfCheck.ports.ts";
import type { ClaimInputCollection, ClaimLexicalProviderIdentity } from "@beep/law-practice-domain/values/ClaimElement";

/**
 * Build a lexical inspection implementation with an explicit pinned provider identity.
 * @example
 * ```ts
 * import { claimInspectionWithLexicalEvidence } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 * console.log(typeof claimInspectionWithLexicalEvidence) // function
 * ```
 * @category layers
 * @since 0.0.0
 */
export const claimInspectionWithLexicalEvidence = (identity: ClaimLexicalProviderIdentity) =>
  Layer.effect(
    ClaimInspection,
    Effect.gen(function* () {
      const tokenization = yield* Tokenization;
      const acquisition = yield* UsptoClaimInputs;
      const inspect = Effect.fn("ClaimInspection.inspectLexical")(function* (input: ClaimInputCollection) {
        const prepared = yield* prepareClaimInspection(input);
        let remainingCharacters = 1_048_576;
        const evidence = yield* Effect.forEach(
          prepared.qualifications,
          (qualification): Effect.Effect<O.Option<ClaimLexicalEvidence>> => {
            if (!ClaimInputQualification.guards["context-ready"](qualification)) return Effect.succeedNone;
            const qualifiedText = qualification.claim.claimText;
            const base = {
              sourceKey: input.sourceKey,
              sourceOrdinal: qualification.record.sourceOrdinal,
              qualifiedText,
            };
            remainingCharacters -= qualifiedText.length;
            const unavailable = (reason: "source-work-limit" | "tokenization-failed" | "alignment-failed") =>
              O.some(ClaimLexicalEvidence.cases.unavailable.make({ ...base, reason }));
            if (qualifiedText.length > 32_768 || remainingCharacters < 0)
              return Effect.succeed(unavailable("source-work-limit"));
            return tokenization.tokenize(qualifiedText).pipe(
              Effect.map((tokens) => {
                if (
                  tokens.length > 8_192 ||
                  A.some(
                    tokens,
                    (token) =>
                      O.isNone(token.pos) ||
                      O.exists(token.pos, Str.isEmpty) ||
                      token.start < 0 ||
                      token.end <= token.start ||
                      token.end > qualifiedText.length ||
                      Str.slice(token.start, token.end)(qualifiedText) !== token.text
                  )
                )
                  return unavailable("alignment-failed");
                const facts = A.map(tokens, (token) =>
                  ClaimLexicalToken.make({
                    anchor: TextAnchor.make({ startChar: token.start, endChar: token.end, quote: token.text }),
                    pos: O.getOrThrow(token.pos),
                    lemma: O.filter(token.lemma, Str.isNonEmpty),
                  })
                );
                return validClaimLexicalTokens(qualifiedText, facts)
                  ? O.some(ClaimLexicalEvidence.cases.aligned.make({ ...base, ...identity, tokens: facts }))
                  : unavailable("alignment-failed");
              }),
              Effect.catchTag("TokenizationError", () => Effect.succeed(unavailable("tokenization-failed")))
            );
          }
        );
        return yield* inspectPreparedClaimRoles(prepared, A.getSomes(evidence));
      });
      return claimInspectionService(inspect)(acquisition);
    })
  );

/**
 * Preserve explicit enhancement-unavailable coverage when the fixed lexical engine cannot initialize.
 * @example
 * ```ts
 * import { unavailableClaimInspectionWithLexicalEvidence } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 * console.log(typeof unavailableClaimInspectionWithLexicalEvidence) // function
 * ```
 * @category layers
 * @since 0.0.0
 */
export const unavailableClaimInspectionWithLexicalEvidence = (identity: ClaimLexicalProviderIdentity) =>
  claimInspectionWithLexicalEvidence(identity).pipe(
    Layer.provide(
      Layer.succeed(
        Tokenization,
        Tokenization.of({
          tokenize: Effect.fn("UnavailableLexical.tokenize")(() =>
            Effect.fail(
              TokenizationError.make({
                operation: "tokenize",
                cause: "Fixed lexical engine initialization unavailable.",
              })
            )
          ),
          sentences: Effect.fn("UnavailableLexical.sentences")(() =>
            Effect.fail(
              TokenizationError.make({
                operation: "sentences",
                cause: "Fixed lexical engine initialization unavailable.",
              })
            )
          ),
          document: Effect.fn("UnavailableLexical.document")(() =>
            Effect.fail(
              TokenizationError.make({
                operation: "document",
                cause: "Fixed lexical engine initialization unavailable.",
              })
            )
          ),
          tokenCount: Effect.fn("UnavailableLexical.tokenCount")(() =>
            Effect.fail(
              TokenizationError.make({
                operation: "tokenCount",
                cause: "Fixed lexical engine initialization unavailable.",
              })
            )
          ),
        })
      )
    )
  );
