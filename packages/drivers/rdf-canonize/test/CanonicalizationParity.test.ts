import { CanonicalWorkBound, canonicalize } from "@beep/rdf/Canonical";
import { Literal, MakeQuadOptionsInput, makeBlankNode, makeDataset, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { CanonicalizationServiceLive } from "@beep/rdf-canonize/adapters/canonicalization";
import { CanonicalizationService, CanonicalizeDatasetRequest } from "@beep/semantic-web/services/canonicalization";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as O from "@beep/utils/Option";
import { expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { canonize } from "rdf-canonize";
import type { Dataset, GraphTerm, ObjectTerm, Quad, Subject } from "@beep/rdf/Rdf";
import type { CanonizeGraph, CanonizeObject, CanonizeQuad, CanonizeSubject } from "rdf-canonize";

const index = (size: number) => Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: size - 1 })));

const pick = <A>(items: ReadonlyArray<A>, at: number): A => O.getOrThrow(A.get(items, at));

const iris = A.map(["s", "p", "q", "o", "g"], (name) => makeNamedNode(`https://example.test/${name}`));
const blanks = A.map(["x0", "x1", "x2", "x3"], makeBlankNode);
const literals = [
  makeLiteral("plain"),
  Literal.typed("1", "http://www.w3.org/2001/XMLSchema#integer"),
  Literal.langTagged("hello", "en-gb"),
  makeLiteral('tab\tquote"backslash\\'),
  makeLiteral("\u00e9\u4e2d"),
];

function makeLiteral(value: string): Literal {
  return Result.getOrThrow(Literal.fromParts({ value, datatype: "http://www.w3.org/2001/XMLSchema#string" }));
}

const subjects: ReadonlyArray<Subject> = [...A.take(iris, 1), ...blanks];
const predicates = A.take(A.drop(iris, 1), 2);
const objects: ReadonlyArray<ObjectTerm> = [...A.drop(iris, 3), ...blanks, ...literals];
const graphs: ReadonlyArray<GraphTerm | undefined> = [undefined, undefined, ...A.drop(iris, 4), ...blanks];

const quad = Arbitrary.map(
  Arbitrary.all([index(subjects.length), index(predicates.length), index(objects.length), index(graphs.length)]),
  ([subject, predicate, object, graph]): Quad => {
    const graphTerm = pick(graphs, graph);
    return makeQuad(
      pick(subjects, subject),
      pick(predicates, predicate),
      graphTerm === undefined
        ? MakeQuadOptionsInput.make({ object: pick(objects, object) })
        : MakeQuadOptionsInput.make({ object: pick(objects, object), graph: graphTerm })
    );
  }
);

const dataset = Arbitrary.map(Arbitrary.array(quad, { maxLength: 12 }), makeDataset);

const toNode = (term: Subject): CanonizeSubject =>
  term.termType === "NamedNode"
    ? { termType: "NamedNode", value: term.value }
    : { termType: "BlankNode", value: term.value };

const toObject = (term: ObjectTerm): CanonizeObject =>
  term.termType === "Literal"
    ? {
        termType: "Literal",
        value: term.value,
        datatype: { termType: "NamedNode", value: Literal.datatypeOf(term).value },
        ...O.getSomesStruct({ language: Literal.languageOf(term) }),
      }
    : toNode(term);

const toGraph = (term: GraphTerm): CanonizeGraph =>
  term.termType === "DefaultGraph" ? { termType: "DefaultGraph", value: "" } : toNode(term);

const toCanonize = (target: Dataset): ReadonlyArray<CanonizeQuad> =>
  A.map(
    A.fromIterable(target.quads),
    (entry): CanonizeQuad => ({
      subject: toNode(entry.subject),
      predicate: { termType: "NamedNode", value: entry.predicate.value },
      object: toObject(entry.object),
      graph: toGraph(entry.graph),
    })
  );

const oracle = (target: Dataset) =>
  Effect.tryPromise({
    try: () => canonize(toCanonize(target), { algorithm: "RDFC-1.0", maxDeepIterations: CanonicalWorkBound }),
    catch: (cause) => String(cause),
  }).pipe(Effect.result);

it.layer(Layer.mergeAll(CanonicalizationServiceLive, Digest.layerWebCrypto), { timeout: "60 seconds" })(
  "RDFC-1.0 port parity with rdf-canonize",
  (it) => {
    it.effect.prop(
      "the port and rdf-canonize agree byte for byte, refusals included",
      [dataset],
      ([target]) =>
        Effect.gen(function* () {
          const expected = yield* oracle(target);
          const actual = yield* Effect.result(canonicalize(target));
          expect(Result.isSuccess(actual)).toBe(Result.isSuccess(expected));
          if (Result.isSuccess(actual) && Result.isSuccess(expected)) {
            expect(actual.success.nquads).toBe(expected.success);
            const service = yield* CanonicalizationService;
            const result = yield* service.canonicalize(
              CanonicalizeDatasetRequest.make({ algorithm: "rdfc-1.0", dataset: target })
            );
            expect(result.canonicalText).toBe(Str.trimEnd(actual.success.nquads));
            expect(result.dataset).toStrictEqual(actual.success.dataset);
          }
        }),
      { arbitrary: fcRuns(200) }
    );
  }
);
