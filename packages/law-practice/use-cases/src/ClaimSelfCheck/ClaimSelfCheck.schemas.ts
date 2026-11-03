/**
 * Schema models of the claim self-check: public claim sources, check reports
 * and finding candidates.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { CandidateClaim, Evidence } from "@beep/epistemic-domain";
import { ContentDigest, OperationId } from "@beep/file-processing/Artifact";
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { UsptoNormalizedApplicationNumber } from "@beep/law-practice-domain/values/CitingApplicationIdentity";
import {
  AntecedentFinding,
  ClaimDecompositionError,
  ClaimElementTree,
  ClaimInputCollection,
} from "@beep/law-practice-domain/values/ClaimElement";
import { PatentApplicationDocument, PatentClaims } from "@beep/law-practice-domain/values/PatentDocument";
import { PatentNumber } from "@beep/law-practice-domain/values/PatentNumber";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PosInt } from "../internal/PosInt.ts";

const $I = $LawPracticeUseCasesId.create("ClaimSelfCheck/ClaimSelfCheck.schemas");

const UsptoClaimSourceKind = LiteralKit(["application", "publication"]).pipe(
  $I.annoteSchema("UsptoClaimSourceKind", {
    description: "USPTO application file wrapper or published patent document.",
  })
);

/**
 * Public USPTO record a claim set is fetched from, discriminated by `kind`.
 *
 * **Details**
 *
 * - `application`: an application's file wrapper. Without `documentIdentifier`
 *   the adapter reads the latest full-text claims; with it, the claims of that
 *   one file-wrapper document, such as the claim set in force when a rejection
 *   was mailed.
 * - `publication`: a published application or granted patent, by its
 *   digits-only publication number.
 *
 * **Example** (Name an application's claims)
 *
 * ```ts
 * import { UsptoNormalizedApplicationNumber } from "@beep/law-practice-domain/values/CitingApplicationIdentity"
 * import { UsptoClaimSource } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 *
 * const source = UsptoClaimSource.cases.application.make({
 *   applicationNumber: UsptoNormalizedApplicationNumber.make("16138242")
 * })
 * console.log(source.kind) // "application"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const UsptoClaimSource = UsptoClaimSourceKind.toTaggedUnion("kind")({
  application: {
    applicationNumber: UsptoNormalizedApplicationNumber.annotateKey({
      description: "Eight-digit USPTO application number whose file wrapper holds the claims.",
    }),
    documentIdentifier: S.optionalKey(S.NonEmptyString).annotateKey({
      description: "File-wrapper document whose claims are wanted; the latest full-text claims when absent.",
    }),
  },
  publication: {
    publicationNumber: PatentNumber.annotateKey({
      description: "Digits-only publication number of the published application or granted patent.",
    }),
  },
}).pipe(
  $I.annoteSchema("UsptoClaimSource", {
    description: "USPTO application file wrapper or published document a public claim set is fetched from.",
  })
);

/**
 * Runtime source type produced by {@link UsptoClaimSource}.
 *
 * @category models
 * @since 0.0.0
 */
export type UsptoClaimSource = typeof UsptoClaimSource.Type;

/**
 * Public USPTO claim set normalized into validated patent claims.
 *
 * **Details**
 *
 * Only full-text claims are returned. The adapter reads structured XML,
 * following `<claim-text>` nesting where present, and never repairs OCR-only
 * claim text; a record with no full-text claims fails the port instead.
 *
 * **Example** (Wrap one published claim)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument"
 * import { PatentNumber } from "@beep/law-practice-domain/values/PatentNumber"
 * import { UsptoClaimSet, UsptoClaimSource } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 *
 * const claimSet = UsptoClaimSet.make({
 *   claims: [
 *     PatentClaim.cases.independent.make({
 *       body: "a sensor",
 *       claimNumber: PosInt.make(1),
 *       claimText: "A system comprising a sensor.",
 *       preamble: "A system",
 *       transition: "comprising"
 *     })
 *   ],
 *   documentIdentifier: "EXAMPLE-DOC-1",
 *   source: UsptoClaimSource.cases.publication.make({ publicationNumber: PatentNumber.make("10123456") })
 * })
 * console.log(claimSet.claims.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UsptoClaimSet extends S.Opaque<UsptoClaimSet, { readonly brand: unique symbol }>()(
  S.Struct({
    claims: PatentClaims.annotateKey({
      description: "Validated, consecutively numbered claims read from the record's full text.",
    }),
    documentIdentifier: S.NonEmptyString.annotateKey({
      description: "USPTO document the claims were read from, kept as fixture provenance.",
    }),
    source: UsptoClaimSource.annotateKey({
      description: "Record the claim set was requested from.",
    }),
  }).pipe(
    $I.annoteSchema("UsptoClaimSet", {
      description: "Full-text public USPTO claims normalized into validated patent claims, with their source document.",
    })
  )
) {}

/**
 * Complete source records from one immutable public document version.
 *
 * **Details**
 * This acquisition result retains all failed extraction records. It does not
 * imply any claim normalized or received a check. Its record identity binds
 * the exact document identifier and byte digest, including all-unusable input.
 *
 * **Example** (Inspect acquired source fields)
 *
 * ```ts
 * import { UsptoClaimInputSet } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 * console.log(UsptoClaimInputSet.fields.documentIdentifier !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UsptoClaimInputSet extends S.Opaque<UsptoClaimInputSet, { readonly brand: unique symbol }>()(
  S.Struct({
    // Keep the nominal collection schema itself: annotateKey rebuilds an Opaque as its structural base.
    input: ClaimInputCollection,
    documentIdentifier: S.NonEmptyString.annotateKey({
      description: "Exact public USPTO document whose bytes were inspected.",
    }),
    sourceDocumentDigest: ContentDigest.annotateKey({
      description: "SHA-256 of the acquired document bytes, before text extraction.",
    }),
    source: UsptoClaimSource.annotateKey({ description: "Public record requested for this acquisition." }),
  })
    .check(
      S.makeFilter(
        ({ input, documentIdentifier, sourceDocumentDigest }) =>
          Str.Equivalence(input.sourceKey, `${documentIdentifier}:${sourceDocumentDigest}`),
        $I.annote("UsptoClaimInputSetIdentityCheck", {
          title: "Document-version source identity",
          description: "Every source record is scoped to the acquired document identifier and exact byte digest.",
          message: "The input source key must be documentIdentifier:sourceDocumentDigest.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("UsptoClaimInputSet", {
        description:
          "Failure-preserving public source acquisition with content-bound document/version identity; no check success implied.",
      })
    )
) {}

/**
 * Result of running the decomposer and then the antecedent policy over one claim set.
 *
 * **Details**
 *
 * Decomposition is per claim, not all-or-nothing. A claim the decomposer
 * cannot decompose is listed in `undecomposed` with its typed failure, and
 * every other claim still gets a tree and its findings. A referring term whose
 * dependency chain passes through an undecomposed claim is reported by the
 * policy as `pattern-not-covered`, so nothing passes silently. The check fails
 * with `decomposition-failed` only when no claim decomposes, which is why
 * `trees` is non-empty.
 *
 * **Example** (List the report fields)
 *
 * ```ts
 * import { ClaimSelfCheckReport } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 *
 * const fields = Object.keys(ClaimSelfCheckReport.fields)
 * console.log(fields) // ["trees", "undecomposed", "findings"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimSelfCheckReport extends S.Opaque<ClaimSelfCheckReport, { readonly brand: unique symbol }>()(
  S.Struct({
    trees: S.NonEmptyArray(ClaimElementTree).annotateKey({
      description: "One claim-element tree per decomposed claim, in claim order.",
    }),
    undecomposed: S.Array(ClaimDecompositionError).annotateKey({
      description:
        "Typed decomposition failure of each claim that has no tree, in claim order; empty when all decomposed.",
    }),
    findings: S.Array(AntecedentFinding).annotateKey({
      description: "Advisory antecedent findings over the trees; empty when no rule fired.",
    }),
  }).pipe(
    $I.annoteSchema("ClaimSelfCheckReport", {
      description:
        "Claim-element trees, per-claim decomposition failures, and the advisory antecedent findings over the trees.",
    })
  )
) {}

/**
 * Self-check report over a public USPTO claim set, with the claim set it was run on.
 *
 * **Details**
 *
 * The claim set carries the USPTO `documentIdentifier` and the requested
 * source, so a labelled fixture or an eval row built from this result
 * records which public document and which claim text in force it came from.
 *
 * **Example** (List the published report fields)
 *
 * ```ts
 * import { PublishedClaimSelfCheckReport } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 *
 * console.log(Object.keys(PublishedClaimSelfCheckReport.fields)) // ["claimSet", "report"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PublishedClaimSelfCheckReport extends S.Opaque<
  PublishedClaimSelfCheckReport,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    claimSet: UsptoClaimSet.annotateKey({
      description: "Public claim set the check ran on, with its USPTO source document as provenance.",
    }),
    report: ClaimSelfCheckReport.annotateKey({
      description: "Self-check report over the claim set's claims.",
    }),
  }).pipe(
    $I.annoteSchema("PublishedClaimSelfCheckReport", {
      description: "Claim self-check report paired with the public USPTO claim set and source document it was run on.",
    })
  )
) {}

/**
 * Normalized patent document plus the provenance needed to persist its findings as candidates.
 *
 * **Details**
 *
 * The provenance fields mirror `PatentClaimCandidateInput`, so a finding's
 * candidate and evidence carry the same docket, digests and operation as the
 * whole-claim candidates of the same document. Claim text and the claims
 * section bounds come from the document itself.
 *
 * **Example** (List the input fields)
 *
 * ```ts
 * import { ClaimSelfCheckInput } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 *
 * console.log(Object.keys(ClaimSelfCheckInput.fields).includes("document")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimSelfCheckInput extends S.Opaque<ClaimSelfCheckInput, { readonly brand: unique symbol }>()(
  S.Struct({
    digest: ContentDigest.annotateKey({
      description: "Content digest of the normalized patent document.",
    }),
    docket: S.NonEmptyString.annotateKey({
      description: "Matter docket associated with the patent document.",
    }),
    document: PatentApplicationDocument.annotateKey({
      description: "Normalized patent application whose claims are checked.",
    }),
    entitySeed: PosInt.annotateKey({
      description: "Bounded deterministic seed used by the current spike entity envelope.",
    }),
    identityDigest: ContentDigest.annotateKey({
      description: "Docket-scoped document digest used for collision-resistant persisted public identifiers.",
    }),
    operationId: OperationId.annotateKey({
      description: "Self-check activity identifier retained in each candidate snapshot.",
    }),
    sourceDocumentDigest: S.optionalKey(ContentDigest).annotateKey({
      description: "Catalogued corpus document digest the source file resolved to, when known.",
    }),
    sourceFile: S.NonEmptyString.annotateKey({
      description: "Traceable source filename presented by the caller.",
    }),
  }).pipe(
    $I.annoteSchema("ClaimSelfCheckInput", {
      description:
        "Normalized patent document and provenance for mapping antecedent findings into epistemic candidates.",
    })
  )
) {}

/**
 * One antecedent finding with the epistemic candidate and evidence it maps to.
 *
 * **Details**
 *
 * The candidate is in `candidate` lifecycle and the evidence span is the
 * finding's referring term, located in the document's source text. An
 * attorney's verdict later sets the candidate's disposition: confirmed to
 * `active`, dismissed to `rejected` with the note as reason.
 *
 * **Example** (List the candidate fields)
 *
 * ```ts
 * import { ClaimFindingCandidate } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 *
 * console.log(Object.keys(ClaimFindingCandidate.fields)) // ["finding", "candidate", "evidence"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimFindingCandidate extends S.Opaque<ClaimFindingCandidate, { readonly brand: unique symbol }>()(
  S.Struct({
    finding: AntecedentFinding.annotateKey({
      description: "Advisory antecedent finding the candidate was mapped from.",
    }),
    candidate: CandidateClaim.annotateKey({
      description: "Epistemic candidate claim asserting the finding.",
    }),
    evidence: Evidence.annotateKey({
      description: "Evidence span over the referring term in the document's source text.",
    }),
  }).pipe(
    $I.annoteSchema("ClaimFindingCandidate", {
      description: "Antecedent finding paired with the epistemic candidate claim and evidence it maps to.",
    })
  )
) {}

/**
 * Finding candidates of one document, with every claim the check could not cover.
 *
 * **Details**
 *
 * A claim listed in `undecomposed` has no claim-element tree, so the
 * antecedent policy never ran over it. An empty `candidates` list therefore
 * means a clean document only when `undecomposed` is empty too. A dependent
 * whose chain passes through an undecomposed claim still gets its
 * `pattern-not-covered` candidate.
 *
 * **Example** (Tell a clean document from an unchecked one)
 *
 * ```ts
 * import { ClaimDecompositionError } from "@beep/law-practice-domain/values/ClaimElement"
 * import { ClaimSelfCheckCandidates } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 * import * as A from "effect/Array"
 *
 * const result = ClaimSelfCheckCandidates.make({
 *   candidates: [],
 *   undecomposed: [
 *     ClaimDecompositionError.make({
 *       claimNumber: 1,
 *       message: "The claim body does not occur in the claim text.",
 *       reason: "unsupported-claim-text"
 *     })
 *   ]
 * })
 * const clean = A.isReadonlyArrayEmpty(result.candidates) && A.isReadonlyArrayEmpty(result.undecomposed)
 * console.log(clean) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimSelfCheckCandidates extends S.Opaque<ClaimSelfCheckCandidates, { readonly brand: unique symbol }>()(
  S.Struct({
    candidates: S.Array(ClaimFindingCandidate).annotateKey({
      description: "One candidate per antecedent finding, in report order; empty when no rule fired.",
    }),
    undecomposed: S.Array(ClaimDecompositionError).annotateKey({
      description:
        "Typed decomposition failure of each claim the check could not cover, in claim order; empty when all decomposed.",
    }),
  }).pipe(
    $I.annoteSchema("ClaimSelfCheckCandidates", {
      description: "Finding candidates of one document, with the decomposition failure of every claim left unchecked.",
    })
  )
) {}
