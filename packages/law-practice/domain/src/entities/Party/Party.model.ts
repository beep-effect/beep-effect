/**
 * Party entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { PartyKind } from "../../values/PartyKind/index.ts";
import { LawPracticeText } from "../LawPracticeEntity.fields.ts";
import { PartyReference } from "./Party.values.ts";

const $I = $LawPracticeDomainId.create("entities/Party/Party.model");
const PartyEntity = ProductEntity.make(LawPractice.PartyId);

/**
 * One legal person a position can be held by or against.
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
 * Two parties referencing the same record are two parties. Nothing here
 * deduplicates, resolves, or merges identity, and no uniqueness over references
 * is asserted.
 *
 * **Example** (Inspect the recorded party surface)
 *
 * ```ts
 * import { Party } from "@beep/law-practice-domain"
 *
 * console.log(Party.fields.reference !== undefined) // true
 * console.log(Party.fields.kind !== undefined) // true
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Party extends PartyEntity.Entity<Party>(PartyEntity.tableName)(
  {
    displayName: LawPracticeText.annotateKey({
      description: "Human-readable name for the party, recorded for display and never used as identity.",
    }).pipe(PartyEntity.pg.text(), PartyEntity.pg.columnName("display_name")),
    kind: PartyKind.annotateKey({
      description: "Whether the party is a natural person or a juristic one.",
    }).pipe(PartyEntity.pg.text()),
    reference: PartyReference.annotateKey({
      description: "Opaque text reference to the existing law-practice record this party is.",
    }).pipe(PartyEntity.pg.jsonb()),
    ...PartyEntity.identityFields,
  },
  $I.annote("Party", {
    description: "One legal person a position can be held by or against, referencing an existing record by text.",
  }),
  PartyEntity.entityExtras
) {}
