import { normalizePatentClaims, PatentClaim } from "@beep/law-practice-domain/values/PatentDocument";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";

describe("bounded parent-claim reference expressions", () => {
  it.effect("does not mistake component numbers before a defining clause for claim references", () =>
    Effect.gen(function* () {
      const text =
        "The method according to claim 1, wherein a workpiece (24) is a disc, characterized in that the disc has ribs (32).";
      const claims = yield* normalizePatentClaims([
        ["1", "A machining method comprising rotating a workpiece."],
        ["2", text],
      ]);
      const claim = O.getOrThrow(A.last(claims));
      assert.deepStrictEqual(
        PatentClaim.match(claim, { independent: () => [], dependent: ({ claimReferences }) => claimReferences }),
        [1]
      );
      assert.strictEqual(claim.claimText, text);
    })
  );

  it.effect("retains lists, repeated claim markers and ranges before descriptive numbers", () =>
    Effect.gen(function* () {
      for (const reference of ["claims 1 and 2", "claims 1, and 2", "claims 1 through 2", "claim 1 or claim 2"]) {
        const claims = yield* normalizePatentClaims([
          ["1", "A machining method comprising rotating a workpiece."],
          ["2", "The method of claim 1 wherein a tool cuts the workpiece."],
          [
            "3",
            `The method of ${reference}, wherein a tool (24) is movable, characterized in that the tool has a head (120).`,
          ],
        ]);
        const claim = O.getOrThrow(A.last(claims));
        assert.deepStrictEqual(
          PatentClaim.match(claim, { independent: () => [], dependent: ({ claimReferences }) => claimReferences }),
          [1, 2]
        );
      }
    })
  );

  it.effect("still rejects self, forward and reversed dependencies in the reference expression", () =>
    Effect.gen(function* () {
      for (const reference of ["claim 2", "claim 24", "claims 1 and 24", "claims 2 through 1", "claims none"]) {
        const result = yield* Effect.exit(
          normalizePatentClaims([
            ["1", "A machining method comprising rotating a workpiece."],
            ["2", `The method of ${reference}, wherein a tool (24) is movable.`],
          ])
        );
        assert.isTrue(Exit.isFailure(result));
      }
    })
  );
});
