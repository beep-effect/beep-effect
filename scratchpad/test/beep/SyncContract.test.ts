import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import {
  SyncLocalFilesV2Response,
  SyncRecoveryWindowExceededResponse,
  SyncRequestValidationErrorResponse,
  syncLocalFilesV2Responses,
} from "../../beep/SyncContract.ts";

const isSyncRecoveryWindowExceededResponse = S.is(SyncRecoveryWindowExceededResponse);
const isSyncRequestValidationErrorResponse = S.is(SyncRequestValidationErrorResponse);
const decodeSyncLocalFilesV2Response = S.decodeUnknownEffect(SyncLocalFilesV2Response);

const decode = <A extends S.Codec<unknown, unknown, never, unknown>>(schema: A, input: unknown): A["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

describe("SyncContract", () => {
  it("decodes both untagged 422 members", () => {
    const recovery = decode(SyncLocalFilesV2Response, { code: "window", detail: "too old" });
    const withLane = decode(SyncRecoveryWindowExceededResponse, { code: "window", detail: "too old", lane: null });
    const validation = decode(SyncLocalFilesV2Response, { detail: [{ type: "missing" }] });
    expect(isSyncRecoveryWindowExceededResponse(recovery)).toBe(true);
    if (isSyncRecoveryWindowExceededResponse(recovery)) expect(O.isNone(recovery.lane)).toBe(true);
    expect(O.isNone(withLane.lane)).toBe(true);
    expect(isSyncRequestValidationErrorResponse(validation)).toBe(true);
    if (isSyncRequestValidationErrorResponse(validation)) expect(validation.detail).toHaveLength(1);
    expect(Effect.runSyncExit(decodeSyncLocalFilesV2Response({ detail: "missing code" }))._tag).toBe(
      "Failure",
    );
  });

  it("keeps the OpenAPI description and builds arbitraries", () => {
    expect(syncLocalFilesV2Responses[422].description).toBe(
      "Automatic recovery window exceeded or malformed request",
    );
    expect(Arbitrary.isArbitrary(SyncLocalFilesV2Response.pipe(Arbitrary.schema))).toBe(true);
    expect(Arbitrary.isArbitrary(SyncRecoveryWindowExceededResponse.pipe(Arbitrary.schema))).toBe(true);
    expect(Arbitrary.isArbitrary(SyncRequestValidationErrorResponse.pipe(Arbitrary.schema))).toBe(true);
  });
});
