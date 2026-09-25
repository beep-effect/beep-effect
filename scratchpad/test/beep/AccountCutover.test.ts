import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  AccountCutoverCheckpointPhase,
  AccountCutoverClientAction,
  AccountCutoverControl,
  AccountCutoverManifestSummary,
  AccountCutoverRecord,
  AccountCutoverState,
  AccountCutoverTransitionRequest,
  OfflineQueueInstruction,
  PlatformMinimumBuild,
  persistedPayload,
} from "../../beep/AccountCutover.ts";

const decode = <A>(schema: S.ConstraintDecoder<A>, value: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(value));

const assertArbitrary = (schema: S.Top): void => {
  assert.notStrictEqual(schema.pipe(Arbitrary.schema), undefined);
};

describe("AccountCutover", () => {
  it("builds arbitrary values for every exported model", () => {
    assertArbitrary(AccountCutoverState);
    assertArbitrary(OfflineQueueInstruction);
    assertArbitrary(AccountCutoverClientAction);
    assertArbitrary(AccountCutoverCheckpointPhase);
    assertArbitrary(PlatformMinimumBuild);
    assertArbitrary(AccountCutoverManifestSummary);
    assertArbitrary(AccountCutoverRecord);
    assertArbitrary(AccountCutoverControl);
    assertArbitrary(AccountCutoverTransitionRequest);
  });

  it("constructs a legacy record and keeps null checkpoint fields", () => {
    const record = AccountCutoverRecord.make({ uid: "user-1" });
    assert.strictEqual(record.state, "legacy");
    assert.strictEqual(record.offlineQueueInstruction, "none");
    assert.strictEqual(O.isNone(record.checkpointToken), true);
    const payload = persistedPayload(record);
    assert.strictEqual(payload.schema_version, 1);
    assert.strictEqual(payload.checkpoint_token, null);
    assert.strictEqual(payload.manifest_id, null);
  });

  it("decodes a present manifest id and treats null as none", () => {
    const required = {
      schemaVersion: 1,
      uid: "user-1",
      state: "legacy",
      accountGeneration: 0,
      uiGeneration: 0,
      apiGeneration: 0,
      strandedNewData: false,
      offlineQueueInstruction: "none",
      checkpointPhase: "not_started",
      destinationBackendBound: false,
    };
    const present = decode(AccountCutoverRecord, {
      ...required,
      manifestId: "manifest-1",
      checkpointToken: "token-1",
    });
    assert.strictEqual(O.getOrNull(present.manifestId), "manifest-1");
    assert.strictEqual(O.getOrNull(present.checkpointToken), "token-1");
    const missing = decode(AccountCutoverRecord, required);
    assert.strictEqual(O.isNone(missing.manifestId), true);
    const cleared = decode(AccountCutoverRecord, { ...required, manifestId: null, checkpointToken: null });
    assert.strictEqual(O.isNone(cleared.manifestId), true);
    assert.strictEqual(O.isNone(cleared.checkpointToken), true);
  });

  it("opens product traffic by default and decodes a transition", () => {
    const control = AccountCutoverControl.make({});
    assert.strictEqual(control.legacyWritesAllowed, true);
    assert.strictEqual(control.clientAction, "none");
    assert.strictEqual(control.migration.checkpointPhase, "not_started");
    const request = decode(AccountCutoverTransitionRequest, {
      targetState: "migrating",
      expectedAccountGeneration: 0,
      reason: "fence",
      offlineQueueInstruction: null,
    });
    assert.strictEqual(request.targetState, "migrating");
    assert.strictEqual(O.isNone(request.offlineQueueInstruction), true);
    assert.strictEqual(O.isNone(request.nextAccountGeneration), true);
  });
});
