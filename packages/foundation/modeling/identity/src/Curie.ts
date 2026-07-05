/**
 * CURIE expansion, contraction, and schema codecs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, pipe, SchemaIssue, SchemaTransformation } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { $IdentityId } from "./packages.ts";
import { CoreVocab } from "./Vocab.ts";
import type { Curie, Expand, Predicate, VocabShape } from "./Vocab.ts";

const $I = $IdentityId.create("Curie");

type Contract<I extends string, V extends VocabShape> = {
  readonly [C in Curie<V>]: Expand<C, V> extends I ? C : never;
}[Curie<V>];

type ExpandedPredicate<P extends string, V extends VocabShape> = P extends `^${infer C}`
  ? { readonly iri: Expand<C, V>; readonly inverse: true }
  : { readonly iri: Expand<P, V>; readonly inverse: false };

const parseCurie = (curie: string) =>
  pipe(
    curie,
    Str.indexOf(":"),
    O.map((separator) => [Str.slice(0, separator)(curie), Str.slice(separator + 1)(curie)] as const)
  );

const hasTerm = (terms: readonly string[], term: string) => A.contains(terms, term);

const expandOption = <const V extends VocabShape>(curie: string, vocab: V): O.Option<string> =>
  pipe(
    parseCurie(curie),
    O.flatMap(([prefix, term]) =>
      pipe(
        R.get(vocab, prefix),
        O.filter((entry) => hasTerm(entry.terms, term)),
        O.map((entry) => `${entry.iri}${term}`)
      )
    )
  );

const contractOption = <const V extends VocabShape>(iri: string, vocab: V): O.Option<Curie<V>> =>
  pipe(
    R.toEntries(vocab),
    A.reduce(O.none<readonly [keyof V & string, V[keyof V & string]["iri"], string]>(), (best, [prefix, entry]) =>
      pipe(
        A.findFirst(entry.terms, (term) => iri === `${entry.iri}${term}`),
        O.map((term) => [prefix, entry.iri, term] as const),
        O.filter((candidate) =>
          pipe(
            best,
            O.match({
              onNone: () => true,
              onSome: ([, namespace]) => Str.length(candidate[1]) > Str.length(namespace),
            })
          )
        ),
        O.orElse(() => best)
      )
    ),
    O.map(([prefix, , term]) => `${prefix}:${term}` as Curie<V>)
  );

const schemaIssue = (value: string, message: string) => new SchemaIssue.InvalidValue(O.some(value), { message });

/**
 * Expand a known CURIE into its exact IRI literal.
 *
 * @example
 * ```ts
 * import { expand } from "@beep/identity"
 *
 * const iri = expand("skos:prefLabel")
 * console.log(iri) // "http://www.w3.org/2004/02/skos/core#prefLabel"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export function expand<const C extends Curie<typeof CoreVocab>>(curie: C): Expand<C, typeof CoreVocab>;
export function expand<const V extends VocabShape, const C extends Curie<V>>(curie: C, vocab: V): Expand<C, V>;
export function expand(curie: string): string | undefined;
export function expand(curie: string, vocab: VocabShape): string | undefined;
export function expand(curie: string, vocab: VocabShape = CoreVocab): string | undefined {
  return pipe(expandOption(curie, vocab), O.getOrUndefined);
}

/**
 * Contract a registered IRI back to its CURIE literal.
 *
 * @example
 * ```ts
 * import { contract } from "@beep/identity"
 *
 * const curie = contract("http://www.w3.org/2004/02/skos/core#prefLabel")
 * console.log(curie) // "skos:prefLabel"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export function contract<const I extends Expand<Curie<typeof CoreVocab>, typeof CoreVocab>>(
  iri: I
): Contract<I, typeof CoreVocab>;
export function contract<const V extends VocabShape, const I extends Expand<Curie<V>, V>>(
  iri: I,
  vocab: V
): Contract<I, V>;
export function contract(iri: string): string | undefined;
export function contract(iri: string, vocab: VocabShape): string | undefined;
export function contract(iri: string, vocab: VocabShape = CoreVocab): string | undefined {
  return pipe(contractOption(iri, vocab), O.getOrUndefined);
}

/**
 * Expand a forward or inverse predicate CURIE into IRI plus direction.
 *
 * @example
 * ```ts
 * import { expandPredicate } from "@beep/identity"
 *
 * const expanded = expandPredicate("^rdfs:subClassOf")
 * console.log(expanded?.inverse) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export function expandPredicate<const P extends Predicate<typeof CoreVocab>>(
  predicate: P
): ExpandedPredicate<P, typeof CoreVocab>;
export function expandPredicate<const V extends VocabShape, const P extends Predicate<V>>(
  predicate: P,
  vocab: V
): ExpandedPredicate<P, V>;
export function expandPredicate(predicate: string): { readonly iri: string; readonly inverse: boolean } | undefined;
export function expandPredicate(
  predicate: string,
  vocab: VocabShape
): { readonly iri: string; readonly inverse: boolean } | undefined;
export function expandPredicate(predicate: string, vocab: VocabShape = CoreVocab) {
  const inverse = pipe(predicate, Str.startsWith("^"));
  const curie = inverse ? Str.slice(1)(predicate) : predicate;

  return pipe(
    expandOption(curie, vocab),
    O.map((iri) => ({ iri, inverse })),
    O.getOrUndefined
  );
}

/**
 * Build literal-preserving CURIE encode/decode helpers for a registry.
 *
 * @example
 * ```ts
 * import { CoreVocab, makeCurieCodec } from "@beep/identity"
 *
 * const codec = makeCurieCodec(CoreVocab)
 * console.log(codec.decode("skos:prefLabel"))
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const makeCurieCodec = <const V extends VocabShape>(vocab: V) => ({
  decode: <const C extends Curie<V>>(curie: C): Expand<C, V> => expand(curie, vocab),
  encode: <const I extends Expand<Curie<V>, V>>(iri: I): Contract<I, V> => contract(iri, vocab),
});

/**
 * Literal-preserving CURIE helper pair for {@link CoreVocab}.
 *
 * @example
 * ```ts
 * import { CoreCurieCodec } from "@beep/identity"
 *
 * const iri = CoreCurieCodec.decode("rdfs:label")
 * console.log(iri) // "http://www.w3.org/2000/01/rdf-schema#label"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const CoreCurieCodec = makeCurieCodec(CoreVocab);

/**
 * Build an Effect Schema codec that decodes CURIEs to IRIs and encodes IRIs to CURIEs.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { CoreVocab, makeCurieFromIri } from "@beep/identity"
 *
 * const decode = S.decodeUnknownEffect(makeCurieFromIri(CoreVocab))
 * console.log(typeof decode)
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const makeCurieFromIri = <const V extends VocabShape>(vocab: V) =>
  S.String.pipe(
    S.decodeTo(
      S.String,
      SchemaTransformation.transformOrFail({
        decode: (curie) =>
          pipe(
            expandOption(curie, vocab),
            O.match({
              onNone: () => Effect.fail(schemaIssue(curie, `Unknown CURIE: ${curie}`)),
              onSome: Effect.succeed,
            })
          ),
        encode: (iri) =>
          pipe(
            contractOption(iri, vocab),
            O.match({
              onNone: () => Effect.fail(schemaIssue(iri, `Unknown IRI: ${iri}`)),
              onSome: Effect.succeed,
            })
          ),
      })
    ),
    $I.annoteSchema("CurieFromIri", {
      description: "Codec that decodes registered CURIEs to IRIs and encodes registered IRIs to CURIEs.",
    })
  );

/**
 * Core vocabulary CURIE-to-IRI Effect Schema codec.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { CurieFromIri } from "@beep/identity"
 *
 * const decode = S.decodeUnknownEffect(CurieFromIri)
 * console.log(typeof decode)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CurieFromIri = makeCurieFromIri(CoreVocab);

/**
 * {@inheritDoc CurieFromIri}
 *
 * @example
 * ```ts
 * import type { CurieFromIri } from "@beep/identity"
 *
 * const iri: CurieFromIri = "http://www.w3.org/2004/02/skos/core#prefLabel"
 * console.log(iri)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CurieFromIri = typeof CurieFromIri.Type;
