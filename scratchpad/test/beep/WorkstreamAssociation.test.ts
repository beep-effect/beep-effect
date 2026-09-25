import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  AssociationAdjudicationInput,
  AssociationCandidateView,
  AssociationEvidence,
  AssociationJudgment,
  AssociationOutcome,
  AssociationOutcomeKind,
  AssociationReason,
  RecurrenceConsumptionOutcome,
  RecurrenceInboxReceipt,
  RecurrenceInboxStatus,
  RecurrenceOutcomeKind,
  WorkstreamAssociationError,
  WorkstreamIndexRebuildReport,
  decodeAssociationJudgment,
  validateAssociationJudgment,
} from "../../beep/WorkstreamAssociation.ts";

const isWorkstreamAssociationError = S.is(WorkstreamAssociationError);
const encodeAssociationJudgment = S.encodeEffect(AssociationJudgment);
const encodeAssociationOutcome = S.encodeEffect(AssociationOutcome);
const encodeRecurrenceConsumptionOutcome = S.encodeEffect(RecurrenceConsumptionOutcome);
const encodeRecurrenceInboxReceipt = S.encodeEffect(RecurrenceInboxReceipt);

const decode = <Sch extends S.Codec<unknown, unknown, never, unknown>>(schema: Sch, input: unknown): Sch["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const evidenceRef = { kind: "conversation", id: "c1", scope: "canonical" };

const candidate = { workstreamId: "w1", objective: "Ship the launch", currentStateSummary: "" };

const signal = {
  signalId: "sig-1",
  title: "Weekly report",
  objective: "Send the weekly report",
  anchorTaskDescription: "Draft the report",
  occurrenceCount: 3,
  distinctDayCount: 2,
  unresolved: true,
  confidence: 0.75,
  firstSeenAt: "2020-01-02T03:04:05Z",
  lastSeenAt: "2020-01-03T03:04:05Z",
  evidenceRefs: [{ kind: "memory_item", id: "m1", scope: "canonical" }],
};

const receiptInput = {
  receiptId: "r1",
  loopKey: "loop-1",
  accountGeneration: 2,
  status: "pending",
  signal,
  attempts: 1,
  lastOutcome: "below_threshold",
  lastErrorCode: "E1",
  createdAt: "2020-01-02T03:04:05.000Z",
  updatedAt: "2020-01-02T04:04:05.000Z",
};

const failureMessage = (exit: Exit.Exit<unknown, unknown>): string =>
  Exit.match(exit, {
    onFailure: (cause) =>
      cause.pipe(
        Cause.findErrorOption,
        O.filter(isWorkstreamAssociationError),
        O.map((error) => error.message),
        O.getOrElse(() => "no-fail"),
      ),
    onSuccess: () => "success",
  });

describe("WorkstreamAssociation", () => {
  it("decodes AssociationEvidence and enforces the ref bounds", () => {
    const evidence = decode(AssociationEvidence, { evidenceId: "e1", summary: "Talked about launch", evidenceRefs: [evidenceRef] });
    assert.strictEqual(evidence.evidenceRefs.length, 1);
    assert.strictEqual(evidence.evidenceRefs[0]?.kind, "conversation");
    assert.strictEqual(decodeFails(AssociationEvidence, { evidenceId: "e1", summary: "x", evidenceRefs: [] }), true);
    assert.strictEqual(decodeFails(AssociationEvidence, { evidenceId: "e1", summary: "", evidenceRefs: [evidenceRef] }), true);
    assert.strictEqual(
      decodeFails(AssociationEvidence, { evidenceId: "e1", summary: "x".repeat(2001), evidenceRefs: [evidenceRef] }),
      true,
    );
  });

  it("decodes AssociationCandidateView with an empty summary and caps its length", () => {
    const view = decode(AssociationCandidateView, candidate);
    assert.strictEqual(view.currentStateSummary, "");
    assert.strictEqual(decodeFails(AssociationCandidateView, { ...candidate, currentStateSummary: "x".repeat(4001) }), true);
    assert.strictEqual(decodeFails(AssociationCandidateView, { ...candidate, objective: "" }), true);
  });

  it("defaults the version literals on AssociationAdjudicationInput and bounds candidates", () => {
    const made = AssociationAdjudicationInput.make({
      evidenceSummary: "Launch",
      candidates: [AssociationCandidateView.make(candidate)],
    });
    assert.strictEqual(made.schemaVersion, 1);
    assert.strictEqual(made.policyVersion, "association.v1");
    const decoded = decode(AssociationAdjudicationInput, {
      schemaVersion: 1,
      policyVersion: "association.v1",
      evidenceSummary: "Launch",
      candidates: [candidate],
    });
    assert.strictEqual(decoded.candidates.length, 1);
    assert.strictEqual(decodeFails(AssociationAdjudicationInput, { schemaVersion: 2, policyVersion: "association.v1", evidenceSummary: "L", candidates: [candidate] }), true);
    assert.strictEqual(
      decodeFails(AssociationAdjudicationInput, {
        schemaVersion: 1,
        policyVersion: "association.v1",
        evidenceSummary: "L",
        candidates: [candidate, candidate, candidate, candidate, candidate, candidate],
      }),
      true,
    );
    assert.strictEqual(
      decodeFails(AssociationAdjudicationInput, { schemaVersion: 1, policyVersion: "association.v1", evidenceSummary: "L", candidates: [] }),
      true,
    );
  });

  it("decodes every AssociationReason, AssociationOutcomeKind, RecurrenceOutcomeKind, and RecurrenceInboxStatus member", () => {
    for (const reason of ["selected", "no_match", "immaterial", "ambiguous", "model_unavailable"]) {
      assert.strictEqual(decode(AssociationReason, reason), reason);
    }
    assert.strictEqual(decodeFails(AssociationReason, "none"), true);
    for (const kind of [
      "workflow_disabled",
      "no_candidates",
      "no_match",
      "immaterial",
      "minimization_rejected",
      "would_append",
      "appended",
    ]) {
      assert.strictEqual(decode(AssociationOutcomeKind, kind), kind);
    }
    for (const kind of ["workflow_disabled", "below_threshold", "would_create", "candidate_created"]) {
      assert.strictEqual(decode(RecurrenceOutcomeKind, kind), kind);
    }
    for (const status of ["pending", "completed"]) assert.strictEqual(decode(RecurrenceInboxStatus, status), status);
    assert.strictEqual(decodeFails(RecurrenceInboxStatus, "failed"), true);
  });

  it("decodes AssociationJudgment Option fields from present, null, and missing keys", () => {
    const present = decode(AssociationJudgment, {
      schemaVersion: 1,
      policyVersion: "association.v1",
      workstreamId: "w1",
      material: true,
      reason: "selected",
      eventSummary: "Launch prep",
    });
    assert.strictEqual(O.getOrNull(present.workstreamId), "w1");
    assert.strictEqual(O.getOrNull(present.eventSummary), "Launch prep");
    const nulls = decode(AssociationJudgment, {
      schemaVersion: 1,
      policyVersion: "association.v1",
      workstreamId: null,
      material: false,
      reason: "no_match",
      eventSummary: null,
    });
    assert.strictEqual(O.isNone(nulls.workstreamId), true);
    assert.strictEqual(O.isNone(nulls.eventSummary), true);
    const missing = decode(AssociationJudgment, { schemaVersion: 1, policyVersion: "association.v1", material: false, reason: "no_match" });
    assert.strictEqual(O.isNone(missing.workstreamId), true);
    const encoded = Effect.runSync(encodeAssociationJudgment(missing));
    assert.strictEqual(encoded.workstreamId, null);
    assert.strictEqual(encoded.eventSummary, null);
    assert.strictEqual(encoded.policyVersion, "association.v1");
    const versions = { schemaVersion: 1, policyVersion: "association.v1" };
    assert.strictEqual(decodeFails(AssociationJudgment, { ...versions, material: false, reason: "no_match", eventSummary: "" }), true);
    assert.strictEqual(
      decodeFails(AssociationJudgment, { ...versions, material: false, reason: "no_match", eventSummary: "x".repeat(501) }),
      true,
    );
    assert.strictEqual(decodeFails(AssociationJudgment, { material: false, reason: "no_match" }), true);
  });

  it("validateAssociationJudgment accepts the legal pairings", () => {
    const material = AssociationJudgment.make({ material: true, reason: "selected", workstreamId: O.some("w1"), eventSummary: O.some("s") });
    assert.strictEqual(Effect.runSync(validateAssociationJudgment(material)), material);
    for (const reason of ["no_match", "ambiguous", "model_unavailable"] as const) {
      const judgment = AssociationJudgment.make({ material: false, reason });
      assert.strictEqual(validateAssociationJudgment(judgment).pipe(Effect.runSyncExit, Exit.isSuccess), true);
    }
    const immaterial = AssociationJudgment.make({ material: false, reason: "immaterial", workstreamId: O.some("w1") });
    assert.strictEqual(validateAssociationJudgment(immaterial).pipe(Effect.runSyncExit, Exit.isSuccess), true);
  });

  it("validateAssociationJudgment rejects each illegal pairing with the Python message", () => {
    const run = (judgment: AssociationJudgment) => validateAssociationJudgment(judgment).pipe(Effect.runSyncExit, failureMessage);
    assert.strictEqual(
      run(AssociationJudgment.make({ material: true, reason: "selected", eventSummary: O.some("s") })),
      "material association requires workstream_id",
    );
    assert.strictEqual(
      run(AssociationJudgment.make({ material: true, reason: "ambiguous", workstreamId: O.some("w1"), eventSummary: O.some("s") })),
      "material association requires selected reason",
    );
    assert.strictEqual(
      run(AssociationJudgment.make({ material: true, reason: "selected", workstreamId: O.some("w1") })),
      "material association requires a minimized event_summary",
    );
    assert.strictEqual(run(AssociationJudgment.make({ material: false, reason: "selected" })), "selected reason requires material association");
    assert.strictEqual(
      run(AssociationJudgment.make({ material: false, reason: "no_match", eventSummary: O.some("s") })),
      "non-material association must not emit an event_summary",
    );
    assert.strictEqual(
      run(AssociationJudgment.make({ material: false, reason: "no_match", workstreamId: O.some("w1") })),
      "a non-material workstream selection requires immaterial reason",
    );
    assert.strictEqual(run(AssociationJudgment.make({ material: false, reason: "immaterial" })), "immaterial reason requires a workstream selection");
  });

  it("decodeAssociationJudgment decodes then validates", () => {
    const versions = { schemaVersion: 1, policyVersion: "association.v1" };
    const ok = Effect.runSync(
      decodeAssociationJudgment({ ...versions, material: true, reason: "selected", workstreamId: "w1", eventSummary: "Launch" }),
    );
    assert.strictEqual(ok.material, true);
    assert.strictEqual(
      decodeAssociationJudgment({ ...versions, material: true, reason: "selected" }).pipe(Effect.runSyncExit, failureMessage),
      "material association requires workstream_id",
    );
    assert.strictEqual(Effect.runSyncExit(decodeAssociationJudgment({ ...versions, material: "yes", reason: "selected" }))._tag, "Failure");
  });

  it("decodes AssociationOutcome with defaults, present values, and null Option fields", () => {
    const made = AssociationOutcome.make({ outcome: "no_candidates" });
    assert.deepStrictEqual(made.retrievedCandidateIds, []);
    assert.deepStrictEqual(made.hydratedCandidateIds, []);
    assert.strictEqual(made.policyVersion, "association.v1");
    assert.strictEqual(O.isNone(made.judgmentReason), true);
    const present = decode(AssociationOutcome, {
      outcome: "appended",
      retrievedCandidateIds: ["w1", "w2"],
      hydratedCandidateIds: ["w1"],
      workstreamId: "w1",
      eventId: "ev1",
      judgmentReason: "selected",
      policyVersion: "association.v1",
    });
    assert.strictEqual(O.getOrNull(present.judgmentReason), "selected");
    assert.strictEqual(O.getOrNull(present.eventId), "ev1");
    const nulls = decode(AssociationOutcome, {
      outcome: "no_match",
      retrievedCandidateIds: [],
      hydratedCandidateIds: [],
      workstreamId: null,
      eventId: null,
      judgmentReason: null,
      policyVersion: "association.v1",
    });
    assert.strictEqual(O.isNone(nulls.workstreamId), true);
    assert.strictEqual(O.isNone(nulls.judgmentReason), true);
    const encoded = Effect.runSync(encodeAssociationOutcome(nulls));
    assert.strictEqual(encoded.judgmentReason, null);
    assert.strictEqual(encoded.workstreamId, null);
    assert.strictEqual(
      decodeFails(AssociationOutcome, {
        outcome: "appended",
        retrievedCandidateIds: Array.from({ length: 21 }, (_, index) => `w${index}`),
        hydratedCandidateIds: [],
        policyVersion: "association.v1",
      }),
      true,
    );
    assert.strictEqual(
      decodeFails(AssociationOutcome, {
        outcome: "appended",
        retrievedCandidateIds: [],
        hydratedCandidateIds: ["a", "b", "c", "d", "e", "f"],
        policyVersion: "association.v1",
      }),
      true,
    );
  });

  it("decodes WorkstreamIndexRebuildReport with the frozen index version", () => {
    const made = WorkstreamIndexRebuildReport.make({ uid: "u1", sourceCount: 3, indexedCount: 2 });
    assert.strictEqual(made.indexVersion, "workstream-association-v2");
    assert.deepStrictEqual(made.failedWorkstreamIds, []);
    const decoded = decode(WorkstreamIndexRebuildReport, {
      uid: "u1",
      indexVersion: "workstream-association-v2",
      sourceCount: 3,
      indexedCount: 2,
      failedWorkstreamIds: ["w3"],
    });
    assert.deepStrictEqual(decoded.failedWorkstreamIds, ["w3"]);
    assert.strictEqual(
      decodeFails(WorkstreamIndexRebuildReport, { uid: "u1", indexVersion: "workstream-association-v1", sourceCount: 0, indexedCount: 0, failedWorkstreamIds: [] }),
      true,
    );
    assert.strictEqual(
      decodeFails(WorkstreamIndexRebuildReport, { uid: "u1", indexVersion: "workstream-association-v2", sourceCount: -1, indexedCount: 0, failedWorkstreamIds: [] }),
      true,
    );
  });

  it("decodes RecurrenceConsumptionOutcome with present, null, and missing optional ids", () => {
    const present = decode(RecurrenceConsumptionOutcome, {
      outcome: "candidate_created",
      signalId: "sig-1",
      candidateId: "cand-1",
      idempotencyKey: "key-1",
    });
    assert.strictEqual(O.getOrNull(present.candidateId), "cand-1");
    const nulls = decode(RecurrenceConsumptionOutcome, { outcome: "would_create", signalId: "sig-1", candidateId: null, idempotencyKey: null });
    assert.strictEqual(O.isNone(nulls.candidateId), true);
    const missing = decode(RecurrenceConsumptionOutcome, { outcome: "workflow_disabled", signalId: "sig-1" });
    assert.strictEqual(O.isNone(missing.idempotencyKey), true);
    const encoded = Effect.runSync(encodeRecurrenceConsumptionOutcome(missing));
    assert.strictEqual(encoded.candidateId, null);
    assert.strictEqual(encoded.idempotencyKey, null);
    assert.strictEqual(decodeFails(RecurrenceConsumptionOutcome, { outcome: "created", signalId: "sig-1" }), true);
  });

  it("decodes RecurrenceInboxReceipt with its embedded signal and optional fields", () => {
    const receipt = decode(RecurrenceInboxReceipt, receiptInput);
    assert.strictEqual(receipt.signal.signalId, "sig-1");
    assert.strictEqual(receipt.signal.evidenceRefs[0]?.kind, "memory_item");
    assert.strictEqual(O.getOrNull(receipt.lastOutcome), "below_threshold");
    assert.strictEqual(O.getOrNull(receipt.lastErrorCode), "E1");
    assert.strictEqual(DateTime.formatIso(receipt.createdAt), "2020-01-02T03:04:05.000Z");
    const nulls = decode(RecurrenceInboxReceipt, { ...receiptInput, lastOutcome: null, lastErrorCode: null });
    assert.strictEqual(O.isNone(nulls.lastOutcome), true);
    assert.strictEqual(O.isNone(nulls.lastErrorCode), true);
    const { lastOutcome: _lastOutcome, lastErrorCode: _lastErrorCode, ...rest } = receiptInput;
    const missing = decode(RecurrenceInboxReceipt, rest);
    assert.strictEqual(O.isNone(missing.lastOutcome), true);
    assert.strictEqual(missing.attempts, 1);
    const { attempts: _attempts, ...withoutAttempts } = missing;
    assert.strictEqual(RecurrenceInboxReceipt.make(withoutAttempts).attempts, 0);
    const encoded = Effect.runSync(encodeRecurrenceInboxReceipt(missing));
    assert.strictEqual(encoded.lastOutcome, null);
    assert.strictEqual(encoded.lastErrorCode, null);
    assert.strictEqual(encoded.updatedAt, "2020-01-02T04:04:05.000Z");
    assert.strictEqual(decodeFails(RecurrenceInboxReceipt, { ...receiptInput, attempts: -1 }), true);
    assert.strictEqual(decodeFails(RecurrenceInboxReceipt, { ...receiptInput, accountGeneration: -1 }), true);
    assert.strictEqual(decodeFails(RecurrenceInboxReceipt, { ...receiptInput, status: "failed" }), true);
    assert.strictEqual(decodeFails(RecurrenceInboxReceipt, { ...receiptInput, signal: { ...signal, evidenceRefs: [] } }), true);
  });

  it("derives arbitraries for every model", () => {
    for (const schema of [
      AssociationEvidence,
      AssociationCandidateView,
      AssociationAdjudicationInput,
      AssociationJudgment,
      AssociationOutcome,
      WorkstreamIndexRebuildReport,
      RecurrenceConsumptionOutcome,
      RecurrenceInboxReceipt,
      AssociationReason,
      AssociationOutcomeKind,
      RecurrenceOutcomeKind,
      RecurrenceInboxStatus,
    ]) {
      assert.notStrictEqual(schema.pipe(Arbitrary.schema), undefined);
    }
  });
});
