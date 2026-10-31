import { decomposeClaim } from "@beep/law-practice-domain/values/ClaimElement";
import { normalizePatentClaims } from "@beep/law-practice-domain/values/PatentDocument";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";

describe("source comma introducing a dependent limitation", () => {
  it.effect("preserves exact source text and grammatical boundaries for an implicit limitation", () =>
    Effect.gen(function* () {
      for (const body of [
        "the support being formed as a cone.",
        "the housing is further caused to: receive a signal.",
        "operating across a frequency range.",
      ]) {
        const text = `The fixture of claim 1, ${body}`;
        const claims = yield* normalizePatentClaims([
          ["1", "A fixture comprising a support and a housing."],
          ["2", text],
        ]);
        const child = O.getOrThrow(A.last(claims));
        assert.strictEqual(child.claimText, text);
        assert.strictEqual(child.preamble, "The fixture of claim 1");
        assert.strictEqual(child.transition, "wherein");
        assert.strictEqual(child.body, body);
        const tree = yield* decomposeClaim(child, claims);
        assert.isTrue(
          A.some(
            tree.edges,
            (edge) => edge.kind === "depends-on-element" && edge.dependent === "2" && edge.ancestor === "1"
          )
        );
        for (const element of tree.elements)
          assert.strictEqual(Str.slice(element.anchor.startChar, element.anchor.endChar)(text), element.anchor.quote);
      }
    })
  );

  it.effect("does not split a comma-separated list of parent claims", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A fixture comprising a support."],
        ["2", "The fixture of claim 1 wherein the support is hollow."],
        ["3", "The fixture of claims 1, 2, the support being formed as a cone."],
      ]);
      const child = O.getOrThrow(A.last(claims));
      assert.strictEqual(child.preamble, "The fixture of claims 1, 2");
      assert.strictEqual(child.body, "the support being formed as a cone.");
    })
  );

  it.effect("keeps explicit transitions authoritative", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A fixture comprising a support."],
        ["2", "The fixture of claim 1, wherein the support is hollow."],
      ]);
      const child = O.getOrThrow(A.last(claims));
      assert.strictEqual(child.body, "the support is hollow.");
    })
  );

  it.effect("withholds independent fragments and dependent fragments without a predicate", () =>
    Effect.gen(function* () {
      for (const text of ["A fixture, the support being formed as a cone.", "The fixture of claim 1, a bracket."]) {
        const result = yield* normalizePatentClaims([
          ["1", "A fixture comprising a support."],
          ["2", text],
        ]).pipe(Effect.result);
        assert.strictEqual(result._tag, "Failure");
      }
    })
  );
});
