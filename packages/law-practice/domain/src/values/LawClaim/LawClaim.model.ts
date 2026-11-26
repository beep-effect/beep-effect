/**
 * The law-owned distinction claim: its proposition, logical key, content id
 * and the claim-core instance built from the epistemics factory.
 *
 * **Details**
 *
 * `@beep/epistemics` exports the claim-core factory and this module owns the
 * law instance (decision `the-law-claim-core-and-distinction-proposition`).
 * Every proposition field is read from the office action's law entities, so
 * the proposition carries no fixture key or entity id and is the same across
 * runs. A claim's scope is the capture's `scopeRef`, byte for byte.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { makeClaimArrows } from "@beep/epistemics/ClaimCore";
import { makeClaimCore, makeClaimRecords } from "@beep/epistemics/ClaimCore.schema";
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { definePreimage } from "@beep/jsonc/Mint";
import { LiteralKit } from "@beep/schema";
import { ContentHash, DomainTag } from "@beep/schema/ContentHash";
import { EntityIdValue } from "@beep/shared-domain/entity/EntityId";
import { SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as S from "effect/Schema";
import { DistinctionDetail } from "../../entities/Distinction/Distinction.values.ts";
import { ClaimNumber, LawPracticeText } from "../../entities/LawPracticeEntity.fields.ts";
import { RejectionStatute } from "../../entities/Rejection/Rejection.values.ts";
import type { PreimageMintError } from "@beep/jsonc/Mint";
import type * as Digest from "effect/crypto/Digest";

const $I = $LawPracticeDomainId.create("values/LawClaim/LawClaim.model");

/**
 * Authority type a law claim distinguishes; one literal per type that has an
 * assessment profile.
 *
 * **Example** (Check the office-action authority)
 *
 * ```ts import.meta.vitest name="Check the office-action authority"
 * import { LawAuthorityType } from "@beep/law-practice-domain/values/LawClaim"
 *
 * LawAuthorityType.is["office-action"]("office-action") // => true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const LawAuthorityType = LiteralKit(["office-action"]).pipe(
  $I.annoteSchema("LawAuthorityType", {
    description: "Authority type a law distinction claim answers, keyed to its assessment profile.",
  })
);

/**
 * @category value-objects
 * @since 0.0.0
 */
export type LawAuthorityType = typeof LawAuthorityType.Type;

/**
 * The proposition a distinction claim asserts: under one authority, a claim
 * of an application is distinguished from one reference on one ground.
 *
 * **Details**
 *
 * `ground` is the statute section alone: the rejection's fixture keys are
 * not proposition content, and the reference is named by its document number.
 *
 * **Example** (Build a proposition)
 *
 * ```ts
 * import { DistinctionProposition } from "@beep/law-practice-domain/values/LawClaim"
 *
 * const proposition = DistinctionProposition.make({
 *   authority: "office-action",
 *   applicationNumber: "16/123,456",
 *   claimNumber: 1,
 *   ground: "102",
 *   referenceDocument: "US 9,876,543 B2",
 *   detail: { kind: "missing_limitation", limitation: "a hinged lid" },
 * })
 *
 * console.log(proposition.ground) // "102"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class DistinctionProposition extends S.Opaque<DistinctionProposition, { readonly brand: unique symbol }>()(
  S.Struct({
    authority: LawAuthorityType,
    applicationNumber: LawPracticeText.annotateKey({ description: "Application number the office action examines." }),
    claimNumber: ClaimNumber,
    ground: RejectionStatute,
    referenceDocument: LawPracticeText.annotateKey({ description: "Document number of the cited reference." }),
    detail: DistinctionDetail,
  }).pipe(
    $I.annoteSchema("DistinctionProposition", {
      description: "A claim of an application distinguished from one cited reference on one statutory ground.",
    })
  )
) {}

/**
 * @category value-objects
 * @since 0.0.0
 */
export declare namespace DistinctionProposition {
  /**
   * The JSON form of a distinction proposition.
   *
   * @category value-objects
   * @since 0.0.0
   */
  export type Encoded = typeof DistinctionProposition.Encoded;
}

const detailParts = DistinctionDetail.match({
  missing_limitation: (detail): ReadonlyArray<string> => [detail.kind, detail.limitation],
});

/**
 * The injective logical key of a distinction proposition: each field in
 * declaration order, length-prefixed.
 *
 * **Example** (Key a proposition)
 *
 * ```ts
 * import { DistinctionProposition, logicalKey } from "@beep/law-practice-domain/values/LawClaim"
 *
 * const key = logicalKey(
 *   DistinctionProposition.make({
 *     authority: "office-action",
 *     applicationNumber: "16/123,456",
 *     claimNumber: 1,
 *     ground: "102",
 *     referenceDocument: "US 9,876,543 B2",
 *     detail: { kind: "missing_limitation", limitation: "a hinged lid" },
 *   })
 * )
 *
 * console.log(key.startsWith("13:office-action")) // true
 * ```
 *
 * @param proposition - The proposition to key.
 * @category utilities
 * @since 0.0.0
 */
export const logicalKey = (proposition: DistinctionProposition): string =>
  pipe(
    [
      proposition.authority,
      proposition.applicationNumber,
      `${proposition.claimNumber}`,
      proposition.ground,
      proposition.referenceDocument,
      ...detailParts(proposition.detail),
    ],
    A.map((part) => `${part.length}:${part}`),
    A.join("")
  );

/**
 * **Example** (Brand a content hash)
 *
 * ```ts
 * import { DistinctionId } from "@beep/law-practice-domain/values/LawClaim"
 * import { ContentHash } from "@beep/schema/ContentHash"
 *
 * const id = DistinctionId.make(ContentHash.make(`sha256:${"0".repeat(64)}`))
 * console.log(id.length) // 71
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const DistinctionId = ContentHash.pipe(
  S.brand("DistinctionId"),
  $I.annoteSchema("DistinctionId", {
    description: "Content hash identifying one distinction proposition, minted from law-distinction/v1.",
  })
);

/**
 * @category value-objects
 * @since 0.0.0
 */
export type DistinctionId = typeof DistinctionId.Type;

/**
 * The `law-distinction/v1` preimage after the domain tag: the encoded
 * distinction proposition.
 *
 * **Details**
 *
 * The committed golden pins the bytes. Changing a proposition field, its
 * encoding or its order bumps the tag to `law-distinction/v2`.
 *
 * **Example** (Read the domain tag)
 *
 * ```ts import.meta.vitest name="Read the distinction domain tag"
 * import { DistinctionPreimage } from "@beep/law-practice-domain/values/LawClaim"
 *
 * DistinctionPreimage.domainTag // => "law-distinction/v1"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const DistinctionPreimage = definePreimage({
  domainTag: DomainTag.make("law-distinction/v1"),
  schema: S.Tuple([DistinctionProposition]),
  golden: {
    preimage: [
      {
        authority: "office-action",
        applicationNumber: "16/123,456",
        claimNumber: 1,
        ground: "102",
        referenceDocument: "US 9,876,543 B2",
        detail: { kind: "missing_limitation", limitation: "a hinged lid" },
      },
    ],
    hash: ContentHash.make("sha256:89f2487d41b0b502b32c607787def489a576f177838b99d99a2cdbd21575a19c"),
  },
});

/**
 * Mint the content id of a distinction proposition.
 *
 * **Example** (Mint a distinction id)
 *
 * ```ts
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 * import { DistinctionProposition, mintDistinctionId } from "@beep/law-practice-domain/values/LawClaim"
 *
 * const proposition = DistinctionProposition.make({
 *   authority: "office-action",
 *   applicationNumber: "16/123,456",
 *   claimNumber: 1,
 *   ground: "102",
 *   referenceDocument: "US 9,876,543 B2",
 *   detail: { kind: "missing_limitation", limitation: "a hinged lid" },
 * })
 *
 * Effect.runPromise(mintDistinctionId(proposition).pipe(Effect.provide(Digest.layerWebCrypto))).then(console.log)
 * ```
 *
 * @param proposition - The proposition to identify.
 * @category constructors
 * @since 0.0.0
 */
export const mintDistinctionId = Effect.fn("LawClaim.mintDistinctionId")(function* (
  proposition: DistinctionProposition
): Effect.fn.Return<DistinctionId, PreimageMintError, Digest.Digest> {
  const hash = yield* DistinctionPreimage.mint([proposition]);
  return DistinctionId.make(hash);
});

/**
 * The scope reference a law claim is bound to: the `SourceTextIdentity`
 * `scopeRef` field schema, so a claim's scope is its capture's scope byte for
 * byte.
 *
 * **Example** (Check a scope reference)
 *
 * ```ts
 * import { ScopeRef } from "@beep/law-practice-domain/values/LawClaim"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ScopeRef)("matter:example")) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const ScopeRef = SourceTextIdentity.fields.scopeRef;

/**
 * Type of {@link ScopeRef}.
 *
 * @category value-objects
 * @since 0.0.0
 */
export type ScopeRef = typeof ScopeRef.Type;

/**
 * **Example** (Brand a revision)
 *
 * ```ts
 * import { LawRevision } from "@beep/law-practice-domain/values/LawClaim"
 *
 * console.log(LawRevision.make("draft-3")) // "draft-3"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const LawRevision = S.NonEmptyString.pipe(
  S.brand("LawRevision"),
  $I.annoteSchema("LawRevision", { description: "The draft or review revision a law admission binds to." })
);

/**
 * @category value-objects
 * @since 0.0.0
 */
export type LawRevision = typeof LawRevision.Type;

/**
 * **Example** (Check the admission action)
 *
 * ```ts import.meta.vitest name="Check the admission action"
 * import { LawAdmissionAction } from "@beep/law-practice-domain/values/LawClaim"
 *
 * LawAdmissionAction.is["admit-distinction"]("admit-distinction") // => true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const LawAdmissionAction = LiteralKit(["admit-distinction"]).pipe(
  $I.annoteSchema("LawAdmissionAction", { description: "The action a law admission token authorizes." })
);

/**
 * @category value-objects
 * @since 0.0.0
 */
export type LawAdmissionAction = typeof LawAdmissionAction.Type;

/**
 * The principal a law claim's challenges, retractions and admissions name:
 * the shared user id, rebuilt from its positive-integer value and brand so
 * the claim-core factory's id bound accepts it.
 *
 * **Details**
 *
 * The decoded type is `Shared.UserId`'s, so a host's user id passes as is.
 *
 * **Example** (Brand a principal)
 *
 * ```ts
 * import { LawPrincipalId } from "@beep/law-practice-domain/values/LawClaim"
 *
 * console.log(LawPrincipalId.make(7)) // 7
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const LawPrincipalId = EntityIdValue.pipe(
  S.brand("SharedUserId"),
  $I.annoteSchema("LawPrincipalId", { description: "The shared user id a law claim names as its principal." })
);

/**
 * @category value-objects
 * @since 0.0.0
 */
export type LawPrincipalId = typeof LawPrincipalId.Type;

const core = makeClaimCore({
  $I,
  proposition: DistinctionProposition,
  ids: {
    logicalKey,
    scope: ScopeRef,
    principal: LawPrincipalId,
    action: LawAdmissionAction,
    revision: LawRevision,
  },
});

/**
 * The creation facts of one law distinction claim; every field participates
 * in its `claim/v1` id.
 *
 * **Example** (Read the core fields)
 *
 * ```ts
 * import { LawClaimCore } from "@beep/law-practice-domain/values/LawClaim"
 *
 * console.log(Object.keys(LawClaimCore.fields).includes("scope")) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class LawClaimCore extends S.Opaque<LawClaimCore, { readonly brand: unique symbol }>()(core.ClaimCore) {}

const records = makeClaimRecords({ $I, core: LawClaimCore });

/**
 * An immutable law claim id and its core.
 *
 * **Example** (Read the record fields)
 *
 * ```ts
 * import { LawClaimRecord } from "@beep/law-practice-domain/values/LawClaim"
 *
 * console.log(Object.keys(LawClaimRecord.fields)) // ["claim", "core"]
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class LawClaimRecord extends S.Opaque<LawClaimRecord, { readonly brand: unique symbol }>()(
  records.ClaimRecord
) {}

/**
 * A proposed law claim without admission authority: it has no admitted case
 * and no admission field.
 *
 * **Example** (Read the proposed stance)
 *
 * ```ts
 * import { LawProposedClaimRecord } from "@beep/law-practice-domain/values/LawClaim"
 *
 * console.log(Object.keys(LawProposedClaimRecord.fields)) // ["claim", "core", "stance"]
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class LawProposedClaimRecord extends S.Opaque<LawProposedClaimRecord, { readonly brand: unique symbol }>()(
  records.ProposedClaimRecord
) {}

/**
 * The agent a law claim names as its asserter.
 *
 * **Example** (List the agent kinds)
 *
 * ```ts
 * import { LawClaimAgent } from "@beep/law-practice-domain/values/LawClaim"
 *
 * console.log(Object.keys(LawClaimAgent.cases)) // ["Person", "Organization", "SoftwareAgent"]
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const LawClaimAgent = core.AgentRef;

/**
 * Type of {@link LawClaimAgent}.
 *
 * @category value-objects
 * @since 0.0.0
 */
export type LawClaimAgent = typeof LawClaimAgent.Type;

/**
 * A writable non-authoritative stance on a law claim: verbatim or proposed.
 *
 * **Example** (List the stance kinds)
 *
 * ```ts
 * import { LawStanceRecord } from "@beep/law-practice-domain/values/LawClaim"
 *
 * console.log(Object.keys(LawStanceRecord.cases)) // ["Verbatim", "Proposed"]
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const LawStanceRecord = core.StanceRecord;

/**
 * Type of {@link LawStanceRecord}.
 *
 * @category value-objects
 * @since 0.0.0
 */
export type LawStanceRecord = typeof LawStanceRecord.Type;

/**
 * A challenge from one law claim to another, by a person or an activity.
 *
 * **Example** (List the challenger kinds)
 *
 * ```ts
 * import { LawChallenge } from "@beep/law-practice-domain/values/LawClaim"
 *
 * console.log(Object.keys(LawChallenge.cases)) // ["ByPerson", "ByActivity"]
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const LawChallenge = core.Challenge;

/**
 * Type of {@link LawChallenge}.
 *
 * @category value-objects
 * @since 0.0.0
 */
export type LawChallenge = typeof LawChallenge.Type;

/**
 * An explicit retraction of a law claim by a person.
 *
 * **Example** (Read the retraction fields)
 *
 * ```ts
 * import { LawRetraction } from "@beep/law-practice-domain/values/LawClaim"
 *
 * console.log(Object.keys(LawRetraction.fields)) // ["claim", "actor", "reason", "at"]
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class LawRetraction extends S.Opaque<LawRetraction, { readonly brand: unique symbol }>()(core.Retraction) {}

/**
 * A serialized attorney attestation bound to an actor, scope, action and
 * revision; verification is a separate port.
 *
 * **Example** (Read what a token binds)
 *
 * ```ts
 * import { LawHumanAdmissionToken } from "@beep/law-practice-domain/values/LawClaim"
 *
 * console.log(Object.keys(LawHumanAdmissionToken.fields).slice(0, 4)) // ["actor", "scope", "action", "revision"]
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class LawHumanAdmissionToken extends S.Opaque<LawHumanAdmissionToken, { readonly brand: unique symbol }>()(
  core.HumanAdmissionToken
) {}

/**
 * A scoped admission of a law claim, bound to its token.
 *
 * **Example** (Read the admission binding)
 *
 * ```ts
 * import { LawAdmission } from "@beep/law-practice-domain/values/LawClaim"
 *
 * console.log("token" in LawAdmission.fields) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class LawAdmission extends S.Opaque<LawAdmission, { readonly brand: unique symbol }>()(core.Admission) {}

/**
 * The checked claim arrows bound to {@link LawClaimCore}: `claim/v1` minting
 * and checked record decoding.
 *
 * **Example** (Read the minting arrow)
 *
 * ```ts
 * import { LawClaimArrows } from "@beep/law-practice-domain/values/LawClaim"
 *
 * console.log(typeof LawClaimArrows.mint) // "function"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const LawClaimArrows = makeClaimArrows({ $I, ClaimCore: LawClaimCore });
