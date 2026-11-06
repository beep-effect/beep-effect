/**
 * The claim self-check service: decompose claims into element trees, check
 * antecedent basis, and map findings into epistemic candidates.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import {
  AntecedentFinding,
  antecedentPolicy,
  claimNumberOfPath,
  decomposeClaim,
} from "@beep/law-practice-domain/values/ClaimElement";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Str from "effect/String";
import {
  claimEvidenceFrom,
  decodeEvidencedCandidate,
  EvidencedCandidateInput,
  termEvidenceFrom,
} from "../internal/claimEvidence.ts";
import { PosInt } from "../internal/PosInt.ts";
import { ClaimSelfCheckError } from "./ClaimSelfCheck.errors.ts";
import { UsptoClaims } from "./ClaimSelfCheck.ports.ts";
import {
  ClaimFindingCandidate,
  ClaimSelfCheckCandidates,
  ClaimSelfCheckReport,
  PublishedClaimSelfCheckReport,
} from "./ClaimSelfCheck.schemas.ts";
import type { AntecedentDependencyChain } from "@beep/law-practice-domain/values/ClaimElement";
import type { PatentApplicationSection, PatentClaims } from "@beep/law-practice-domain/values/PatentDocument";
import type { UsptoClaimsShape } from "./ClaimSelfCheck.ports.ts";
import type { ClaimSelfCheckInput, UsptoClaimSource } from "./ClaimSelfCheck.schemas.ts";

const $I = $LawPracticeUseCasesId.create("ClaimSelfCheck/ClaimSelfCheck.service");

/**
 * Service shape of the claim self-check.
 *
 * **Details**
 *
 * Every method runs the domain `ClaimElementDecomposer` over each claim and
 * then the domain `AntecedentPolicy` over the resulting trees. A claim that
 * fails to decompose is reported in the report's `undecomposed` list and does
 * not discard its siblings' findings; only a set where no claim decomposes
 * fails with `decomposition-failed`. Findings are advisory results, never
 * failures, and nothing here blocks a draft or a pipeline.
 *
 * **Example** (List the claims a candidate run could not cover)
 *
 * ```ts
 * import type { ClaimSelfCheckInput, ClaimSelfCheckShape } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 * import * as A from "effect/Array"
 * import * as Effect from "effect/Effect"
 *
 * // No candidates is a clean result only when this list is empty too.
 * const uncheckedClaims = (selfCheck: ClaimSelfCheckShape, input: ClaimSelfCheckInput) =>
 *   Effect.map(selfCheck.candidates(input), ({ undecomposed }) => A.map(undecomposed, ({ claimNumber }) => claimNumber))
 * console.log(typeof uncheckedClaims) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface ClaimSelfCheckShape {
  /**
   * Map each finding over a normalized document into a `candidate`-lifecycle `CandidateClaim`
   * and its referring-term `Evidence`, the way `PatentClaimCandidate` maps whole claims.
   * Claims that did not decompose come back in `undecomposed`, so an unchecked claim never reads as clean.
   */
  readonly candidates: (input: ClaimSelfCheckInput) => Effect.Effect<ClaimSelfCheckCandidates, ClaimSelfCheckError>;
  /** Decompose every claim of the set, then check antecedent basis over the trees. */
  readonly check: (claims: PatentClaims) => Effect.Effect<ClaimSelfCheckReport, ClaimSelfCheckError>;
  /**
   * Fetch a public USPTO claim set through the `UsptoClaims` port, then check it.
   * The result keeps the claim set, so its source document travels with the report as provenance.
   */
  readonly checkPublished: (
    source: UsptoClaimSource
  ) => Effect.Effect<PublishedClaimSelfCheckReport, ClaimSelfCheckError>;
}

/**
 * The claim self-check: advisory 35 U.S.C. 112(b) antecedent-basis findings
 * over a document's claims.
 *
 * **Details**
 *
 * Its layer depends on the `UsptoClaims` port for `checkPublished`; `check`
 * and `candidates` use only the pure domain decomposer and policy. Domain
 * decomposition failures and port failures are translated into
 * `ClaimSelfCheckError`.
 *
 * **Example** (Reference the service)
 *
 * ```ts
 * import { ClaimSelfCheck } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 *
 * console.log(ClaimSelfCheck.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ClaimSelfCheck extends Context.Service<ClaimSelfCheck, ClaimSelfCheckShape>()($I`ClaimSelfCheck`) {}

const check = Effect.fn("ClaimSelfCheck.check")(function* (
  claims: PatentClaims
): Effect.fn.Return<ClaimSelfCheckReport, ClaimSelfCheckError> {
  const forEach1 = yield* Effect.forEach(claims, (claim) => Effect.result(decomposeClaim(claim, claims)));
  const [trees, undecomposed] = A.separate(forEach1);
  return yield* A.match(trees, {
    onEmpty: () =>
      Effect.fail(
        ClaimSelfCheckError.make({
          ...O.getSomesStruct({ cause: A.head(undecomposed) }),
          message: `None of the ${A.length(claims)} claims could be decomposed into a claim-element tree.`,
          reason: "decomposition-failed",
        })
      ),
    onNonEmpty: (decomposed) =>
      Effect.succeed(
        ClaimSelfCheckReport.make({
          trees: decomposed,
          undecomposed,
          findings: antecedentPolicy(decomposed, claims),
        })
      ),
  });
});

const claimsSectionOf = (input: ClaimSelfCheckInput): Effect.Effect<PatentApplicationSection, ClaimSelfCheckError> =>
  Effect.fromOption(
    A.findFirst(input.document.sections, ({ role }) => role === "claims"),
    () =>
      ClaimSelfCheckError.make({
        message: "The patent document has no claims section to align findings to.",
        reason: "candidate-mapping-failed",
      })
  );

const chainOf = (finding: AntecedentFinding): O.Option<AntecedentDependencyChain> =>
  AntecedentFinding.guards["pattern-not-covered"](finding) ? O.none() : O.some(finding.chain);

// Unique per finding: claim, referring span start, rule and, when the finding has one, its chain.
const findingKeyOf = (finding: AntecedentFinding, claimNumber: number): string =>
  `c${claimNumber}s${finding.referring.anchor.startChar}r${Str.replace(/-/gu, "")(finding.rule)}${pipe(
    chainOf(finding),
    O.map(
      (chain) =>
        `h${A.join(
          A.map(chain, (claim) => `${claim}`),
          "h"
        )}`
    ),
    O.getOrElse(() => "")
  )}`;

const findingCandidate = Effect.fn("ClaimSelfCheck.findingCandidate")(function* (
  input: ClaimSelfCheckInput,
  claimsSection: PatentApplicationSection,
  finding: AntecedentFinding,
  index: number
): Effect.fn.Return<ClaimFindingCandidate, ClaimSelfCheckError> {
  const claimNumber = claimNumberOfPath(finding.referring.path);
  const { startChar: termStart, quote: termQuote } = finding.referring.anchor;
  const [startChar, quote] = yield* Effect.fromOption(
    pipe(
      A.findFirst(input.document.claims, (claim) => claim.claimNumber === claimNumber),
      O.flatMap((claim) =>
        pipe(
          claimEvidenceFrom(claim, input.document.sourceText, claimsSection.sourceStart, claimsSection.sourceEnd),
          O.flatMap(termEvidenceFrom(claim.claimText, termStart, termQuote))
        )
      )
    ),
    () =>
      ClaimSelfCheckError.make({
        claimNumber,
        message: `The referring term "${termQuote}" of claim ${claimNumber} does not align to the document source text.`,
        reason: "candidate-mapping-failed",
      })
  );
  const findingKey = findingKeyOf(finding, claimNumber);
  const evidenceFixtureKey = `evidence:${input.identityDigest}:${findingKey}`;
  const [candidate, evidence] = yield* decodeEvidencedCandidate(
    EvidencedCandidateInput.make({
      artifactFixtureKey: input.digest,
      entitySeed: PosInt.make(input.entitySeed + index),
      evidenceFixtureKey,
      fixtureKey: `antecedent:${input.identityDigest}:${findingKey}`,
      identityKey: `p${Str.slice(7)(input.identityDigest)}${findingKey}`,
      quote,
      snapshot: {
        activityKind: "claim-self-check",
        activityOperation: input.operationId,
        chain: O.getOrNull(chainOf(finding)),
        claimNumber,
        digest: input.digest,
        docket: input.docket,
        evidenceFixtureKey,
        family: Str.takeLeft(5)(input.docket),
        findingKind: finding.kind,
        referringQuote: termQuote,
        rule: finding.rule,
        sourceDocumentDigest: input.sourceDocumentDigest ?? null,
        sourceFile: input.sourceFile,
      },
      startChar,
    })
  ).pipe(
    Effect.mapError((cause) =>
      ClaimSelfCheckError.make({
        cause,
        claimNumber,
        message: `The finding on "${termQuote}" in claim ${claimNumber} was rejected by the epistemic entity schemas.`,
        reason: "candidate-mapping-failed",
      })
    )
  );
  return ClaimFindingCandidate.make({ finding, candidate, evidence });
});

const makeClaimSelfCheck = (uspto: UsptoClaimsShape): ClaimSelfCheckShape => ({
  check,
  checkPublished: Effect.fn("ClaimSelfCheck.checkPublished")(function* (
    source: UsptoClaimSource
  ): Effect.fn.Return<PublishedClaimSelfCheckReport, ClaimSelfCheckError> {
    const claimSet = yield* uspto.claims(source).pipe(
      Effect.mapError((cause) =>
        ClaimSelfCheckError.make({
          cause,
          message: `Public USPTO claims are unavailable (${cause.reason}): ${cause.message}`,
          reason: "public-claims-unavailable",
        })
      )
    );
    return PublishedClaimSelfCheckReport.make({ claimSet, report: yield* check(claimSet.claims) });
  }),
  candidates: Effect.fn("ClaimSelfCheck.candidates")(function* (
    input: ClaimSelfCheckInput
  ): Effect.fn.Return<ClaimSelfCheckCandidates, ClaimSelfCheckError> {
    const report = yield* check(input.document.claims);
    const claimsSection = yield* claimsSectionOf(input);
    const candidates = yield* Effect.forEach(report.findings, (finding, index) =>
      findingCandidate(input, claimsSection, finding, index)
    );
    return ClaimSelfCheckCandidates.make({ candidates, undecomposed: report.undecomposed });
  }),
});

/**
 * Layer of the claim self-check over the `UsptoClaims` port.
 *
 * **Details**
 *
 * - `check` decomposes each claim on its own; failures land in `undecomposed`
 *   in claim order and the other claims keep their trees and findings. Only a
 *   set where no claim decomposes fails, with `decomposition-failed` and the
 *   first decomposition failure as `cause`.
 * - `checkPublished` translates every port failure into
 *   `public-claims-unavailable`.
 * - `candidates` maps each finding, in report order, to a `candidate`
 *   claim and the evidence span of its referring term in the document's source
 *   text, and passes the report's `undecomposed` list through unchanged. A
 *   finding that cannot be aligned fails with `candidate-mapping-failed`
 *   rather than being skipped. Spike entity seeds are `entitySeed + index`, so
 *   the mapping is deterministic.
 *
 * **Example** (Provide the self-check over an in-memory port)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import { ClaimSelfCheckLive, UsptoClaims, UsptoClaimsError } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 *
 * const port = Layer.succeed(UsptoClaims, {
 *   claims: () => Effect.fail(UsptoClaimsError.make({ message: "No fixture.", reason: "not-found" }))
 * })
 * const layer = ClaimSelfCheckLive.pipe(Layer.provide(port))
 * console.log(Layer.isLayer(layer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ClaimSelfCheckLive: Layer.Layer<ClaimSelfCheck, never, UsptoClaims> = Layer.effect(
  ClaimSelfCheck,
  Effect.map(UsptoClaims, makeClaimSelfCheck)
);
