import { decomposeClaim } from "@beep/law-practice-domain/values/ClaimElement";
import { normalizePatentClaims } from "@beep/law-practice-domain/values/PatentDocument";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

describe("purpose predicates and response idioms", () => {
  it.effect("keeps purpose participles and response connective text out of entity names", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A method comprising receiving a control channel (CCH) used for feedback in response to transmission on a carrier."],
      ]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
      assert.deepStrictEqual(
        A.map(A.flatMap(tree.elements, (element) => element.terms), (term) => term.anchor.quote),
        ["A method", "a control channel (CCH)", "feedback", "transmission", "a carrier"]
      );
    })
  );

  it.effect("retains nominal used modifiers and response entities", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A fixture comprising a used bracket; a response unit; a panel configured to embed strips."],
      ]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
      assert.deepStrictEqual(
        A.map(A.flatMap(tree.elements, (element) => element.terms), (term) => term.anchor.quote),
        ["A fixture", "a used bracket", "a response unit", "a panel", "strips"]
      );
    })
  );
});
