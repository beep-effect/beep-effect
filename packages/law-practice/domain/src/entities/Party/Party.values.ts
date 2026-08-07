/**
 * Concept-local value objects for law-practice parties.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { LawPracticeFixtureKey } from "../LawPracticeEntity.fields.ts";

const $I = $LawPracticeDomainId.create("entities/Party/Party.values");
const PartyLikeKindBase = LiteralKit(["legal_client", "legal_contact"]);

/**
 * Which existing law-practice record a party reference points at.
 *
 * **When to use**
 *
 * Use inside {@link PartyReference} to say which registry the reference key
 * belongs to.
 *
 * **Details**
 *
 * Only the two party-like records are members. A matter is a thing a party has,
 * not a party, so it is not a referent even though it carries the same kind of
 * key.
 *
 * **Example** (Narrow a party-like kind)
 *
 * ```ts
 * import { PartyLikeKind } from "@beep/law-practice-domain"
 *
 * console.log(PartyLikeKind.is.legal_client("legal_client")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PartyLikeKind = PartyLikeKindBase.pipe(
  $I.annoteSchema("PartyLikeKind", {
    description: "Which existing law-practice record a party reference points at.",
  }),
  SchemaUtils.withLiteralKitStatics(PartyLikeKindBase)
);

/**
 * Runtime type for {@link PartyLikeKind}.
 *
 * @see {@link PartyLikeKind} for the runtime schema and member meanings.
 * @category models
 * @since 0.0.0
 */
export type PartyLikeKind = typeof PartyLikeKind.Type;

/**
 * Opaque reference from a party to an existing law-practice record.
 *
 * **When to use**
 *
 * Use to say which already-recorded client or contact a party is, without
 * asserting a foreign-key relationship to it.
 *
 * **Details**
 *
 * The reference is a fixture key and the registry that key belongs to. It is
 * text on purpose: the live client and contact records link to one another by
 * fixture key rather than by entity id, so a party that claimed an id edge
 * would be claiming a relationship the stored data does not have.
 *
 * **Gotchas**
 *
 * Nothing resolves the key. A reference to a key with no matching record is a
 * representable state, and identity resolution or record merging is a separate
 * problem this reference deliberately does not attempt.
 *
 * **Example** (Point a party at an existing client record)
 *
 * ```ts
 * import { PartyReference } from "@beep/law-practice-domain"
 *
 * const reference = PartyReference.make({
 *   fixtureKey: "client.acme",
 *   partyLike: "legal_client",
 * })
 * console.log(reference.partyLike) // "legal_client"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PartyReference extends S.Class<PartyReference>($I`PartyReference`)(
  {
    fixtureKey: LawPracticeFixtureKey.annotateKey({
      description: "Fixture key of the referenced record, linked by text and never by entity id.",
    }),
    partyLike: PartyLikeKind.annotateKey({
      description: "Registry the fixture key belongs to.",
    }),
  },
  $I.annote("PartyReference", {
    description: "Opaque text reference from a party to an existing law-practice record.",
  })
) {}
