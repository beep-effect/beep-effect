/**
 * Stable-ID resolution outcomes, separate from semantic citation meanings.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as S from "effect/Schema";
import { CitationAuthorityId, CitationMentionId } from "./Citation.identity.ts";

const $I = $LawPracticeDomainId.create("values/Citation/Citation.resolution");
/**
 * Source-backed reasons for an unresolved occurrence.
 * Mirrors failure branches in pinned eyecite resolve.py; no raw error bag.
 * **Example** (Inspect the closed domain)
 * ```ts
 * import { CitationUnresolvedReason } from "@beep/law-practice-domain/values"
 * console.log(CitationUnresolvedReason.is["invalid-pin-cite"]("invalid-pin-cite")) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const CitationUnresolvedReason = LiteralKit([
  "missing-antecedent",
  "no-matching-authority",
  "no-previous-authority",
  "invalid-pin-cite",
  "unsupported-citation",
]).pipe(
  $I.annoteSchema("CitationUnresolvedReason", {
    description:
      "Finite resolver diagnostics for missing names, absent matches/previous resolution, invalid Id. pincites or unsupported citations.",
  })
);
/**
 * Schema-derived unresolved diagnostic.
 * @category models
 * @since 0.0.0
 */
export type CitationUnresolvedReason = typeof CitationUnresolvedReason.Type;

/**
 * A chosen authority assertion for one mention.
 * **Example** (Inspect the target identity field)
 * ```ts
 * import { CitationResolved } from "@beep/law-practice-domain/values"
 * console.log(CitationResolved.fields.authorityId !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationResolved extends S.Opaque<CitationResolved, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag("Resolved"),
    mentionId: CitationMentionId,
    authorityId: CitationAuthorityId,
    confidence: S.OptionFromNullOr(UnitInterval),
  }).pipe(
    $I.annoteSchema("CitationResolved", {
      description: "One resolved membership edge; bounded confidence is an optional producer assertion, not proof.",
    })
  )
) {}

/**
 * Multiple distinct candidate authorities without a chosen membership.
 * **Example** (Inspect candidate evidence)
 * ```ts
 * import { CitationAmbiguous } from "@beep/law-practice-domain/values"
 * console.log(CitationAmbiguous.fields.candidateAuthorityIds !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationAmbiguous extends S.Opaque<CitationAmbiguous, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag("Ambiguous"),
    mentionId: CitationMentionId,
    candidateAuthorityIds: S.Array(CitationAuthorityId).check(S.isMinLength(2), S.isUnique()),
    confidence: S.OptionFromNullOr(UnitInterval),
  }).pipe(
    $I.annoteSchema("CitationAmbiguous", {
      description:
        "At least two distinct authority candidates; candidate order preserves producer evidence, never a selected result.",
    })
  )
) {}

/**
 * An occurrence retained as data after resolution failed or was unsupported.
 * **Example** (Inspect the diagnostic field)
 * ```ts
 * import { CitationUnresolved } from "@beep/law-practice-domain/values"
 * console.log(CitationUnresolved.fields.reason !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationUnresolved extends S.Opaque<CitationUnresolved, { readonly brand: unique symbol }>()(
  S.Struct({ status: S.tag("Unresolved"), mentionId: CitationMentionId, reason: CitationUnresolvedReason }).pipe(
    $I.annoteSchema("CitationUnresolved", {
      description: "Typed non-resolution outcome with no authority choice, raw cause or array index.",
    })
  )
) {}

/**
 * Closed resolution outcome union over occurrence/authority IDs.
 * The owning CitationDocument validates reference closure and uniqueness.
 * **Example** (Inspect the discriminator)
 * ```ts
 * import { CitationResolution } from "@beep/law-practice-domain/values"
 * console.log(CitationResolution.tag) // "status"
 * ```
 * @category models
 * @since 0.0.0
 */
export const CitationResolution = S.Union([CitationResolved, CitationAmbiguous, CitationUnresolved]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("CitationResolution", {
    description: "Resolved membership, ambiguous candidates or explicit non-resolution; no optional result bag.",
  })
);
/**
 * Schema-derived resolution outcome.
 * @category models
 * @since 0.0.0
 */
export type CitationResolution = typeof CitationResolution.Type;
