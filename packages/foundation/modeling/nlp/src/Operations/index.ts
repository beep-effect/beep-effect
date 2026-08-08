/**
 * Operations - composable, schema-typed NLP operations.
 *
 * An algebra of operations (`A -> Effect<B, E, R>`) with schema-checked
 * boundaries: define operations ({@link Definition}) and compose them
 * functorially/monadically/applicatively ({@link Composable}).
 *
 * The schema-AST reconstruction layer is intentionally outside this package
 * surface; operations compose over typed schemas and graph carriers directly.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

/**
 * Composable operation builders and the categorical combinators (map/flatMap/
 * product/zipWith/traverse/aggregate).
 *
 * **Example** (Import composable operation builders)
 *
 * ```typescript
 * import { Composable } from "@beep/nlp/Operations"
 *
 * console.log(typeof Composable.makeOperation)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export * as Composable from "./Composable.ts";
/**
 * Structured operation definitions (metadata + schemas + implementation).
 *
 * **Example** (Reference operation definition type)
 *
 * ```typescript
 * import type { Definition } from "@beep/nlp/Operations"
 *
 * type Op = Definition.OperationDefinition<never, never>
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export type * as Definition from "./Definition.ts";
