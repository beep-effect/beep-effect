import { fcRuns } from "@beep/fc-runs";
import { OptionFromOptionalNullishKey } from "@beep/schema/Options";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const NicknamePayload = S.Struct({
  nickname: OptionFromOptionalNullishKey(S.String),
});
const decodeUnknownNicknamePayloadSync = S.decodeUnknownSync(NicknamePayload);
const encodeNicknamePayloadSync = S.encodeSync(NicknamePayload);
const HomepagePayload = S.Struct({
  homepage: OptionFromOptionalNullishKey({ schema: S.URLFromString, onNoneEncoding: null }),
});
const encodeHomepagePayloadSync = S.encodeSync(HomepagePayload);
const NicknamePayloadArbitrary = S.toArbitrary(NicknamePayload)(fc);

describe("OptionFromOptionalNullishKey", () => {
  it("decodes omitted, null, and undefined keys as None", () => {
    expect(decodeUnknownNicknamePayloadSync({}).nickname).toEqual(O.none());
    expect(decodeUnknownNicknamePayloadSync({ nickname: null }).nickname).toEqual(O.none());
    expect(decodeUnknownNicknamePayloadSync({ nickname: undefined }).nickname).toEqual(O.none());
  });

  it("decodes present non-nullish values as Some", () => {
    expect(decodeUnknownNicknamePayloadSync({ nickname: "beep" }).nickname).toEqual(O.some("beep"));
  });

  it("omits None by default during encoding", () => {
    expect(encodeNicknamePayloadSync({ nickname: O.none() })).toEqual({});
  });

  it("can encode None as null when requested", () => {
    expect(encodeHomepagePayloadSync({ homepage: O.none() })).toEqual({ homepage: null });
    expect(encodeHomepagePayloadSync({ homepage: O.some(new URL("https://example.com")) })).toEqual({
      homepage: "https://example.com/",
    });
  });

  it("round-trips Option values derived from the source schema", () => {
    fc.assert(
      fc.property(NicknamePayloadArbitrary, (payload) => {
        expect(decodeUnknownNicknamePayloadSync(encodeNicknamePayloadSync(payload))).toEqual(payload);
      }),
      fcRuns(50)
    );
  });
});
