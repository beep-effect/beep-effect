import { AdmissionOutcome, HeldConflict, NearDuplicateFlag, toClaimGateResult } from "@beep/agent-memory-store";
import { describe, expect, it } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { contentHash, nodeId, otherNodeId, revisionA, staleRevision } from "./fixtures.ts";

const encodeOutcome = S.encodeEffect(AdmissionOutcome);
const decodeOutcome = S.decodeUnknownEffect(AdmissionOutcome);

const outcomes: ReadonlyArray<AdmissionOutcome> = [
  AdmissionOutcome.cases.landed.make({ nodeId, revisionId: revisionA }),
  AdmissionOutcome.cases.deferred.make({ nodeId, contentHash }),
  AdmissionOutcome.cases.held.make({ nodeId, ours: "logged text", theirs: "agent text", violations: [staleRevision] }),
  AdmissionOutcome.cases.rejected.make({ violations: [staleRevision] }),
];

describe("Admission models", () => {
  it.effect(
    "round-trips every admission outcome variant",
    Effect.fnUntraced(function* () {
      const kinds = yield* Effect.forEach(outcomes, (outcome) =>
        Effect.gen(function* () {
          const encoded = yield* encodeOutcome(outcome);
          const decoded = yield* decodeOutcome(encoded);
          expect(decoded).toEqual(outcome);
          return decoded.outcome;
        })
      );
      expect(kinds).toEqual(["landed", "deferred", "held", "rejected"]);
    })
  );

  it.effect.prop(
    "round-trips arbitrary admission outcomes",
    [Arbitrary.schema(AdmissionOutcome)],
    ([outcome]) =>
      Effect.gen(function* () {
        const encoded = yield* encodeOutcome(outcome);
        const decoded = yield* decodeOutcome(encoded);
        expect(decoded).toEqual(outcome);
      }),
    { arbitrary: { runs: 50 } }
  );

  it.effect(
    "requires at least one violation on a held outcome",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(
        decodeOutcome({ outcome: "held", nodeId, ours: "logged text", theirs: "agent text", violations: [] })
      );
      assertInstanceOf(error, S.SchemaError);
    })
  );

  it.effect(
    "round-trips a held conflict with both texts",
    Effect.fnUntraced(function* () {
      const conflict = HeldConflict.make({
        nodeId,
        ours: "logged text",
        theirs: "agent text",
        since: DateTime.makeUnsafe(0),
        violations: [staleRevision],
      });
      const encoded = yield* S.encodeEffect(HeldConflict)(conflict);
      const decoded = yield* S.decodeEffect(HeldConflict)(encoded);
      expect(decoded.ours).toBe("logged text");
      expect(decoded.theirs).toBe("agent text");
      expect(DateTime.toEpochMillis(decoded.since)).toBe(0);
    })
  );

  it.effect(
    "defaults near-duplicate flags on a landed outcome and keeps them through a round trip",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeOutcome({ outcome: "landed", nodeId, revisionId: revisionA });
      expect(decoded).toEqual(AdmissionOutcome.cases.landed.make({ nodeId, revisionId: revisionA, flags: [] }));

      const flagged = AdmissionOutcome.cases.landed.make({
        nodeId,
        revisionId: revisionA,
        flags: [NearDuplicateFlag.make({ nodeId, candidateNodeId: otherNodeId, simhashDistance: 2 })],
      });
      const encoded = yield* encodeOutcome(flagged);
      const roundTripped = yield* decodeOutcome(encoded);
      expect(roundTripped).toEqual(flagged);
    })
  );

  it.effect(
    "projects every admission outcome onto the claim gate verdict",
    Effect.fnUntraced(function* () {
      const rejected = { verdict: "rejected", violations: [staleRevision.violation] };
      expect(A.map(outcomes, toClaimGateResult)).toEqual([
        { verdict: "admitted" },
        { verdict: "admitted" },
        rejected,
        rejected,
      ]);
    })
  );
});
