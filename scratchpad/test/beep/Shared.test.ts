import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import { EmptyResponse, StatusResponse } from "../../beep/Shared.ts";

describe("Shared", () => {
  it("decodes an empty body and a status acknowledgement", () => {
    expect(Effect.runSync(S.decodeUnknownEffect(EmptyResponse)({}))).toBeInstanceOf(EmptyResponse);
    const ack = Effect.runSync(S.decodeUnknownEffect(StatusResponse)({ status: "ok" }));
    expect(ack.status).toBe("ok");
    expect(Effect.runSyncExit(S.decodeUnknownEffect(StatusResponse)({}))._tag).toBe("Failure");
  });

  it("builds arbitraries for both responses", () => {
    expect(Arbitrary.isArbitrary(EmptyResponse.pipe(Arbitrary.schema))).toBe(true);
    expect(Arbitrary.isArbitrary(StatusResponse.pipe(Arbitrary.schema))).toBe(true);
  });
});
