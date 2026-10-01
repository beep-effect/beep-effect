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
  it.effect("rejects reused fresh runs and normal cache-disabled authority as same-profile evidence", () =>
    Effect.gen(function* () {
      const first = input.freshPairs[0];
      for (const freshPairs of [
        A.map(input.freshPairs, () => first),
        A.map(input.freshPairs, (pair) => ({ ...pair, rightRoot: pair.leftRoot })),
        A.map(input.freshPairs, (pair) => ({ ...pair, leftRoot: first.leftRoot })),
        A.map(input.freshPairs, (pair) => ({ ...pair, right: { ...pair.right, root: pair.left.root } })),
        A.map(input.freshPairs, (pair) => ({ ...pair, left: { ...pair.left, cacheEnabled: false } })),
        A.map(input.freshPairs, (pair) => ({
          ...pair,
          left: { ...pair.left, summarySha256: input.pairs[0].authoritative.summarySha256 },
        })),
        A.map(input.freshPairs, (pair) => ({
          ...pair,
          left: {
            ...pair.left,
            outcome: { ...pair.left.outcome, selected: { ...pair.left.outcome.selected, origin: "local-hit" } },
          },
        })),
        A.map(input.freshPairs, (pair) => ({
          ...pair,
          left: {
            ...pair.left,
            outcome: { ...pair.left.outcome, selected: { ...pair.left.outcome.selected, inputsDigest: digest("0") } },
          },
        })),
      ])
        expect(Result.isFailure(yield* validate({ ...input, freshPairs }))).toBe(true);
    })
  );
  it.effect("rejects fresh-pair verdict, log, task and runtime divergence", () =>
    Effect.gen(function* () {
      const run = input.freshPairs[0].left;
      for (const patch of [
        { graphExitCode: 1 },
        { nativeRuntimeKeyObserved: false },
        { sourceTreeUnchanged: false },
        { dependencies: A.map(run.dependencies, (task) => ({ ...task, origin: "local-hit" })) },
        { outcome: { ...run.outcome, logSha256: digest("0") } },
        { outcome: { ...run.outcome, logBytes: 24 } },
        { outcome: { ...run.outcome, replayLogMatches: false } },
        { outcome: { ...run.outcome, selected: { ...run.outcome.selected, taskHash: "other-hash" } } },
        { outcome: { ...run.outcome, selected: { ...run.outcome.selected, exitCode: 1 } } },
        { outcome: { ...run.outcome, selected: { ...run.outcome.selected, computation: "@beep/types#lint" } } },
      ]) {
        const freshPairs = A.map(input.freshPairs, (pair) => ({ ...pair, left: { ...pair.left, ...patch } }));
        expect(Result.isFailure(yield* validate({ ...input, freshPairs }))).toBe(true);
      }
    })
  );
  it.effect("requires all ten distinct remote shadow scenarios and isolation roots", () =>
    Effect.gen(function* () {
      for (const shadows of [
        [],
        A.map(input.shadows, (shadow) => ({ ...shadow, case: "baseline" })),
        A.map(input.shadows, (shadow) => ({ ...shadow, comparison: input.pairs[0] })),
        A.map(input.shadows, (shadow) => ({
          ...shadow,
          comparison: { ...shadow.comparison, producerRoot: input.pairs[0].producerRoot },
        })),
      ])
        expect(Result.isFailure(yield* validate({ ...input, shadows }))).toBe(true);
    })
  );
  it.effect("derives shadow invalidation and invariance from the scenario", () =>
    Effect.gen(function* () {
      for (const name of ["source-comment", "declared-env", "orchestration-env", "absolute-root"]) {
        const shadows = A.map(input.shadows, (shadow) =>
          shadow.case !== name
            ? shadow
            : {
                ...shadow,
                passed: true,
                comparison: {
                  ...shadow.comparison,
                  producer: {
                    ...shadow.comparison.producer,
                    outcome: {
                      ...shadow.comparison.producer.outcome,
                      selected: {
                        ...shadow.comparison.producer.outcome.selected,
                        taskHash:
                          name === "source-comment" || name === "declared-env" ? task.taskHash : "different-hash",
                      },
                    },
                  },
                },
              }
        );
        expect(Result.isFailure(yield* validate({ ...input, shadows }))).toBe(true);
      }
    })
  );
  it.effect("checks shadow wire and output evidence as strictly as baseline comparisons", () =>
    Effect.gen(function* () {
      for (const patch of [
        { events: [] },
        {
          events: A.map(input.shadows[0].comparison.events, (event) =>
            event.operation === "put" ? { ...event, status: 403 } : event
          ),
        },
        {
          replay: {
            ...input.shadows[0].comparison.replay,
            outcome: { ...input.shadows[0].comparison.replay.outcome, logSha256: digest("0") },
          },
        },
      ]) {
        const shadows = A.map(input.shadows, (shadow, index) =>
          index === 0 ? { ...shadow, comparison: { ...shadow.comparison, ...patch } } : shadow
        );
        expect(Result.isFailure(yield* validate({ ...input, shadows }))).toBe(true);
      }
    })
  );
  it.effect("includes every shadow in the protected comparison inventory", () =>
    Effect.gen(function* () {
      const receipt = yield* S.decodeUnknownEffect(CacheSignedPilotReceipt)(input);
      expect(receipt.comparisons).toHaveLength(13);
      expect(receipt.comparisons[12]).toEqual(receipt.shadows[9].comparison);
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
