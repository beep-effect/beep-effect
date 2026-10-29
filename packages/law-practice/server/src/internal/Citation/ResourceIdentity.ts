/**
 * Trusted resource identity descriptors, separate from callback truthiness.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationAuthorityId,
  CitationMemberList,
  CitationMentionId,
  CitationResourceGroupId,
} from "@beep/law-practice-domain/values";
import { CitationEngineAbsoluteMaxima } from "@beep/law-practice-use-cases/server";
import { LiteralKit, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CitationAuthorityIdentityInput, makeCitationAuthorityId } from "./AuthorityIdentity.ts";
import type * as Crypto from "effect/Crypto";

const $I = $LawPracticeServerId.create("internal/Citation/ResourceIdentity");
const encoder = new TextEncoder();

/**
 * Adapter-owned identity evidence. Canonical fallback uses the existing key
 * producer. External scope/key fingerprints are supplied by a trusted adapter;
 * they do not certify arbitrary host-object equality by themselves. Equal
 * resources must share the same descriptor regardless of their representation.
 * Truthiness and the first returned resource value belong to resolver state.
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CitationResourceIdentity = S.TaggedUnion({
  Canonical: { authority: CitationAuthorityIdentityInput },
  External: { scope: Sha256Hex, key: Sha256Hex },
}).pipe(
  $I.annoteSchema("CitationResourceIdentity", {
    description:
      "Trusted canonical fallback or adapter-scoped external equality fingerprint; never taken from a document receipt.",
  })
);
/**
 * Schema-derived trusted resource identity.
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CitationResourceIdentity = typeof CitationResourceIdentity.Type;

/**
 * Expected decisions and ordered insertion entries supplied out of band by the trusted resource
 * adapter. Binding every decision permits a callback to merge full citations
 * with different default keys without letting a receipt invent an override.
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CitationResourceBinding extends S.Opaque<CitationResourceBinding, { readonly brand: unique symbol }>()(
  S.Struct({
    identity: CitationResourceIdentity,
    groups: S.Array(S.Struct({ position: S.Natural, id: CitationResourceGroupId, list: CitationMemberList })).check(
      S.isMaxLength(CitationEngineAbsoluteMaxima.authorities)
    ),
    decisions: S.Array(CitationMentionId).check(
      S.isMaxLength(CitationEngineAbsoluteMaxima.mentions),
      S.makeFilter(
        (members) => A.length(A.dedupe(members)) === A.length(members),
        $I.annote("UniqueBindingMembers", {
          title: "Unique Binding Members",
          description: "Each resource binding names a document occurrence at most once.",
          message: "Duplicate resource binding member.",
        })
      )
    ),
  }).pipe(
    $I.annoteSchema("CitationResourceBinding", {
      description:
        "Bounded trusted resource key and exact expected decision set and insertion positions/group/list identities, absent from the persisted document.",
    })
  )
) {}
const Json = S.fromJsonString(CitationResourceIdentity);
const ExternalKey = S.fromJsonString(
  S.Tuple([S.tag("citation-authority/v1"), S.tag("external-resource"), Sha256Hex, Sha256Hex])
).pipe(
  $I.annoteSchema("ExternalKey", {
    description: "Versioned external resource digest protocol, distinct from every canonical authority preimage.",
  })
);
const FailureReason = LiteralKit(["invalid-input", "identity-failed", "digest-failed"]).pipe(
  $I.annoteSchema("FailureReason", { description: "Sanitized private resource identity failure reasons." })
);
/**
 * Private failure without adapter fingerprints, source text or nested causes.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class CitationResourceIdentityFailure extends S.TaggedError<
  CitationResourceIdentityFailure,
  { readonly brand: unique symbol }
>($I`CitationResourceIdentityFailure`)(
  "CitationResourceIdentityFailure",
  { reason: FailureReason },
  $I.annoteError<CitationResourceIdentityFailure>("CitationResourceIdentityFailure", {
    description: "Resource key production failed without retaining adapter inputs or nested causes.",
  })
) {}
const invalid = () => CitationResourceIdentityFailure.make({ reason: "invalid-input" });

/**
 * Hash a snapshotted trusted descriptor. Canonical descriptors preserve ca1
 * fallback equality; external scope/key pairs use a disjoint preimage domain.
 * This issues an identity token, not an assertion that an adapter is trusted.
 * The caller owns adapter selection and source equality/truthiness laws.
 * @internal
 * @category encoding
 * @since 0.0.0
 */
export const makeCitationResourceAuthorityId = Effect.fn("Citation.makeResourceAuthorityId")(function* (
  input: unknown
): Effect.fn.Return<CitationAuthorityId, CitationResourceIdentityFailure, Crypto.Crypto> {
  const decoded = yield* S.decodeUnknownEffect(S.toType(CitationResourceIdentity))(input).pipe(
    Effect.mapError(invalid)
  );
  const json = yield* S.encodeEffect(Json)(decoded).pipe(Effect.mapError(invalid));
  const snapshot = yield* S.decodeEffect(Json)(json).pipe(Effect.mapError(invalid));
  if (snapshot._tag === "Canonical")
    return yield* makeCitationAuthorityId(snapshot.authority).pipe(
      Effect.mapError(() => CitationResourceIdentityFailure.make({ reason: "identity-failed" }))
    );
  const preimage = yield* S.encodeEffect(ExternalKey)([
    "citation-authority/v1",
    "external-resource",
    snapshot.scope,
    snapshot.key,
  ]).pipe(Effect.mapError(invalid));
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(encoder.encode(preimage)).pipe(
    Effect.mapError(() => CitationResourceIdentityFailure.make({ reason: "digest-failed" }))
  );
  return CitationAuthorityId.make(`ca1:${hash}`);
});
