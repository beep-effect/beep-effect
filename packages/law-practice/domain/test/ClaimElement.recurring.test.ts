import { antecedentPolicy, decomposeClaim } from "@beep/law-practice-domain/values/ClaimElement";
import { normalizePatentClaims } from "@beep/law-practice-domain/values/PatentDocument";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

describe("next recurring source-structure gaps", () => {
  it.effect("excludes a further-comprising wrapper from the claimed subject", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A tester comprising a sensor."],
        ["2", "The tester of claim 1, further comprising a housing, wherein the housing is sealed."],
      ]);
      const claim = O.getOrThrow(A.last(claims));
      assert.strictEqual(claim.preamble, "The tester of claim 1");
      const tree = yield* decomposeClaim(claim, claims);
      assert.deepStrictEqual(
        A.map(tree.elements, (element) => element.anchor.quote),
        ["The tester of claim 1", "a housing", "the housing is sealed"]
      );
    })
  );

  it.effect("prefers an explicit defining clause over incidental having or wherein wording", () =>
    Effect.gen(function* () {
      const capsule = "A capsule having a rim, said capsule being characterized by the fact that a seal is fixed.";
      const method =
        "A method, wherein a detector is running, said method is characterized by the steps of: creating a record.";
      for (const text of [capsule, method]) {
        const claims = yield* normalizePatentClaims([["1", text]]);
        const claim = O.getOrThrow(A.head(claims));
        assert.strictEqual(claim.transition, "wherein");
        assert.strictEqual(claim.claimText, text);
        const tree = yield* decomposeClaim(claim, claims);
        assert.strictEqual(O.getOrThrow(A.head(tree.elements)).anchor.quote, claim.preamble);
      }
      const plain = yield* normalizePatentClaims([
        ["1", "A device comprising a surface that is characterized by the fact that a seal is fixed."],
      ]);
      assert.strictEqual(O.getOrThrow(A.head(plain)).preamble, "A device");
      assert.strictEqual(O.getOrThrow(A.head(plain)).transition, "comprising");
    })
  );

  it.effect("keeps infinitive actions out of names and preserves determiner-led participial names", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        [
          "1",
          "A tester comprising a platform configured to provide side-to-side motion by means of triggering a switch; the received pulse echo is processed.",
        ],
      ]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
      assert.deepStrictEqual(
        A.map(
          A.flatMap(tree.elements, (element) => element.terms),
          (term) => term.anchor.quote
        ),
        ["A tester", "a platform", "side-to-side motion", "a switch", "the received pulse echo"]
      );
    })
  );

  it.effect("keeps bare predicative material descriptions in connecting text without dropping explicit entities", () =>
    Effect.gen(function* () {
      for (const material of ["animal hair", "a fibrous layer"]) {
        const claims = yield* normalizePatentClaims([
          ["1", `A tester comprising the roller is formed of ${material}.`],
        ]);
        const tree = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
        const terms = A.map(
          A.flatMap(tree.elements, (element) => element.terms),
          (term) => term.anchor.quote
        );
        assert.deepStrictEqual(
          terms,
          material === "animal hair" ? ["A tester", "the roller"] : ["A tester", "the roller", "a fibrous layer"]
        );
        const functional = yield* Effect.fromOption(A.findFirst(tree.edges, (edge) => edge.kind === "functional"));
        if (functional.kind !== "functional") return yield* Effect.die("Expected functional relation");
        assert.strictEqual(
          A.join(
            A.map(functional.parts, (part) => (part.kind === "text" ? part.anchor.quote : part.term.anchor.quote)),
            ""
          ),
          `the roller is formed of ${material}`
        );
      }
    })
  );

  it.effect("keeps association and at-least connectors out of entity mentions", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A tester comprising the insert is optionally in association with at least the two layers."],
      ]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
      assert.deepStrictEqual(
        A.map(
          A.flatMap(tree.elements, (element) => element.terms),
          (term) => term.anchor.quote
        ),
        ["A tester", "the insert", "the two layers"]
      );
    })
  );

  it.effect("preserves shared-head ordinal coordination and ordinary selector lists", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A tester comprising first and second shield layers; a stack comprising one of paper, card or cloth."],
      ]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
      assert.deepStrictEqual(
        A.map(
          A.flatMap(tree.elements, (element) => element.terms),
          (term) => term.anchor.quote
        ),
        ["A tester", "first and second shield layers", "a stack", "paper, card or cloth"]
      );
      const separate = yield* normalizePatentClaims([["1", "A tester comprising a first shield and a second shield."]]);
      const split = yield* decomposeClaim(O.getOrThrow(A.head(separate)), separate);
      assert.deepStrictEqual(
        A.map(
          A.flatMap(split.elements, (element) => element.terms),
          (term) => term.anchor.quote
        ),
        ["A tester", "a first shield", "a second shield"]
      );
    })
  );

  it.effect("preserves a through-hole name without swallowing the following predicate", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A tester comprising a through hole receiving the received pulse echo."],
      ]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
      assert.deepStrictEqual(
        A.map(
          A.flatMap(tree.elements, (element) => element.terms),
          (term) => term.head
        ),
        ["tester", "through hole", "received pulse echo"]
      );
    })
  );

  it.effect("links a unique shortened prior mention structurally without treating it as a legal introduction", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A tester comprising the associated signals are recorded."],
        ["2", "The tester of claim 1 wherein the signals are evaluated."],
      ]);
      const trees = yield* Effect.forEach(claims, (claim) => decomposeClaim(claim, claims));
      assert.isTrue(
        A.some(
          O.getOrThrow(A.last(trees)).edges,
          (edge) =>
            edge.kind === "antecedent" &&
            edge.referring.anchor.quote === "the signals" &&
            edge.introducing.anchor.quote === "the associated signals"
        )
      );
      assert.isTrue(
        A.some(
          antecedentPolicy(trees, claims),
          (finding) => finding.kind === "missing-antecedent" && finding.referring.path === "2.a"
        )
      );
    })
  );
});
