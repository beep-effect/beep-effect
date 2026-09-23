import { fcRuns } from "@beep/fc-runs";
import { OptionFromOptionalNullishKey } from "@beep/schema/Options";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const NicknamePayload = S.Struct({
  nickname: OptionFromOptionalNullishKey(S.String),
});
const decodeUnknownNicknamePayloadEffect = S.decodeUnknownEffect(NicknamePayload);
const encodeNicknamePayloadEffect = S.encodeEffect(NicknamePayload);
const HomepagePayload = S.Struct({
  homepage: OptionFromOptionalNullishKey({ schema: S.URLFromString, onNoneEncoding: null }),
});
const encodeHomepagePayloadEffect = S.encodeEffect(HomepagePayload);
const NicknamePayloadArbitrary = Arbitrary.schema(NicknamePayload);

describe("OptionFromOptionalNullishKey", () => {
  it.effect(
    "decodes omitted, null, and undefined keys as None",
    Effect.fnUntraced(function* () {
      expect((yield* decodeUnknownNicknamePayloadEffect({})).nickname).toEqual(O.none());
      expect((yield* decodeUnknownNicknamePayloadEffect({ nickname: null })).nickname).toEqual(O.none());
      expect((yield* decodeUnknownNicknamePayloadEffect({ nickname: undefined })).nickname).toEqual(O.none());
    })
  );

  it.effect(
    "decodes present non-nullish values as Some",
    Effect.fnUntraced(function* () {
      expect((yield* decodeUnknownNicknamePayloadEffect({ nickname: "beep" })).nickname).toEqual(O.some("beep"));
    })
  );

  it.effect(
    "omits None by default during encoding",
    Effect.fnUntraced(function* () {
      expect(yield* encodeNicknamePayloadEffect({ nickname: O.none() })).toEqual({});
    })
  );

  it.effect(
    "can encode None as null when requested",
    Effect.fnUntraced(function* () {
      expect(yield* encodeHomepagePayloadEffect({ homepage: O.none() })).toEqual({ homepage: null });
      expect(yield* encodeHomepagePayloadEffect({ homepage: O.some(new URL("https://example.com")) })).toEqual({
        homepage: "https://example.com/",
      });
    })
  );

  it.effect.prop(
    "round-trips Option values derived from the source schema",
    [NicknamePayloadArbitrary],
    Effect.fnUntraced(function* ([payload]) {
      expect(yield* decodeUnknownNicknamePayloadEffect(yield* encodeNicknamePayloadEffect(payload))).toEqual(payload);

      return true;
    }),
    { arbitrary: fcRuns(50) }
  );
});
