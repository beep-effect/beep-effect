/**
 * Literal CURIE type helpers over a vocabulary shape.
 *
 * **Details**
 *
 * The runtime vocabulary is the generated identity registry,
 * `RegistryVocab` in `@beep/identity/Registry`. This module only derives
 * literal CURIE, predicate and IRI types from any value of that shape.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Registry shape consumed by identity CURIE type helpers.
 *
 * **Example** (Satisfies VocabShape registry)
 *
 * ```ts
 * import type { VocabShape } from "@beep/identity/Vocab"
 *
 * const vocab = {
 *   ex: {
 *     iri: "https://example.test/ns#",
 *     terms: ["Thing"],
 *   },
 * } satisfies VocabShape
 *
 * console.log(vocab.ex.iri)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VocabShape = Readonly<
  Record<
    string,
    {
      readonly iri: string;
      readonly terms: readonly string[];
    }
  >
>;

type TermOf<V extends VocabShape, Prefix extends keyof V & string> = V[Prefix]["terms"][number] & string;

/**
 * Literal CURIE union derived from a vocabulary registry.
 *
 * **Example** (Typed CURIE from the registry)
 *
 * ```ts
 * import type { RegistryVocab } from "@beep/identity/Registry"
 * import type { Curie } from "@beep/identity/Vocab"
 *
 * const curie: Curie<typeof RegistryVocab> = "skos:prefLabel"
 * console.log(curie)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Curie<V extends VocabShape> = {
  readonly [Prefix in keyof V & string]: `${Prefix}:${TermOf<V, Prefix>}`;
}[keyof V & string];

/**
 * Forward or inverse predicate CURIE derived from a vocabulary registry.
 *
 * **Example** (Inverse predicate CURIE type)
 *
 * ```ts
 * import type { RegistryVocab } from "@beep/identity/Registry"
 * import type { Predicate } from "@beep/identity/Vocab"
 *
 * const predicate: Predicate<typeof RegistryVocab> = "^rdfs:subClassOf"
 * console.log(predicate)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Predicate<V extends VocabShape> = Curie<V> | `^${Curie<V>}`;

/**
 * Type-level expansion from a known CURIE to its exact IRI literal.
 *
 * **Example** (Expand CURIE to IRI literal)
 *
 * ```ts
 * import type { RegistryVocab } from "@beep/identity/Registry"
 * import type { Expand } from "@beep/identity/Vocab"
 *
 * const iri: Expand<"skos:prefLabel", typeof RegistryVocab> = "http://www.w3.org/2004/02/skos/core#prefLabel"
 * console.log(iri)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Expand<C extends string, V extends VocabShape> = C extends `${infer Prefix}:${infer Term}`
  ? Prefix extends keyof V & string
    ? Term extends TermOf<V, Prefix>
      ? `${V[Prefix]["iri"]}${Term}`
      : never
    : never
  : never;
