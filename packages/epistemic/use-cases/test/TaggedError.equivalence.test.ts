import { LogicalEdgeKey } from "@beep/epistemic-domain/values";
import { ContradictionCandidateKey } from "@beep/epistemic-domain/values/Contradiction";
import { ClaimDispositionRepositoryUnavailable } from "@beep/epistemic-use-cases/ClaimDisposition";
import {
  EdgeConstraintViolation,
  EdgeRepositoryUnavailable,
  SupersessionConflict,
} from "@beep/epistemic-use-cases/EdgeAuthority";
import {
  ExecutionLedgerConstraintViolation,
  ExecutionLedgerUnavailable,
} from "@beep/epistemic-use-cases/ExecutionLedger";
import { ContradictionActionError } from "@beep/epistemic-use-cases/public";
import {
  ContradictionRepositoryUnavailable,
  ContradictionReviewConflict,
  ContradictionSubmissionConflict,
} from "@beep/epistemic-use-cases/server";
import { PosInt } from "@beep/schema/Int";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const expectDeclaredEquivalence = <Schema extends S.Top>(
  schema: Schema,
  a: Schema["Type"],
  b: Schema["Type"],
  c: Schema["Type"]
): void => {
  const same = S.toEquivalence(schema);

  expect(same(a, b)).toBe(true);
  expect(same(a, c)).toBe(false);
};

const candidateId = Epistemic.ContradictionCandidateId.make(1);
const otherCandidateId = Epistemic.ContradictionCandidateId.make(2);
const candidateKey = ContradictionCandidateKey.make(Str.repeat(64)("a"));
const otherCandidateKey = ContradictionCandidateKey.make(Str.repeat(64)("b"));
const logicalKey = LogicalEdgeKey.make(Str.repeat(64)("c"));
const expectedVersion = PosInt.make(1);
const otherExpectedVersion = PosInt.make(2);

describe("epistemic-use-cases tagged-error declared equivalence", () => {
  it("excludes ClaimDispositionRepositoryUnavailable cause while comparing diagnostics", () => {
    expectDeclaredEquivalence(
      ClaimDispositionRepositoryUnavailable,
      ClaimDispositionRepositoryUnavailable.during("record", "insert failed", { code: "cause-a" }),
      ClaimDispositionRepositoryUnavailable.during("record", "insert failed", { code: "cause-b" }),
      ClaimDispositionRepositoryUnavailable.during("record", "transaction aborted", { code: "cause-a" })
    );
  });

  it("compares contradiction errors by stable declared fields and excludes repository cause", () => {
    expectDeclaredEquivalence(
      ContradictionRepositoryUnavailable,
      ContradictionRepositoryUnavailable.during("review", "database unavailable", { code: "cause-a" }),
      ContradictionRepositoryUnavailable.during("review", "database unavailable", { code: "cause-b" }),
      ContradictionRepositoryUnavailable.during("review", "transaction aborted", { code: "cause-a" })
    );
    expectDeclaredEquivalence(
      ContradictionReviewConflict,
      ContradictionReviewConflict.make({ candidateId, reason: "not-found" }),
      ContradictionReviewConflict.make({ candidateId, reason: "not-found" }),
      ContradictionReviewConflict.make({ candidateId: otherCandidateId, reason: "not-found" })
    );
    expectDeclaredEquivalence(
      ContradictionSubmissionConflict,
      ContradictionSubmissionConflict.make({ candidateKey, reason: "candidate-payload-mismatch" }),
      ContradictionSubmissionConflict.make({ candidateKey, reason: "candidate-payload-mismatch" }),
      ContradictionSubmissionConflict.make({
        candidateKey: otherCandidateKey,
        reason: "candidate-payload-mismatch",
      })
    );
    expectDeclaredEquivalence(
      ContradictionActionError,
      ContradictionActionError.make({ reason: "candidate-not-found" }),
      ContradictionActionError.make({ reason: "candidate-not-found" }),
      ContradictionActionError.make({ reason: "candidate-already-resolved" })
    );
  });

  it("compares edge errors by stable declared fields and excludes opaque causes", () => {
    expectDeclaredEquivalence(
      SupersessionConflict,
      SupersessionConflict.backstop(logicalKey, expectedVersion, { code: "cause-a" }),
      SupersessionConflict.backstop(logicalKey, expectedVersion, { code: "cause-b" }),
      SupersessionConflict.backstop(logicalKey, otherExpectedVersion, { code: "cause-a" })
    );
    expectDeclaredEquivalence(
      EdgeConstraintViolation,
      EdgeConstraintViolation.on("record", "epistemic_edge_valid_ordered"),
      EdgeConstraintViolation.on("record", "epistemic_edge_valid_ordered"),
      EdgeConstraintViolation.on("record", "epistemic_edge_endpoint_kind")
    );
    expectDeclaredEquivalence(
      EdgeRepositoryUnavailable,
      EdgeRepositoryUnavailable.during("readLatest", "database unavailable", { code: "cause-a" }),
      EdgeRepositoryUnavailable.during("readLatest", "database unavailable", { code: "cause-b" }),
      EdgeRepositoryUnavailable.during("readLatest", "transaction aborted", { code: "cause-a" })
    );
  });

  it("compares ledger errors by stable declared fields and excludes opaque cause", () => {
    expectDeclaredEquivalence(
      ExecutionLedgerConstraintViolation,
      ExecutionLedgerConstraintViolation.on("appendDecision", "epistemic_execution_decision_pk"),
      ExecutionLedgerConstraintViolation.on("appendDecision", "epistemic_execution_decision_pk"),
      ExecutionLedgerConstraintViolation.on("appendOutcome", "epistemic_execution_outcome_pk")
    );
    expectDeclaredEquivalence(
      ExecutionLedgerUnavailable,
      ExecutionLedgerUnavailable.during("readDecisions", "database unavailable", { code: "cause-a" }),
      ExecutionLedgerUnavailable.during("readDecisions", "database unavailable", { code: "cause-b" }),
      ExecutionLedgerUnavailable.during("readDecisions", "transaction aborted", { code: "cause-a" })
    );
  });
});
