import { antecedentPolicy, decomposeClaim } from "@beep/law-practice-domain/values/ClaimElement";
import { normalizePatentClaims } from "@beep/law-practice-domain/values/PatentDocument";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

describe("source-defined bare action results", () => {
  it.effect("carries a result refinement through the immediate parent while retaining legal warning", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A method comprising illuminating sources to form distinct patterns."],
        ["2", "The method of claim 1 wherein the distinct patterns include a narrow pattern."],
        ["3", "The method of claim 2 wherein the distinct patterns include a broad pattern."],
      ]);
      const trees = yield* Effect.forEach(claims, (claim) => decomposeClaim(claim, claims));
      for (const [number, parent] of [
        [2, 1],
        [3, 2],
      ]) {
        const tree = O.getOrThrow(A.findFirst(trees, (t) => t.claimNumber === number));
        assert.isTrue(
          A.some(
            tree.edges,
            (e) => e.kind === "depends-on-element" && e.dependent === `${number}.a` && e.ancestor === `${parent}.a`
          )
        );
      }
      assert.isTrue(
        A.some(
          antecedentPolicy(trees, claims),
          (f) => f.referring.path === "2.a" && f.referring.anchor.quote === "the distinct patterns"
        )
      );
    })
  );

  it.effect("withholds generic bare mentions, ambiguous definitions and sibling definitions", () =>
    Effect.gen(function* () {
      for (const body of [
        "measuring distinct patterns.",
        "illuminating sources to form distinct patterns; illuminating sources to form distinct patterns.",
      ]) {
        const claims = yield* normalizePatentClaims([
          ["1", `A method comprising ${body}`],
          ["2", "The method of claim 1 wherein the distinct patterns include a narrow pattern."],
        ]);
        const tree = yield* decomposeClaim(O.getOrThrow(A.last(claims)), claims);
        assert.isFalse(A.some(tree.edges, (e) => e.kind === "depends-on-element" && e.dependent === "2.a"));
      }
      const claims = yield* normalizePatentClaims([
        ["1", "A method comprising illuminating a source."],
        ["2", "The method of claim 1 wherein illuminating sources to form distinct patterns."],
        ["3", "The method of claim 1 wherein the distinct patterns include a narrow pattern."],
      ]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.last(claims)), claims);
      assert.isFalse(A.some(tree.edges, (e) => e.kind === "depends-on-element" && e.dependent === "3.a"));
    })
  );
});
