/**
 * The recorded basis for a priority claim between two legal positions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as S from "effect/Schema";
import { HohfeldPosition } from "../HohfeldPosition/index.ts";
import { LegalScopeValue } from "../LegalScopeContext/index.ts";

const $I = $LawPracticeDomainId.create("values/PriorityBasis/PriorityBasis.model");

/**
 * One recorded designation on a priority basis, written as the asserter put it.
 *
 * **Details**
 *
 * Every argumentative axis of a priority claim is recorded as a designation
 * rather than a typed or ordered value. The designations are what somebody
 * argued, not facts the system holds, and they are stored so a reader can see
 * the argument rather than so anything can act on it.
 *
 * **Example** (Record a source-precedence argument)
 *
 * ```ts
 * import { PriorityBasisDesignation } from "@beep/law-practice-domain"
 *
 * console.log(PriorityBasisDesignation.make("statute over agency guidance"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PriorityBasisDesignation = S.NonEmptyString.pipe(
  $I.annoteSchema("PriorityBasisDesignation", {
    description: "One recorded designation on a priority basis, written as the asserter put it.",
  })
);

/**
 * Runtime type for {@link PriorityBasisDesignation}.
 *
 * @see {@link PriorityBasisDesignation} for the runtime schema and why the axes are untyped designations.
 * @category models
 * @since 0.0.0
 */
export type PriorityBasisDesignation = typeof PriorityBasisDesignation.Type;

/**
 * The basis somebody asserted for one position taking priority over another.
 *
 * **When to use**
 *
 * Use as typed input structure accompanying a law-side candidate record, so the
 * argument for priority is on the record beside the candidate rather than left
 * in prose or implied by ordering.
 *
 * **Details**
 *
 * The party whose claim it is and the position it is about are required,
 * because a basis that names neither is about nothing. The eight argumentative
 * axes are optional: a basis records what was actually asserted, and requiring
 * all eight would fill the record with placeholders that later read as real
 * arguments.
 *
 * Forum, proof standard, and institutional viewpoint live here rather than on
 * the position's recorded scope. They are grounds for arguing that one position
 * should prevail, not statements about where a position holds, and folding them
 * into scope would let a scope-overlap answer read as a statement about which
 * position wins.
 *
 * Source precedence and specificity are the two axes that make priority
 * uncomputable rather than merely unimplemented. Which source outranks which,
 * and whether the more specific provision governs, are contested legal
 * arguments whose answers differ by forum and by decade. They are recorded for
 * exactly that reason.
 *
 * **Gotchas**
 *
 * `time` is a designation and not a timestamp, deliberately. A comparable time
 * would invite the lex-posterior ordering this structure exists to refuse, and
 * the temporal argument a lawyer actually makes ("as amended in 2019") is not a
 * point on a clock.
 *
 * Nothing here orders, scores, or compares two bases. There is no `Order`, no
 * ranking helper, and no "strongest basis" view, because any of them would be
 * the proxy for a priority outcome that the never-compute boundary forbids.
 * Two bases citing incompatible grounds is something a reader sees, not
 * something this vocabulary resolves.
 *
 * **Example** (Record why one position is claimed to prevail)
 *
 * ```ts
 * import { HohfeldPosition, LegalActContent, PriorityBasis } from "@beep/law-practice-domain"
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 * import * as O from "effect/Option"
 *
 * const basis = PriorityBasis.make({
 *   forum: O.some("N.D. Cal."),
 *   party: LawPractice.PartyId.make(3),
 *   position: HohfeldPosition.make({
 *     content: LegalActContent.make({ description: "enter the land", polarity: "act" }),
 *     kind: "privilege",
 *   }),
 *   sourcePrecedence: O.some("lease clause over the parties' course of dealing"),
 * })
 * console.log(O.isNone(basis.specificity)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PriorityBasis extends S.Class<PriorityBasis>($I`PriorityBasis`)(
  {
    authority: S.OptionFromNullOr(PriorityBasisDesignation).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Level of the authority the asserter claims stands behind the position.",
    }),
    forum: S.OptionFromNullOr(PriorityBasisDesignation).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Forum the priority claim is made in or for.",
    }),
    jurisdiction: S.OptionFromNullOr(LegalScopeValue).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Jurisdiction the priority claim is made under, recorded as a scope designation.",
    }),
    party: LawPractice.PartyId.annotateKey({
      description: "Party whose priority claim this basis records.",
    }),
    position: HohfeldPosition.annotateKey({
      description: "Position the priority is claimed for, as the kind and content pair.",
    }),
    proofStandard: S.OptionFromNullOr(PriorityBasisDesignation).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Standard of proof the asserter says applies.",
    }),
    sourcePrecedence: S.OptionFromNullOr(PriorityBasisDesignation).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Asserted precedence between the competing sources; recorded, never ranked.",
    }),
    specificity: S.OptionFromNullOr(PriorityBasisDesignation).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Asserted specificity argument between the competing provisions; recorded, never ranked.",
    }),
    time: S.OptionFromNullOr(PriorityBasisDesignation).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Temporal argument as the asserter put it, deliberately a designation rather than a timestamp.",
    }),
    viewpoint: S.OptionFromNullOr(PriorityBasisDesignation).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Institutional viewpoint the claim is made from.",
    }),
  },
  $I.annote("PriorityBasis", {
    description: "The recorded basis for a priority claim between two legal positions, never an outcome.",
  })
) {}
