import { decomposeClaim } from "@beep/law-practice-domain/values/ClaimElement";
import { normalizePatentClaims } from "@beep/law-practice-domain/values/PatentDocument";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

describe("finite motion and generation predicates", () => {
  it.effect("separates finite rotate, go and generate predicates from the subject head", () =>
    Effect.gen(function* () {
      for (const [body, head] of [
        ["the roller rotates in a clockwise direction", "roller"],
        ["the monitor goes into a standby mode", "monitor"],
        ["the controller generates an output signal", "controller"],
      ]) {
        const claims = yield* normalizePatentClaims([["1", `A device comprising ${body}.`]]);
        const tree = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
        const element = O.getOrThrow(A.last(tree.elements));
        assert.strictEqual(element.kind, "functional-relation");
        assert.strictEqual(O.getOrThrow(A.head(element.terms)).head, head);
        assert.isTrue(A.some(tree.edges, (edge) => edge.kind === "functional" && edge.element === element.path));
      }
    })
  );

  it.effect("preserves a nominal go switch and rotation sensor as entity limitations", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([["1", "A device comprising a go switch; and a rotation sensor."]]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
      assert.deepStrictEqual(
        A.map(A.drop(tree.elements, 1), (element) => [element.kind, O.getOrThrow(A.head(element.terms)).head]),
        [
          ["limitation", "go switch"],
          ["limitation", "rotation sensor"],
        ]
      );
    })
  );
});
