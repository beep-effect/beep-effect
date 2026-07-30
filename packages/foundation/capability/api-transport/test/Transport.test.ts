import { ApiAuth, ApiTransportOptions, RateLimitSnapshot } from "@beep/api-transport";
import { fcRuns } from "@beep/test-utils";
import { O } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Redacted } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as Headers from "effect/unstable/http/Headers";

const RateLimitSnapshotArbitrary = S.toArbitrary(RateLimitSnapshot);
const RateLimitSnapshotEquivalence = S.toEquivalence(RateLimitSnapshot);
const decodeRateLimitSnapshot = S.decodeUnknownEffect(RateLimitSnapshot);
const encodeRateLimitSnapshot = S.encodeEffect(RateLimitSnapshot);

const HeaderRoundTripNumber = S.Int.check(S.isBetween({ minimum: -1_000_000, maximum: 1_000_000 }));
const HeaderRoundTripSnapshot = S.Struct({
  limit: S.optionalKey(HeaderRoundTripNumber),
  remaining: S.optionalKey(HeaderRoundTripNumber),
  reset: S.optionalKey(HeaderRoundTripNumber),
});
const HeaderRoundTripSnapshotArbitrary = S.toArbitrary(HeaderRoundTripSnapshot).map((snapshot) =>
  RateLimitSnapshot.make(snapshot)
);

const toHeaders = (snapshot: RateLimitSnapshot): Headers.Headers =>
  Headers.fromInput(
    O.getSomesStruct({
      "x-ratelimit-limit": O.map(O.fromUndefinedOr(snapshot.limit), (limit) => `${limit}`),
      "x-ratelimit-remaining": O.map(O.fromUndefinedOr(snapshot.remaining), (remaining) => `${remaining}`),
      "x-ratelimit-reset": O.map(O.fromUndefinedOr(snapshot.reset), (reset) => `${reset}`),
    })
  );

const hasAnyField = (snapshot: RateLimitSnapshot): boolean =>
  O.isSome(
    A.findFirst(
      [O.fromUndefinedOr(snapshot.limit), O.fromUndefinedOr(snapshot.remaining), O.fromUndefinedOr(snapshot.reset)],
      O.isSome
    )
  );

describe("@beep/api-transport", () => {
  it("keeps auth constructors and matching on schema-backed transport options", () => {
    const options = ApiTransportOptions.make({
      auth: ApiAuth.ApiKeyQueryAuth({
        key: Redacted.make("secret"),
        param: "api_key",
      }),
      key: "govinfo",
      rateLimit: {
        limit: 1000,
        window: "1 hour",
      },
    });
    const encoded = Effect.runSync(S.encodeEffect(ApiTransportOptions)(options));
    const decoded = Effect.runSync(S.decodeUnknownEffect(ApiTransportOptions)(encoded));

    expect(S.is(ApiTransportOptions)(decoded)).toBe(true);
    expect(ApiAuth.$is("ApiKeyQueryAuth")(decoded.auth)).toBe(true);
    expect(ApiAuth.$is("NoAuth")(decoded.auth)).toBe(false);
    expect(ApiAuth.$is("ApiKeyQueryAuth")({ _tag: "ApiKeyQueryAuth" })).toBe(true);
    expect(
      ApiAuth.$match(decoded.auth, {
        ApiKeyHeaderAuth: () => "header",
        ApiKeyQueryAuth: ({ param }) => param,
        NoAuth: () => "none",
        TokenHeaderAuth: () => "token",
      })
    ).toBe("api_key");
  });

  it("preserves every legacy transport option input accepted by Effect Duration", () => {
    const auth = ApiAuth.NoAuth();
    const options = [
      {
        auth,
        key: "explicit-undefined",
        rateLimit: { limit: 1000, window: { seconds: undefined } },
        retryBaseDelay: undefined,
        retryTimes: undefined,
      },
      {
        auth,
        key: "signed-fraction",
        rateLimit: { limit: Number.NaN, window: "-0.5 seconds" },
        retryBaseDelay: "01 seconds",
        retryTimes: Number.POSITIVE_INFINITY,
      },
      {
        auth,
        key: "negative-infinity",
        rateLimit: { limit: Number.NEGATIVE_INFINITY, window: Number.POSITIVE_INFINITY },
        retryTimes: Number.NEGATIVE_INFINITY,
      },
    ];

    for (const option of options) {
      const decoded = Effect.runSync(S.decodeUnknownEffect(ApiTransportOptions)(option));

      expect(S.is(ApiTransportOptions)(decoded)).toBe(true);
    }
  });

  it("keeps RateLimitSnapshot encoded wire shape unchanged", () => {
    const encodedFull = Effect.runSync(
      encodeRateLimitSnapshot(RateLimitSnapshot.make({ limit: 1000, remaining: 42, reset: 60 }))
    );
    const encodedPartial = Effect.runSync(encodeRateLimitSnapshot(RateLimitSnapshot.make({ remaining: 42 })));

    expect(encodedFull).toEqual({ limit: 1000, remaining: 42, reset: 60 });
    expect(encodedPartial).toEqual({ remaining: 42 });
  });

  it("round-trips schema-derived RateLimitSnapshot values through the encoded shape", () =>
    fc.assert(
      fc.property(RateLimitSnapshotArbitrary, (snapshot) => {
        const encoded = Effect.runSync(encodeRateLimitSnapshot(snapshot));
        const decoded = Effect.runSync(decodeRateLimitSnapshot(encoded));
        const reencoded = Effect.runSync(encodeRateLimitSnapshot(decoded));

        expect(reencoded).toEqual(encoded);
        expect(RateLimitSnapshotEquivalence(decoded, snapshot)).toBe(true);
      }),
      fcRuns(50)
    ));

  it("round-trips parseable schema-derived snapshots through rate-limit headers", () =>
    fc.assert(
      fc.property(HeaderRoundTripSnapshotArbitrary, (snapshot) => {
        const parsed = RateLimitSnapshot.fromHeaders(toHeaders(snapshot));

        O.match(parsed, {
          onNone: () => expect(hasAnyField(snapshot)).toBe(false),
          onSome: (value) => expect(RateLimitSnapshotEquivalence(value, snapshot)).toBe(true),
        });
      }),
      fcRuns(50)
    ));

  it("parses rate-limit aliases and ignores non-numeric headers", () => {
    expect(
      RateLimitSnapshot.fromHeaders(
        Headers.fromInput({
          "ratelimit-limit": "limit=1000",
          "ratelimit-remaining": "remaining: 42",
          "x-ratelimit-reset-after": "60 seconds",
        })
      )
    ).toEqual(O.some(RateLimitSnapshot.make({ limit: 1000, remaining: 42, reset: 60 })));
    expect(RateLimitSnapshot.fromHeaders(Headers.fromInput({ "x-ratelimit-limit": "unknown" }))).toEqual(O.none());
    expect(RateLimitSnapshot.fromHeaders(Headers.empty)).toEqual(O.none());
  });
});
