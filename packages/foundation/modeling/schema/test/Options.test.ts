import { OptionFromOptionalNullishKey } from "@beep/schema/Options";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

describe("OptionFromOptionalNullishKey", () => {
  it("decodes omitted, null, and undefined keys as None", () => {
    const Payload = S.Struct({
      nickname: OptionFromOptionalNullishKey(S.String),
    });

    const decode = S.decodeUnknownSync(Payload);

    expect(decode({}).nickname).toEqual(O.none());
    expect(decode({ nickname: null }).nickname).toEqual(O.none());
    expect(decode({ nickname: undefined }).nickname).toEqual(O.none());
  });

  it("decodes present non-nullish values as Some", () => {
    const Payload = S.Struct({
      nickname: OptionFromOptionalNullishKey(S.String),
    });

    const decode = S.decodeUnknownSync(Payload);

    expect(decode({ nickname: "beep" }).nickname).toEqual(O.some("beep"));
  });

  it("omits None by default during encoding", () => {
    const Payload = S.Struct({
      nickname: OptionFromOptionalNullishKey(S.String),
    });

    const encode = S.encodeSync(Payload);

    expect(encode({ nickname: O.none() })).toEqual({});
  });

  it("can encode None as null when requested", () => {
    const Payload = S.Struct({
      homepage: OptionFromOptionalNullishKey(S.URLFromString, { onNoneEncoding: null }),
    });

    const encode = S.encodeSync(Payload);

    expect(encode({ homepage: O.none() })).toEqual({ homepage: null });
    expect(encode({ homepage: O.some(new URL("https://example.com")) })).toEqual({
      homepage: "https://example.com/",
    });
  });

  it("round-trips Option values derived from the source schema", () => {
    const Payload = S.Struct({
      nickname: OptionFromOptionalNullishKey(S.String),
    });

    const decode = S.decodeUnknownSync(Payload);
    const encode = S.encodeSync(Payload);
    const arbitrary = S.toArbitrary(Payload);

    fc.assert(
      fc.property(arbitrary, (payload) => {
        expect(decode(encode(payload))).toEqual(payload);
      }),
      { numRuns: 50 }
    );
  });
});
