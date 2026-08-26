/**
 * Barrel re-exports for `@beep/identity`.
 *
 * **Example** (Make package identity ID)
 *
 * ```ts import.meta.vitest name="Make package identity ID"
 * import { make } from "@beep/identity"
 *
 * const { $MyPkgId } = make("my-pkg")
 * const id = $MyPkgId.make("Service")
 * id // => "@beep/my-pkg/Service"
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * CURIE expansion, contraction, and schema codecs for identity vocabularies.
 *
 * **Example** (Expand CURIE to IRI)
 *
 * ```ts import.meta.vitest name="Expand CURIE to IRI"
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
 * Discrete fiber families with schema-validated section metadata.
 *
 * **Example** (Build a single-point family)
 *
 * ```ts import.meta.vitest name="Build a single-point family"
 * import { Fibered } from "@beep/identity"
 * import * as S from "effect/Schema"
 *
 * const family = Fibered.make({
 *   base: S.Literals(["text"]),
 *   fibers: { text: S.String },
 *   section: {
 *     schema: S.Struct({ label: S.String }),
 *     values: { text: { label: "Text" } }
 *   }
 * })
 *
 * family.points // => ["text"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Fibered.ts";
/**
 * Identity system core -- composers, annotations, and branded types.
 *
 * **Example** (Compose branded package ID)
 *
 * ```ts import.meta.vitest name="Compose branded package ID"
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
 * Exact identity, IRI, and CURIE dereferencing contracts and local layer.
 *
 * **Example** (Create an empty local registry)
 *
 * ```ts import.meta.vitest name="Create an empty local registry"
 * import { IdentityRegistry } from "@beep/identity"
 *
 * console.log(IdentityRegistry.layerLocal([]))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * from "./IdentityRegistry.ts";
/**
 * Turtle PN_LOCAL parser-side helpers and safe emission fallback.
 *
 * **Example** (Emit prefixed name or IRI)
 *
 * ```ts import.meta.vitest name="Emit prefixed name or IRI"
 * import { prefixedNameOrIri } from "@beep/identity"
 *
 * console.log(prefixedNameOrIri("prefLabel", {
 *   prefix: "skos",
 *   fullIri: "http://www.w3.org/2004/02/skos/core#prefLabel"
 * }))
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export * from "./PnLocal.ts";
/**
 * Pre-built identity composers for every `@beep/*` workspace package.
 *
 * **Example** (Use prebuilt package composer)
 *
 * ```ts import.meta.vitest name="Use prebuilt package composer"
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
 * **Example** (Read core vocab IRI)
 *
 * ```ts import.meta.vitest name="Read core vocab IRI"
 * import { CoreVocab } from "@beep/identity"
 *
 * console.log(CoreVocab.rdf.iri)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export * from "./Vocab.ts";
