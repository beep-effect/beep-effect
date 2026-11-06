import { decomposeClaim } from "@beep/law-practice-domain/values/ClaimElement";
import { normalizePatentClaims } from "@beep/law-practice-domain/values/PatentDocument";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

describe("subordinate condition boundaries", () => {
  it.effect("keeps whether out of a following explicit entity phrase", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A circuit comprising a status register that indicates whether embedded packets include a checksum."],
      ]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
      const element = O.getOrThrow(A.last(tree.elements));
      assert.deepStrictEqual(
        A.map(element.terms, (term) => term.anchor.quote),
        ["a status register", "embedded packets", "a checksum"]
      );
      assert.strictEqual(element.kind, "functional-relation");
    })
  );

  it.effect("retains a source compound containing the same letters", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([["1", "A circuit comprising a whether-or-not flag."]]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
      const term = O.getOrThrow(A.head(O.getOrThrow(A.last(tree.elements)).terms));
      assert.strictEqual(term.anchor.quote, "a whether-or-not flag");
      assert.strictEqual(term.head, "whether-or-not flag");
    })
  );
  it.effect("preserves the function word when it is part of an explicitly quoted source name", () =>
    Effect.gen(function* () {
      for (const body of [
        'a "whether" flag',
        "a “whether or not” flag",
        "a “end of process” signal",
        "a ‘controller’s whether’ flag",
        'a "whether \\"or\\" not" flag',
      ]) {
        const claims = yield* normalizePatentClaims([["1", `A circuit comprising ${body}.`]]);
        const tree = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
        const terms = O.getOrThrow(A.last(tree.elements)).terms;
        assert.strictEqual(terms.length, 1);
        assert.strictEqual(O.getOrThrow(A.head(terms)).anchor.quote, body);
      }
    })
  );
});
