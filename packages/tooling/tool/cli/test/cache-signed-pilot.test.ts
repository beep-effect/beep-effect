import { CacheSignedPilotReceipt, validateCacheSignedPilotReceipt } from "@beep/repo-cli/commands/Cache";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { signedPilotInput as input } from "./helpers/cache-signed-pilot-fixture.ts";

const digest = Str.repeat(64);
const task = input.pairs[0].producer.outcome.selected;
const run = (pair: number, role: number) => (role === 2 ? input.pairs[pair].replay : input.pairs[pair].producer);
const validate = (value: unknown) =>
  S.decodeUnknownEffect(CacheSignedPilotReceipt)(value).pipe(
    Effect.flatMap(validateCacheSignedPilotReceipt),
    Effect.result
  );

describe("signed real-pilot receipt relationships", () => {
  it.effect("accepts coherent comparisons without promotion authority", () =>
    Effect.gen(function* () {
      const receipt = yield* S.decodeUnknownEffect(CacheSignedPilotReceipt)(input);
      expect((yield* validateCacheSignedPilotReceipt(receipt)).authority).toBe("signed-pilot-observation-only");
    })
  );
  it.effect("rejects duplicate pairs, namespaces and run summaries", () =>
    Effect.gen(function* () {
      for (const pairs of [
        A.map(input.pairs, () => input.pairs[0]),
        A.map(input.pairs, (pair) => ({ ...pair, client: input.client })),
        A.map(input.pairs, (pair) => ({
          ...pair,
          replay: { ...pair.replay, summarySha256: pair.producer.summarySha256 },
        })),
      ])
        expect(Result.isFailure(yield* validate({ ...input, pairs }))).toBe(true);
    })
  );
  it.effect("rejects false hits, divergent logs and changed inputs", () =>
    Effect.gen(function* () {
      for (const outcome of [
        { ...run(0, 2).outcome, selected: { ...task, origin: "fresh" } },
        { ...run(0, 2).outcome, logSha256: digest("0") },
        { ...run(0, 2).outcome, selected: { ...task, origin: "remote-hit", inputsDigest: digest("0") } },
      ])
        expect(
          Result.isFailure(
            yield* validate({
              ...input,
              pairs: A.map(input.pairs, (pair) => ({
                ...pair,
                replay: { ...pair.replay, outcome },
              })),
            })
          )
        ).toBe(true);
    })
  );
  it.effect("rejects absent uploads, denied writes and unsigned downloads", () =>
    Effect.gen(function* () {
      for (const events of [
        A.filter(input.pairs[0].events, (value) => value.operation !== "put"),
        A.map(input.pairs[0].events, (value) => (value.operation === "put" ? { ...value, status: 403 } : value)),
        A.map(input.pairs[0].events, (value) => (value.role === "reader" ? { ...value, tagPresent: false } : value)),
      ])
        expect(
          Result.isFailure(yield* validate({ ...input, pairs: A.map(input.pairs, (pair) => ({ ...pair, events })) }))
        ).toBe(true);
    })
  );
  it.effect("rejects profile changes and lost source integrity", () =>
    Effect.gen(function* () {
      expect(Result.isFailure(yield* validate({ ...input, key: { ...input.key, profile: "other" } }))).toBe(true);
      expect(
        Result.isFailure(
          yield* validate({
            ...input,
            pairs: A.map(input.pairs, (pair) => ({
              ...pair,
              producer: { ...pair.producer, sourceTreeUnchanged: false },
            })),
          })
        )
      ).toBe(true);
    })
  );
});

it.effect("rejects missing or failed reader-protection evidence", () =>
  Effect.gen(function* () {
    for (const protection of [
      undefined,
      { ...input.pairs[0].protection, readsDenied: false },
      { ...input.pairs[0].protection, protectedBytesUnchanged: false },
      { ...input.pairs[0].protection, issuerMaterialDenied: false },
    ]) {
      expect(
        Result.isFailure(yield* validate({ ...input, pairs: A.map(input.pairs, (pair) => ({ ...pair, protection })) }))
      ).toBe(true);
    }
  })
);

it.effect("distinguishes a canary-only observation from an actual issuer denial", () =>
  Effect.gen(function* () {
    const canary = yield* S.decodeUnknownEffect(CacheSignedPilotReceipt)(input);
    expect(A.every(canary.pairs, (pair) => O.isNone(pair.protection.issuerMaterialDenied))).toBe(true);
    const actual = yield* S.decodeUnknownEffect(CacheSignedPilotReceipt)({
      ...input,
      pairs: A.map(input.pairs, (pair) => ({
        ...pair,
        protection: { ...pair.protection, issuerMaterialDenied: true },
      })),
    });
    expect(A.every(actual.pairs, (pair) => O.contains(pair.protection.issuerMaterialDenied, true))).toBe(true);
    expect(actual.authority).toBe("signed-pilot-observation-only");
  })
);
