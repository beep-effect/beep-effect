import {
  ClaimElementTree,
  ClaimInputCollection,
  ClaimInputRecord,
  decomposeClaim,
  decomposeClaimInput,
} from "@beep/law-practice-domain/values/ClaimElement";
import { normalizePatentClaims } from "@beep/law-practice-domain/values/PatentDocument";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { assert, describe } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const inspect = Effect.fn("ColonScopeTest.inspect")(function* (texts: A.NonEmptyReadonlyArray<string>) {
  const input = ClaimInputCollection.make({
    sourceKey: "synthetic-colon-scope",
    records: A.map(texts, (canonicalText, index) =>
      ClaimInputRecord.cases.text.make({
        sourceOrdinal: index + 1,
        numberText: O.some(`${index + 1}`),
        sourceText: canonicalText,
        canonicalText,
      })
    ),
  });
  const outcomes = yield* decomposeClaimInput(input);
  assert.isTrue(A.every(outcomes, ({ status }) => status === "decomposed"));
  const trees = A.getSomes(
    A.map(outcomes, (outcome) => (outcome.status === "decomposed" ? O.some(outcome.tree) : O.none()))
  );
  assert.isTrue(A.every(trees, S.is(ClaimElementTree)));
  return trees;
});
const treeOf = Effect.fn("ColonScopeTest.treeOf")(function* (text: string) {
  const trees = yield* inspect([text]);
  return O.getOrThrow(A.head(trees));
});
const containment = (tree: ClaimElementTree) =>
  A.flatMap(tree.edges, (edge) => (edge.kind === "part-of" ? [[edge.child, edge.parent]] : []));
const atPath = (tree: ClaimElementTree, path: string) =>
  O.getOrThrow(A.findFirst(tree.elements, (element) => element.path === path));

describe("source-input colon scope", () => {
  it.effect("retains the full container extent with header-only lexical ownership", () =>
    Effect.gen(function* () {
      const body = "a housing including: a panel; a sensor coupled to the panel";
      const tree = yield* treeOf(`A fixture comprising ${body}.`);
      const parent = atPath(tree, "1.a");
      assert.strictEqual(parent.anchor.quote, body);
      assert.strictEqual(parent.kind, "limitation");
      assert.deepStrictEqual(
        A.map(parent.terms, (term) => term.anchor.quote),
        ["a housing"]
      );
      assert.deepStrictEqual(containment(tree), [
        ["1.a", "1"],
        ["1.a.i", "1.a"],
        ["1.a.ii", "1.a"],
      ]);
      assert.strictEqual(
        A.countBy(
          A.flatMap(tree.elements, (element) => element.terms),
          (term) => term.anchor.quote === "a panel"
        ),
        1
      );
      assert.isTrue(
        A.some(
          tree.edges,
          (edge) => edge.kind === "antecedent" && edge.introducing.path === "1.a.i" && edge.referring.path === "1.a.ii"
        )
      );
      assert.isFalse(A.some(tree.edges, (edge) => edge.kind === "functional" && edge.element === "1.a"));
    })
  );

  it.effect("returns through explicit nested label levels to peer containers and root siblings", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf(
        "A fixture comprising (a) a housing including: (i) a module including: (1) a panel; (2) a sensor; (ii) a relay; and (b) a controller."
      );
      assert.deepStrictEqual(containment(tree), [
        ["1.a", "1"],
        ["1.a.i", "1.a"],
        ["1.a.i.i", "1.a.i"],
        ["1.a.i.ii", "1.a.i"],
        ["1.a.ii", "1.a"],
        ["1.b", "1"],
      ]);
      assert.strictEqual(atPath(tree, "1.a.i").anchor.quote, "(i) a module including: (1) a panel; (2) a sensor");
      assert.strictEqual(
        atPath(tree, "1.a").anchor.quote,
        "(a) a housing including: (i) a module including: (1) a panel; (2) a sensor; (ii) a relay"
      );
      assert.strictEqual(atPath(tree, "1.b").anchor.quote, "(b) a controller");
    })
  );

  it.effect("recognizes consecutive source labels without a fixed roman range", () =>
    Effect.gen(function* () {
      for (const body of [
        "a) a housing including: i) a panel; ii) a sensor; and b) a controller",
        "(1) a housing including: (i) a panel; (ii) a sensor; and (2) a controller",
        "(h) a housing including: (1) a panel; (2) a sensor; and (i) a controller",
        "(cxlv) a housing including: (1) a panel; (2) a sensor; and (cxlvi) a controller",
      ]) {
        const tree = yield* treeOf(`A fixture comprising ${body}.`);
        assert.deepStrictEqual(containment(tree), [
          ["1.a", "1"],
          ["1.a.i", "1.a"],
          ["1.a.ii", "1.a"],
          ["1.b", "1"],
        ]);
      }
    })
  );

  it.effect("opens a second explicitly labelled peer group without absorbing it into the first", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf(
        "A fixture comprising (a) a housing including: (i) a panel; and (b) a controller including: (i) a register; (ii) a bus."
      );
      assert.deepStrictEqual(containment(tree), [
        ["1.a", "1"],
        ["1.a.i", "1.a"],
        ["1.b", "1"],
        ["1.b.i", "1.b"],
        ["1.b.ii", "1.b"],
      ]);
      assert.strictEqual(atPath(tree, "1.b").anchor.quote, "(b) a controller including: (i) a register; (ii) a bus");
    })
  );

  it.effect("keeps ambiguous unlabelled list continuations under their existing container", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf("A fixture comprising a housing including: a panel; and a controller.");
      assert.deepStrictEqual(containment(tree), [
        ["1.a", "1"],
        ["1.a.i", "1.a"],
        ["1.a.ii", "1.a"],
      ]);
      assert.strictEqual(atPath(tree, "1.a.ii").anchor.quote, "a controller");
    })
  );

  it.effect("does not infer a peer return from skipped, mixed-style or competing child labels", () =>
    Effect.gen(function* () {
      for (const body of [
        "(a) a housing including: (i) a panel; (d) a controller",
        "(a) a housing including: (i) a panel; b) a controller",
        "(a) a housing including: (a) a panel; (b) a controller",
      ]) {
        const tree = yield* treeOf(`A fixture comprising ${body}.`);
        assert.deepStrictEqual(containment(tree), [
          ["1.a", "1"],
          ["1.a.i", "1.a"],
          ["1.a.ii", "1.a"],
        ]);
      }
    })
  );

  it.effect("retains nested ownership when multiple active headers match the same peer label", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf(
        "A fixture comprising (a) a housing including: (i) a panel; (a) a module including: (1) a sensor; (b) a relay."
      );
      assert.deepStrictEqual(containment(tree), [
        ["1.a", "1"],
        ["1.a.i", "1.a"],
        ["1.a.ii", "1.a"],
        ["1.a.ii.i", "1.a.ii"],
        ["1.a.ii.ii", "1.a.ii"],
      ]);
      assert.strictEqual(atPath(tree, "1.a.ii.ii").anchor.quote, "(b) a relay");
      assert.strictEqual(atPath(tree, "1.a.ii").anchor.quote, "(a) a module including: (1) a sensor; (b) a relay");
      assert.isFalse(A.some(tree.elements, (element) => element.path === "1.b"));
    })
  );

  it.effect("treats explicit method frames as transparent while preserving a later root clause", () =>
    Effect.gen(function* () {
      for (const frame of [
        "it comprises the following steps",
        "the method includes the following steps",
        "said method has the following steps",
      ]) {
        const tree = yield* treeOf(
          `A method characterized in that ${frame}: Step 1, receiving a signal; Step 2, storing the signal; wherein the signal is binary.`
        );
        assert.deepStrictEqual(
          A.map(tree.elements, (element) => element.path),
          ["1", "1.a", "1.b", "1.c"]
        );
        assert.strictEqual(atPath(tree, "1.a").anchor.quote, "Step 1, receiving a signal");
        assert.strictEqual(atPath(tree, "1.c").anchor.quote, "the signal is binary");
        assert.isTrue(A.every(containment(tree), ([, parent]) => parent === "1"));
      }
    })
  );

  it.effect("preserves a nominal container whose name contains method-frame words", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf("A fixture comprising a following steps indicator including: a panel; a sensor.");
      assert.strictEqual(atPath(tree, "1.a").anchor.quote, "a following steps indicator including: a panel; a sensor");
      assert.deepStrictEqual(containment(tree), [
        ["1.a", "1"],
        ["1.a.i", "1.a"],
        ["1.a.ii", "1.a"],
      ]);
    })
  );

  it.effect("shields complete paired quoted separators while retaining ordinary separators after the quote", () =>
    Effect.gen(function* () {
      for (const name of [
        '"mode: alpha; beta"',
        "“mode: alpha; beta”",
        "‘mode: alpha; beta’",
        '"mode: \\"alpha; beta\\""',
      ]) {
        const tree = yield* treeOf(
          `A fixture comprising a label bearing ${name}; a sensor (12) with a panel [13; 14].`
        );
        assert.deepStrictEqual(
          A.map(tree.elements, (element) => element.anchor.quote),
          ["A fixture", `a label bearing ${name}`, "a sensor (12) with a panel [13; 14]"]
        );
      }
    })
  );

  it.effect("does not hide remaining source behind an unpaired quotation", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf('A fixture comprising a label bearing "alpha; a sensor.');
      assert.strictEqual(tree.elements.length, 3);
      assert.strictEqual(atPath(tree, "1.b").anchor.quote, "a sensor");
    })
  );

  it.effect("leaves a childless colon header as an ordinary leaf", () =>
    Effect.gen(function* () {
      const tree = yield* treeOf("A fixture comprising a housing including:");
      assert.strictEqual(tree.elements.length, 2);
      assert.strictEqual(atPath(tree, "1.a").kind, "functional-relation");
    })
  );

  it.effect("keeps strict colon behavior unchanged while inspection uses the refined strategy", () =>
    Effect.gen(function* () {
      const text = "A fixture comprising a housing including: a panel; a sensor.";
      const claims = yield* normalizePatentClaims([["1", text]]);
      const strict = yield* decomposeClaim(A.headNonEmpty(claims), claims);
      const inspection = yield* treeOf(text);
      assert.strictEqual(atPath(strict, "1.a").anchor.quote, "a housing including:");
      assert.strictEqual(atPath(inspection, "1.a").anchor.quote, "a housing including: a panel; a sensor");
      assert.deepStrictEqual(
        A.map(atPath(strict, "1.a").terms, (term) => term.anchor),
        A.map(atPath(inspection, "1.a").terms, (term) => term.anchor)
      );
    })
  );

  it.effect("reuses inspection lexical ownership for dependency ancestors without duplicating introductions", () =>
    Effect.gen(function* () {
      const trees = yield* inspect([
        "A fixture comprising a housing including: a panel; a sensor.",
        "The fixture of claim 1 wherein the housing includes a latch coupled to the panel.",
      ]);
      const parent = atPath(O.getOrThrow(A.head(trees)), "1.a");
      const child = O.getOrThrow(A.last(trees));
      assert.strictEqual(parent.kind, "limitation");
      assert.isTrue(
        A.some(
          child.edges,
          (edge) =>
            edge.kind === "antecedent" &&
            edge.referring.anchor.quote === "the housing" &&
            edge.introducing.path === "1.a"
        )
      );
      assert.isTrue(
        A.some(
          child.edges,
          (edge) =>
            edge.kind === "antecedent" &&
            edge.referring.anchor.quote === "the panel" &&
            edge.introducing.path === "1.a.i"
        )
      );
    })
  );

  it.effect.prop(
    "retains exact labelled child source spans across generated nominal names",
    [Arbitrary.schema(S.Literals(["panel", "sensor", "controller", "register"]))],
    ([noun]) =>
      Effect.gen(function* () {
        const tree = yield* treeOf(`A fixture comprising (a) a housing including: (i) a ${noun}; and (b) a cover.`);
        assert.strictEqual(atPath(tree, "1.a.i").anchor.quote, `(i) a ${noun}`);
        assert.strictEqual(atPath(tree, "1.b").anchor.quote, "(b) a cover");
        assert.deepStrictEqual(
          A.map(atPath(tree, "1.a").terms, (term) => term.anchor.quote),
          ["a housing"]
        );
      }),
    { arbitrary: fcRuns(100) }
  );
});
