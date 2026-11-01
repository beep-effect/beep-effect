/**
 * Ancestry edge cases for the claim-element decomposer.
 *
 * Every claim text here is synthetic and written for the test.
 */

import { decomposeClaim } from "@beep/law-practice-domain/values/ClaimElement";
import { normalizePatentClaims, PatentClaim } from "@beep/law-practice-domain/values/PatentDocument";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertFalse, assertTrue, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { ClaimElementTree } from "@beep/law-practice-domain/values/ClaimElement";
import type { PatentClaims } from "@beep/law-practice-domain/values/PatentDocument";

const independent = (claimNumber: number, claimText: string, body: string): PatentClaim =>
  PatentClaim.cases.independent.make({ claimNumber, claimText, preamble: "A device", transition: "comprising", body });

const dependent = (claimNumber: number, parent: number, body: string): PatentClaim =>
  PatentClaim.cases.dependent.make({
    claimNumber,
    claimReferences: [parent],
    claimText: `The device of claim ${parent} wherein ${body}`,
    preamble: `The device of claim ${parent}`,
    transition: "wherein",
    body,
  });

const lastOf = (claims: PatentClaims): PatentClaim => O.getOrThrow(A.last(claims));

const hasDependency = (tree: ClaimElementTree, dependentPath: string): boolean =>
  A.some(tree.edges, (edge) => edge.kind === "depends-on-element" && edge.dependent === dependentPath);

const termHeads = (tree: ClaimElementTree): ReadonlyArray<string> =>
  A.flatMap(tree.elements, (element) => A.map(element.terms, (term) => term.head));

describe("ClaimElement decomposer ancestry", () => {
  it.effect("does not read a claim reference as a claim term", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A device comprising a frame."],
        ["2", "A device comprising the claim 1 frame and a lid."],
      ]);
      const tree = yield* decomposeClaim(lastOf(claims), claims);
      assertFalse(A.some(termHeads(tree), Str.startsWith("claim")));
    })
  );

  it.effect("tolerates sibling claims whose references are outside the claim set", () =>
    Effect.gen(function* () {
      const claims: PatentClaims = [
        independent(1, "A device comprising a frame.", "a frame."),
        dependent(2, 1, "the frame is rigid."),
        dependent(3, 9, "the frame is light."),
      ];
      const tree = yield* decomposeClaim(O.getOrThrow(A.get(claims, 1)), claims);
      strictEqual(tree.claimNumber, 2);
    })
  );

  it.effect("skips an ancestor whose text does not locate its parts", () =>
    Effect.gen(function* () {
      const claims: PatentClaims = [
        independent(1, "Garbled source text without the parts.", "a frame."),
        dependent(2, 1, "the frame is rigid."),
      ];
      const tree = yield* decomposeClaim(lastOf(claims), claims);
      assertFalse(hasDependency(tree, "2.a"));
    })
  );

  it.effect("withholds a result dependency when no immediate parent refines it", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A method comprising illuminating sources to form distinct patterns."],
        ["2", "The method of claim 1 wherein the sources are lasers."],
        ["3", "The method of claim 2 wherein the distinct patterns include a narrow pattern."],
      ]);
      const tree = yield* decomposeClaim(lastOf(claims), claims);
      assertFalse(hasDependency(tree, "3.a"));
      assertTrue(A.isReadonlyArrayNonEmpty(tree.elements));
    })
  );
});
