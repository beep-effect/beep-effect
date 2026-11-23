import {
  CanonicalizationLimitExceeded,
  CanonicalWorkBound,
  canonicalDigest,
  canonicalize,
  isIsomorphic,
} from "@beep/rdf/Canonical";
import { Dataset, makeBlankNode, makeDataset, makeNamedNode, makeQuad, Quad, serializeQuad } from "@beep/rdf/Rdf";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { expect } from "@effect/vitest";
import { assertEquals } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { dataset, datasetWithBlankEdge, nonEmptyDataset, relabelledCase } from "./support/Dataset.arbitrary.ts";

const L61 = "L6-1 dataset equality is up to blank-node isomorphism and the digest is on the canonical form";

const runs = { arbitrary: fcRuns(100) };

const p = makeNamedNode("https://example.test/p");

const edges = (pairs: ReadonlyArray<readonly [string, string]>): Dataset =>
  makeDataset(A.map(pairs, ([from, to]) => makeQuad(makeBlankNode(from), p, makeBlankNode(to))));

const cycle = (labels: ReadonlyArray<string>): ReadonlyArray<readonly [string, string]> =>
  A.map(
    labels,
    (label, index) => [label, O.getOrElse(A.get(labels, (index + 1) % labels.length), () => label)] as const
  );

const clique = (size: number): Dataset => {
  const labels = A.map(A.range(0, size - 1), (index) => `k${index}`);
  return edges(
    A.flatMap(labels, (from) =>
      A.map(
        A.filter(labels, (to) => to !== from),
        (to) => [from, to] as const
      )
    )
  );
};

const reversed = (target: Dataset): Dataset => target.quads.pipe(A.fromIterable, A.reverse, makeDataset);

const blankDegrees = (target: Dataset): ReadonlyArray<string> => {
  const quads = A.fromIterable(target.quads);
  const labels = A.dedupe(
    A.flatMap(quads, (quad) =>
      A.getSomes([
        quad.subject.termType === "BlankNode" ? O.some(quad.subject.value) : O.none(),
        quad.object.termType === "BlankNode" ? O.some(quad.object.value) : O.none(),
      ])
    )
  );
  return A.sort(
    A.map(labels, (label) => {
      const out = A.filter(quads, (quad) => quad.subject.termType === "BlankNode" && quad.subject.value === label);
      const into = A.filter(quads, (quad) => quad.object.termType === "BlankNode" && quad.object.value === label);
      return `${into.length}/${out.length}`;
    }),
    Order.String
  );
};

const isBlankEdge = (quad: Quad): boolean =>
  quad.subject.termType === "BlankNode" && quad.object.termType === "BlankNode";

const blankEdgesOf = (quads: ReadonlyArray<Quad>): Array<Quad> => A.filter(quads, (quad: Quad) => isBlankEdge(quad));

const rewirings = (target: Dataset): ReadonlyArray<Dataset> => {
  const quads = A.fromIterable(target.quads);
  const labels = A.dedupe(A.flatMap(blankEdgesOf(quads), (quad) => [quad.subject.value, quad.object.value]));
  return A.flatMap(blankEdgesOf(quads), (edge) =>
    A.map(
      A.filter(labels, (label) => label !== edge.object.value),
      (label) =>
        makeDataset(
          A.append(
            A.filter(quads, (quad) => quad !== edge),
            Quad.make({
              subject: edge.subject,
              predicate: edge.predicate,
              object: makeBlankNode(label),
              graph: edge.graph,
            })
          )
        )
    )
  );
};

const structuralChange = (target: Dataset): O.Option<Dataset> =>
  A.findFirst(
    rewirings(target),
    (candidate) => A.join(blankDegrees(candidate), ",") !== A.join(blankDegrees(target), ",")
  );

const separated = Effect.fn("separated")(function* (left: Dataset, right: Dataset) {
  const isomorphic = yield* isIsomorphic(left, right);
  const leftDigest = yield* canonicalDigest(left);
  const rightDigest = yield* canonicalDigest(right);
  expect(isomorphic).toBe(false);
  expect(leftDigest).not.toBe(rightDigest);
});

it.layer(Digest.layerWebCrypto, { timeout: "120 seconds" })(L61, (it) => {
  it.effect.prop(
    `${L61}: invariance under relabelling and listing order`,
    [relabelledCase],
    ([{ original, relabelled }]) =>
      Effect.gen(function* () {
        const relabelledDigest = yield* canonicalDigest(reversed(relabelled));
        const originalDigest = yield* canonicalDigest(original);
        const isomorphic = yield* isIsomorphic(original, relabelled);
        expect(relabelledDigest).toBe(originalDigest);
        expect(isomorphic).toBe(true);
      }),
    runs
  );

  it.effect.prop(
    `${L61}: replacing one IRI separates the datasets`,
    [nonEmptyDataset],
    ([target]) =>
      Effect.gen(function* () {
        const quads = A.fromIterable(target.quads);
        const first = O.getOrThrow(A.head(quads));
        const rest = A.drop(quads, 1);
        const changed = Quad.make({
          subject: first.subject,
          predicate: makeNamedNode("https://absent.example.test/replaced"),
          object: first.object,
          graph: first.graph,
        });
        yield* separated(target, makeDataset(A.append(rest, changed)));
      }),
    runs
  );

  it.effect.prop(
    `${L61}: rewiring a blank-to-blank edge separates the datasets`,
    [datasetWithBlankEdge],
    ([target]) =>
      Effect.gen(function* () {
        const changed = structuralChange(target);
        if (O.isSome(changed)) {
          yield* separated(target, changed.value);
        }
      }),
    runs
  );

  it.effect(`${L61}: two 2-cycles and a 4-cycle are separated`, () =>
    separated(edges([...cycle(["a", "b"]), ...cycle(["c", "d"])]), edges(cycle(["a", "b", "c", "d"])))
  );

  it.effect(`${L61}: two directed triangles and a directed hexagon are separated`, () =>
    separated(
      edges([...cycle(["a", "b", "c"]), ...cycle(["d", "e", "f"])]),
      edges(cycle(["a", "b", "c", "d", "e", "f"]))
    )
  );

  it.effect.prop(
    `${L61}: the encoding is deduplicated, sorted and decodes to an equal dataset`,
    [dataset],
    ([target]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(Dataset)(target);
        const decoded = yield* S.decodeEffect(Dataset)(encoded);
        assertEquals(decoded, target);
        const decodedQuads = yield* Effect.forEach(encoded.quads, (quad) => S.decodeEffect(Quad)(quad), {
          concurrency: 1,
        });
        const lines = A.map(decodedQuads, serializeQuad);
        expect(lines).toStrictEqual(A.dedupe(A.sort(lines, Order.String)));
        expect(lines.length).toBe(HashSet.size(target.quads));
      }),
    runs
  );

  it.effect.prop(
    `${L61}: the digest is the SHA-256 of the canonical N-Quads`,
    [dataset],
    ([target]) =>
      Effect.gen(function* () {
        const form = yield* canonicalize(target);
        const crypto = yield* Digest.Digest;
        const bytes = yield* crypto.digest(Digest.sha256, new TextEncoder().encode(form.nquads));
        const digest = yield* canonicalDigest(target);
        expect(digest).toBe(`sha256:${Hex.encode(bytes)}`);
      }),
    runs
  );

  it.effect(`${L61}: K4 is within the bound and K6 is refused the same way twice`, () =>
    Effect.gen(function* () {
      const k4 = yield* canonicalize(clique(4));
      expect(HashSet.size(k4.dataset.quads)).toBe(12);
      const refusals = yield* Effect.all([Effect.flip(canonicalize(clique(6))), Effect.flip(canonicalize(clique(6)))], {
        concurrency: 1,
      });
      const expected = CanonicalizationLimitExceeded.make({
        limit: CanonicalWorkBound,
        reached: CanonicalWorkBound + 1,
      });
      expect(refusals).toStrictEqual([expected, expected]);
    })
  );

  it.effect.prop(
    `${L61}: the bound does not depend on blank-node labels`,
    [relabelledCase],
    ([{ original, relabelled }]) =>
      Effect.gen(function* () {
        const [left, right] = yield* Effect.all(
          [Effect.result(canonicalize(original)), Effect.result(canonicalize(relabelled))],
          { concurrency: 1 }
        );
        expect(Result.isFailure(left)).toBe(Result.isFailure(right));
      }),
    runs
  );

  it.effect(`${L61}: ground datasets compare with Equal`, () =>
    Effect.gen(function* () {
      const ground = makeDataset([
        makeQuad(makeNamedNode("https://example.test/s"), p, makeNamedNode("https://example.test/o")),
      ]);
      const sameListing = yield* isIsomorphic(ground, reversed(ground));
      const againstEmpty = yield* isIsomorphic(ground, makeDataset([]));
      expect(sameListing).toBe(true);
      expect(againstEmpty).toBe(false);
    })
  );
});
