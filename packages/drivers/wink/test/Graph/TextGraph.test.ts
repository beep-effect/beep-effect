/**
 * Proofs for the TextGraph: construction, sentence/token graph building via the
 * Tokenization service, acyclicity enforcement, traversal, and queries.
 *
 * Effect v4 + `@effect/vitest` coverage for TextGraph tests.
 * Service-dependent tests run against the package's WinkTokenization layer.
 */

import { TextNode } from "@beep/nlp/Graph/Schema";
import * as TG from "@beep/nlp-processing/Graph/TextGraph";
import { provideScopedLayer } from "@beep/test-utils";
import { A } from "@beep/utils";
import { WinkTokenizationLive } from "@beep/wink";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Graph from "effect/Graph";

describe("TextGraph construction", () => {
  it.effect(
    "singleton builds a one-node graph",
    Effect.fnUntraced(function* () {
      const g = yield* TG.singleton("Hello world.", "document");
      expect(TG.nodeCount(g)).toBe(1);
      expect(TG.findNodesByType(g, "document")).toHaveLength(1);
    })
  );

  it.effect(
    "empty graph has no nodes",
    Effect.fnUntraced(function* () {
      expect(TG.nodeCount(TG.empty())).toBe(0);
    })
  );
});

describe("TextGraph acyclicity", () => {
  it.effect(
    "addChildren keeps the graph acyclic",
    Effect.fnUntraced(function* () {
      const g0 = yield* TG.singleton("doc", "document");
      const roots = TG.getRoots(g0);
      const child = TextNode.make({ text: "a sentence", type: "sentence", timestamp: 0 });
      const g1 = yield* TG.addChildren(g0, { parentIndex: roots[0]!, children: [child], relation: "contains" });
      expect(TG.nodeCount(g1)).toBe(2);
      expect(TG.isAcyclic(g1)).toBe(true);
      expect(TG.getChildren(g1, roots[0]!)).toHaveLength(1);
    })
  );
});

describe("TextGraph from document (service-backed)", () => {
  it.effect(
    "fromDocument creates a doc root with sentence children",
    Effect.fnUntraced(function* () {
      const g = yield* TG.fromDocument("Hello there. How are you?").pipe(provideScopedLayer(WinkTokenizationLive));
      expect(TG.findNodesByType(g, "document")).toHaveLength(1);
      const sentences = TG.findNodesByType(g, "sentence");
      expect(sentences.length).toBeGreaterThanOrEqual(2);
    })
  );

  it.effect(
    "tokenizeNodes is idempotent",
    Effect.fnUntraced(function* () {
      const g0 = yield* TG.fromDocument("Hello there.").pipe(provideScopedLayer(WinkTokenizationLive));
      const g1 = yield* TG.tokenizeNodes(g0).pipe(provideScopedLayer(WinkTokenizationLive));
      const tokensAfterFirst = TG.findNodesByType(g1, "token").length;
      expect(tokensAfterFirst).toBeGreaterThan(0);
      const g2 = yield* TG.tokenizeNodes(g1).pipe(provideScopedLayer(WinkTokenizationLive));
      expect(TG.findNodesByType(g2, "token").length).toBe(tokensAfterFirst);
    })
  );
});

describe("TextGraph traversal & queries", () => {
  it.effect(
    "getRoots / getLeaves reflect structure",
    Effect.fnUntraced(function* () {
      const g0 = yield* TG.singleton("doc", "document");
      const root = TG.getRoots(g0)[0]!;
      const child = TextNode.make({ text: "leaf", type: "sentence", timestamp: 0 });
      const g1 = yield* TG.addChildren(g0, { parentIndex: root, children: [child], relation: "contains" });
      expect(TG.getRoots(g1)).toHaveLength(1);
      expect(TG.getLeaves(g1).length).toBeGreaterThanOrEqual(1);
    })
  );

  it.effect(
    "topo walker yields all nodes",
    Effect.fnUntraced(function* () {
      const g0 = yield* TG.singleton("doc", "document");
      const root = TG.getRoots(g0)[0]!;
      const child = TextNode.make({ text: "s", type: "sentence", timestamp: 0 });
      const g1 = yield* TG.addChildren(g0, { parentIndex: root, children: [child], relation: "contains" });
      const indices = A.fromIterable(g1.pipe(TG.topo, Graph.indices));
      expect(indices).toHaveLength(2);
    })
  );
});
