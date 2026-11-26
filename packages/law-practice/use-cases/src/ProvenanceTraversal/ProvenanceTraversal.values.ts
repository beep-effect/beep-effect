/**
 * Claim provenance values: the request, the provenance a traversal returns and
 * its found-or-missing result.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ClaimId } from "@beep/epistemics/ClaimCore";
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { ActivityRecord } from "@beep/jsonc/ActivityRecord";
import { LawAdmission } from "@beep/law-practice-domain/values/LawClaim";
import { CanonicalHashSet } from "@beep/schema/CanonicalHashSet";
import { CaptureId } from "@beep/text/Capture";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

const $I = $LawPracticeUseCasesId.create("ProvenanceTraversal/ProvenanceTraversal.values");

const byEncodedId = Order.mapInput(Order.String, (record: typeof ActivityRecord.Encoded) => record.id);

const ActivityRecordsById = ActivityRecord.pipe(
  S.toEncoded,
  S.Array,
  S.decodeTo(
    S.HashSet(ActivityRecord),
    SchemaTransformation.transform({
      decode: HashSet.fromIterable,
      encode: (records: HashSet.HashSet<typeof ActivityRecord.Encoded>): ReadonlyArray<typeof ActivityRecord.Encoded> =>
        A.sort(A.fromIterable(records), byEncodedId),
    })
  ),
  $I.annoteSchema("ActivityRecordsById", {
    description: "Activity records encoded as an array sorted by activity id.",
  })
);

/**
 * **Example** (Request a claim's provenance)
 *
 * ```ts
 * import { ClaimId } from "@beep/epistemics/ClaimCore"
 * import { ClaimProvenanceRequest } from "@beep/law-practice-use-cases/ProvenanceTraversal"
 *
 * const request = ClaimProvenanceRequest.make({ claim: ClaimId.make(`sha256:${"0".repeat(64)}`) })
 * console.log(request.claim)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimProvenanceRequest extends S.Opaque<ClaimProvenanceRequest, { readonly brand: unique symbol }>()(
  S.Struct({ claim: ClaimId }).pipe(
    $I.annoteSchema("ClaimProvenanceRequest", { description: "The law claim whose provenance is requested." })
  )
) {}

/**
 * The provenance of one law claim the principal may traverse.
 *
 * **Details**
 *
 * `activities` holds every stored activity record whose captures the
 * principal may traverse, `captures` the captures those records used, and
 * `admissions` the claim's admissions in append order. An activity that used
 * a capture outside the principal's grants is omitted with that capture.
 *
 * **Example** (Name the provenance fields)
 *
 * ```ts
 * import { ClaimProvenance } from "@beep/law-practice-use-cases/ProvenanceTraversal"
 *
 * console.log(Object.keys(ClaimProvenance.fields)) // ["claim", "activities", "captures", "admissions"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimProvenance extends S.Opaque<ClaimProvenance, { readonly brand: unique symbol }>()(
  S.Struct({
    claim: ClaimId,
    activities: ActivityRecordsById,
    captures: CanonicalHashSet(CaptureId),
    admissions: S.Array(LawAdmission),
  }).pipe(
    $I.annoteSchema("ClaimProvenance", {
      description: "A law claim's traversable activity records, the captures they used and its admissions.",
    })
  )
) {}

/**
 * The answer for a claim that is absent or that the principal may not
 * traverse.
 *
 * **Example** (Answer missing)
 *
 * ```ts
 * import { ClaimProvenanceMissing } from "@beep/law-practice-use-cases/ProvenanceTraversal"
 *
 * console.log(ClaimProvenanceMissing.make({})._tag) // "Missing"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimProvenanceMissing = S.TaggedStruct("Missing", {}).pipe(
  $I.annoteSchema("ClaimProvenanceMissing", {
    description: "No provenance: the claim is absent or outside the principal's grants.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type ClaimProvenanceMissing = typeof ClaimProvenanceMissing.Type;

/**
 * **Details**
 *
 * A claim the principal may not traverse answers `Missing`, the value an
 * absent id gets, so the result never reveals that a denied claim exists.
 *
 * **Example** (Match a result)
 *
 * ```ts
 * import { ProvenanceResult } from "@beep/law-practice-use-cases/ProvenanceTraversal"
 *
 * const missing = ProvenanceResult.cases.Missing.make({})
 * console.log(ProvenanceResult.guards.Missing(missing)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProvenanceResult = S.TaggedUnion({
  Found: { provenance: ClaimProvenance },
  Missing: {},
}).pipe(
  $I.annoteSchema("ProvenanceResult", {
    description: "A claim's provenance, or Missing for an absent or untraversable claim.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type ProvenanceResult = typeof ProvenanceResult.Type;
