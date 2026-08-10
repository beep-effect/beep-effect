/**
 * Closed Hohfeldian legal position vocabulary and its bounded subdomains.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/HohfeldPositionKind/HohfeldPositionKind.model");

const HohfeldPositionKindBase = LiteralKit([
  "claim",
  "duty",
  "privilege",
  "noRight",
  "power",
  "liability",
  "immunity",
  "disability",
]);

/**
 * The eight Hohfeldian legal position kinds, closed at eight.
 *
 * **When to use**
 *
 * Use when a position kind is read or derived. Only the advantage side is
 * ever stored, so a stored field takes {@link AdvantagePositionKind} instead.
 *
 * **Details**
 *
 * The vocabulary splits into two four-member orbits under the correlative and
 * opposite derivations: {@link DeonticPositionKind} and
 * {@link PotestativePositionKind}. Nothing maps between orbits, which is why
 * both derivations are closed and total on this domain.
 *
 * Closing the domain at eight is a recorded stance. Reductions that treat
 * privilege–noRight and immunity–disability as mere absences of a duty or a
 * power collapse four members into two and lose exactly the positions this
 * vocabulary exists to record.
 *
 * **Gotchas**
 *
 * A member is a kind, never a position. A kind carried without the act content
 * it qualifies cannot be derived over soundly, so the derivations live on the
 * paired value rather than here.
 *
 * **Example** (Narrow a position kind)
 *
 * ```ts
 * import { HohfeldPositionKind } from "@beep/law-practice-domain"
 *
 * console.log(HohfeldPositionKind.is.disability("disability")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HohfeldPositionKind = HohfeldPositionKindBase.pipe(
  $I.annoteSchema("HohfeldPositionKind", {
    description: "The eight Hohfeldian legal position kinds in their two four-member orbits.",
  }),
  SchemaUtils.withLiteralKitStatics(HohfeldPositionKindBase)
);

/**
 * Runtime type for {@link HohfeldPositionKind}.
 *
 * @see {@link HohfeldPositionKind} for the runtime schema and member meanings.
 * @category models
 * @since 0.0.0
 */
export type HohfeldPositionKind = typeof HohfeldPositionKind.Type;

const AdvantagePositionKindBase = LiteralKit(
  HohfeldPositionKindBase.pickOptions(["claim", "privilege", "power", "immunity"])
);

/**
 * The advantage-side subdomain of {@link HohfeldPositionKind}: the only kinds a
 * relator may store.
 *
 * **When to use**
 *
 * Use as the type of any persisted position kind.
 *
 * **Details**
 *
 * Canonicalising storage to the advantage side is a modelling decision, not
 * Hohfeld's — his tables are symmetric. It is what makes the stored form of a
 * correlative pair unique: storing a duty and its claim as two records lets one
 * be superseded while the other stands, leaving a duty with no claim behind it.
 * Burden-side kinds therefore exist in the domain only as derivation outputs.
 *
 * **Gotchas**
 *
 * Because every advantage-side kind's opposite is burden-side, comparing two
 * stored kinds for opposition is vacuously false. Opposition is answered over
 * derived views, never over stored kinds.
 *
 * **Example** (Reject a burden-side kind from storage)
 *
 * ```ts
 * import { isAdvantagePositionKind } from "@beep/law-practice-domain"
 *
 * console.log(isAdvantagePositionKind("privilege")) // true
 * console.log(isAdvantagePositionKind("duty")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AdvantagePositionKind = AdvantagePositionKindBase.pipe(
  $I.annoteSchema("AdvantagePositionKind", {
    description: "Advantage-side position kinds, the canonical stored side of a correlative pair.",
  }),
  SchemaUtils.withLiteralKitStatics(AdvantagePositionKindBase)
);

/**
 * Runtime type for {@link AdvantagePositionKind}.
 *
 * @see {@link AdvantagePositionKind} for the runtime schema and the canonicalisation rule.
 * @category models
 * @since 0.0.0
 */
export type AdvantagePositionKind = typeof AdvantagePositionKind.Type;

/**
 * Whether a position kind may be stored, derived from the
 * {@link AdvantagePositionKind} subdomain schema rather than an ad-hoc
 * predicate.
 *
 * **Example** (Guard a candidate stored kind)
 *
 * ```ts
 * import { isAdvantagePositionKind } from "@beep/law-practice-domain"
 *
 * console.log(isAdvantagePositionKind("immunity")) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isAdvantagePositionKind: (kind: HohfeldPositionKind) => kind is AdvantagePositionKind =
  S.is(AdvantagePositionKind);

const DeonticPositionKindBase = LiteralKit(
  HohfeldPositionKindBase.pickOptions(["claim", "duty", "privilege", "noRight"])
);

/**
 * The first-order orbit of {@link HohfeldPositionKind}: what a party may or must
 * do.
 *
 * **Details**
 *
 * Both derivations are closed on this four-member set, so a deontic position
 * never derives into a potestative one. The orbit is a fact about the
 * derivations rather than a taxonomy imposed on them.
 *
 * **Example** (Recognise a first-order kind)
 *
 * ```ts
 * import { isDeonticPositionKind } from "@beep/law-practice-domain"
 *
 * console.log(isDeonticPositionKind("noRight")) // true
 * console.log(isDeonticPositionKind("power")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DeonticPositionKind = DeonticPositionKindBase.pipe(
  $I.annoteSchema("DeonticPositionKind", {
    description: "First-order orbit of the position vocabulary: claim, duty, privilege, and noRight.",
  }),
  SchemaUtils.withLiteralKitStatics(DeonticPositionKindBase)
);

/**
 * Runtime type for {@link DeonticPositionKind}.
 *
 * @see {@link DeonticPositionKind} for the runtime schema and the orbit rule.
 * @category models
 * @since 0.0.0
 */
export type DeonticPositionKind = typeof DeonticPositionKind.Type;

/**
 * Whether a position kind sits in the first-order orbit, derived from the
 * {@link DeonticPositionKind} subdomain schema.
 *
 * **Example** (Guard a first-order kind)
 *
 * ```ts
 * import { isDeonticPositionKind } from "@beep/law-practice-domain"
 *
 * console.log(isDeonticPositionKind("claim")) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isDeonticPositionKind: (kind: HohfeldPositionKind) => kind is DeonticPositionKind =
  S.is(DeonticPositionKind);

const PotestativePositionKindBase = LiteralKit(
  HohfeldPositionKindBase.pickOptions(["power", "liability", "immunity", "disability"])
);

/**
 * The second-order orbit of {@link HohfeldPositionKind}: who may change whose
 * first-order positions.
 *
 * **Details**
 *
 * Powers and immunities are about altering legal positions rather than about
 * conduct, so the orbit closes on itself under both derivations exactly as the
 * first-order orbit does.
 *
 * **Example** (Recognise a second-order kind)
 *
 * ```ts
 * import { isPotestativePositionKind } from "@beep/law-practice-domain"
 *
 * console.log(isPotestativePositionKind("liability")) // true
 * console.log(isPotestativePositionKind("duty")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PotestativePositionKind = PotestativePositionKindBase.pipe(
  $I.annoteSchema("PotestativePositionKind", {
    description: "Second-order orbit of the position vocabulary: power, liability, immunity, and disability.",
  }),
  SchemaUtils.withLiteralKitStatics(PotestativePositionKindBase)
);

/**
 * Runtime type for {@link PotestativePositionKind}.
 *
 * @see {@link PotestativePositionKind} for the runtime schema and the orbit rule.
 * @category models
 * @since 0.0.0
 */
export type PotestativePositionKind = typeof PotestativePositionKind.Type;

/**
 * Whether a position kind sits in the second-order orbit, derived from the
 * {@link PotestativePositionKind} subdomain schema.
 *
 * **Example** (Guard a second-order kind)
 *
 * ```ts
 * import { isPotestativePositionKind } from "@beep/law-practice-domain"
 *
 * console.log(isPotestativePositionKind("immunity")) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isPotestativePositionKind: (kind: HohfeldPositionKind) => kind is PotestativePositionKind =
  S.is(PotestativePositionKind);
