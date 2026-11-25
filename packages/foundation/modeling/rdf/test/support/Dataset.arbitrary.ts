import { BlankNode, makeDataset, Quad } from "@beep/rdf/Rdf";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { Dataset, GraphTerm, ObjectTerm, Subject } from "@beep/rdf/Rdf";

const blankPool = ["x0", "x1", "x2", "x3"];

const poolIndex = Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: 3 })));

const poolLabel = (index: number): string => O.getOrElse(A.get(blankPool, index), () => "x0");

const intoPool = <T extends Subject | ObjectTerm | GraphTerm>(term: T, index: number): T =>
  term.termType === "BlankNode" ? (BlankNode.make({ termType: "BlankNode", value: poolLabel(index) }) as T) : term;

const pooledQuad = Arbitrary.map(
  Arbitrary.all([Arbitrary.schema(Quad), poolIndex, poolIndex, poolIndex]),
  ([quad, subject, object, graph]) =>
    Quad.make({
      subject: intoPool(quad.subject, subject),
      predicate: quad.predicate,
      object: intoPool(quad.object, object),
      graph: intoPool(quad.graph, graph),
    })
);

export const dataset: Arbitrary.Arbitrary<Dataset> = Arbitrary.map(
  Arbitrary.array(pooledQuad, { maxLength: 12 }),
  makeDataset
);

export const nonEmptyDataset: Arbitrary.Arbitrary<Dataset> = Arbitrary.map(
  Arbitrary.array(pooledQuad, { minLength: 1, maxLength: 12 }),
  makeDataset
);

const blankEdge = Arbitrary.map(
  Arbitrary.all([Arbitrary.schema(Quad), poolIndex, poolIndex]),
  ([quad, subject, object]) =>
    Quad.make({
      subject: BlankNode.make({ termType: "BlankNode", value: poolLabel(subject) }),
      predicate: quad.predicate,
      object: BlankNode.make({ termType: "BlankNode", value: poolLabel(object) }),
      graph: intoPool(quad.graph, subject),
    })
);

export const datasetWithBlankEdge: Arbitrary.Arbitrary<Dataset> = Arbitrary.map(
  Arbitrary.all([blankEdge, Arbitrary.array(pooledQuad, { maxLength: 11 })]),
  ([edge, rest]) => makeDataset(A.prepend(rest, edge))
);

const relabelWith = (labels: HashMap.HashMap<string, string>) => {
  const rename = <T extends Subject | ObjectTerm | GraphTerm>(term: T): T =>
    term.termType === "BlankNode"
      ? (BlankNode.make({
          termType: "BlankNode",
          value: O.getOrElse(HashMap.get(labels, term.value), () => term.value),
        }) as T)
      : term;
  return (target: Dataset): Dataset =>
    target.quads.pipe(
      A.fromIterable,
      A.map((quad) =>
        Quad.make({
          subject: rename(quad.subject),
          predicate: quad.predicate,
          object: rename(quad.object),
          graph: rename(quad.graph),
        })
      ),
      makeDataset
    );
};

const permutations = (items: ReadonlyArray<string>): ReadonlyArray<ReadonlyArray<string>> =>
  A.match(items, {
    onEmpty: () => [[]],
    onNonEmpty: () =>
      A.flatMap(items, (item, index) => A.map(permutations(A.remove(items, index)), (rest) => A.prepend(rest, item))),
  });

const poolPermutations = permutations(blankPool);

export const relabelledCase: Arbitrary.Arbitrary<{ readonly original: Dataset; readonly relabelled: Dataset }> =
  Arbitrary.flatMap(dataset, (original) =>
    Arbitrary.map(
      Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: poolPermutations.length - 1 }))),
      (choice) => {
        const target = O.getOrElse(A.get(poolPermutations, choice), () => blankPool);
        const labels = HashMap.fromIterable(A.zip(blankPool, target));
        return { original, relabelled: relabelWith(labels)(original) };
      }
    )
  );
