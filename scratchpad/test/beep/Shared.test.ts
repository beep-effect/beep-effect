import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/Arbitrary";
import { EmptyResponse, StatusResponse } from "../../beep/Shared.ts";

const decode = <A extends S.Codec<unknown, unknown, never, unknown>>(schema: A, input: unknown): A["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const fails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

describe("Shared", () => {
  it("decodes an empty body and a status acknowledgement", () => {
    expect(decode(EmptyResponse, {})).toBeInstanceOf(EmptyResponse);
    const ack = decode(StatusResponse, { status: "ok" });
    expect(ack.status).toBe("ok");
    expect(fails(StatusResponse, {})).toBe(true);
  });

  it("builds arbitraries for both responses", () => {
    expect(Arbitrary.isArbitrary(EmptyResponse.pipe(Arbitrary.schema))).toBe(true);
    expect(Arbitrary.isArbitrary(StatusResponse.pipe(Arbitrary.schema))).toBe(true);
  });
});
