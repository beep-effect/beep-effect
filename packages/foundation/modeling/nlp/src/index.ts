/**
 * Natural language processing utilities for deterministic tokenization,
 * normalization, and variant generation across identifiers, paths, and queries.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

/**
 * Deterministic identifier tokenization and variant helpers.
 *
 * **Example** (Tokenize identifier text)
 *
 * ```ts import.meta.vitest name="Tokenize identifier text"
 * import * as IdentifierText from "@beep/nlp/IdentifierText"
 *
 * const result = IdentifierText.tokens("myVariable")
 * result // => ["my", "variable"]
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export * as IdentifierText from "./IdentifierText.ts";
/**
 * Deterministic path and module-specifier normalization helpers.
 *
 * **Example** (Normalize path phrase)
 *
 * ```ts import.meta.vitest name="Normalize path phrase"
 * import * as PathText from "@beep/nlp/PathText"
 *
 * const normalized = PathText.normalizePathPhrase("src\\utils")
 * normalized // => "src/utils"
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export * as PathText from "./PathText.ts";
/**
 * Deterministic query-text normalization helpers.
 *
 * **Example** (Normalize question text)
 *
 * ```ts import.meta.vitest name="Normalize question text"
 * import * as QueryText from "@beep/nlp/QueryText"
 *
 * const normalized = QueryText.normalizeQuestion("  hello   world  ")
 * normalized // => "hello world"
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export * as QueryText from "./QueryText.ts";
/**
 * Ordered string-variant deduplication helpers.
 *
 * **Example** (Ordered dedupe variants)
 *
 * ```ts import.meta.vitest name="Ordered dedupe variants"
 * import * as VariantText from "@beep/nlp/VariantText"
 *
 * const deduped = VariantText.orderedDedupe(["foo", "bar", "foo"])
 * deduped // => ["foo", "bar"]
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export * as VariantText from "./VariantText.ts";
