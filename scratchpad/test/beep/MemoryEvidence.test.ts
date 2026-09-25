import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  ArtifactPreservationState,
  ArtifactRef,
  CheckedMemoryEvidence,
  MemoryEvidence,
  ProvenanceVisibility,
  RedactionStatus,
  SourceState,
  SourceStateReason,
  memoryEvidenceIssue,
} from "../../beep/MemoryEvidence.ts";

const encodeArtifactRef = S.encodeEffect(ArtifactRef);
const encodeMemoryEvidence = S.encodeEffect(MemoryEvidence);

const decode = <Sch extends S.Codec<unknown, unknown, never, unknown>>(schema: Sch, input: unknown): Sch["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const sourceStates: ReadonlyArray<string> = ["active", "missing", "tombstoned", "purged"];
const reasons: ReadonlyArray<string> = [
  "ephemeral_already_missing",
  "dropped_before_copy",
  "deleted_by_user",
  "account_purged",
  "copy_failed",
  "explicit_loss",
  "not_applicable",
];
const preservations: ReadonlyArray<string> = ["preserved", ...reasons];
const visibilities: ReadonlyArray<string> = ["visible", "redacted", "hidden"];
const redactions: ReadonlyArray<string> = ["active", "redacted", "tombstoned", "purged"];

const artifact = {
  artifactId: "art-1",
  uri: "gs://bucket/art-1",
  checksum: "abc",
  sizeBytes: 42,
  preservation: "preserved",
};

const full = {
  evidenceId: "ev-1",
  sourceType: "conversation",
  sourceId: "conv-1",
  sourceVersion: "v3",
  conversationId: "conv-1",
  artifactRefs: [artifact],
  artifactPreservation: "preserved",
  quoteRefs: [{ start: 0, end: 4 }],
  contentHash: "hash-1",
  lineageId: "lin-1",
  sourceState: "active",
  sourceStateReason: "not_applicable",
  provenanceVisibility: "visible",
  redactionStatus: "active",
  encryptionOrRedactionStatus: "active",
  patchId: "patch-1",
  commitId: "commit-1",
  clientDeviceId: "device-1",
  capturedAt: "2026-01-02T03:04:05.000Z",
  sourceSignal: "voice",
  extractorId: "extractor-1",
  extractorVersion: "1.0",
  captureConfidence: 0.75,
  independenceGroup: "group-1",
  attribution: "primary_user",
};

const minimal = {
  evidenceId: "ev-2",
  sourceType: "conversation",
  artifactRefs: [],
  artifactPreservation: "preserved",
  quoteRefs: [],
  sourceState: "active",
  provenanceVisibility: "visible",
  redactionStatus: "active",
  encryptionOrRedactionStatus: "active",
};

describe("MemoryEvidence literals", () => {
  it("accept every member and reject strangers", () => {
    for (const value of sourceStates) assert.strictEqual(decode(SourceState, value), value);
    for (const value of reasons) assert.strictEqual(decode(SourceStateReason, value), value);
    for (const value of preservations) assert.strictEqual(decode(ArtifactPreservationState, value), value);
    for (const value of visibilities) assert.strictEqual(decode(ProvenanceVisibility, value), value);
    for (const value of redactions) assert.strictEqual(decode(RedactionStatus, value), value);
    assert.strictEqual(decodeFails(SourceState, "preserved"), true);
    assert.strictEqual(decodeFails(SourceStateReason, "preserved"), true);
    assert.strictEqual(decodeFails(ArtifactPreservationState, "lost"), true);
    assert.strictEqual(decodeFails(ProvenanceVisibility, "public"), true);
    assert.strictEqual(decodeFails(RedactionStatus, "missing"), true);
  });
});

describe("ArtifactRef", () => {
  it("decodes present values", () => {
    const ref = decode(ArtifactRef, artifact);
    assert.strictEqual(O.getOrNull(ref.artifactId), "art-1");
    assert.strictEqual(O.getOrNull(ref.uri), "gs://bucket/art-1");
    assert.strictEqual(O.getOrNull(ref.checksum), "abc");
    assert.strictEqual(O.getOrNull(ref.sizeBytes), 42);
    assert.strictEqual(ref.preservation, "preserved");
  });

  it("decodes null and missing Option fields to None and encodes None as null", () => {
    const nulled = decode(ArtifactRef, { artifactId: null, uri: null, checksum: null, sizeBytes: null, preservation: "copy_failed" });
    assert.strictEqual(O.isNone(nulled.artifactId), true);
    assert.strictEqual(O.isNone(nulled.sizeBytes), true);
    const missing = decode(ArtifactRef, { preservation: "copy_failed" });
    assert.strictEqual(O.isNone(missing.artifactId), true);
    assert.strictEqual(O.isNone(missing.uri), true);
    assert.strictEqual(O.isNone(missing.checksum), true);
    assert.strictEqual(O.isNone(missing.sizeBytes), true);
    const encoded = Effect.runSync(encodeArtifactRef(missing));
    assert.strictEqual(encoded.artifactId, null);
    assert.strictEqual(encoded.uri, null);
    assert.strictEqual(encoded.checksum, null);
    assert.strictEqual(encoded.sizeBytes, null);
    assert.strictEqual(encoded.preservation, "copy_failed");
  });

  it("rejects blank text and a fractional size", () => {
    assert.strictEqual(decodeFails(ArtifactRef, { ...artifact, artifactId: "   " }), true);
    assert.strictEqual(decodeFails(ArtifactRef, { ...artifact, sizeBytes: 1.5 }), true);
    assert.strictEqual(decodeFails(ArtifactRef, { ...artifact, preservation: "lost" }), true);
  });
});

describe("MemoryEvidence", () => {
  it("decodes present values", () => {
    const evidence = decode(MemoryEvidence, full);
    assert.strictEqual(evidence.evidenceId, "ev-1");
    assert.strictEqual(O.getOrNull(evidence.sourceId), "conv-1");
    assert.strictEqual(O.getOrNull(evidence.sourceVersion), "v3");
    assert.strictEqual(O.getOrNull(evidence.conversationId), "conv-1");
    assert.strictEqual(evidence.artifactRefs.length, 1);
    assert.deepStrictEqual(evidence.quoteRefs, [{ start: 0, end: 4 }]);
    assert.strictEqual(O.getOrNull(evidence.sourceStateReason), "not_applicable");
    assert.strictEqual(O.getOrNull(evidence.clientDeviceId), "device-1");
    assert.strictEqual(O.getOrNull(evidence.captureConfidence), 0.75);
    assert.strictEqual(O.getOrNull(evidence.attribution), "primary_user");
    const captured = evidence.capturedAt.pipe(O.getOrThrow);
    assert.strictEqual(DateTime.formatIso(captured), "2026-01-02T03:04:05.000Z");
  });

  it("decodes missing Option fields to None, applies defaults, and encodes None as null", () => {
    const evidence = decode(MemoryEvidence, minimal);
    assert.strictEqual(O.isNone(evidence.sourceId), true);
    assert.strictEqual(O.isNone(evidence.sourceVersion), true);
    assert.strictEqual(O.isNone(evidence.conversationId), true);
    assert.strictEqual(O.isNone(evidence.contentHash), true);
    assert.strictEqual(O.isNone(evidence.sourceStateReason), true);
    assert.strictEqual(O.isNone(evidence.capturedAt), true);
    assert.strictEqual(O.isNone(evidence.captureConfidence), true);
    assert.strictEqual(O.isNone(evidence.clientDeviceId), true);
    assert.deepStrictEqual(evidence.artifactRefs, []);
    assert.deepStrictEqual(evidence.quoteRefs, []);
    const encoded = Effect.runSync(encodeMemoryEvidence(evidence));
    assert.strictEqual(encoded.sourceId, null);
    assert.strictEqual(encoded.capturedAt, null);
    assert.strictEqual(encoded.captureConfidence, null);
    assert.strictEqual(encoded.clientDeviceId, null);
    assert.strictEqual(encoded.sourceStateReason, null);
  });

  it("decodes explicit nulls to None", () => {
    const evidence = decode(MemoryEvidence, {
      ...full,
      sourceStateReason: null,
      capturedAt: null,
      captureConfidence: null,
      clientDeviceId: null,
      attribution: null,
    });
    assert.strictEqual(O.isNone(evidence.sourceStateReason), true);
    assert.strictEqual(O.isNone(evidence.capturedAt), true);
    assert.strictEqual(O.isNone(evidence.captureConfidence), true);
    assert.strictEqual(O.isNone(evidence.clientDeviceId), true);
    assert.strictEqual(O.isNone(evidence.attribution), true);
  });

  it("constructor defaults the three status fields and the lists", () => {
    const made = MemoryEvidence.make({ evidenceId: "ev-3", sourceType: "note", artifactPreservation: "preserved" });
    assert.strictEqual(made.sourceState, "active");
    assert.strictEqual(made.provenanceVisibility, "visible");
    assert.strictEqual(made.redactionStatus, "active");
    assert.strictEqual(made.encryptionOrRedactionStatus, "active");
    assert.deepStrictEqual(made.artifactRefs, []);
    assert.deepStrictEqual(made.quoteRefs, []);
  });

  it("rejects blank ids, a closed-literal stranger, and a confidence out of range", () => {
    assert.strictEqual(decodeFails(MemoryEvidence, { ...full, evidenceId: " " }), true);
    assert.strictEqual(decodeFails(MemoryEvidence, { ...full, sourceState: "lost" }), true);
    assert.strictEqual(decodeFails(MemoryEvidence, { ...full, provenanceVisibility: "public" }), true);
    assert.strictEqual(decodeFails(MemoryEvidence, { ...full, captureConfidence: 1.5 }), true);
    assert.strictEqual(decodeFails(MemoryEvidence, { ...full, clientDeviceId: "  " }), true);
  });
});

describe("memoryEvidenceIssue", () => {
  const issue = (patch: Record<string, unknown>): string | undefined =>
    memoryEvidenceIssue(decode(MemoryEvidence, { ...full, ...patch }));

  it("passes the full active record", () => {
    assert.strictEqual(issue({}), undefined);
  });

  it("active evidence needs a source id and version", () => {
    assert.strictEqual(issue({ sourceId: null }), "active evidence requires source_id");
    assert.strictEqual(issue({ sourceVersion: null }), "active evidence requires source_version");
  });

  it("every non-active source state needs a reason", () => {
    for (const state of ["missing", "tombstoned", "purged"]) {
      assert.strictEqual(
        issue({ sourceState: state, sourceStateReason: null }),
        "non-active source evidence requires source_state_reason",
      );
      assert.strictEqual(issue({ sourceState: state, sourceStateReason: "deleted_by_user", sourceId: null }), undefined);
    }
  });

  it("conversation evidence must agree on the conversation id", () => {
    assert.strictEqual(
      issue({ conversationId: "conv-9" }),
      "conversation_id must match source_id for conversation evidence",
    );
    assert.strictEqual(issue({ sourceType: "note", conversationId: "conv-9" }), undefined);
    assert.strictEqual(issue({ conversationId: null }), undefined);
  });

  it("artifact refs must share the row preservation", () => {
    assert.strictEqual(
      issue({ artifactRefs: [{ ...artifact, preservation: "copy_failed" }] }),
      "artifact_refs preservation must match evidence artifact_preservation",
    );
    assert.strictEqual(issue({ artifactRefs: [], artifactPreservation: "copy_failed" }), undefined);
  });

  it("CheckedMemoryEvidence enforces the same rules", () => {
    assert.strictEqual(decodeFails(CheckedMemoryEvidence, full), false);
    assert.strictEqual(decodeFails(CheckedMemoryEvidence, { ...full, sourceId: null }), true);
    assert.strictEqual(decodeFails(CheckedMemoryEvidence, { ...full, sourceState: "purged", sourceStateReason: null }), true);
    assert.strictEqual(decodeFails(CheckedMemoryEvidence, { ...full, conversationId: "other" }), true);
    assert.strictEqual(decodeFails(MemoryEvidence, { ...full, conversationId: "other" }), false);
  });
});

describe("arbitraries", () => {
  it("derive for every exported schema", () => {
    for (const schema of [
      SourceState,
      SourceStateReason,
      ArtifactPreservationState,
      ProvenanceVisibility,
      RedactionStatus,
      ArtifactRef,
      MemoryEvidence,
      CheckedMemoryEvidence,
    ]) {
      assert.strictEqual(Arbitrary.isArbitrary(schema.pipe(Arbitrary.schema)), true);
    }
  });
});
