/**
 * Party kind vocabulary shared by parties and the roles they may play.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";

const $I = $LawPracticeDomainId.create("values/PartyKind/PartyKind.model");

const PartyKindBase = LiteralKit(["natural-person", "juristic-person"]);

/**
 * The kind of legal person a party is.
 *
 * **When to use**
 *
 * Use to record what a party is, and on a legal role to record which kinds of
 * person the prescribing norm admits as players of that role.
 *
 * **Details**
 *
 * One vocabulary serves both readings on purpose. A role that admits both kinds
 * is the mechanism by which the same role is played by a person and a company,
 * and a second vocabulary for "kinds a role admits" would let the two drift
 * until the comparison stopped meaning anything.
 *
 * **Gotchas**
 *
 * Party kind is what a party is, never what it is entitled to. Nothing about
 * authority, capacity, or standing follows from it.
 *
 * **Example** (Narrow a recorded party kind)
 *
 * ```ts
 * import { PartyKind } from "@beep/law-practice-domain"
 *
 * console.log(PartyKind.is["juristic-person"]("juristic-person")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PartyKind = PartyKindBase.pipe(
  $I.annoteSchema("PartyKind", {
    description: "The kind of legal person a party is: a natural person or a juristic person.",
  }),
  SchemaUtils.withLiteralKitStatics(PartyKindBase)
);

/**
 * Runtime type for {@link PartyKind}.
 *
 * @see {@link PartyKind} for the runtime schema and member meanings.
 * @category models
 * @since 0.0.0
 */
export type PartyKind = typeof PartyKind.Type;
