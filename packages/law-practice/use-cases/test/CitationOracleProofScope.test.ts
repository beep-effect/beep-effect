import { CitationOracleLedgerProofPlan } from "@beep/law-practice-use-cases/test";
import { assert, describe, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const digest = Str.repeat(64)("0");
const proof = (scope: string) => ({
  command: "synthetic proof control",
  result: "passed",
  scope,
  operation: "extract",
  evidencePath: "test/synthetic-proof.json",
  evidenceSha256: digest,
  targetTests: [{ path: "test/synthetic-proof.test.ts", sha256: digest, name: "synthetic proof" }],
  references: [],
});
const binding = (workflowState: string, scope: string, id: string) => ({
  workflowState,
  cases: [{ id, observationSha256: digest }],
  rationale: "Synthetic proof-scope admission control.",
  proof: proof(scope),
});
const accepts = (bindings: ReadonlyArray<ReturnType<typeof binding>>) =>
  O.isSome(
    S.decodeUnknownOption(CitationOracleLedgerProofPlan)({ schemaVersion: "citation-ledger-proof-plan/v1", bindings })
  );

describe("citation proof-plan admission", () => {
  it("admits stage evidence as ready while requiring complete-case evidence for completion", () => {
    assert.isTrue(accepts([binding("ready", "stage", "case-a")]));
    assert.isTrue(accepts([binding("complete", "complete-case", "case-a")]));
    assert.isFalse(accepts([binding("complete", "stage", "case-a")]));
  });
  it("rejects duplicated source-case ownership across otherwise valid proof bindings", () => {
    assert.isFalse(accepts([binding("ready", "stage", "case-a"), binding("ready", "stage", "case-a")]));
    assert.isTrue(accepts([binding("ready", "stage", "case-a"), binding("complete", "complete-case", "case-b")]));
  });
});
