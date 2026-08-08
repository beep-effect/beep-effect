/**
 * Algebraic structures (monoids) for NLP aggregation operations.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

/**
 * Monoid type class plus concrete instances and law checkers.
 *
 * **Example** (Fold numbers with NumberSum)
 *
 * ```typescript
 * import { Monoid } from "@beep/nlp/Algebra"
 *
 * console.log(Monoid.fold(Monoid.NumberSum)([1, 2, 3])) // 6
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export * as Monoid from "./Monoid.ts";
/**
 * NLP-specific monoid instances (tokens, sentences, documents, corpus, TF-IDF).
 *
 * **Example** (Concatenate tokens with TokenConcat)
 *
 * ```typescript
 * import { NLPMonoid } from "@beep/nlp/Algebra"
 *
 * console.log(NLPMonoid.TokenConcat.combine("hello", "world")) // "hello world"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export * as NLPMonoid from "./NLPMonoid.ts";
