/**
 * Claim evidence shared by the whole-claim and antecedent-finding candidate
 * mappers: aligning claim and term text to the normalized source text, and
 * decoding the candidate and evidence entity pair.
 *
 * Covered by the package's `./internal/*: null` export guard — not part of the
 * public surface.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { CandidateClaim, Evidence } from "@beep/epistemic-domain";
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, flow, pipe } from "effect/Function";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PosInt } from "./PosInt.ts";
import { spikeEntityInput } from "./spikeEntity.ts";
import type { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument";

const $I = $LawPracticeUseCasesId.create("internal/claimEvidence");
const decodeCandidateClaim = S.decodeUnknownEffect(CandidateClaim);
const decodeEvidence = S.decodeUnknownEffect(Evidence);

const escapeRegExp = (value: string): string => Str.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")(value);

/**
 * Exact source offset and quote of an aligned span.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type SourceQuote = readonly [startChar: number, quote: string];

const whitespaceFlexiblePattern: (value: string) => string = flow(
  Str.split(/\s+/u),
  A.map(escapeRegExp),
  A.join("\\s+")
);

/**
 * Locate a typed claim's text in the claims section of its normalized source text.
 *
 * **Details**
 *
 * The claim must follow its own number (`"1. "`) at the start of a line inside
 * `[claimsSectionStart, claimsSectionEnd)`. Whitespace runs match any
 * whitespace, so a claim re-wrapped by the normalizer still aligns. The result
 * is the source offset and the exact source quote.
 *
 * **Example** (Align a claim after its number)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument"
 * import { claimEvidenceFrom } from "./claimEvidence.ts"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 * const claim = PatentClaim.cases.independent.make({
 *   body: "a sensor.",
 *   claimNumber: PosInt.make(1),
 *   claimText: "A system comprising a sensor.",
 *   preamble: "A system",
 *   transition: "comprising"
 * })
 * const source = "CLAIMS\n1. A system comprising\na sensor."
 * console.log(O.map(claimEvidenceFrom(claim, source, 7, source.length), ([start]) => start)) // Option.some(10)
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const claimEvidenceFrom: {
  (
    sourceText: string,
    claimsSectionStart: number,
    claimsSectionEnd: number
  ): (claim: PatentClaim) => O.Option<SourceQuote>;
  (claim: PatentClaim, sourceText: string, claimsSectionStart: number, claimsSectionEnd: number): O.Option<SourceQuote>;
} = dual(
  4,
  (
    claim: PatentClaim,
    sourceText: string,
    claimsSectionStart: number,
    claimsSectionEnd: number
  ): O.Option<SourceQuote> => {
    const claimsText = Str.slice(claimsSectionStart, claimsSectionEnd)(sourceText);
    const claimPattern = new RegExp(
      `(?:^|\\n)[\\t ]*${claim.claimNumber}\\.[\\t ]+(${whitespaceFlexiblePattern(claim.claimText)})`,
      "iu"
    );
    return pipe(
      Str.match(claimPattern)(claimsText),
      O.flatMap((claimMatch) =>
        pipe(
          O.all({
            matchStart: O.fromUndefinedOr(claimMatch.index),
            quote: A.get(claimMatch, 1),
          }),
          O.flatMap(({ matchStart, quote }) =>
            pipe(
              Str.indexOf(quote)(claimMatch[0]),
              O.map(
                (quoteOffset): SourceQuote => [Num.sum(claimsSectionStart, Num.sum(matchStart, quoteOffset)), quote]
              )
            )
          )
        )
      )
    );
  }
);

/**
 * Locate one span of a claim's normalized text inside that claim's source quote.
 *
 * **Details**
 *
 * The claim's source quote comes from {@link claimEvidenceFrom};
 * `spanStart` and `spanQuote` index the claim's whitespace-normalized
 * `claimText`. The claim text before the span and the span itself match
 * whitespace-flexibly, so the result is the span's exact source offset and
 * quote even where the source wraps lines.
 *
 * **Example** (Align a term inside a wrapped claim)
 *
 * ```ts
 * import { termEvidenceFrom } from "./claimEvidence.ts"
 *
 * const located = termEvidenceFrom([10, "A system comprising\na sensor."], "A system comprising a sensor.", 20, "a sensor")
 * console.log(located) // Option.some([30, "a sensor"])
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const termEvidenceFrom: {
  (claimText: string, spanStart: number, spanQuote: string): (claimQuote: SourceQuote) => O.Option<SourceQuote>;
  (claimQuote: SourceQuote, claimText: string, spanStart: number, spanQuote: string): O.Option<SourceQuote>;
} = dual(
  4,
  (
    [claimStart, claimQuote]: SourceQuote,
    claimText: string,
    spanStart: number,
    spanQuote: string
  ): O.Option<SourceQuote> =>
    pipe(
      Str.match(
        new RegExp(
          `^${whitespaceFlexiblePattern(Str.slice(0, spanStart)(claimText))}(${whitespaceFlexiblePattern(spanQuote)})`,
          "u"
        )
      )(claimQuote),
      O.flatMap((termMatch) =>
        O.map(
          A.get(termMatch, 1),
          (quote): SourceQuote => [claimStart + Str.length(termMatch[0]) - Str.length(quote), quote]
        )
      )
    )
);

/**
 * Inputs of one candidate claim and the evidence span that supports it.
 *
 * **Example** (Construct a candidate input)
 *
 * ```ts
 * import { EvidencedCandidateInput } from "./claimEvidence.ts"
 *
 * const input = EvidencedCandidateInput.make({
 *   artifactFixtureKey: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
 *   entitySeed: 1,
 *   evidenceFixtureKey: "evidence:example",
 *   fixtureKey: "claim:example",
 *   identityKey: "pexample",
 *   quote: "a sensor",
 *   snapshot: { activityKind: "example" },
 *   startChar: 30
 * })
 * console.log(input.identityKey) // "pexample"
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class EvidencedCandidateInput extends S.Opaque<EvidencedCandidateInput, { readonly brand: unique symbol }>()(
  S.Struct({
    artifactFixtureKey: S.NonEmptyString.annotateKey({
      description: "Fixture key of the source artifact the evidence quotes.",
    }),
    entitySeed: PosInt.annotateKey({
      description: "Spike entity seed; the candidate and evidence take the ids seed * 10 and seed * 10 + 1.",
    }),
    evidenceFixtureKey: S.NonEmptyString.annotateKey({
      description: "Fixture key of the evidence span.",
    }),
    fixtureKey: S.NonEmptyString.annotateKey({
      description: "Fixture key of the candidate claim.",
    }),
    identityKey: S.NonEmptyString.annotateKey({
      description: "Lowercase base-36 key shared by the candidate and evidence public ids.",
    }),
    quote: S.NonEmptyString.annotateKey({
      description: "Exact source quote of the evidence span.",
    }),
    snapshot: S.Record(S.String, S.Unknown).annotateKey({
      description: "Candidate snapshot recording what was asserted and by which activity.",
    }),
    startChar: S.Natural.annotateKey({
      description: "Source offset of the evidence quote.",
    }),
  }).pipe(
    $I.annoteSchema("EvidencedCandidateInput", {
      description: "Inputs of one candidate-lifecycle claim and its supporting evidence span.",
    })
  )
) {}

/**
 * Decode a `candidate`-lifecycle claim and its evidence span from one input.
 *
 * **Example** (Decode a candidate and its evidence)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { EvidencedCandidateInput, decodeEvidencedCandidate } from "./claimEvidence.ts"
 *
 * const program = decodeEvidencedCandidate(
 *   EvidencedCandidateInput.make({
 *     artifactFixtureKey: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
 *     entitySeed: 1,
 *     evidenceFixtureKey: "evidence:example",
 *     fixtureKey: "claim:example",
 *     identityKey: "pexample",
 *     quote: "a sensor",
 *     snapshot: { activityKind: "example" },
 *     startChar: S.Natural.make(30)
 *   })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @internal
 * @category mapping
 * @since 0.0.0
 */
export const decodeEvidencedCandidate = Effect.fn("ClaimEvidence.decodeEvidencedCandidate")(function* (
  input: EvidencedCandidateInput
): Effect.fn.Return<readonly [candidate: CandidateClaim, evidence: Evidence], S.SchemaError> {
  const candidate = yield* decodeCandidateClaim({
    ...spikeEntityInput("EpistemicCandidateClaim", input.entitySeed * 10),
    fixtureKey: input.fixtureKey,
    lifecycle: "candidate",
    snapshot: input.snapshot,
    publicId: `${Epistemic.CandidateClaimId.tableName}_${input.identityKey}`,
  });
  const evidence = yield* decodeEvidence({
    ...spikeEntityInput("EpistemicEvidence", input.entitySeed * 10 + 1),
    artifactFixtureKey: input.artifactFixtureKey,
    publicId: `${Epistemic.EvidenceId.tableName}_${input.identityKey}`,
    span: {
      version: "evidence-position/v2",
      position: {
        endChar: Num.sum(input.startChar, Str.length(input.quote)),
        quote: input.quote,
        startChar: input.startChar,
      },
      extractorConfidence: { _tag: "Absent", reason: "not-assessed" },
    },
    spanFixtureKey: input.evidenceFixtureKey,
  });
  return [candidate, evidence];
});
