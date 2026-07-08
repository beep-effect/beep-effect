import { RateLimitSnapshot } from "@beep/api-transport";
import { fcRuns } from "@beep/test-utils";
import { O } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
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
