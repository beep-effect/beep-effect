/**
 * Natural language processing utilities for deterministic tokenization,
 * normalization, and variant generation across identifiers, paths, and queries.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

/**
 * Algebraic structures (monoids) for NLP aggregation.
 *
 * **Example** (Fold number sum monoid)
 *
 * ```typescript
 * import { Algebra } from "@beep/nlp"
 *
 * console.log(Algebra.Monoid.fold(Algebra.Monoid.NumberSum)([1, 2, 3])) // 6
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export * as Algebra from "./Algebra/index.ts";
/**
 * Core NLP models, tokenization, and pattern utilities.
 *
 * **Example** (Make document identifier)
 *
 * ```typescript
 * import { Core } from "@beep/nlp"
 *
 * console.log(Core.DocumentId.make("doc-a"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * as Core from "./Core/index.ts";
/**
 * Text-graph IR: node/edge schema classes (the handoff-contract basis).
 *
 * **Example** (Log text node schema)
 *
 * ```typescript
 * import { Graph } from "@beep/nlp"
 *
 * console.log(Graph.Schema.TextNode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * as Graph from "./Graph/index.ts";
/**
 * The product-neutral generic IR handoff contract emitted for downstream
 * consumers (chunks/mentions/entities/relations + spans + PROV-O provenance).
 *
 * **Example** (Log annotated document contract)
 *
 * ```typescript
 * import { Handoff } from "@beep/nlp"
 *
 * console.log(Handoff.Contract.AnnotatedDocument)
 * ```
 *
 * @category interop
 * @since 0.0.0
 */
export * as Handoff from "./Handoff/index.ts";
/**
 * Deterministic identifier tokenization and variant helpers.
 *
 * **Example** (Tokenize identifier text)
 *
 * ```typescript
 * import { IdentifierText } from "@beep/nlp"
 *
 * const result = IdentifierText.tokens("myVariable")
 * console.log(result) // ["my", "variable"]
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export * as IdentifierText from "./IdentifierText.ts";
/**
 * Type-level ontology of text strata (kinds) and the containment poset.
 *
 * **Example** (Check kind containment)
 *
 * ```typescript
 * import { Ontology } from "@beep/nlp"
 *
 * console.log(Ontology.Kind.canContain("Document", "Sentence")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * as Ontology from "./Ontology/index.ts";
/**
 * Deterministic path and module-specifier normalization helpers.
 *
 * **Example** (Normalize path phrase)
 *
 * ```typescript
 * import { PathText } from "@beep/nlp"
 *
 * const normalized = PathText.normalizePathPhrase("src\\utils")
 * console.log(normalized) // "src/utils"
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
 * ```typescript
 * import { QueryText } from "@beep/nlp"
 *
 * const normalized = QueryText.normalizeQuestion("  hello   world  ")
 * console.log(normalized) // "hello world"
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
 * ```typescript
 * import { VariantText } from "@beep/nlp"
 *
 * const deduped = VariantText.orderedDedupe(["foo", "bar", "foo"])
 * console.log(deduped) // ["foo", "bar"]
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export * as VariantText from "./VariantText.ts";
