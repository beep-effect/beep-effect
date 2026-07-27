import {
  ExecutionLedger,
  ExecutionLedgerConstraintViolation,
  ExecutionLedgerError,
  ExecutionLedgerOperation,
  ExecutionLedgerUnavailable,
} from "@beep/epistemic-use-cases/ExecutionLedger";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

describe("ExecutionLedger", () => {
  describe("ExecutionLedgerOperation", () => {
    it("is the closed five-operation domain", () => {
      expect(ExecutionLedgerOperation.Options).toEqual([
        "appendDecision",
        "appendOutcome",
        "readDecisions",
        "readOutcomes",
        "readUnsettledAllowed",
      ]);
    });
  });

  describe("ExecutionLedgerConstraintViolation", () => {
    it("carries the constraint name and operation it rejected", () => {
      const violation = ExecutionLedgerConstraintViolation.on("appendDecision", "epistemic_execution_decision_pk");

      expect(violation._tag).toBe("ExecutionLedgerConstraintViolation");
      expect(violation.constraintName).toBe("epistemic_execution_decision_pk");
      expect(violation.operation).toBe("appendDecision");
      expect(ExecutionLedgerConstraintViolation.is(violation)).toBe(true);
    });
  });

  describe("ExecutionLedgerUnavailable", () => {
    it("retains an optional driver defect as its cause", () => {
      const bare = ExecutionLedgerUnavailable.during("readDecisions", "read failed");
      const caused = ExecutionLedgerUnavailable.during("appendOutcome", "write failed", new Error("ECONNRESET"));

      expect(bare._tag).toBe("ExecutionLedgerUnavailable");
      expect(O.isNone(bare.cause)).toBe(true);
      expect(bare.reason).toBe("read failed");
      expect(O.isSome(caused.cause)).toBe(true);
      expect(caused.operation).toBe("appendOutcome");
      expect(ExecutionLedgerUnavailable.is(caused)).toBe(true);
    });

    it("rejects an empty reason at construction", () => {
      expect(() => ExecutionLedgerUnavailable.during("readOutcomes", "")).toThrow();
    });
  });

  describe("ExecutionLedgerError", () => {
    it("admits exactly the two ledger failures", () => {
      const violation = ExecutionLedgerConstraintViolation.on("appendDecision", "epistemic_execution_outcome_pk");
      const unavailable = ExecutionLedgerUnavailable.during("readUnsettledAllowed", "read failed");

      expect(ExecutionLedgerError.is(violation)).toBe(true);
      expect(ExecutionLedgerError.is(unavailable)).toBe(true);
      expect(ExecutionLedgerError.is({ _tag: "SomethingElse" })).toBe(false);
      expect(S.is(ExecutionLedgerError)(new Error("plain"))).toBe(false);
    });
  });

  describe("ExecutionLedger service tag", () => {
    it.effect(
      "provides and resolves a ledger implementation",
      Effect.fnUntraced(function* () {
        const ledger = yield* ExecutionLedger.pipe(
          Effect.provideService(
            ExecutionLedger,
            ExecutionLedger.of({
              appendDecision: Effect.fn("ExecutionLedgerTest.appendDecision")(function* () {}),
              appendOutcome: Effect.fn("ExecutionLedgerTest.appendOutcome")(function* () {}),
              readDecisions: Effect.fn("ExecutionLedgerTest.readDecisions")(function* () {
                return [];
              }),
              readOutcomes: Effect.fn("ExecutionLedgerTest.readOutcomes")(function* () {
                return [];
              }),
              readUnsettledAllowed: Effect.fn("ExecutionLedgerTest.readUnsettledAllowed")(function* () {
                return [];
              }),
            })
          )
        );

        expect(typeof ledger.appendDecision).toBe("function");
        expect(typeof ledger.readUnsettledAllowed).toBe("function");
      })
    );
  });
});
