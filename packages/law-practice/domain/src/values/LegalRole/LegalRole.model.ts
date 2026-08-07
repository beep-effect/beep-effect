/**
 * Norm-prescribed role a party plays in one legal position relator.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import { PartyKind } from "../PartyKind/index.ts";
import { SourceNormRef } from "../SourceNormRef/index.ts";

const $I = $LawPracticeDomainId.create("values/LegalRole/LegalRole.model");

const isNonEmptyPartyKinds = (kinds: HashSet.HashSet<PartyKind>): boolean => !HashSet.isEmpty(kinds);

const AdmittedPlayerKinds = S.HashSet(PartyKind).check(
  S.makeFilter(isNonEmptyPartyKinds, {
    identifier: $I`LegalRoleAdmittedPlayerKindsCheck`,
    title: "Legal Role Admitted Player Kinds",
    description: "A legal role must admit at least one kind of legal person as a player.",
    message: "A legal role must admit at least one party kind.",
  })
);

/**
 * The name a norm gives to a role.
 *
 * **Example** (Record a prescribed role name)
 *
 * ```ts
 * import { LegalRoleName } from "@beep/law-practice-domain"
 *
 * console.log(LegalRoleName.make("licensee"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LegalRoleName = S.NonEmptyString.pipe(
  $I.annoteSchema("LegalRoleName", {
    description: "The name a norm gives to a role played in a legal position.",
  })
);

/**
 * Runtime type for {@link LegalRoleName}.
 *
 * @see {@link LegalRoleName} for the runtime schema.
 * @category models
 * @since 0.0.0
 */
export type LegalRoleName = typeof LegalRoleName.Type;

/**
 * One norm-prescribed role, scoped to the relator it is recorded in.
 *
 * **When to use**
 *
 * Use as the bearer and counterparty ends of a legal position relator. A role
 * exists relative to one relation, so it is a value carried by that relation
 * rather than an independently identified record.
 *
 * **Details**
 *
 * A role names both the party playing it and the norm prescribing it. Keeping
 * the norm on the role rather than only on the relator is what lets one
 * relation rest on a norm whose two ends are prescribed by different
 * provisions.
 *
 * `admittedPlayerKinds` is the role-mixin constraint: the kinds of legal person
 * the prescribing norm allows to play this role, which is frequently both. That
 * multiplicity is not incidental. The same party holding several roles is
 * exactly how principle collisions arise, and a model that admitted one kind
 * per role could not represent the collisions this vocabulary exists to record.
 *
 * **Gotchas**
 *
 * The role links its player by party id and asserts nothing further. That the
 * player is admitted by `admittedPlayerKinds`, that the party has the authority
 * the role implies, and that the norm was in force — none of these are checked
 * here, and none may be inferred from a role being recorded.
 *
 * **Example** (Record a role a company or a person may play)
 *
 * ```ts
 * import { LegalRole, PartyKind, SourceNormRef } from "@beep/law-practice-domain"
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 * import * as HashSet from "effect/HashSet"
 *
 * const role = LegalRole.make({
 *   admittedPlayerKinds: HashSet.make(PartyKind.Enum["natural-person"], PartyKind.Enum["juristic-person"]),
 *   name: "licensee",
 *   player: LawPractice.PartyId.make(1),
 *   sourceNorm: SourceNormRef.make({ designation: "cl. 4.1" }),
 * })
 * console.log(role.name) // "licensee"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LegalRole extends S.Class<LegalRole>($I`LegalRole`)(
  {
    admittedPlayerKinds: AdmittedPlayerKinds.annotateKey({
      description: "Kinds of legal person the prescribing norm admits as players of this role.",
    }),
    name: LegalRoleName.annotateKey({
      description: "The name the prescribing norm gives to this role.",
    }),
    player: LawPractice.PartyId.annotateKey({
      description: "Party recorded as playing this role in the relation carrying it.",
    }),
    sourceNorm: SourceNormRef.annotateKey({
      description: "Opaque reference to the norm prescribing this role.",
    }),
  },
  $I.annote("LegalRole", {
    description: "One norm-prescribed role, scoped to the legal position relator that carries it.",
  })
) {}
