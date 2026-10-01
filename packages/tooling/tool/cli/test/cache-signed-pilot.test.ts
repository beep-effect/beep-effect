import { CacheSignedPilotReceipt, validateCacheSignedPilotReceipt } from "@beep/repo-cli/commands/Cache";
import { Sha256Hex } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
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
  it.effect("requires four independent native capture refusals with exact case diagnostics", () =>
    Effect.gen(function* () {
      for (const captureControls of [
        [],
        A.map(input.captureControls, (control) => ({ ...control, case: "credential-output" })),
        A.map(input.captureControls, (control) => ({ ...control, diagnostic: "unrelated failure" })),
        A.map(input.captureControls, (control) => ({
          ...control,
          summarySha256: input.pairs[0].producer.summarySha256,
        })),
        A.map(input.captureControls, (control) => ({ ...control, isolationRoot: input.freshPairs[0].leftRoot })),
        A.map(input.captureControls, (control) => ({ ...control, selectedExitCode: 1 })),
        A.map(input.captureControls, (control) => ({ ...control, origin: "remote-hit" })),
      ])
        assertTrue(Result.isFailure(yield* validate({ ...input, captureControls })));
    })
  );
  it.effect("binds every inspected archive to transferred bytes and the verified producer log", () =>
    Effect.gen(function* () {
      for (const archive of [
        { ...input.pairs[0].archive, archiveSha256: digest("e") },
        { ...input.pairs[0].archive, archiveBytes: 160 },
        { ...input.pairs[0].archive, logSha256: digest("e") },
        { ...input.pairs[0].archive, logBytes: 24 },
        { ...input.pairs[0].archive, decodedBytes: 2049 },
        { ...input.pairs[0].archive, path: "another.log" },
      ]) {
        assertTrue(
          Result.isFailure(yield* validate({ ...input, pairs: A.map(input.pairs, (pair) => ({ ...pair, archive })) }))
        );
        assertTrue(
          Result.isFailure(
            yield* validate({
              ...input,
              shadows: A.map(input.shadows, (shadow) => ({ ...shadow, comparison: { ...shadow.comparison, archive } })),
            })
          )
        );
        assertTrue(
          Result.isFailure(
            yield* validate({
              ...input,
              mutations: A.map(input.mutations, (mutation) => ({
                ...mutation,
                comparison: { ...mutation.comparison, archive },
              })),
            })
          )
        );
      }
    })
  );
  it.effect("requires independent missing-child refusal with no native execution", () =>
    Effect.gen(function* () {
      assertTrue(Result.isFailure(yield* validate(R.remove(input, "policyRefusal"))));
      const refusal = input.policyRefusal;
      for (const policyRefusal of [
        { ...refusal, removedPath: "turbo.json" },
        { ...refusal, nativeRuntimeKeyObserved: true },
        { ...refusal, nativeExecutionObserved: true },
        { ...refusal, guardRejected: false },
        { ...refusal, planExitCode: 1 },
        { ...refusal, executionSummaries: 1 },
        { ...refusal, selectedLogFiles: 1 },
        { ...refusal, isolationRoot: input.freshPairs[0].leftRoot },
        { ...refusal, dryPlanSha256: input.pairs[0].producer.summarySha256 },
        { ...refusal, taskHash: task.taskHash },
        { ...refusal, computation: "@beep/types#lint" },
        { ...refusal, configuration: { ...refusal.configuration, env: ["BEEP_CACHE_TOOLCHAIN_DIGEST"] } },
        { ...refusal, configuration: { ...refusal.configuration, persistent: true } },
        { ...refusal, configuration: { ...refusal.configuration, interactive: true } },
      ])
        assertTrue(Result.isFailure(yield* validate({ ...input, policyRefusal })));
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
        assertTrue(Result.isFailure(yield* validate({ ...input, freshPairs })));
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
        assertTrue(Result.isFailure(yield* validate({ ...input, freshPairs })));
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
        assertTrue(Result.isFailure(yield* validate({ ...input, freshPairs })));
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
        assertTrue(Result.isFailure(yield* validate({ ...input, freshPairs })));
      }
      const oneOverlap = A.map(input.freshPairs, (pair, index) =>
        index === 0
          ? pair
          : {
              ...pair,
              right: { ...pair.right, selectedTaskInterval: { startTime: 9000, endTime: 10000 } },
            }
      );
      assertTrue(Result.isSuccess(yield* validate({ ...input, freshPairs: oneOverlap })));
    })
  );
  it.effect("derives native non-execution from exit, summary and diagnostic facts", () =>
    Effect.gen(function* () {
      for (const nonExecutions of [
        [],
        A.map(input.nonExecutions, () => input.nonExecutions[0]),
        A.map(input.nonExecutions, (observation) => ({ ...observation, id: "same" })),
        A.map(input.nonExecutions, (observation) => ({ ...observation, isolationRoot: input.freshPairs[0].leftRoot })),
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
        A.map(input.nonExecutions, (observation) => ({ ...R.remove(observation, "diagnostic"), passed: true })),
        A.map(input.nonExecutions, (observation) => ({ ...observation, diagnostic: "malformed-child-config" })),
        A.map(input.nonExecutions, (observation) => ({ ...R.remove(observation, "summarySha256"), passed: true })),
        A.map(input.nonExecutions, (observation) => ({ ...observation, summarySha256: digest("7"), passed: true })),
        A.map(input.nonExecutions, (observation) =>
          observation.reason === "absent-script"
            ? {
                ...observation,
                summarySha256: input.freshPairs[0].left.summarySha256,
              }
            : observation
        ),
      ])
        assertTrue(Result.isFailure(yield* validate({ ...input, nonExecutions })));
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
        assertTrue(Result.isFailure(yield* validate({ ...input, mutations })));
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
        assertTrue(Result.isFailure(yield* validate({ ...input, mutations })));
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
        assertTrue(Result.isFailure(yield* validate({ ...input, shadows })));
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
        assertTrue(Result.isFailure(yield* validate({ ...input, shadows })));
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
        assertTrue(Result.isFailure(yield* validate({ ...input, shadows })));
      }
    })
  );
  it.effect("includes every shadow in the protected comparison inventory", () =>
    Effect.gen(function* () {
      const receipt = yield* S.decodeUnknownEffect(CacheSignedPilotReceipt)(input);
      expect(receipt.comparisons).toHaveLength(20);
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
        assertTrue(Result.isFailure(yield* validate({ ...input, pairs })));
    })
  );
  it.effect("rejects false hits, divergent logs and changed inputs", () =>
    Effect.gen(function* () {
      for (const outcome of [
        { ...run(0, 2).outcome, selected: { ...task, origin: "fresh" } },
        { ...run(0, 2).outcome, logSha256: digest("0") },
        { ...run(0, 2).outcome, selected: { ...task, origin: "remote-hit", inputsDigest: digest("0") } },
      ])
        assertTrue(
          Result.isFailure(
            yield* validate({
              ...input,
              pairs: A.map(input.pairs, (pair) => ({
                ...pair,
                replay: { ...pair.replay, outcome },
              })),
            })
          )
        );
    })
  );
  it.effect("rejects absent uploads, denied writes and unsigned downloads", () =>
    Effect.gen(function* () {
      for (const events of [
        A.filter(input.pairs[0].events, (value) => value.operation !== "put"),
        A.map(input.pairs[0].events, (value) => (value.operation === "put" ? { ...value, status: 403 } : value)),
        A.map(input.pairs[0].events, (value) => (value.role === "reader" ? { ...value, tagPresent: false } : value)),
      ])
        assertTrue(
          Result.isFailure(yield* validate({ ...input, pairs: A.map(input.pairs, (pair) => ({ ...pair, events })) }))
        );
    })
  );
  it.effect("rejects profile changes and lost source integrity", () =>
    Effect.gen(function* () {
      assertTrue(Result.isFailure(yield* validate({ ...input, key: { ...input.key, profile: "other" } })));
      assertTrue(
        Result.isFailure(
          yield* validate({
            ...input,
            pairs: A.map(input.pairs, (pair) => ({
              ...pair,
              producer: { ...pair.producer, sourceTreeUnchanged: false },
            })),
          })
        )
      );
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
      assertTrue(
        Result.isFailure(yield* validate({ ...input, pairs: A.map(input.pairs, (pair) => ({ ...pair, protection })) }))
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

it.effect("rejects schema-generated archive identities detached from transferred bytes", () =>
  Effect.gen(function* () {
    const checked = yield* Arbitrary.checkEffect(
      Arbitrary.schema(Sha256Hex),
      (archiveSha256) =>
        Effect.gen(function* () {
          const result = yield* validate({
            ...input,
            pairs: A.map(input.pairs, (pair) => ({ ...pair, archive: { ...pair.archive, archiveSha256 } })),
          });
          expect(Result.isSuccess(result)).toBe(archiveSha256 === input.pairs[0].archive.archiveSha256);
          return true;
        }),
      fcRuns(100)
    );
    expect(checked._tag).toBe("Passed");
  })
);
