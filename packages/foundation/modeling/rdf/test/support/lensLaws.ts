import { canonicalDigest } from "@beep/rdf/Canonical";
import { makeDataset, makeLiteral, makeNamedNode, Quad, serializeQuad } from "@beep/rdf/Rdf";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import type { Dataset } from "@beep/rdf/Rdf";

const extraPredicate = makeNamedNode("https://absent.example.test/extra");

const byLine: Order.Order<Quad> = Order.mapInput(Order.String, serializeQuad);

const withQuad = (quads: ReadonlyArray<Quad>, added: Quad): Dataset => makeDataset(A.append(quads, added));

const perturbations = (view: Dataset): ReadonlyArray<Dataset> => {
  const quads = A.sort(A.fromIterable(view.quads), byLine);
  return A.flatMap(quads, (quad) => [
    makeDataset(A.filter(quads, (kept) => kept !== quad)),
    withQuad(
      quads,
      Quad.make({ subject: quad.subject, predicate: extraPredicate, object: makeLiteral("extra"), graph: quad.graph })
    ),
    withQuad(
      quads,
      Quad.make({ subject: quad.subject, predicate: quad.predicate, object: makeLiteral("second"), graph: quad.graph })
    ),
  ]);
};

export const checkPartialLens = Effect.fnUntraced(function* <S, Omitted, E, R>(
  lens: {
    readonly get: (source: S) => Effect.Effect<Dataset, E, R>;
    readonly put: (omitted: Omitted) => (view: Dataset) => Effect.Effect<S, E, R>;
    readonly omitted: (source: S) => Omitted;
    readonly quotient: (left: S, right: S) => boolean;
  },
  source: S,
  other: S
) {
  const view = yield* lens.get(source);
  const again = yield* lens.get(source);
  expect(Equal.equals(view, again)).toBe(true);
  const viewDigest = yield* canonicalDigest(view);
  const againDigest = yield* canonicalDigest(again);
  expect(viewDigest).toBe(againDigest);

  const put = lens.put(lens.omitted(source));
  const restored = yield* put(view);
  expect(lens.quotient(restored, source)).toBe(true);

  const otherView = yield* lens.get(other);
  const candidates = [view, otherView, ...perturbations(view)];
  const outcomes = yield* Effect.forEach(candidates, (candidate) => Effect.result(put(candidate)), { concurrency: 1 });
  const accepted = yield* Effect.forEach(
    A.zip(candidates, outcomes),
    ([candidate, outcome]) =>
      Result.isSuccess(outcome)
        ? Effect.map(lens.get(outcome.success), (reprojected) => {
            expect(Equal.equals(reprojected, candidate)).toBe(true);
            return 1;
          })
        : Effect.succeed(0),
    { concurrency: 1 }
  );
  return { candidates: candidates.length, accepted: A.reduce(accepted, 0, (total, count) => total + count) };
});
