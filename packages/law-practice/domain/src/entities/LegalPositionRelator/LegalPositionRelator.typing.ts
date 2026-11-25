/**
 * gUFO typing of the legal position relator and the roles it mediates.
 *
 * @packageDocumentation
 * @category constants
 * @since 0.0.0
 */

import { iri } from "@beep/identity/Registry";
import { TermIri } from "@beep/identity/Term";
import { GufoTyping, TypedHierarchy } from "@beep/ontology/Gufo";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import type { GufoClassType } from "@beep/ontology/Gufo";

/**
 * The term IRI of the legal position relator.
 *
 * **Example** (Read the relator term)
 *
 * ```ts
 * import { legalPositionRelatorTerm } from "@beep/law-practice-domain/entities/LegalPositionRelator"
 *
 * console.log(legalPositionRelatorTerm.endsWith("LegalPositionRelator"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const legalPositionRelatorTerm = TermIri.make(iri("law-practice:LegalPositionRelator"));

/**
 * The term IRI of the role a relator's bearer plays.
 *
 * **Example** (Read the bearer term)
 *
 * ```ts
 * import { positionBearerTerm } from "@beep/law-practice-domain/entities/LegalPositionRelator"
 *
 * console.log(positionBearerTerm.endsWith("PositionBearer"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const positionBearerTerm = TermIri.make(iri("law-practice:PositionBearer"));

/**
 * The term IRI of the role a relator's counterparty plays.
 *
 * **Example** (Read the counterparty term)
 *
 * ```ts
 * import { positionCounterpartyTerm } from "@beep/law-practice-domain/entities/LegalPositionRelator"
 *
 * console.log(positionCounterpartyTerm.endsWith("PositionCounterparty"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const positionCounterpartyTerm = TermIri.make(iri("law-practice:PositionCounterparty"));

/**
 * The term IRI of the category every party falls under.
 *
 * **Example** (Read the party term)
 *
 * ```ts
 * import { partyTerm } from "@beep/law-practice-domain/entities/LegalPositionRelator"
 *
 * console.log(partyTerm.endsWith("Party"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const partyTerm = TermIri.make(iri("law-practice:Party"));

const objectTyping = (classType: GufoClassType) =>
  GufoTyping.make({ classType, instanceCategory: "Object", mediates: HashMap.empty() });

/**
 * The gUFO typing of the legal position relator, its two roles and the party
 * category, with the roles' specialization edges.
 *
 * **Details**
 *
 * The relator is a Kind of instance category Relator that mediates the bearer
 * and counterparty roles once each. The roles are RoleMixins, because natural
 * and juristic persons, different kinds, both play them; each specializes the
 * Party category.
 *
 * **Example** (Audit the relator typing)
 *
 * ```ts
 * import {
 *   legalPositionRelatorTerm,
 *   legalPositionRelatorTyping
 * } from "@beep/law-practice-domain/entities/LegalPositionRelator"
 * import { audit } from "@beep/ontology/Gufo"
 *
 * console.log(audit(legalPositionRelatorTyping)(legalPositionRelatorTerm).length)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const legalPositionRelatorTyping = TypedHierarchy.make({
  typing: HashMap.make(
    [
      legalPositionRelatorTerm,
      GufoTyping.make({
        classType: "Kind",
        instanceCategory: "Relator",
        mediates: HashMap.make([positionBearerTerm, 1], [positionCounterpartyTerm, 1]),
      }),
    ],
    [positionBearerTerm, objectTyping("RoleMixin")],
    [positionCounterpartyTerm, objectTyping("RoleMixin")],
    [partyTerm, objectTyping("Category")]
  ),
  specializes: HashMap.make(
    [positionBearerTerm, HashSet.make(partyTerm)],
    [positionCounterpartyTerm, HashSet.make(partyTerm)]
  ),
});
