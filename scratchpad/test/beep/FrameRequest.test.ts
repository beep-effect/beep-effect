import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import {
  CreateFrameRequest,
  FrameRequest,
  FrameRequestBatch,
  FrameRequestCleanupState,
  FrameRequestEnvelope,
  FrameRequestPromotion,
  FrameRequestState,
  FrameRequestStateUpdate,
  decodeCreateFrameRequest,
  decodeFrameRequest,
  decodeFrameRequestStateUpdate,
  normalizeFrameInstant,
  stripOptionalFrameString,
  stripRequiredFrameString,
  validateFrameLifecycle,
  validateFrameStorageId,
  validateRequestId,
  validateStateUpdateStorageId,
} from "../../beep/FrameRequest.ts";

const at = () => DateTime.makeUnsafe("2020-01-02T03:04:05.000Z");

const frameDefaults = {
  account_generation: 0,
  dedupe_window: 0,
  attempt_number: 0,
  state: "requested",
  byte_count: 0,
  cleanup_state: "not_required",
  cleanup_attempts: 0,
};

const base = () =>
  FrameRequest.make({
    requestId: "r1",
    uid: "user-1",
    deviceId: "device-1",
    dedupeKey: "d1",
    createdAt: at(),
    expiresAt: at(),
  });

describe("FrameRequest", () => {
  it("strips identifiers and rejects slashes and urls", () => {
    assert.strictEqual(Effect.runSync(stripRequiredFrameString("  id  ")), "id");
    assert.strictEqual(Effect.runSyncExit(stripRequiredFrameString(1))._tag, "Failure");
    assert.strictEqual(Effect.runSyncExit(stripRequiredFrameString("  "))._tag, "Failure");
    assert.strictEqual(Effect.runSync(validateRequestId("abc")), "abc");
    assert.strictEqual(Effect.runSyncExit(validateRequestId("a/b"))._tag, "Failure");
    assert.strictEqual(O.isNone(Effect.runSync(stripOptionalFrameString("  "))), true);
    assert.strictEqual(O.isNone(Effect.runSync(stripOptionalFrameString(null))), true);
    assert.strictEqual(Effect.runSyncExit(stripOptionalFrameString(2))._tag, "Failure");
    assert.strictEqual(O.isNone(Effect.runSync(validateFrameStorageId(O.none()))), true);
    assert.strictEqual(Effect.runSyncExit(validateFrameStorageId(O.some("https:abc")))._tag, "Failure");
    assert.strictEqual(O.isNone(Effect.runSync(validateStateUpdateStorageId("   "))), true);
    assert.strictEqual(O.getOrElse(Effect.runSync(validateStateUpdateStorageId(" sid ")), () => ""), "sid");
  });

  it("normalizes naive time and checks lifecycle branches", () => {
    assert.strictEqual(O.isSome(Effect.runSync(normalizeFrameInstant(O.some("2020-01-02T03:04:05.000")))), true);
    assert.strictEqual(O.isNone(Effect.runSync(normalizeFrameInstant(O.none()))), true);
    const later = DateTime.makeUnsafe("2020-01-02T04:04:05.000Z");
    assert.strictEqual(Effect.runSync(validateFrameLifecycle(base())).state, "requested");
    assert.strictEqual(
      Effect.runSyncExit(validateFrameLifecycle(FrameRequest.make({ ...base(), createdAt: later, expiresAt: at() })))._tag,
      "Failure",
    );
    assert.strictEqual(Effect.runSyncExit(validateFrameLifecycle(FrameRequest.make({ ...base(), state: "attached" })))._tag, "Failure");
    const attached = FrameRequest.make({ ...base(), state: "attached", conversationId: O.some("c1") });
    assert.strictEqual(Effect.runSync(validateFrameLifecycle(attached)).state, "attached");
    assert.strictEqual(
      Effect.runSyncExit(validateFrameLifecycle(FrameRequest.make({ ...attached, expiresAt: later })))._tag,
      "Failure",
    );
    assert.strictEqual(
      Effect.runSyncExit(validateFrameLifecycle(FrameRequest.make({ ...attached, terminalReason: O.some("done") })))._tag,
      "Failure",
    );
    assert.strictEqual(Effect.runSyncExit(validateFrameLifecycle(FrameRequest.make({ ...base(), state: "failed" })))._tag, "Failure");
    const failed = FrameRequest.make({ ...base(), state: "failed", terminalReason: O.some("gone") });
    assert.strictEqual(Effect.runSync(validateFrameLifecycle(failed)).state, "failed");
    assert.strictEqual(Effect.runSyncExit(validateFrameLifecycle(FrameRequest.make({ ...base(), state: "uploaded" })))._tag, "Failure");
    const uploaded = FrameRequest.make({ ...base(), state: "uploaded", storageId: O.some("sid") });
    assert.strictEqual(Effect.runSync(validateFrameLifecycle(uploaded)).state, "uploaded");
  });

  it("decodes present, null, and missing fields and rejects extra keys", () => {
    const decoded = Effect.runSync(
      decodeFrameRequest({
        ...frameDefaults,
        request_id: " r1 ",
        uid: "user-1",
        device_id: "device-1",
        dedupe_key: "d1",
        created_at: "2020-01-02T03:04:05.000",
        expires_at: "2020-01-02T04:04:05.000Z",
        storage_id: null,
        conversation_id: "  ",
      }),
    );
    assert.strictEqual(decoded.requestId, "r1");
    assert.strictEqual(O.isNone(decoded.storageId), true);
    assert.strictEqual(O.isNone(decoded.conversationId), true);
    assert.strictEqual(O.isNone(decoded.claimedAt), true);
    assert.strictEqual(
      Effect.runSyncExit(decodeFrameRequest({
        ...frameDefaults,
        request_id: "r1",
        uid: "user-1",
        device_id: "device-1",
        dedupe_key: "d1",
        created_at: "2020-01-02T03:04:05.000Z",
        expires_at: "2020-01-02T04:04:05.000Z",
        extra: true,
      }))._tag,
      "Failure",
    );
    const created = Effect.runSync(
      decodeCreateFrameRequest({
        device_id: " d ",
        account_generation: 0,
        dedupe_key: "k",
        requested_ttl_seconds: null,
      }),
    );
    assert.strictEqual(created.deviceId, " d ");
    assert.strictEqual(O.isNone(created.requestedTtlSeconds), true);
    const update = Effect.runSync(
      decodeFrameRequestStateUpdate({
        state: "uploaded",
        device_id: "device-1",
        account_generation: 0,
        byte_count: 0,
        storage_id: " sid ",
      }),
    );
    assert.strictEqual(O.getOrElse(update.storageId, () => ""), "sid");
    assert.strictEqual(FrameRequestBatch.make({}).requests.length, 0);
    assert.strictEqual(FrameRequest.make(base()).byteCount, 0);
  });

  it("derives an arbitrary for each model", () => {
    for (const schema of [
      FrameRequestState,
      FrameRequestCleanupState,
      FrameRequest,
      CreateFrameRequest,
      FrameRequestStateUpdate,
      FrameRequestPromotion,
      FrameRequestEnvelope,
      FrameRequestBatch,
    ]) {
      assert.strictEqual(Arbitrary.isArbitrary(Arbitrary.schema(schema)), true);
    }
  });
});
