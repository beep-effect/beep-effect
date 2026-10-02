import { CacheSignedPilotReceipt, validateCacheSignedPilotReceipt } from "@beep/repo-cli/commands/Cache";
import { Sha256Hex } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { assertTrue, strictEqual } from "@effect/vitest/utils";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { signedPilotInput as input } from "./helpers/cache-signed-pilot-fixture.ts";

const digest = Str.repeat(64);
const task = A.getUnsafe(input.pairs, 0).producer.outcome.selected;
const run = (pair: number, role: number) =>
  role === 2 ? A.getUnsafe(input.pairs, pair).replay : A.getUnsafe(input.pairs, pair).producer;
const validate = (value: unknown) =>
  S.decodeUnknownEffect(CacheSignedPilotReceipt)(value).pipe(
    Effect.flatMap(validateCacheSignedPilotReceipt),
    Effect.result
  );

describe("signed real-pilot receipt relationships", () => {
  it.effect("requires four independent native capture refusals with exact case diagnostics", () =>
    Effect.gen(function* () {
      for (const captureControls of [
        [],
        A.map(input.captureControls, (control) => ({ ...control, case: "credential-output" })),
        A.map(input.captureControls, (control) => ({ ...control, diagnostic: "unrelated failure" })),
        A.map(input.captureControls, (control) => ({
          ...control,
          summarySha256: A.getUnsafe(input.pairs, 0).producer.summarySha256,
        })),
        A.map(input.captureControls, (control) => ({
          ...control,
          isolationRoot: A.getUnsafe(input.freshPairs, 0).leftRoot,
        })),
        A.map(input.captureControls, (control) => ({ ...control, selectedExitCode: 1 })),
        A.map(input.captureControls, (control) => ({ ...control, origin: "remote-hit" })),
      ])
        (yield* validate({ ...input, captureControls })).pipe(Result.isFailure, assertTrue);
    })
  );
  it.effect("binds every inspected archive to transferred bytes and the verified producer log", () =>
    Effect.gen(function* () {
      for (const archive of [
        { ...A.getUnsafe(input.pairs, 0).archive, archiveSha256: digest("e") },
        { ...A.getUnsafe(input.pairs, 0).archive, archiveBytes: 160 },
        { ...A.getUnsafe(input.pairs, 0).archive, logSha256: digest("e") },
        { ...A.getUnsafe(input.pairs, 0).archive, logBytes: 24 },
        { ...A.getUnsafe(input.pairs, 0).archive, decodedBytes: 2049 },
        { ...A.getUnsafe(input.pairs, 0).archive, path: "another.log" },
      ]) {
        (yield* validate({ ...input, pairs: A.map(input.pairs, (pair) => ({ ...pair, archive })) })).pipe(
          Result.isFailure,
          assertTrue
        );
        (yield* validate({
          ...input,
          shadows: A.map(input.shadows, (shadow) => ({ ...shadow, comparison: { ...shadow.comparison, archive } })),
        })).pipe(Result.isFailure, assertTrue);
        (yield* validate({
          ...input,
          mutations: A.map(input.mutations, (mutation) => ({
            ...mutation,
            comparison: { ...mutation.comparison, archive },
          })),
        })).pipe(Result.isFailure, assertTrue);
      }
    })
  );
  it.effect("requires independent missing-child refusal with no native execution", () =>
    Effect.gen(function* () {
      (yield* validate(R.remove(input, "policyRefusal"))).pipe(Result.isFailure, assertTrue);
      const refusal = input.policyRefusal;
      for (const policyRefusal of [
        { ...refusal, removedPath: "turbo.json" },
        { ...refusal, nativeRuntimeKeyObserved: true },
        { ...refusal, nativeExecutionObserved: true },
        { ...refusal, guardRejected: false },
        { ...refusal, planExitCode: 1 },
        { ...refusal, executionSummaries: 1 },
        { ...refusal, selectedLogFiles: 1 },
        { ...refusal, isolationRoot: A.getUnsafe(input.freshPairs, 0).leftRoot },
        { ...refusal, dryPlanSha256: A.getUnsafe(input.pairs, 0).producer.summarySha256 },
        { ...refusal, taskHash: task.taskHash },
        { ...refusal, computation: "@beep/types#lint" },
        { ...refusal, configuration: { ...refusal.configuration, env: ["BEEP_CACHE_TOOLCHAIN_DIGEST"] } },
        { ...refusal, configuration: { ...refusal.configuration, persistent: true } },
        { ...refusal, configuration: { ...refusal.configuration, interactive: true } },
      ])
        (yield* validate({ ...input, policyRefusal })).pipe(Result.isFailure, assertTrue);
    })
  );
  it.effect("accepts coherent comparisons without promotion authority", () =>
    Effect.gen(function* () {
      const receipt = yield* S.decodeUnknownEffect(CacheSignedPilotReceipt)(input);
      expect((yield* validateCacheSignedPilotReceipt(receipt)).authority).toBe("signed-pilot-observation-only");
    })
  );
  it.effect("rejects reused fresh runs and normal cache-disabled authority as same-profile evidence", () =>
    Effect.gen(function* () {
      const first = A.getUnsafe(input.freshPairs, 0);
      for (const freshPairs of [
        A.map(input.freshPairs, () => first),
        A.map(input.freshPairs, (pair) => ({ ...pair, rightRoot: pair.leftRoot })),
        A.map(input.freshPairs, (pair) => ({ ...pair, leftRoot: first.leftRoot })),
        A.map(input.freshPairs, (pair) => ({ ...pair, right: { ...pair.right, root: pair.left.root } })),
        A.map(input.freshPairs, (pair) => ({ ...pair, left: { ...pair.left, cacheEnabled: false } })),
        A.map(input.freshPairs, (pair) => ({
          ...pair,
          left: { ...pair.left, summarySha256: A.getUnsafe(input.pairs, 0).authoritative.summarySha256 },
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
        (yield* validate({ ...input, freshPairs })).pipe(Result.isFailure, assertTrue);
    })
  );
  it.effect("rejects fresh-pair verdict, log, task and runtime divergence", () =>
    Effect.gen(function* () {
      const run = A.getUnsafe(input.freshPairs, 0).left;
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
        (yield* validate({ ...input, freshPairs })).pipe(Result.isFailure, assertTrue);
      }
    })
  );
  it.effect("requires native task overlap rather than parent lifetime or touching endpoints", () =>
    Effect.gen(function* () {
      for (const interval of [
        undefined,
        { startTime: 1000, endTime: 1000 },
        { startTime: 1100, endTime: 1000 },
        { startTime: -1, endTime: 1800 },
        { startTime: 1.5, endTime: 1800 },
      ]) {
        const freshPairs = A.map(input.freshPairs, (pair) => ({
          ...pair,
          left: { ...pair.left, selectedTaskInterval: interval },
        }));
        (yield* validate({ ...input, freshPairs })).pipe(Result.isFailure, assertTrue);
      }
      for (const offset of [0, 1]) {
        const freshPairs = A.map(input.freshPairs, (pair) => ({
          ...pair,
          right: {
            ...pair.right,
            selectedTaskInterval: {
              startTime: pair.left.selectedTaskInterval.endTime + offset,
              endTime: pair.left.selectedTaskInterval.endTime + 1000,
            },
          },
        }));
        (yield* validate({ ...input, freshPairs })).pipe(Result.isFailure, assertTrue);
      }
      const oneOverlap = A.map(input.freshPairs, (pair, index) =>
        index === 0
          ? pair
          : {
              ...pair,
              right: { ...pair.right, selectedTaskInterval: { startTime: 9000, endTime: 10000 } },
            }
      );
      (yield* validate({ ...input, freshPairs: oneOverlap })).pipe(Result.isSuccess, assertTrue);
    })
  );
  it.effect("derives native non-execution from exit, summary and diagnostic facts", () =>
    Effect.gen(function* () {
      for (const nonExecutions of [
        [],
        A.map(input.nonExecutions, () => input.nonExecutions[0]),
        A.map(input.nonExecutions, (observation) => ({ ...observation, id: "same" })),
        A.map(input.nonExecutions, (observation) => ({
          ...observation,
          isolationRoot: A.getUnsafe(input.freshPairs, 0).leftRoot,
        })),
        A.map(input.nonExecutions, (observation) => ({
          ...observation,
          selectedExecutionObserved: true,
          passed: true,
        })),
        A.map(input.nonExecutions, (observation) => ({
          ...observation,
          exitCode: observation.exitCode === 0 ? 1 : 0,
          passed: true,
        })),
        A.map(input.nonExecutions, (observation) => ({
          ...(P.hasProperty(observation, "diagnostic") ? R.remove(observation, "diagnostic") : observation),
          passed: true,
        })),
        A.map(input.nonExecutions, (observation) => ({ ...observation, diagnostic: "malformed-child-config" })),
        A.map(input.nonExecutions, (observation) => ({
          ...(P.hasProperty(observation, "summarySha256") ? R.remove(observation, "summarySha256") : observation),
          passed: true,
        })),
        A.map(input.nonExecutions, (observation) => ({ ...observation, summarySha256: digest("7"), passed: true })),
        A.map(input.nonExecutions, (observation) =>
          observation.reason === "absent-script"
            ? {
                ...observation,
                summarySha256: A.getUnsafe(input.freshPairs, 0).left.summarySha256,
              }
            : observation
        ),
      ])
        (yield* validate({ ...input, nonExecutions })).pipe(Result.isFailure, assertTrue);
    })
  );
  it.effect("requires all seven seeded cases with distinct changed files and fresh case-derived verdicts", () =>
    Effect.gen(function* () {
      for (const mutations of [
        [],
        A.map(input.mutations, () => input.mutations[0]),
        A.map(input.mutations, (mutation) => ({ ...mutation, case: "missing-child-config" })),
        A.map(input.mutations, (mutation) => ({ ...mutation, changedPath: "unrelated.json" })),
        A.map(input.mutations, (mutation) => ({ ...mutation, afterSha256: mutation.beforeSha256 })),
        A.map(input.mutations, (mutation) => ({
          ...mutation,
          seed: { ...mutation.seed, nativeRuntimeKeyObserved: false },
        })),
        A.map(input.mutations, (mutation) => ({ ...mutation, seed: { ...mutation.seed, graphExitCode: 7 } })),
        A.map(input.mutations, (mutation) => ({
          ...mutation,
          seed: {
            ...mutation.seed,
            outcome: {
              ...mutation.seed.outcome,
              selected: {
                ...mutation.seed.outcome.selected,
                taskHash: mutation.comparison.producer.outcome.selected.taskHash,
              },
            },
          },
        })),
        A.map(input.mutations, (mutation) => ({
          ...mutation,
          seed: {
            ...mutation.seed,
            outcome: {
              ...mutation.seed.outcome,
              selected: { ...mutation.seed.outcome.selected, origin: "remote-hit" },
            },
          },
        })),
      ])
        (yield* validate({ ...input, mutations })).pipe(Result.isFailure, assertTrue);
    })
  );
  it.effect("requires ordered seed and changed wire evidence without uploading failed seeds", () =>
    Effect.gen(function* () {
      for (const mutations of [
        A.map(input.mutations, (mutation) => ({
          ...mutation,
          comparison: {
            ...mutation.comparison,
            events: A.filter(
              mutation.comparison.events,
              (event) => event.artifact !== mutation.seed.outcome.selected.taskHash
            ),
          },
        })),
        A.map(input.mutations, (mutation) => ({
          ...mutation,
          comparison: {
            ...mutation.comparison,
            events: A.map(mutation.comparison.events, (event) =>
              event.artifact === mutation.seed.outcome.selected.taskHash ? { ...event, status: 403 } : event
            ),
          },
        })),
        A.map(input.mutations, (mutation) => ({
          ...mutation,
          comparison: {
            ...mutation.comparison,
            events: A.map(mutation.comparison.events, (event) =>
              event.role === "reader" ? { ...event, artifact: mutation.seed.outcome.selected.taskHash } : event
            ),
          },
        })),
        A.map(input.mutations, (mutation) => ({
          ...mutation,
          comparison: {
            ...mutation.comparison,
            events: A.map(A.reverse(mutation.comparison.events), (event, index) => ({ ...event, sequence: index + 1 })),
          },
        })),
        A.map(input.mutations, (mutation) => ({
          ...mutation,
          comparison: {
            ...mutation.comparison,
            events: A.append(mutation.comparison.events, {
              ...mutation.comparison.events[0],
              sequence: mutation.comparison.events.length + 1,
              operation: "put",
              status: 200,
            }),
          },
        })),
      ])
        (yield* validate({ ...input, mutations })).pipe(Result.isFailure, assertTrue);
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
          comparison: { ...shadow.comparison, producerRoot: A.getUnsafe(input.pairs, 0).producerRoot },
        })),
      ])
        (yield* validate({ ...input, shadows })).pipe(Result.isFailure, assertTrue);
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
        (yield* validate({ ...input, shadows })).pipe(Result.isFailure, assertTrue);
      }
    })
  );
  it.effect("checks shadow wire and output evidence as strictly as baseline comparisons", () =>
    Effect.gen(function* () {
      for (const patch of [
        { events: [] },
        {
          events: A.map(A.getUnsafe(input.shadows, 0).comparison.events, (event) =>
            event.operation === "put" ? { ...event, status: 403 } : event
          ),
        },
        {
          replay: {
            ...A.getUnsafe(input.shadows, 0).comparison.replay,
            outcome: { ...A.getUnsafe(input.shadows, 0).comparison.replay.outcome, logSha256: digest("0") },
          },
        },
      ]) {
        const shadows = A.map(input.shadows, (shadow, index) =>
          index === 0 ? { ...shadow, comparison: { ...shadow.comparison, ...patch } } : shadow
        );
        (yield* validate({ ...input, shadows })).pipe(Result.isFailure, assertTrue);
      }
    })
  );
  it.effect("includes every shadow in the protected comparison inventory", () =>
    Effect.gen(function* () {
      const receipt = yield* S.decodeUnknownEffect(CacheSignedPilotReceipt)(input);
      expect(receipt.comparisons).toHaveLength(20);
      expect(receipt.comparisons[12]).toEqual(A.getUnsafe(receipt.shadows, 9).comparison);
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
        (yield* validate({ ...input, pairs })).pipe(Result.isFailure, assertTrue);
    })
  );
  it.effect("rejects false hits, divergent logs and changed inputs", () =>
    Effect.gen(function* () {
      for (const outcome of [
        { ...run(0, 2).outcome, selected: { ...task, origin: "fresh" } },
        { ...run(0, 2).outcome, logSha256: digest("0") },
        { ...run(0, 2).outcome, selected: { ...task, origin: "remote-hit", inputsDigest: digest("0") } },
      ])
        (yield* validate({
          ...input,
          pairs: A.map(input.pairs, (pair) => ({
            ...pair,
            replay: { ...pair.replay, outcome },
          })),
        })).pipe(Result.isFailure, assertTrue);
    })
  );
  it.effect("rejects absent uploads, denied writes and unsigned downloads", () =>
    Effect.gen(function* () {
      for (const events of [
        A.filter(A.getUnsafe(input.pairs, 0).events, (value) => value.operation !== "put"),
        A.map(A.getUnsafe(input.pairs, 0).events, (value) =>
          value.operation === "put" ? { ...value, status: 403 } : value
        ),
        A.map(A.getUnsafe(input.pairs, 0).events, (value) =>
          value.role === "reader" ? { ...value, tagPresent: false } : value
        ),
      ])
        (yield* validate({ ...input, pairs: A.map(input.pairs, (pair) => ({ ...pair, events })) })).pipe(
          Result.isFailure,
          assertTrue
        );
    })
  );
  it.effect("rejects profile changes and lost source integrity", () =>
    Effect.gen(function* () {
      (yield* validate({ ...input, key: { ...input.key, profile: "other" } })).pipe(Result.isFailure, assertTrue);
      (yield* validate({
        ...input,
        pairs: A.map(input.pairs, (pair) => ({
          ...pair,
          producer: { ...pair.producer, sourceTreeUnchanged: false },
        })),
      })).pipe(Result.isFailure, assertTrue);
    })
  );
});

it.effect("rejects missing or failed reader-protection evidence", () =>
  Effect.gen(function* () {
    for (const protection of [
      undefined,
      { ...A.getUnsafe(input.pairs, 0).protection, readsDenied: false },
      { ...A.getUnsafe(input.pairs, 0).protection, protectedBytesUnchanged: false },
      { ...A.getUnsafe(input.pairs, 0).protection, issuerMaterialDenied: false },
    ]) {
      (yield* validate({ ...input, pairs: A.map(input.pairs, (pair) => ({ ...pair, protection })) })).pipe(
        Result.isFailure,
        assertTrue
      );
    }
  })
);

it.effect("distinguishes a canary-only observation from an actual issuer denial", () =>
  Effect.gen(function* () {
    const canary = yield* S.decodeUnknownEffect(CacheSignedPilotReceipt)(input);
    assertTrue(A.every(canary.pairs, (pair) => O.isNone(pair.protection.issuerMaterialDenied)));
    const actual = yield* S.decodeUnknownEffect(CacheSignedPilotReceipt)({
      ...input,
      pairs: A.map(input.pairs, (pair) => ({
        ...pair,
        protection: { ...pair.protection, issuerMaterialDenied: true },
      })),
    });
    assertTrue(A.every(actual.pairs, (pair) => O.contains(pair.protection.issuerMaterialDenied, true)));
    expect(actual.authority).toBe("signed-pilot-observation-only");
  })
);

it.effect.prop(
  "rejects schema-generated archive identities detached from transferred bytes",
  { archiveSha256: Sha256Hex },
  ({ archiveSha256 }) =>
    Effect.gen(function* () {
      const result = yield* validate({
        ...input,
        pairs: A.map(input.pairs, (pair) => ({ ...pair, archive: { ...pair.archive, archiveSha256 } })),
      });
      strictEqual(Result.isSuccess(result), archiveSha256 === A.getUnsafe(input.pairs, 0).archive.archiveSha256);
    }),
  { arbitrary: fcRuns(100) }
);
