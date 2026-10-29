import { antecedentPolicy, decomposeClaim } from "@beep/law-practice-domain/values/ClaimElement";
import { normalizePatentClaims } from "@beep/law-practice-domain/values/PatentDocument";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

describe("source discourse and grammatical dependency roles", () => {
  it.effect("does not introduce an inherited indefinite dependent subject twice", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A fixture comprising a panel."],
        ["2", "A fixture of claim 1 wherein said fixture is attached to a post."],
      ]);
      const trees = yield* Effect.forEach(claims, (claim) => decomposeClaim(claim, claims));
      const child = O.getOrThrow(A.last(trees));
      assert.isTrue(
        A.some(
          child.edges,
          (edge) =>
            edge.kind === "antecedent" &&
            edge.referring.anchor.quote === "said fixture" &&
            edge.introducing.path === "1"
        )
      );
      assert.isFalse(
        A.some(antecedentPolicy(trees, claims), (finding) => finding.referring.anchor.quote === "said fixture")
      );
    })
  );

  it.effect("excludes alternative dependency scaffolding from preamble terms", () =>
    Effect.gen(function* () {
      for (const wording of ["any of", "any one of"]) {
        const claims = yield* normalizePatentClaims([
          ["1", "A fixture comprising a panel."],
          ["2", "The fixture of claim 1 wherein the panel is fixed."],
          ["3", `The fixture of ${wording} claims 1 to 2 wherein the panel is covered.`],
        ]);
        const tree = yield* decomposeClaim(O.getOrThrow(A.last(claims)), claims);
        assert.deepStrictEqual(
          A.map(O.getOrThrow(A.head(tree.elements)).terms, (term) => term.anchor.quote),
          ["The fixture"]
        );
      }
    })
  );

  it.effect("distinguishes inflected predicates from nominal compounds and homographs", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        [
          "1",
          "A fixture comprising a display that displays a curve; lateral support strips that extend through a panel; a mesh that meshes with the panel; a frame to support strips.",
        ],
      ]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
      assert.deepStrictEqual(
        A.map(
          A.flatMap(tree.elements, (element) => element.terms),
          (term) => term.anchor.quote
        ),
        [
          "A fixture",
          "a display",
          "a curve",
          "lateral support strips",
          "a panel",
          "a mesh",
          "the panel",
          "a frame",
          "strips",
        ]
      );
    })
  );

  it.effect("resolves a unique local letter-number designator without inventing legal introduction", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A method comprising measuring the pulse duration T1; evaluating the pulse duration."],
      ]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
      assert.isTrue(
        A.some(
          tree.edges,
          (edge) =>
            edge.kind === "antecedent" &&
            edge.referring.path === "1.b" &&
            edge.introducing.path === "1.a" &&
            edge.introducing.anchor.quote === "the pulse duration T1"
        )
      );
      assert.isTrue(
        A.some(
          antecedentPolicy([tree], claims),
          (finding) => finding.kind === "missing-antecedent" && finding.referring.path === "1.b"
        )
      );
    })
  );

  it.effect("withholds ambiguous designators and does not treat bare numbers as designators", () =>
    Effect.gen(function* () {
      for (const body of [
        "measuring the pulse duration T1; measuring the pulse duration T2; evaluating the pulse duration.",
        "measuring the pulse duration 12; evaluating the pulse duration.",
      ]) {
        const claims = yield* normalizePatentClaims([["1", `A method comprising ${body}`]]);
        const tree = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
        assert.isFalse(
          A.some(
            tree.edges,
            (edge) => edge.kind === "antecedent" && edge.referring.anchor.quote === "the pulse duration"
          )
        );
      }
    })
  );

  it.effect("does not misclassify the object of an action step as a limiting subject", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A method comprising a packet header."],
        ["2", "The method of claim 1 wherein creating the packet header."],
      ]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.last(claims)), claims);
      assert.isTrue(
        A.some(
          tree.edges,
          (edge) => edge.kind === "antecedent" && edge.referring.path === "2.a" && edge.introducing.path === "1.a"
        )
      );
      assert.isFalse(A.some(tree.edges, (edge) => edge.kind === "depends-on-element" && edge.dependent === "2.a"));
    })
  );

  it.effect("attaches an introduced spatial part to its explicit owner, not a later object", () =>
    Effect.gen(function* () {
      for (const [body, expected] of A.make(
        ["a central portion of the housing is provided with a recess.", true],
        ["a relay is coupled to the housing.", false]
      )) {
        const claims = yield* normalizePatentClaims([
          ["1", "A fixture comprising a housing."],
          ["2", `The fixture of claim 1 wherein ${body}`],
        ]);
        const tree = yield* decomposeClaim(O.getOrThrow(A.last(claims)), claims);
        assert.strictEqual(
          A.some(
            tree.edges,
            (edge) => edge.kind === "depends-on-element" && edge.dependent === "2.a" && edge.ancestor === "1.a"
          ),
          expected
        );
      }
    })
  );
});
