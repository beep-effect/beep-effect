/**
 * Party identity resolution read models.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PartyDomainId } from "@beep/identity/packages";
import { PartyId } from "@beep/shared-domain/identity/Party";
import * as S from "effect/Schema";
import { ClaimVersionId } from "../../Ids.ts";
import { PartyKey } from "../../PartyKey.ts";

const $I = $PartyDomainId.create("values/Resolution/Resolution.model");

/**
 * The two time coordinates used for a resolution query.
 * **Example** (Decode a historical scope)
 * ```ts
 * import { ResolutionScope } from "@beep/party-domain/Resolution"
 * import * as S from "effect/Schema"
 * S.decodeUnknownEffect(ResolutionScope)({ asOf: 100, validAt: 50 })
 * ```
 * @category models
 * @since 0.0.0
 */
export class ResolutionScope extends S.Opaque<ResolutionScope, { readonly brand: unique symbol }>()(
  S.Struct({ asOf: S.DateTimeUtcFromMillis, validAt: S.DateTimeUtcFromMillis }).pipe(
    $I.annoteSchema("ResolutionScope", { description: "Knowledge and valid time for an identity view." })
  )
) {}

/**
 * A merge blocked by active cannot-link assertions in this exact query scope.
 * **Example** (Validate a contradiction case)
 * ```ts
 * import { ConflictingReview } from "@beep/party-domain/Resolution"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ConflictingReview)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ConflictingReview extends S.Opaque<ConflictingReview, { readonly brand: unique symbol }>()(
  S.TaggedStruct("conflicting-review", {
    blockedClaim: ClaimVersionId,
    vetoClaims: S.NonEmptyArray(ClaimVersionId),
    left: PartyId,
    right: PartyId,
    scope: ResolutionScope,
  }).pipe($I.annoteSchema("ConflictingReview", { description: "Retained merge and veto assertions requiring review." }))
) {}

/**
 * One original party and its current surviving identity.
 * **Example** (Keep an unmerged identity)
 * ```ts
 * import { PartyRepresentative } from "@beep/party-domain/Resolution"
 * import { PartyId } from "@beep/shared-domain/identity/Party"
 * PartyRepresentative.make({ party: PartyId.make(1), survivor: PartyId.make(1) })
 * ```
 * @category models
 * @since 0.0.0
 */
export class PartyRepresentative extends S.Opaque<PartyRepresentative, { readonly brand: unique symbol }>()(
  S.Struct({ party: PartyId, survivor: PartyId }).pipe(
    $I.annoteSchema("PartyRepresentative", { description: "Read-time redirect; the original id is never rewritten." })
  )
) {}

/**
 * An evidence key's surviving party in the queried view.
 * **Example** (Decode a key redirect)
 * ```ts
 * import { KeyRepresentative } from "@beep/party-domain/Resolution"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(KeyRepresentative)
 * ```
 * @category models
 * @since 0.0.0
 */
export class KeyRepresentative extends S.Opaque<KeyRepresentative, { readonly brand: unique symbol }>()(
  S.Struct({ key: PartyKey, party: PartyId, survivor: PartyId }).pipe(
    $I.annoteSchema("KeyRepresentative", { description: "Key assignment resolved through the current component." })
  )
) {}

/**
 * Deterministic components, key redirects and active contradictions.
 * **Example** (Decode a resolution result)
 * ```ts
 * import { ResolutionView } from "@beep/party-domain/Resolution"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ResolutionView)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ResolutionView extends S.Opaque<ResolutionView, { readonly brand: unique symbol }>()(
  S.Struct({
    scope: ResolutionScope,
    representatives: S.Array(PartyRepresentative),
    keys: S.Array(KeyRepresentative),
    reviewCases: S.Array(ConflictingReview),
  }).pipe($I.annoteSchema("ResolutionView", { description: "Pure, replayable party identity projection." }))
) {}
