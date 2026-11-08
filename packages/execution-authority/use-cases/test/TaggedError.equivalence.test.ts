import {
  ExecutionLedgerConstraintViolation,
  ExecutionLedgerUnavailable,
} from "@beep/execution-authority-use-cases/ExecutionLedger";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect/Function";
import * as S from "effect/Schema";

const expectDeclaredEquivalence = <Schema extends S.Top>(
  schema: Schema,
  a: Schema["Type"],
  b: Schema["Type"],
  c: Schema["Type"]
): void => {
  const same = S.toEquivalence(schema);

  pipe(same(a, b), assertTrue);
  pipe(same(a, c), assertFalse);
};

describe("execution-authority-use-cases tagged-error declared equivalence", () => {
  it("compares ledger errors by stable declared fields and excludes opaque cause", () => {
    expectDeclaredEquivalence(
      ExecutionLedgerConstraintViolation,
      ExecutionLedgerConstraintViolation.on("appendDecision", "execution_authority_decision_pk"),
      ExecutionLedgerConstraintViolation.on("appendDecision", "execution_authority_decision_pk"),
      ExecutionLedgerConstraintViolation.on("appendOutcome", "execution_authority_outcome_pk")
    );
    expectDeclaredEquivalence(
      ExecutionLedgerUnavailable,
      ExecutionLedgerUnavailable.during("readDecisions", "database unavailable", { code: "cause-a" }),
      ExecutionLedgerUnavailable.during("readDecisions", "database unavailable", { code: "cause-b" }),
      ExecutionLedgerUnavailable.during("readDecisions", "transaction aborted", { code: "cause-a" })
    );
  });
});
