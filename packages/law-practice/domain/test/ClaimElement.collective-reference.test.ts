import { antecedentPolicy, decomposeClaim } from "@beep/law-practice-domain/values/ClaimElement";
import { normalizePatentClaims } from "@beep/law-practice-domain/values/PatentDocument";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

describe("collective references retain their lexical source heads", () => {
  it.effect("retains the collective plurality phrase and preserves numeric-quantifier conventions", () =>
    Effect.gen(function* () {
      for (const [introduced, referred, head] of [
        ["a plurality of pins", "said plurality of pins", "plurality of pins"],
        ["one or more sensors", "the one or more sensors", "sensors"],
      ]) {
        const claims = yield* normalizePatentClaims([
          ["1", `A fixture comprising ${introduced}.`],
          ["2", `The fixture of claim 1 wherein ${referred} are metallic.`],
        ]);
        const trees = yield* Effect.forEach(claims, (claim) => decomposeClaim(claim, claims));
        const child = O.getOrThrow(A.last(trees));
        const element = O.getOrThrow(A.last(child.elements));
        assert.strictEqual(O.getOrThrow(A.head(element.terms)).head, head);
        assert.isTrue(
          A.some(
            child.edges,
            (edge) =>
              edge.kind === "antecedent" && edge.referring.anchor.quote === referred && edge.introducing.path === "1.a"
          )
        );
        assert.isTrue(
          A.some(
            child.edges,
            (edge) => edge.kind === "depends-on-element" && edge.dependent === "2.a" && edge.ancestor === "1.a"
          )
        );
        assert.isFalse(
          A.some(antecedentPolicy(trees, claims), (finding) => finding.referring.anchor.quote === referred)
        );
      }
    })
  );

  it.effect("does not guess among two explicit introductions with the same quantified contents", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A fixture comprising a plurality of pins; and a plurality of pins."],
        ["2", "The fixture of claim 1 wherein said plurality of pins are metallic."],
      ]);
      const trees = yield* Effect.forEach(claims, (claim) => decomposeClaim(claim, claims));
      const child = O.getOrThrow(A.last(trees));
      assert.isFalse(
        A.some(
          child.edges,
          (edge) => edge.kind === "antecedent" && edge.referring.anchor.quote === "said plurality of pins"
        )
      );
      assert.isTrue(
        A.some(
          antecedentPolicy(trees, claims),
          (finding) =>
            finding.kind === "ambiguous-antecedent" && finding.referring.anchor.quote === "said plurality of pins"
        )
      );
    })
  );
  it.effect("retains grammatical-number and outside-chain diagnostics for collective contents", () =>
    Effect.gen(function* () {
      for (const [parent, expected] of [
        ["a pin", "number-mismatch"],
        ["a panel", "antecedent-outside-chain"],
      ]) {
        const claims = yield* normalizePatentClaims([
          ["1", `A fixture comprising ${parent}.`],
          ["2", "A second fixture comprising a plurality of pins."],
          ["3", "The fixture of claim 1 wherein said plurality of pins are metallic."],
        ]);
        const trees = yield* Effect.forEach(claims, (claim) => decomposeClaim(claim, claims));
        const finding = O.getOrThrow(
          A.findFirst(
            antecedentPolicy(trees, claims),
            (value) => value.referring.anchor.quote === "said plurality of pins"
          )
        );
        assert.strictEqual(finding.kind, expected);
        const child = O.getOrThrow(A.last(trees));
        const term = O.getOrThrow(A.head(O.getOrThrow(A.last(child.elements)).terms));
        assert.strictEqual(term.head, "plurality of pins");
      }
    })
  );
});
