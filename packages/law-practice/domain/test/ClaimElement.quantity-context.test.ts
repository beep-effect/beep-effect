import { antecedentPolicy, decomposeClaim } from "@beep/law-practice-domain/values/ClaimElement";
import { normalizePatentClaims } from "@beep/law-practice-domain/values/PatentDocument";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

describe("quantity wrappers and relational predicate context", () => {
  it.effect("separates include and responsive-to while preserving nominal modifiers", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        [
          "1",
          "A method comprising a responsive panel; a bracket that incorporates strips; evaluating the settings that include a maximum count allowed to be embedded for each packet type; checking the packets responsive to a signal.",
        ],
      ]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
      assert.deepStrictEqual(
        A.map(
          A.flatMap(tree.elements, (e) => e.terms),
          (t) => t.anchor.quote
        ),
        [
          "A method",
          "a responsive panel",
          "a bracket",
          "strips",
          "the settings",
          "a maximum count",
          "each packet type",
          "the packets",
          "a signal",
        ]
      );
    })
  );

  it.effect("links a unique count-wrapped introduction without shortening source spans", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A method comprising receiving a specified number of packets."],
        ["2", "The method of claim 1 wherein checking the packets responsive to a signal."],
      ]);
      const trees = yield* Effect.forEach(claims, (claim) => decomposeClaim(claim, claims));
      const child = O.getOrThrow(A.last(trees));
      assert.isTrue(
        A.some(
          child.edges,
          (e) =>
            e.kind === "antecedent" &&
            e.referring.anchor.quote === "the packets" &&
            e.introducing.anchor.quote === "a specified number of packets"
        )
      );
      assert.isFalse(A.some(antecedentPolicy(trees, claims), (f) => f.referring.anchor.quote === "the packets"));
    })
  );

  it.effect("withholds ambiguous quantity introductions and does not erase substantive grouping nouns", () =>
    Effect.gen(function* () {
      for (const body of ["a specified number of packets; a selected number of packets", "a group of packets"]) {
        const claims = yield* normalizePatentClaims([
          ["1", `A method comprising receiving ${body}.`],
          ["2", "The method of claim 1 wherein checking the packets."],
        ]);
        const trees = yield* Effect.forEach(claims, (claim) => decomposeClaim(claim, claims));
        const child = O.getOrThrow(A.last(trees));
        assert.isFalse(
          A.some(child.edges, (e) => e.kind === "antecedent" && e.referring.anchor.quote === "the packets")
        );
        assert.isTrue(A.some(antecedentPolicy(trees, claims), (f) => f.referring.anchor.quote === "the packets"));
      }
    })
  );
});
