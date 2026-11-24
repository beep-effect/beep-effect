/**
 * Epistemic edge relation vocabulary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicsId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $EpistemicsId.create("EdgeRelation/EdgeRelation.model");

const EdgeRelationBase = LiteralKit(["supports", "refutes", "contradicts"]);

/**
 * Bounded relation vocabulary carried by a bitemporal epistemic edge: one
 * endpoint `supports`, `refutes`, or `contradicts` the other.
 *
 * **Example** (Decode supports relation)
 *
 * ```ts
 * import { EdgeRelation } from "@beep/epistemics/EdgeRelation"
 * import * as S from "effect/Schema"
 *
 * const relation = S.decodeUnknownSync(EdgeRelation)("supports")
 * console.log(relation)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EdgeRelation = EdgeRelationBase.pipe(
  $I.annoteSchema("EdgeRelation", {
    description: "Bounded relation vocabulary carried by a bitemporal epistemic edge.",
  }),
  SchemaUtils.withLiteralKitStatics(EdgeRelationBase)
);

/**
 * **Example** (Satisfy EdgeRelation type)
 *
 * ```ts
 * import type { EdgeRelation } from "@beep/epistemics/EdgeRelation"
 *
 * const relation = "contradicts" satisfies EdgeRelation
 * console.log(relation)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EdgeRelation = typeof EdgeRelation.Type;

const SymmetricEdgeRelationBase = EdgeRelationBase.pick(["contradicts"]);

/**
 * The subset of {@link EdgeRelation} whose meaning is order-independent: an edge
 * carrying a symmetric relation denotes the same logical claim regardless of
 * which endpoint is recorded as source. The logical-edge digest uses this subset
 * to collapse both endpoint orderings onto one key.
 *
 * **Example** (Decode contradicts relation)
 *
 * ```ts
 * import { SymmetricEdgeRelation } from "@beep/epistemics/EdgeRelation"
 * import * as S from "effect/Schema"
 *
 * const relation = S.decodeUnknownSync(SymmetricEdgeRelation)("contradicts")
 * console.log(relation)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SymmetricEdgeRelation = SymmetricEdgeRelationBase.pipe(
  $I.annoteSchema("SymmetricEdgeRelation", {
    description: "Subset of the edge relation vocabulary whose endpoint ordering carries no meaning.",
  }),
  SchemaUtils.withLiteralKitStatics(SymmetricEdgeRelationBase)
);

/**
 * **Example** (Satisfy SymmetricEdgeRelation type)
 *
 * ```ts
 * import type { SymmetricEdgeRelation } from "@beep/epistemics/EdgeRelation"
 *
 * const relation = "contradicts" satisfies SymmetricEdgeRelation
 * console.log(relation)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SymmetricEdgeRelation = typeof SymmetricEdgeRelation.Type;

/**
 * The relation literals that are symmetric, in vocabulary order.
 *
 * **Example** (Log symmetric relations list)
 *
 * ```ts
 * import { symmetricEdgeRelations } from "@beep/epistemics/EdgeRelation"
 *
 * console.log(symmetricEdgeRelations)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const symmetricEdgeRelations: ReadonlyArray<EdgeRelation> = SymmetricEdgeRelation.literals;

/**
 * Whether a relation's endpoint ordering carries no meaning, derived from the
 * {@link SymmetricEdgeRelation} subset schema rather than an ad-hoc predicate.
 *
 * **Example** (Check relation symmetry)
 *
 * ```ts
 * import { isSymmetricEdgeRelation } from "@beep/epistemics/EdgeRelation"
 *
 * console.log(isSymmetricEdgeRelation("contradicts"))
 * console.log(isSymmetricEdgeRelation("supports"))
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isSymmetricEdgeRelation: (relation: EdgeRelation) => relation is SymmetricEdgeRelation =
  S.is(SymmetricEdgeRelation);
