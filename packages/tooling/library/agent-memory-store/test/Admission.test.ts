import {
  AdmissionOutcome,
  ConflictResolution,
  HeldConflict,
  InsertPlacement,
  MemoryGateViolation,
  NearDuplicateFlag,
  NodeOperation,
  toClaimGateResult,
} from "@beep/agent-memory-store";
import { describe, expect, it } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  author,
  contentHash,
  filePath,
  holdId,
  missingPredecessor,
  nodeId,
  otherNodeId,
  revisionA,
  revisionB,
  staleRevision,
} from "./fixtures.ts";

const encodeOutcome = S.encodeEffect(AdmissionOutcome);
const decodeOutcome = S.decodeUnknownEffect(AdmissionOutcome);

const outcomes: ReadonlyArray<AdmissionOutcome> = [
  AdmissionOutcome.cases.landed.make({ nodeId, revisionId: revisionA }),
  AdmissionOutcome.cases.deferred.make({ nodeId, contentHash }),
  AdmissionOutcome.cases.held.make({
    holdId,
    nodeId,
    ours: O.some("logged text"),
    theirs: O.some("agent text"),
    violations: [staleRevision],
  }),
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
        decodeOutcome({ outcome: "held", holdId, nodeId, ours: "logged text", theirs: "agent text", violations: [] })
      );
      assertInstanceOf(error, S.SchemaError);
    })
  );

  it.effect(
    "holds a delete against a retired node and an insert of a new node without inventing a text",
    Effect.fnUntraced(function* () {
      const encodedViolation = yield* S.encodeEffect(MemoryGateViolation)(staleRevision);
      const deleteHeld = yield* decodeOutcome({ outcome: "held", holdId, nodeId, violations: [encodedViolation] });
      expect(deleteHeld).toEqual(
        AdmissionOutcome.cases.held.make({
          holdId,
          nodeId,
          ours: O.none(),
          theirs: O.none(),
          violations: [staleRevision],
        })
      );

      const insertHeld = AdmissionOutcome.cases.held.make({
        holdId,
        nodeId: otherNodeId,
        ours: O.none(),
        theirs: O.some("- A new fact."),
        violations: [missingPredecessor],
      });
      const encoded = yield* encodeOutcome(insertHeld);
      const encodedMissing = yield* S.encodeEffect(MemoryGateViolation)(missingPredecessor);
      expect(encoded).toEqual({
        outcome: "held",
        holdId,
        nodeId: otherNodeId,
        theirs: "- A new fact.",
        violations: [encodedMissing],
      });
    })
  );

  it.effect(
    "round-trips a held conflict with its hold id, operation and both texts",
    Effect.fnUntraced(function* () {
      const conflict = HeldConflict.make({
        holdId,
        operation: NodeOperation.cases.replace.make({ nodeId, expectedRevision: revisionA, text: "agent text" }),
        author,
        nodeId,
        headRevision: O.some(revisionB),
        ours: O.some("logged text"),
        theirs: O.some("agent text"),
        since: DateTime.makeUnsafe(0),
        violations: [staleRevision],
      });
      const encoded = yield* S.encodeEffect(HeldConflict)(conflict);
      const decoded = yield* S.decodeEffect(HeldConflict)(encoded);
      expect(decoded).toEqual(conflict);
      expect(decoded.holdId).toBe(holdId);
      expect(DateTime.toEpochMillis(decoded.since)).toBe(0);
    })
  );

  it.effect(
    "keeps a held insert reviewable under the node id its capture step minted",
    Effect.fnUntraced(function* () {
      const conflict = HeldConflict.make({
        holdId,
        operation: NodeOperation.cases.insert.make({
          nodeId,
          afterNodeId: O.some(otherNodeId),
          filePath,
          kind: "listItem",
          text: "- A new fact.",
        }),
        author,
        nodeId,
        headRevision: O.none(),
        ours: O.none(),
        theirs: O.some("- A new fact."),
        since: DateTime.makeUnsafe(0),
        violations: [missingPredecessor],
      });
      const encoded = yield* S.encodeEffect(HeldConflict)(conflict);
      const decoded = yield* S.decodeEffect(HeldConflict)(encoded);
      expect(decoded).toEqual(conflict);

      const placed = ConflictResolution.cases.theirs.make({
        placement: O.some(InsertPlacement.make({ afterNodeId: O.none() })),
      });
      const encodedResolution = yield* S.encodeEffect(ConflictResolution)(placed);
      expect(encodedResolution).toEqual({ choice: "theirs", placement: {} });
      const kept = yield* S.decodeEffect(ConflictResolution)({ choice: "merged", text: "Both facts." });
      expect(kept).toEqual(ConflictResolution.cases.merged.make({ text: "Both facts.", placement: O.none() }));
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
