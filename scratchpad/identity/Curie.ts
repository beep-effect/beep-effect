import { Effect, pipe, SchemaIssue, SchemaTransformation } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CoreVocab, type Curie, type Expand, type Predicate, type VocabShape } from "./Vocab.ts";

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

const schemaIssue = (value: string, message: string) =>
  new SchemaIssue.InvalidValue(O.some(value), { message });

export function expand<const C extends Curie<typeof CoreVocab>>(curie: C): Expand<C, typeof CoreVocab>;
export function expand<const V extends VocabShape, const C extends Curie<V>>(curie: C, vocab: V): Expand<C, V>;
export function expand(curie: string): string | undefined;
export function expand(curie: string, vocab: VocabShape): string | undefined;
export function expand(curie: string, vocab: VocabShape = CoreVocab): string | undefined {
  return pipe(expandOption(curie, vocab), O.getOrUndefined);
}

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

export const makeCurieCodec = <const V extends VocabShape>(vocab: V) => ({
  decode: <const C extends Curie<V>>(curie: C): Expand<C, V> => expand(curie, vocab),
  encode: <const I extends Expand<Curie<V>, V>>(iri: I): Contract<I, V> => contract(iri, vocab),
});

export const CoreCurieCodec = makeCurieCodec(CoreVocab);

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
    )
  );

export const CurieFromIri = makeCurieFromIri(CoreVocab);
export type CurieFromIri = typeof CurieFromIri.Type;
