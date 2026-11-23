import { TermIri } from "@beep/identity/Term";
import {
  GufoClassType,
  GufoInstanceCategory,
  GufoTyping,
  MediationCardinality,
  TypedHierarchy,
} from "@beep/ontology/Gufo";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";

export const testTerms = A.makeBy(10, (index) => TermIri.make(`https://example.test/gufo/t${index}`));

const TermCount = S.Literals([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
const TermIndex = S.Literals([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

const untypedCompletion = (classType: GufoClassType) =>
  GufoTyping.make({ classType, instanceCategory: "Object", mediates: HashMap.empty() });

const hierarchyCase = (
  count: number,
  edges: ReadonlyArray<readonly [number, number]>,
  partial: ReadonlyArray<O.Option<GufoTyping>>,
  completions: ReadonlyArray<GufoClassType>
) => {
  const terms = A.take(testTerms, count);
  const specializes = HashMap.fromIterable(
    A.map(terms, (term, index) => [
      term,
      pipe(
        A.filter(edges, ([sub, sup]) => sub === index && sup < sub),
        A.map(([, sup]) => testTerms[sup] ?? term),
        HashSet.fromIterable
      ),
    ])
  );
  const typed = A.zip(terms, A.zip(partial, completions));
  const hierarchy = TypedHierarchy.make({
    typing: HashMap.fromIterable(
      A.flatMap(typed, ([term, [typing]]) => O.match(typing, { onNone: A.empty, onSome: (value) => [[term, value]] }))
    ),
    specializes,
  });
  const completion = TypedHierarchy.make({
    typing: HashMap.fromIterable(
      A.map(typed, ([term, [typing, classType]]) => [term, O.getOrElse(typing, () => untypedCompletion(classType))])
    ),
    specializes,
  });
  return { terms, hierarchy, completion };
};

const typingArbitrary = Arbitrary.all({
  present: Arbitrary.schema(S.Boolean),
  classType: Arbitrary.schema(GufoClassType),
  instanceCategory: Arbitrary.schema(GufoInstanceCategory),
  mediated: Arbitrary.array(Arbitrary.all([Arbitrary.schema(TermIndex), Arbitrary.schema(MediationCardinality)]), {
    minLength: 1,
    maxLength: 3,
  }),
}).pipe(
  Arbitrary.map(({ present, classType, instanceCategory, mediated }) =>
    present
      ? GufoTyping.makeOption({
          classType,
          instanceCategory,
          mediates: GufoInstanceCategory.match(instanceCategory, {
            Relator: () =>
              HashMap.fromIterable(
                A.map(mediated, ([index, cardinality]) => [testTerms[index] ?? testTerms[0], cardinality])
              ),
            Object: HashMap.empty,
            Event: HashMap.empty,
            Quality: HashMap.empty,
          }),
        })
      : O.none()
  )
);

export const typedHierarchyArbitrary = Arbitrary.all({
  count: Arbitrary.schema(TermCount),
  edges: Arbitrary.array(Arbitrary.all([Arbitrary.schema(TermIndex), Arbitrary.schema(TermIndex)]), {
    maxLength: 20,
  }),
  partial: Arbitrary.array(typingArbitrary, { minLength: 10, maxLength: 10 }),
  completions: Arbitrary.array(Arbitrary.schema(GufoClassType), { minLength: 10, maxLength: 10 }),
}).pipe(Arbitrary.map(({ count, edges, partial, completions }) => hierarchyCase(count, edges, partial, completions)));
