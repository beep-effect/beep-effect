import { assertSome } from "@effect/vitest/utils";
import * as O from "effect/Option";
/**
 * Proofs for the GraphOperations Catalog: the backend-backed linguistic operations
 * (sentencize/tokenize/posTag/lemmatize/extractEntities) produce child nodes when
 * applied to a node, and the pure string operations (toLowerCase/toUpperCase/trim)
 * transform node data. Backend-backed ops run against the real wink-nlp model.
 */

import * as EG from "@beep/nlp-processing/Graph/EffectGraph";
import { Catalog } from "@beep/nlp-processing/Graph/GraphOperations";
import * as WinkEngine from "@beep/wink";
import { WinkBackendLive } from "@beep/wink";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const BackendLayer = Layer.provide(WinkBackendLive, WinkEngine.WinkEngineLive);

describe("Catalog backend-backed operations", () => {
  it.layer(BackendLayer)("sentencize produces a child node per sentence", (it) => {
    it.effect(
      "sentencize produces a child node per sentence",
      Effect.fnUntraced(function* () {
        const root = yield* EG.makeNode("Hello world. How are you?");
        const children = yield* Catalog.sentencize.apply(root);
        expect(children.length).toBe(2);
        expect(children.every((c) => typeof c.data === "string")).toBe(true);
      })
    );
  });

  it.layer(BackendLayer)("tokenize produces a child node per token", (it) => {
    it.effect(
      "tokenize produces a child node per token",
      Effect.fnUntraced(function* () {
        const root = yield* EG.makeNode("dogs run fast");
        const children = yield* Catalog.tokenize.apply(root);
        expect(children.length).toBeGreaterThanOrEqual(3);
      })
    );
  });

  it.layer(BackendLayer)("posTag produces POS annotation nodes", (it) => {
    it.effect(
      "posTag produces POS annotation nodes",
      Effect.fnUntraced(function* () {
        const root = yield* EG.makeNode("dogs run");
        const children = yield* Catalog.posTag.apply(root);
        expect(children.length).toBe(2);
        expect(typeof children[0]?.data.tag).toBe("string");
      })
    );
  });

  it.layer(BackendLayer)("lemmatize produces lemma annotation nodes", (it) => {
    it.effect(
      "lemmatize produces lemma annotation nodes",
      Effect.fnUntraced(function* () {
        const root = yield* EG.makeNode("running dogs");
        const children = yield* Catalog.lemmatize.apply(root);
        expect(children.length).toBe(2);
        expect(typeof children[0]?.data.lemma).toBe("string");
      })
    );
  });

  it.layer(BackendLayer)("each backend op records its operation name on the produced nodes", (it) => {
    it.effect(
      "each backend op records its operation name on the produced nodes",
      Effect.fnUntraced(function* () {
        const root = yield* EG.makeNode("hello world");
        const children = yield* Catalog.tokenize.apply(root);
        const first = children[0];
        assertSome(first?.metadata.operation ?? O.none(), "tokenize");
      })
    );
  });
});

describe("Catalog pure operations", () => {
  it.effect(
    "toLowerCase transforms node data",
    Effect.fnUntraced(function* () {
      const root = yield* EG.makeNode("HELLO");
      const [child] = yield* Catalog.toLowerCase.apply(root);
      expect(child?.data).toBe("hello");
    })
  );

  it.effect(
    "toUpperCase transforms node data",
    Effect.fnUntraced(function* () {
      const root = yield* EG.makeNode("hello");
      const [child] = yield* Catalog.toUpperCase.apply(root);
      expect(child?.data).toBe("HELLO");
    })
  );

  it.effect(
    "trim removes surrounding whitespace",
    Effect.fnUntraced(function* () {
      const root = yield* EG.makeNode("  spaced  ");
      const [child] = yield* Catalog.trim.apply(root);
      expect(child?.data).toBe("spaced");
    })
  );

  it("getOperationNames lists the catalog entries", () => {
    const names = Catalog.getOperationNames();
    expect(names).toContain("tokenize");
    expect(names).toContain("posTag");
    expect(names).toContain("toLowerCase");
  });
});
