/**
 * Barrel re-exports for `@beep/identity`.
 *
 * **Example** (Make package identity ID)
 *
 * ```ts import.meta.vitest name="Make package identity ID"
 * import { make } from "@beep/identity/Id"
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
 * The identity authority, the IRI root of every declared internal namespace.
 *
 * **Example** (Read the identity authority)
 *
 * ```ts
 * import { IdentityAuthority } from "@beep/identity/Authority"
 *
 * console.log(IdentityAuthority)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export * from "./Authority.ts";
/**
 * Discrete fiber families with schema-validated section metadata.
 *
 * **Example** (Build a single-point family)
 *
 * ```ts import.meta.vitest name="Build a single-point family"
 * import { Fibered } from "@beep/identity/Fibered"
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
 * ```ts
 * import { make } from "@beep/identity/Id"
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
 * ```ts
 * import { IdentityRegistry } from "@beep/identity/IdentityRegistry"
 *
 * console.log(IdentityRegistry.layerLocal([]))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * from "./IdentityRegistry.ts";
/**
 * RFC 3987 IRI, IRI-reference, relative-reference, and absolute-IRI schemas.
 *
 * **Example** (Decode an RFC 3987 IRI)
 *
 * ```ts import.meta.vitest name="Decode an RFC 3987 IRI"
 * import { IRI } from "@beep/identity/Iri"
 * import * as S from "effect/Schema"
 *
 * S.decodeUnknownSync(IRI)("https://example.org/page#section") // => "https://example.org/page#section"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export * from "./Iri.ts";
/**
 * Turtle PN_LOCAL parser-side helpers and safe emission fallback.
 *
 * **Example** (Emit prefixed name or IRI)
 *
 * ```ts
 * import { prefixedNameOrIri } from "@beep/identity/PnLocal"
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
 * ```ts
 * import { $DataId } from "@beep/identity/packages"
 *
 * console.log($DataId.make("CurrencyCodes"))
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export * from "./packages.ts";
/**
 * Registry-free root composer for package-local leaves in deployed bundles.
 *
 * **Example** (Derive a leaf composer)
 *
 * ```ts
 * import { $BeepId } from "@beep/identity/Root"
 *
 * console.log($BeepId.create("schema").make("Email"))
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export * from "./Root.ts";
/**
 * Declared terms, namespaces, term bindings, deprecations and the term-stability snapshot.
 *
 * **Example** (Check a term local)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TermLocal } from "@beep/identity/Term"
 *
 * console.log(S.is(TermLocal)("receipts/accepted/v2"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Term.ts";
/**
 * Literal CURIE, predicate and IRI type helpers over a vocabulary shape.
 *
 * **Example** (Type a CURIE over the registry)
 *
 * ```ts
 * import type { RegistryVocab } from "@beep/identity/Registry"
 * import type { Curie } from "@beep/identity/Vocab"
 *
 * const curie: Curie<typeof RegistryVocab> = "rdfs:label"
 * console.log(curie)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export * from "./Vocab.ts";
