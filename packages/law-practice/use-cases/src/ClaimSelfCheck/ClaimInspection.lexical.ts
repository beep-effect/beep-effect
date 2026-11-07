/**
 * Source-aligned lexical inspection adapter over the existing NLP capability.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import {
  ClaimInputQualification,
  ClaimIntrinsicNounWitness,
  ClaimLexicalEvidence,
  ClaimLexicalMembershipRequest,
  ClaimLexicalProviderIdentity,
  ClaimLexicalSourceWork,
  ClaimLexicalToken,
  inspectPreparedClaimRoles,
  prepareClaimInspection,
  validClaimLexicalTokens,
} from "@beep/law-practice-domain/values/ClaimElement";
import { Tokenization, TokenizationError } from "@beep/nlp-processing/Core/Tokenization";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ClaimInspection, claimInspectionService } from "./ClaimInspection.service.ts";
import { ClaimLexicalMembership, UsptoClaimInputs } from "./ClaimSelfCheck.ports.ts";
import type { ClaimInputCollection, ClaimLexicalMembershipResult } from "@beep/law-practice-domain/values/ClaimElement";
import type { ClaimLexicalMembershipShape } from "./ClaimSelfCheck.ports.ts";

const $I = $LawPracticeUseCasesId.create("ClaimSelfCheck/ClaimInspection.lexical");
const LexicalSourceFacts = LiteralKit(["ready", "unavailable"])
  .toTaggedUnion("status")({
    ready: { tokens: S.Array(ClaimLexicalToken), lexicalWorkConsumed: ClaimLexicalSourceWork },
    unavailable: { reason: S.Literals(["source-work-limit", "alignment-failed"]) },
  })
  .pipe(
    $I.annoteSchema("LexicalSourceFacts", {
      description: "Exact token facts and the already-paid part of their one source allowance.",
    })
  );
const providerEqual = S.toEquivalence(ClaimLexicalProviderIdentity);
const validDebit = (remaining: number, debit: number, next: number): boolean =>
  debit >= 0 && debit <= remaining && next === remaining - debit;
class IntrinsicSourceFactsBuilder {
  private remaining: number;
  private reason: "source-work-limit" | "alignment-failed" = "alignment-failed";
  private readonly facts: Array<ClaimLexicalToken>;
  private readonly identity: ClaimLexicalProviderIdentity;
  private readonly membership: ClaimLexicalMembershipShape;
  constructor(
    facts: Array<ClaimLexicalToken>,
    identity: ClaimLexicalProviderIdentity,
    membership: ClaimLexicalMembershipShape,
    remaining: number
  ) {
    this.facts = facts;
    this.identity = identity;
    this.membership = membership;
    this.remaining = remaining;
  }
  private readonly consume = Effect.fn("ClaimInspection.consumeIntrinsicSourceFact")((index: number) =>
    Effect.gen({ self: this }, function* () {
      const token = O.getOrThrow(A.get(this.facts, index));
      if (token.pos !== "ADJ") return true;
      const requestWork = token.anchor.quote.length + 8;
      if (this.remaining < requestWork) {
        this.reason = "source-work-limit";
        return false;
      }
      this.remaining -= requestWork;
      const request = ClaimLexicalMembershipRequest.make({
        rawForm: token.anchor.quote,
        token: token.anchor,
        provider: this.identity,
        remainingWork: this.remaining,
      });
      const response = yield* this.membership.query(request).pipe(Effect.result);
      if (Result.isFailure(response)) {
        if (!validDebit(this.remaining, response.failure.workDebit, response.failure.remainingWork)) return false;
        this.remaining = response.failure.remainingWork;
        return true;
      }
      return this.accept(response.success, token, index);
    })
  );
  private accept(result: ClaimLexicalMembershipResult, token: ClaimLexicalToken, index: number): boolean {
    if (!validDebit(this.remaining, result.workDebit, result.remainingWork)) return false;
    this.remaining = result.remainingWork;
    if (result.status === "work-limit") {
      this.reason = "source-work-limit";
      return false;
    }
    if (!providerEqual(result.provider, this.identity) || result.rawForm !== token.anchor.quote) return false;
    if (result.status === "unavailable") return true;
    this.facts[index] = ClaimLexicalToken.make({
      ...token,
      intrinsicNoun: ClaimIntrinsicNounWitness.cases.known.make({
        anchor: token.anchor,
        rawForm: result.rawForm,
        baseNoun: result.baseNoun,
        oov: result.oov,
      }),
    });
    return true;
  }
  readonly run = Effect.gen({ self: this }, function* () {
    for (let index = 0; index < this.facts.length; index++)
      if (!(yield* this.consume(index))) return LexicalSourceFacts.cases.unavailable.make({ reason: this.reason });
    return LexicalSourceFacts.cases.ready.make({ tokens: this.facts, lexicalWorkConsumed: 262_144 - this.remaining });
  });
}
const intrinsicSourceFacts = Effect.fn("ClaimInspection.intrinsicSourceFacts")(function* (
  facts: Array<ClaimLexicalToken>,
  identity: ClaimLexicalProviderIdentity,
  membership: O.Option<ClaimLexicalMembershipShape>
) {
  if (O.isNone(membership)) return LexicalSourceFacts.cases.ready.make({ tokens: facts, lexicalWorkConsumed: 0 });
  // Reserve the added scan, immutable token/result copies, and source-local builder before allocation.
  const scanWork = facts.length * 16 + 9;
  if (262_144 < scanWork) return LexicalSourceFacts.cases.unavailable.make({ reason: "source-work-limit" });
  return yield* new IntrinsicSourceFactsBuilder(facts, identity, membership.value, 262_144 - scanWork).run;
});

/**
 * Build a lexical inspection implementation with an explicit pinned provider identity.
 * **Example** (Inspect source-aligned roles)
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
      const membership = yield* Effect.serviceOption(ClaimLexicalMembership);
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
              Effect.flatMap(
                Effect.fnUntraced(function* (tokens) {
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
                  if (!validClaimLexicalTokens(qualifiedText, facts)) return unavailable("alignment-failed");
                  const annotated = yield* intrinsicSourceFacts(facts, identity, membership);
                  return annotated.status === "ready"
                    ? O.some(
                        ClaimLexicalEvidence.cases.aligned.make({
                          ...base,
                          ...identity,
                          tokens: annotated.tokens,
                          lexicalWorkConsumed: annotated.lexicalWorkConsumed,
                        })
                      )
                    : unavailable(annotated.reason);
                })
              ),
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
 * **Example** (Inspect source-aligned roles)
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
