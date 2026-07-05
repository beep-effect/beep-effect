/**
 * Barrel re-exports for `@beep/identity`.
 *
 * @example
 * ```ts
 * import { make } from "@beep/identity"
 *
 * const { $MyPkgId } = make("my-pkg")
 * const id = $MyPkgId.make("Service")
 * console.log(id)// "@beep/my-pkg/Service"
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * CURIE expansion, contraction, and schema codecs for identity vocabularies.
 *
 * @example
 * ```ts
 * import { expand } from "@beep/identity"
 *
 * console.log(expand("skos:prefLabel"))
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export * from "./Curie.ts";
/**
 * Identity system core -- composers, annotations, and branded types.
 *
 * @example
 * ```ts
 * import { make } from "@beep/identity"
 *
 * const { $MyPkgId } = make("my-pkg")
 * console.log($MyPkgId.make("Service"))
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export * from "./Id.ts";
/**
 * Turtle PN_LOCAL parser-side helpers and safe emission fallback.
 *
 * @example
 * ```ts
 * import { prefixedNameOrIri } from "@beep/identity"
 *
 * console.log(prefixedNameOrIri("skos", "prefLabel", "http://www.w3.org/2004/02/skos/core#prefLabel"))
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export * from "./PnLocal.ts";
/**
 * Pre-built identity composers for every `@beep/*` workspace package.
 *
 * @example
 * ```ts
 * import { $DataId } from "@beep/identity"
 *
 * console.log($DataId.make("CurrencyCodes"))
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export * from "./packages.ts";
/**
 * Static borrowed vocabulary registry and literal CURIE type helpers.
 *
 * @example
 * ```ts
 * import { CoreVocab } from "@beep/identity"
 *
 * console.log(CoreVocab.rdf.iri)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export * from "./Vocab.ts";
