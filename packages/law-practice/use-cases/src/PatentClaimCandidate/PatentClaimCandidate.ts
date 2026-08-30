/**
 * Typed patent-claim to epistemic candidate mapping.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { CandidateClaim, Evidence } from "@beep/epistemic-domain";
import { ContentDigest, OperationId } from "@beep/file-processing/Artifact";
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument";
import { Defect, NonNegativeInt, PosInt } from "@beep/schema";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import { Effect, flow, Number as Num, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { spikeEntityInput } from "../internal/spikeEntity.ts";
import { OfficeActionCandidateExtraction } from "../OfficeActionReview/OfficeActionReview.ports.ts";

const $I = $LawPracticeUseCasesId.create("PatentClaimCandidate/PatentClaimCandidate");
const decodeCandidateClaim = S.decodeUnknownEffect(CandidateClaim);
const decodeEvidence = S.decodeUnknownEffect(Evidence);

/**
 * Already-normalized patent claim plus provenance required for KG persistence.
 *
 * **Example** (Construct a mapping input)
 *
 * ```ts
 * import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument"
 * import { PatentClaimCandidateInput } from "@beep/law-practice-use-cases/PatentClaimCandidate"
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 *
 * const claim = PatentClaim.cases.independent.make({
 *   body: "a sensor",
 *   claimNumber: PosInt.make(1),
 *   claimText: "A system comprising a sensor.",
 *   preamble: "A system",
 *   transition: "comprising"
 * })
 * console.log(claim.claimType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PatentClaimCandidateInput extends S.Class<PatentClaimCandidateInput>($I`PatentClaimCandidateInput`)(
  {
    claim: PatentClaim.annotateKey({
      description: "Typed patent claim produced by the domain normalization boundary.",
    }),
    claimsHeading: S.NonEmptyString.annotateKey({
      description: "Recognized claims-section heading used to constrain evidence alignment.",
    }),
    claimsSectionEnd: NonNegativeInt.annotateKey({
      description: "Exclusive source-text boundary of the structurally normalized claims section.",
    }),
    claimsSectionStart: NonNegativeInt.annotateKey({
      description: "Inclusive source-text boundary of the structurally normalized claims section content.",
    }),
    digest: ContentDigest.annotateKey({
      description: "Content digest of the normalized patent document.",
    }),
    docket: S.NonEmptyString.annotateKey({
      description: "Matter docket associated with the patent document.",
    }),
    entitySeed: PosInt.annotateKey({
      description: "Bounded deterministic seed used by the current spike entity envelope.",
    }),
    identityDigest: ContentDigest.annotateKey({
      description: "Docket-scoped document digest used for collision-resistant persisted public identifiers.",
    }),
    operationId: OperationId.annotateKey({
      description: "Normalization activity identifier retained in the candidate snapshot.",
    }),
    sourceFile: S.NonEmptyString.annotateKey({
      description: "Traceable source filename presented by the batch caller.",
    }),
    sourceText: S.NonEmptyString.annotateKey({
      description: "Normalized document text containing the claim evidence quote.",
    }),
  },
  $I.annote("PatentClaimCandidateInput", {
    description: "Typed patent claim and provenance required to construct an epistemic candidate with evidence.",
  })
) {}

/**
 * Failure mapping a normalized patent claim into epistemic entities.
 *
 * **Example** (Construct an alignment error)
 *
 * ```ts
 * import { PatentClaimCandidateError } from "@beep/law-practice-use-cases/PatentClaimCandidate"
 *
 * const error = PatentClaimCandidateError.make({
 *   message: "Claim 2 does not align to the normalized patent source text."
 * })
 * console.log(error._tag) // "PatentClaimCandidateError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PatentClaimCandidateError extends S.TaggedError<PatentClaimCandidateError>($I`PatentClaimCandidateError`)(
  "PatentClaimCandidateError",
  {
    cause: S.optionalKey(Defect({ includeStack: true })),
    message: S.NonEmptyString,
  },
  $I.annoteError<PatentClaimCandidateError>("PatentClaimCandidateError", {
    description: "Failure aligning or decoding a normalized patent claim into epistemic entities.",
  })
) {}

const patentClaimCandidateError = (cause: unknown): PatentClaimCandidateError =>
  PatentClaimCandidateError.make({
    cause,
    message: `Patent claim candidate mapping failed: ${String(cause)}`,
  });

const escapeRegExp = (value: string): string => Str.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")(value);

const whitespaceFlexiblePattern: (value: string) => string = flow(
  Str.split(/\s+/u),
  A.map(escapeRegExp),
  A.join("\\s+")
);

const claimEvidenceFrom = (
  sourceText: string,
  claimsSectionStart: number,
  claimsSectionEnd: number,
  claim: PatentClaim
): O.Option<readonly [startChar: number, quote: string]> => {
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
            O.map((quoteOffset) => [Num.sum(claimsSectionStart, Num.sum(matchStart, quoteOffset)), quote] as const)
          )
        )
      )
    )
  );
};

/**
 * Map a typed patent claim directly into candidate and evidence entities.
 *
 * **Details**
 *
 * This mapper performs no Markdown-heading or claim-text parsing. It preserves
 * the domain-owned structure in the snapshot and aligns the already-decoded
 * claim text to its source for an exact evidence span.
 *
 * **Example** (Map a normalized independent claim)
 *
 * ```ts
 * import { ContentDigest, OperationId } from "@beep/file-processing/Artifact"
 * import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument"
 * import {
 *   PatentClaimCandidateInput,
 *   patentClaimCandidateFrom
 * } from "@beep/law-practice-use-cases/PatentClaimCandidate"
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 * import * as Effect from "effect/Effect"
 *
 * const claimText = "A system comprising a sensor."
 * const claim = PatentClaim.cases.independent.make({
 *   body: "a sensor",
 *   claimNumber: PosInt.make(1),
 *   claimText,
 *   preamble: "A system",
 *   transition: "comprising"
 * })
 * const program = patentClaimCandidateFrom(PatentClaimCandidateInput.make({
 *   claim,
 *   claimsHeading: "CLAIMS",
 *   claimsSectionEnd: NonNegativeInt.make(44),
 *   claimsSectionStart: NonNegativeInt.make(21),
 *   digest: ContentDigest.make("sha256:0000000000000000000000000000000000000000000000000000000000000000"),
 *   docket: "US-EXAMPLE-1",
 *   entitySeed: PosInt.make(1),
 *   identityDigest: ContentDigest.make("sha256:1111111111111111111111111111111111111111111111111111111111111111"),
 *   operationId: OperationId.make("operation:0000000000000000000000000000000000000000000000000000000000000000"),
 *   sourceFile: "example.md",
 *   sourceText: `CLAIMS\n1. ${claimText}`
 * }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @effects Fails when the typed claim no longer aligns to its supplied source
 * text or an epistemic entity rejects the mapped shape.
 * @category mapping
 * @since 0.0.0
 */
export const patentClaimCandidateFrom = Effect.fn("PatentClaimCandidate.from")(function* (
  input: PatentClaimCandidateInput
): Effect.fn.Return<OfficeActionCandidateExtraction, PatentClaimCandidateError> {
  const [startChar, evidenceQuote] = yield* Effect.fromOption(
    claimEvidenceFrom(input.sourceText, input.claimsSectionStart, input.claimsSectionEnd, input.claim),
    () =>
      patentClaimCandidateError(`Claim ${input.claim.claimNumber} does not align to the normalized patent source text.`)
  );
  const evidenceFixtureKey = `evidence:${input.identityDigest}:${input.claim.claimNumber}`;
  const fixtureKey = `claim:${input.identityDigest}:${input.claim.claimNumber}`;
  const identityKey = `p${Str.slice(7)(input.identityDigest)}c${input.claim.claimNumber}`;
  const claimReferences = PatentClaim.match(input.claim, {
    dependent: ({ claimReferences: references }) => references,
    independent: () => [],
  });
  const candidate = yield* decodeCandidateClaim({
    ...spikeEntityInput("EpistemicCandidateClaim", input.entitySeed * 10),
    fixtureKey,
    lifecycle: "candidate",
    snapshot: {
      activityKind: "patent-document-normalization",
      activityOperation: input.operationId,
      claimNumber: input.claim.claimNumber,
      claimReferences,
      claimText: input.claim.claimText,
      claimType: input.claim.claimType,
      digest: input.digest,
      docket: input.docket,
      evidenceFixtureKey,
      family: Str.takeLeft(5)(input.docket),
      sourceFile: input.sourceFile,
    },
    publicId: `${Epistemic.CandidateClaimId.tableName}_${identityKey}`,
  }).pipe(Effect.mapError(patentClaimCandidateError));
  const evidence = yield* decodeEvidence({
    ...spikeEntityInput("EpistemicEvidence", input.entitySeed * 10 + 1),
    artifactFixtureKey: input.digest,
    publicId: `${Epistemic.EvidenceId.tableName}_${identityKey}`,
    span: {
      confidence: 1,
      endChar: Num.sum(startChar, Str.length(evidenceQuote)),
      quote: evidenceQuote,
      startChar,
    },
    spanFixtureKey: evidenceFixtureKey,
  }).pipe(Effect.mapError(patentClaimCandidateError));
  return OfficeActionCandidateExtraction.make({ candidate, evidence });
});
