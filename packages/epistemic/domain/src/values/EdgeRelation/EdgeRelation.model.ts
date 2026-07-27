/**
 * Epistemic edge relation vocabulary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $EpistemicDomainId.create("values/EdgeRelation/EdgeRelation.model");

const EdgeRelationBase = LiteralKit(["supports", "refutes", "contradicts"]);

/**
 * Bounded relation vocabulary carried by a bitemporal epistemic edge: one
 * endpoint `supports`, `refutes`, or `contradicts` the other.
 *
 * @example
 * ```ts
 * import { EdgeRelation } from "@beep/epistemic-domain"
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
 * Runtime type for {@link EdgeRelation}.
 *
 * @example
 * ```ts
 * import type { EdgeRelation } from "@beep/epistemic-domain"
 *
 * const relation = "contradicts" satisfies EdgeRelation
 * console.log(relation)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EdgeRelation = typeof EdgeRelation.Type;

const SymmetricEdgeRelationBase = LiteralKit(EdgeRelationBase.pickOptions(["contradicts"]));

/**
 * The subset of {@link EdgeRelation} whose meaning is order-independent: an edge
 * carrying a symmetric relation denotes the same logical claim regardless of
 * which endpoint is recorded as source. The logical-edge digest uses this subset
 * to collapse both endpoint orderings onto one key.
 *
 * @example
 * ```ts
 * import { SymmetricEdgeRelation } from "@beep/epistemic-domain"
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
 * Runtime type for {@link SymmetricEdgeRelation}.
 *
 * @example
 * ```ts
 * import type { SymmetricEdgeRelation } from "@beep/epistemic-domain"
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
 * @example
 * ```ts
 * import { symmetricEdgeRelations } from "@beep/epistemic-domain"
 *
 * console.log(symmetricEdgeRelations)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const symmetricEdgeRelations: ReadonlyArray<EdgeRelation> = SymmetricEdgeRelation.Options;

/**
 * Whether a relation's endpoint ordering carries no meaning, derived from the
 * {@link SymmetricEdgeRelation} subset schema rather than an ad-hoc predicate.
 *
 * @example
 * ```ts
 * import { isSymmetricEdgeRelation } from "@beep/epistemic-domain"
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
