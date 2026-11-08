import { sourceLowerBound, sourceSelectionFrameMember } from "@beep/law-practice-domain/test";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import controls from "./fixtures/claim-element/finite-clause-source-plans.json" with { type: "json" };
import { decomposeFiniteSourceFixture } from "./helpers/ClaimElementFiniteSource.ts";

describe("bounded source queries", () => {
  it("returns the first boundary at duplicates and reports refusal before reading an accessor", () => {
    const values = [1, 1, 3, 7];
    for (const boundary of [0, 1, 2, 3, 4, 7, 8]) {
      const expected = A.takeWhile(values, (value) => value < boundary).length;
      const actual = pipe(
        values,
        sourceLowerBound(
          boundary,
          (value) => value,
          () => true
        )
      );
      assert.strictEqual(actual, expected);
    }
    let reads = 0;
    const denied = sourceLowerBound(
      values,
      2,
      (value) => {
        reads++;
        return value;
      },
      () => false
    );
    assert.strictEqual(denied, -1);
    assert.strictEqual(reads, 0);
    assert.strictEqual(
      sourceLowerBound(
        [],
        2,
        () => {
          reads++;
          return 0;
        },
        () => false
      ),
      0
    );
    assert.strictEqual(reads, 0);
  });
  it.effect(
    "requires an owned element and coherent selection owner, with a refusal distinct from successful membership",
    () =>
      Effect.gen(function* () {
        const row = A.findFirst(controls.cases, (entry) => entry.case === "opaque-selector-binary").pipe(O.getOrThrow);
        const result = yield* decomposeFiniteSourceFixture(row);
        const plan = A.head(result.plans).pipe(O.getOrThrow).sourcePlan;
        const frame = A.findFirst(plan.frames, (entry) =>
          A.some(entry.privateArguments, (argument) => argument.kind === "selection")
        ).pipe(O.getOrThrow);
        const argument = A.findFirst(frame.privateArguments, (entry) => entry.kind === "selection").pipe(O.getOrThrow);
        assert.strictEqual(argument.kind, "selection");
        if (argument.kind !== "selection") return;
        const selection = A.findFirst(
          plan.roles.opaqueSelections,
          (entry) => entry.proof.ordinal === argument.certificate.ordinal
        ).pipe(O.getOrThrow);
        const owner = O.flatMap(argument.owner, (ref) => A.get(plan.roles.certificates, ref.ordinal - 1));
        const element = A.get(plan.elements, frame.publicOwner - 1);
        owner.pipe(O.isSome, assertTrue);
        const member = pipe(
          frame,
          sourceSelectionFrameMember(element, selection.core, owner, () => true)
        );
        assert.isTrue(member);
        assert.isFalse(sourceSelectionFrameMember(frame, O.none(), selection.core, owner, () => true));
        assert.isFalse(sourceSelectionFrameMember(frame, element, selection.core, O.none(), () => true));
        let calls = 0;
        const denied = sourceSelectionFrameMember(frame, element, selection.core, owner, () => {
          calls++;
          return false;
        });
        assert.isFalse(denied);
        assert.strictEqual(calls, 1);
      })
  );
});
