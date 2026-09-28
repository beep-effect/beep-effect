import {
  ExecutionLedger,
  ExecutionLedgerConstraintViolation,
  ExecutionLedgerError,
  ExecutionLedgerOperation,
  ExecutionLedgerUnavailable,
} from "@beep/epistemic-use-cases/ExecutionLedger";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertNone, assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const isExecutionLedgerError = S.is(ExecutionLedgerError);

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
      pipe(ExecutionLedgerConstraintViolation.is(violation), assertTrue);
    });
  });

  describe("ExecutionLedgerUnavailable", () => {
    it("retains an optional driver defect as its cause", () => {
      const bare = ExecutionLedgerUnavailable.during("readDecisions", "read failed");
      const caused = ExecutionLedgerUnavailable.during("appendOutcome", "write failed", new Error("ECONNRESET"));

      expect(bare._tag).toBe("ExecutionLedgerUnavailable");
      assertNone(bare.cause);
      expect(bare.reason).toBe("read failed");
      pipe(caused.cause, O.isSome, assertTrue);
      expect(caused.operation).toBe("appendOutcome");
      pipe(ExecutionLedgerUnavailable.is(caused), assertTrue);
    });

    it("rejects an empty reason at construction", () => {
      expect(() => ExecutionLedgerUnavailable.during("readOutcomes", "")).toThrow();
    });
  });

  describe("ExecutionLedgerError", () => {
    it("admits exactly the two ledger failures", () => {
      const violation = ExecutionLedgerConstraintViolation.on("appendDecision", "epistemic_execution_outcome_pk");
      const unavailable = ExecutionLedgerUnavailable.during("readUnsettledAllowed", "read failed");

      pipe(ExecutionLedgerError.is(violation), assertTrue);
      pipe(ExecutionLedgerError.is(unavailable), assertTrue);
      pipe(ExecutionLedgerError.is({ _tag: "SomethingElse" }), assertFalse);
      pipe(isExecutionLedgerError(new Error("plain")), assertFalse);
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
