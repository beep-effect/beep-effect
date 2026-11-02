/**
 * Exact structural scoring for the pinned, unique-span reference corpus.
 * Node identities use claim number, kind and exact source anchor, never path spelling.
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { ClaimElementEdge, ClaimFunctionalPart } from "@beep/law-practice-domain/values/ClaimElement";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import type { ClaimElementTree, ClaimTermRef } from "@beep/law-practice-domain/values/ClaimElement";
import type { TextAnchor } from "@beep/provenance/TextAnchor";

const $I = $LawPracticeServerId.create("test/evaluation/Structural");
const Count = S.Int.check(S.isGreaterThanOrEqualTo(0));
const json = S.encodeEffect(S.fromJsonString(S.Unknown));
const anchorKey = (anchor: TextAnchor) => Tuple.make(anchor.startChar, anchor.endChar, anchor.quote);

/** Measurement precondition failed; never silently score an arbitrary mapping. */
export class StructuralEvaluationError extends S.TaggedError<
  StructuralEvaluationError,
  { readonly brand: unique symbol }
>()(
  $I`StructuralEvaluationError`,
  { message: S.String },
  $I.annote("StructuralEvaluationError", {
    description: "The corpus does not admit the declared unique source-span node mapping.",
  })
) {}

/** One selected claim's exact result and diagnostic typed-edge counts. */
class StructuralClaimScore extends S.Opaque<StructuralClaimScore, { readonly brand: unique symbol }>()(
  S.Struct({
    claimNumber: S.Int.check(S.isGreaterThan(0)),
    strict: S.Boolean,
    predictionMissing: S.Boolean,
    goldElements: Count,
    predictedElements: Count,
    matchedElements: Count,
    goldEdges: Count,
    predictedEdges: Count,
    matchedEdges: Count,
  }).pipe(
    $I.annoteSchema("StructuralClaimScore", {
      description: "Exact node/term/typed-edge equality; edge counts are diagnostic only.",
    })
  )
) {}

class EvaluationNode extends S.Opaque<EvaluationNode, { readonly brand: unique symbol }>()(
  S.Struct({ path: S.String, key: S.String, terms: S.String, claimNumber: S.Int }).pipe(
    $I.annoteSchema("EvaluationNode", {
      description: "One source-identified node and its exact ordered term signature.",
    })
  )
) {}

const nodesOf = Effect.fn("Structural.nodes")(function* (trees: ReadonlyArray<ClaimElementTree>, side: string) {
  const nodes = yield* Effect.forEach(
    A.flatMap(trees, (tree) => A.map(tree.elements, (element) => ({ claimNumber: tree.claimNumber, element }))),
    ({ claimNumber, element }) =>
      Effect.gen(function* () {
        const key = yield* json([claimNumber, element.kind, anchorKey(element.anchor)]);
        const terms = yield* json(A.map(element.terms, (term) => [anchorKey(term.anchor), term.determiner, term.head]));
        return EvaluationNode.make({ path: element.path, key, terms, claimNumber });
      })
  );
  if (A.dedupe(A.map(nodes, (node) => node.key)).length !== nodes.length) {
    return yield* StructuralEvaluationError.make({
      message: `${side} has duplicate claim/kind/span node identities; a general isomorphism mapping is required.`,
    });
  }
  return nodes;
});

const edgeKeys = Effect.fn("Structural.edges")(function* (
  edges: ReadonlyArray<ClaimElementEdge>,
  index: HashMap.HashMap<string, string>,
  side: string
) {
  const node = (path: string) => O.getOrElse(HashMap.get(index, path), () => `${side}:unmapped:${path}`);
  const term = (ref: Pick<ClaimTermRef, "path" | "anchor">) => [node(ref.path), anchorKey(ref.anchor)];
  return yield* Effect.forEach(edges, (edge) =>
    Effect.gen(function* () {
      const endpoints = ClaimElementEdge.match(edge, {
        "part-of": (value) => [value.child, value.parent],
        "depends-on-element": (value) => [value.dependent, value.ancestor],
        antecedent: (value) => [value.referring.path, value.introducing.path],
        functional: (value) =>
          A.prepend(
            A.flatMap(value.parts, (part) =>
              ClaimFunctionalPart.match(part, { term: (value) => [value.term.path], text: () => [] })
            ),
            value.element
          ),
      });
      if (side === "reference" && A.some(endpoints, (path) => !HashMap.has(index, path))) {
        return yield* StructuralEvaluationError.make({
          message: "A reference edge has no labelled source node in the supplied family.",
        });
      }
      return yield* json(
        ClaimElementEdge.match(edge, {
          "part-of": (value) => [value.kind, node(value.child), node(value.parent)],
          "depends-on-element": (value) => [value.kind, node(value.dependent), node(value.ancestor)],
          antecedent: (value) => [value.kind, term(value.referring), term(value.introducing)],
          functional: (value) => [
            value.kind,
            node(value.element),
            A.map(value.parts, (part) =>
              ClaimFunctionalPart.match(part, {
                term: (value) => ["term", term(value.term)],
                text: (value) => ["text", anchorKey(value.anchor)],
              })
            ),
          ],
        })
      );
    })
  );
});

const intersectionCount = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): number =>
  A.reduce(
    A.dedupe(left),
    0,
    (sum, key) =>
      sum +
      N.min(A.length(A.filter(left, (value) => value === key)), A.length(A.filter(right, (value) => value === key)))
  );

/**
 * Score every reference claim under one family-wide exact source-node mapping.
 * Producer metadata, ordinal path spelling and edge array order are ignored.
 * Functional part order, edge direction/type, heads, determiners and spans are exact.
 * The frozen gold has no duplicate identity keys; ambiguity aborts measurement.
 */
export const compareStructuralFamily = Effect.fn("Structural.compareFamily")(function* (
  reference: ReadonlyArray<ClaimElementTree>,
  predicted: ReadonlyArray<ClaimElementTree>
) {
  const gold = yield* nodesOf(reference, "reference");
  const actual = yield* nodesOf(predicted, "prediction");
  const goldIndex = HashMap.fromIterable(A.map(gold, (node) => Tuple.make(node.path, node.key)));
  const actualIndex = HashMap.fromIterable(A.map(actual, (node) => Tuple.make(node.path, node.key)));
  return yield* Effect.forEach(reference, (tree) =>
    Effect.gen(function* () {
      const prediction = A.findFirst(predicted, (candidate) => candidate.claimNumber === tree.claimNumber);
      const goldNodes = A.filter(gold, (node) => node.claimNumber === tree.claimNumber);
      const actualNodes = A.filter(actual, (node) => node.claimNumber === tree.claimNumber);
      const matchedElements = A.length(
        A.filter(goldNodes, (node) =>
          A.some(actualNodes, (candidate) => node.key === candidate.key && node.terms === candidate.terms)
        )
      );
      const goldEdges = yield* edgeKeys(tree.edges, goldIndex, "reference");
      const actualEdges = yield* edgeKeys(
        O.match(prediction, { onNone: () => [], onSome: (value) => value.edges }),
        actualIndex,
        "prediction"
      );
      const matchedEdges = intersectionCount(goldEdges, actualEdges);
      return StructuralClaimScore.make({
        claimNumber: tree.claimNumber,
        predictionMissing: O.isNone(prediction),
        strict:
          O.isSome(prediction) &&
          matchedElements === goldNodes.length &&
          matchedElements === actualNodes.length &&
          matchedEdges === goldEdges.length &&
          matchedEdges === actualEdges.length,
        goldElements: goldNodes.length,
        predictedElements: actualNodes.length,
        matchedElements,
        goldEdges: goldEdges.length,
        predictedEdges: actualEdges.length,
        matchedEdges,
      });
    })
  );
});
