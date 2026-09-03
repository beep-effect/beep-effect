/**
 * CURIE expansion, contraction, and schema codecs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, pipe, SchemaIssue, SchemaTransformation } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { $IdentityId } from "./packages.ts";
import { CoreVocab } from "./Vocab.ts";
import type { Curie, Expand, Predicate, VocabShape } from "./Vocab.ts";

const $I = $IdentityId.create("Curie");
// Internal invariant guard for the literal-preserving `expand`/`contract`
// overloads: the CURIE/IRI is asserted registered by its literal type, so the
// unresolved branch is type-level unreachable. Modeled as a S.TaggedError
// (not a native Error) to satisfy the native-runtime law without an allowlist
// entry; intentionally not exported (never a caught public failure).
class CurieCodecInvariantError extends S.TaggedError<CurieCodecInvariantError>(
  "@beep/identity/errors/CurieCodecInvariantError"
)(
  "CurieCodecInvariantError",
  {
    value: S.String,
  },
  $I.annoteError<CurieCodecInvariantError>("@beep/identity/errors/CurieCodecInvariantError", {
    description:
      "A CURIE/IRI asserted registered by its literal type failed to resolve (type-level-unreachable invariant).",
  })
) {}

type CoreCurie = Curie<typeof CoreVocab>;
type CoreIri = Expand<CoreCurie, typeof CoreVocab>;
type Contract<I extends string, V extends VocabShape> = {
  readonly [C in Curie<V>]: Expand<C, V> extends I ? C : never;
}[Curie<V>];

type ExpandedPredicateValue = { readonly iri: string; readonly inverse: boolean } | undefined;

type ExpandedPredicate<P extends string, V extends VocabShape> = P extends `^${infer C}`
  ? { readonly iri: Expand<C, V>; readonly inverse: true }
  : { readonly iri: Expand<P, V>; readonly inverse: false };

const CoreCurieArbitraryValues = [
  "rdf:type",
  "rdfs:label",
  "skos:prefLabel",
  "owl:Class",
  "dcterms:creator",
] as const satisfies readonly [CoreCurie, ...Array<CoreCurie>];
const CoreIriArbitraryValues = [
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  "http://www.w3.org/2000/01/rdf-schema#label",
  "http://www.w3.org/2004/02/skos/core#prefLabel",
  "http://www.w3.org/2002/07/owl#Class",
  "http://purl.org/dc/terms/creator",
] as const satisfies readonly [CoreIri, ...Array<CoreIri>];

const parseCurie = (curie: string) =>
  pipe(
    curie,
    Str.indexOf(":"),
    O.map((separator) => [Str.slice(0, separator)(curie), Str.slice(separator + 1)(curie)] as const)
  );

const expandOptionImpl = <const V extends VocabShape>(curie: string, vocab: V): O.Option<string> =>
  pipe(
    parseCurie(curie),
    O.flatMap(([prefix, term]) =>
      pipe(
        R.get(vocab, prefix),
        O.filter((entry) => A.contains(entry.terms, term)),
        O.map((entry) => `${entry.iri}${term}`)
      )
    )
  );

/**
 * Expand a possibly-unknown CURIE into its IRI.
 *
 * **Details**
 *
 * Returns `O.none()` when the CURIE's prefix is unregistered or its term
 * isn't declared for that prefix, instead of a null/undefined-typed return.
 * Use {@link expand} instead when the CURIE is statically known to be
 * registered (it preserves the exact IRI literal type).
 *
 * **Example** (Optional CURIE expansion results)
 *
 * ```ts import.meta.vitest name="Optional CURIE expansion results"
 * import { pipe } from "effect"
 * import * as O from "effect/Option"
 * import { CoreVocab, expandOption } from "@beep/identity"
 *
 * O.isSome(expandOption("skos:prefLabel", CoreVocab)) // => true
 * O.isNone(expandOption("bogus:term", CoreVocab)) // => true
 * O.isSome(pipe("skos:prefLabel", expandOption(CoreVocab))) // => true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const expandOption: {
  <const V extends VocabShape>(vocab: V): (curie: string) => O.Option<string>;
  <const V extends VocabShape>(curie: string, vocab: V): O.Option<string>;
} = dual(2, expandOptionImpl);

const contractOptionImpl = <const V extends VocabShape>(iri: string, vocab: V): O.Option<Curie<V>> =>
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

/**
 * Contract a possibly-unknown IRI back to its registered CURIE.
 *
 * **Details**
 *
 * Returns `O.none()` when the IRI isn't registered under any vocabulary
 * entry, instead of a null/undefined-typed return. Use {@link contract}
 * instead when the IRI is statically known to be registered (it preserves
 * the exact CURIE literal type).
 *
 * **Example** (Optional IRI contraction results)
 *
 * ```ts import.meta.vitest name="Optional IRI contraction results"
 * import { pipe } from "effect"
 * import * as O from "effect/Option"
 * import { CoreVocab, contractOption } from "@beep/identity"
 *
 * const iri = "http://www.w3.org/2004/02/skos/core#prefLabel"
 * O.isSome(contractOption(iri, CoreVocab)) // => true
 * O.isNone(contractOption("http://example.com/nope", CoreVocab)) // => true
 * O.isSome(pipe(iri, contractOption(CoreVocab))) // => true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const contractOption: {
  <const V extends VocabShape>(vocab: V): (iri: string) => ReturnType<typeof contractOptionImpl<V>>;
  <const V extends VocabShape>(iri: string, vocab: V): ReturnType<typeof contractOptionImpl<V>>;
} = dual(2, contractOptionImpl);

const schemaIssue = (message: string) => new SchemaIssue.InvalidValue({ message });

const isCoreCurie = (value: unknown): value is CoreCurie =>
  P.isString(value) && O.isSome(expandOption(value, CoreVocab));

const isCoreIri = (value: unknown): value is CoreIri => P.isString(value) && O.isSome(contractOption(value, CoreVocab));

const CoreCurieSchema = S.declare<CoreCurie>(isCoreCurie, {
  identifier: "@beep/identity/Curie/CoreCurie",
  title: "Core CURIE",
  description: "Finite CURIE literal from the built-in identity CoreVocab registry.",
  toArbitrary: () => (fc) => fc.constantFrom(...CoreCurieArbitraryValues),
});

const CoreIriSchema = S.declare<CoreIri>(isCoreIri, {
  identifier: "@beep/identity/Curie/CoreIri",
  title: "Core IRI",
  description: "Finite IRI literal from the built-in identity CoreVocab registry.",
  toArbitrary: () => (fc) => fc.constantFrom(...CoreIriArbitraryValues),
});

const makeCurieTransformation = <const V extends VocabShape>(vocab: V) =>
  SchemaTransformation.transformOrFail({
    decode: (curie: string) =>
      pipe(
        expandOption(curie, vocab),
        Effect.fromOption(() => schemaIssue(`Unknown CURIE: ${curie}`))
      ),
    encode: (iri: string) =>
      pipe(
        contractOption(iri, vocab),
        Effect.fromOption(() => schemaIssue(`Unknown IRI: ${iri}`))
      ),
  });

const CoreCurieTransformation = SchemaTransformation.transformOrFail({
  decode: (curie: CoreCurie) =>
    pipe(
      expandOption(curie, CoreVocab),
      O.filter(isCoreIri),
      Effect.fromOption(() => schemaIssue(`Unknown CURIE: ${curie}`))
    ),
  encode: (iri: CoreIri) =>
    pipe(
      contractOption(iri, CoreVocab),
      O.filter(isCoreCurie),
      Effect.fromOption(() => schemaIssue(`Unknown IRI: ${iri}`))
    ),
});

const expandUnsafe = (curie: string, vocab: VocabShape): string =>
  pipe(
    expandOption(curie, vocab),
    O.getOrElse(() => {
      throw CurieCodecInvariantError.make({ value: curie });
    })
  );

type ExpandDataLast = <const V extends VocabShape>(vocab: V) => <const C extends Curie<V>>(curie: C) => Expand<C, V>;

type ExpandDataFirst = {
  <const C extends Curie<typeof CoreVocab>>(curie: C): Expand<C, typeof CoreVocab>;
  <const V extends VocabShape, const C extends Curie<V>>(curie: C, vocab: V): Expand<C, V>;
};

function expandImpl<const C extends Curie<typeof CoreVocab>>(curie: C): Expand<C, typeof CoreVocab>;
function expandImpl<const V extends VocabShape, const C extends Curie<V>>(curie: C, vocab: V): Expand<C, V>;
function expandImpl(curie: string, vocab: VocabShape = CoreVocab): unknown {
  return expandUnsafe(curie, vocab);
}

/**
 * Expand a known CURIE into its exact IRI literal.
 *
 * **Example** (Expand known CURIE to IRI)
 *
 * ```ts import.meta.vitest name="Expand known CURIE to IRI"
 * import { expand } from "@beep/identity"
 *
 * const iri = expand("skos:prefLabel")
 * iri // => "http://www.w3.org/2004/02/skos/core#prefLabel"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const expand: ExpandDataLast & ExpandDataFirst = dual<ExpandDataLast, ExpandDataFirst>(
  (args) => P.isString(args[0]),
  expandImpl
);

const contractUnsafe = (iri: string, vocab: VocabShape): string =>
  pipe(
    contractOption(iri, vocab),
    O.getOrElse(() => {
      throw CurieCodecInvariantError.make({ value: iri });
    })
  );

type ContractDataLast = <const V extends VocabShape>(
  vocab: V
) => <const I extends Expand<Curie<V>, V>>(iri: I) => Contract<I, V>;

type ContractDataFirst = {
  <const I extends Expand<Curie<typeof CoreVocab>, typeof CoreVocab>>(iri: I): Contract<I, typeof CoreVocab>;
  <const V extends VocabShape, const I extends Expand<Curie<V>, V>>(iri: I, vocab: V): Contract<I, V>;
};

function contractImpl<const I extends Expand<Curie<typeof CoreVocab>, typeof CoreVocab>>(
  iri: I
): Contract<I, typeof CoreVocab>;
function contractImpl<const V extends VocabShape, const I extends Expand<Curie<V>, V>>(
  iri: I,
  vocab: V
): Contract<I, V>;
function contractImpl(iri: string, vocab: VocabShape = CoreVocab): unknown {
  return contractUnsafe(iri, vocab);
}

/**
 * Contract a registered IRI back to its CURIE literal.
 *
 * **Example** (Contract IRI to CURIE literal)
 *
 * ```ts import.meta.vitest name="Contract IRI to CURIE literal"
 * import { contract } from "@beep/identity"
 *
 * const curie = contract("http://www.w3.org/2004/02/skos/core#prefLabel")
 * curie // => "skos:prefLabel"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const contract: ContractDataLast & ContractDataFirst = dual<ContractDataLast, ContractDataFirst>(
  (args) => P.isString(args[0]),
  contractImpl
);

const expandPredicateUnsafe = (predicate: string, vocab: VocabShape): ExpandedPredicateValue => {
  const inverse = Str.startsWith("^")(predicate);
  const curie = inverse ? Str.slice(1)(predicate) : predicate;

  return pipe(
    expandOption(curie, vocab),
    O.map((iri) => ({ iri, inverse })),
    O.getOrUndefined
  );
};

type ExpandPredicateDataLast = {
  <const V extends VocabShape>(vocab: V): <const P extends Predicate<V>>(predicate: P) => ExpandedPredicate<P, V>;
  (vocab: VocabShape): (predicate: string) => ExpandedPredicateValue;
};

type ExpandPredicateDataFirst = {
  <const P extends Predicate<typeof CoreVocab>>(predicate: P): ExpandedPredicate<P, typeof CoreVocab>;
  <const V extends VocabShape, const P extends Predicate<V>>(predicate: P, vocab: V): ExpandedPredicate<P, V>;
  (predicate: string): ExpandedPredicateValue;
  (predicate: string, vocab: VocabShape): ExpandedPredicateValue;
};

function expandPredicateImpl<const P extends Predicate<typeof CoreVocab>>(
  predicate: P
): ExpandedPredicate<P, typeof CoreVocab>;
function expandPredicateImpl<const V extends VocabShape, const P extends Predicate<V>>(
  predicate: P,
  vocab: V
): ExpandedPredicate<P, V>;
function expandPredicateImpl(predicate: string): ExpandedPredicateValue;
function expandPredicateImpl(predicate: string, vocab: VocabShape): ExpandedPredicateValue;
function expandPredicateImpl(predicate: string, vocab: VocabShape = CoreVocab): ExpandedPredicateValue {
  return expandPredicateUnsafe(predicate, vocab);
}

/**
 * Expand a forward or inverse predicate CURIE into IRI plus direction.
 *
 * **Example** (Expand inverse predicate CURIE)
 *
 * ```ts import.meta.vitest name="Expand inverse predicate CURIE"
 * import { expandPredicate } from "@beep/identity"
 *
 * const expanded = expandPredicate("^rdfs:subClassOf")
 * expanded?.inverse // => true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const expandPredicate: ExpandPredicateDataLast & ExpandPredicateDataFirst = dual<
  ExpandPredicateDataLast,
  ExpandPredicateDataFirst
>((args) => P.isString(args[0]), expandPredicateImpl);

/**
 * Build literal-preserving CURIE encode/decode helpers for a registry.
 *
 * **Example** (Build codec from vocabulary)
 *
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
 * **Example** (Decode CoreVocab CURIE)
 *
 * ```ts import.meta.vitest name="Decode CoreVocab CURIE"
 * import { CoreCurieCodec } from "@beep/identity"
 *
 * const iri = CoreCurieCodec.decode("rdfs:label")
 * iri // => "http://www.w3.org/2000/01/rdf-schema#label"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const CoreCurieCodec = makeCurieCodec(CoreVocab);

/**
 * Build an Effect Schema codec that decodes CURIEs to IRIs and encodes IRIs to CURIEs.
 *
 * **Example** (Build Schema CURIE codec)
 *
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
    S.decodeTo(S.String, makeCurieTransformation(vocab)),
    $I.annoteSchema("CurieFromIri", {
      description: "Codec that decodes registered CURIEs to IRIs and encodes registered IRIs to CURIEs.",
    })
  );

/**
 * Core vocabulary CURIE-to-IRI Effect Schema codec.
 *
 * **Example** (Decode with CurieFromIri schema)
 *
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
export const CurieFromIri = CoreCurieSchema.pipe(
  S.decodeTo(CoreIriSchema, CoreCurieTransformation),
  $I.annoteSchema("CurieFromIri", {
    description: "Codec that decodes CoreVocab CURIEs to finite CoreVocab IRIs and encodes them back.",
  })
);

/**
 * {@inheritDoc CurieFromIri}
 * @category models
 * @since 0.0.0
 */
export type CurieFromIri = typeof CurieFromIri.Type;
