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
 * ```ts import.meta.vitest name="Fold number sum monoid"
 * import { Algebra } from "@beep/nlp"
 *
 * Algebra.Monoid.fold(Algebra.Monoid.NumberSum)([1, 2, 3]) // => 6
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
 * ```ts import.meta.vitest name="Make document identifier"
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
 * ```ts import.meta.vitest name="Log text node schema"
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
 * ```ts import.meta.vitest name="Log annotated document contract"
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
 * ```ts import.meta.vitest name="Tokenize identifier text"
 * import { IdentifierText } from "@beep/nlp"
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
 * Type-level ontology of text strata (kinds) and the containment poset.
 *
 * **Example** (Check kind containment)
 *
 * ```ts import.meta.vitest name="Check kind containment"
 * import { Ontology } from "@beep/nlp"
 *
 * Ontology.Kind.canContain("Document", "Sentence") // => true
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
 * ```ts import.meta.vitest name="Normalize path phrase"
 * import { PathText } from "@beep/nlp"
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
 * import { QueryText } from "@beep/nlp"
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
 * import { VariantText } from "@beep/nlp"
 *
 * const deduped = VariantText.orderedDedupe(["foo", "bar", "foo"])
 * deduped // => ["foo", "bar"]
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export * as VariantText from "./VariantText.ts";
