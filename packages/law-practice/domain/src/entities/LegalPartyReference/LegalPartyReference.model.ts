/**
 * Legal role-player reference model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as PartyIdentity from "@beep/shared-domain/identity/Party";
import { PartyKind } from "../../values/PartyKind/index.ts";
import { LawPracticeText } from "../LawPracticeEntity.fields.ts";
import { PartyReference } from "./LegalPartyReference.values.ts";

const $I = $LawPracticeDomainId.create("entities/LegalPartyReference/LegalPartyReference.model");
const pg = ProductEntity.pg;

/**
 * A law-practice role-player reference keyed by the shared party identity.
 *
 * **When to use**
 *
 * Use as the thing a {@link LegalRole} names as its player. A party is generic
 * legal identity: the same party plays a role in one relation and a different
 * role in another, which is what makes role collisions representable.
 *
 * **Details**
 *
 * A party references an existing law-practice record rather than restating it.
 * The reference is a fixture key and its registry, because the live client and
 * contact records link by key rather than by entity id, and a party asserting
 * an id edge would assert a relationship the stored data does not have.
 *
 * `kind` records what the party is — a natural person or a juristic one — which
 * is what a role's admitted player kinds are read against.
 *
 * **Gotchas**
 *
 * This record retains its original PartyId when party resolution merges or
 * splits identities. Nothing here resolves identity or rewrites references;
 * no uniqueness over references is asserted.
 *
 * **Example** (Inspect the recorded party surface)
 *
 * ```ts
 * import { LegalPartyReference } from "@beep/law-practice-domain"
 *
 * console.log(LegalPartyReference.fields.reference !== undefined) // true
 * console.log(LegalPartyReference.fields.kind !== undefined) // true
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class LegalPartyReference extends ProductEntity.Entity<LegalPartyReference>()(PartyIdentity.PartyId)(
  {
    displayName: LawPracticeText.annotateKey({
      description: "Human-readable name for the party, recorded for display and never used as identity.",
    }).pipe(pg.text(), pg.columnName("display_name")),
    kind: PartyKind.annotateKey({
      description: "Whether the party is a natural person or a juristic one.",
    }).pipe(pg.text()),
    reference: PartyReference.annotateKey({
      description: "Opaque text reference to the existing law-practice record this party is.",
    }).pipe(pg.jsonb()),
  },
  $I.annote("LegalPartyReference", {
    description: "One legal person a position can be held by or against, referencing an existing record by text.",
  })
) {}
