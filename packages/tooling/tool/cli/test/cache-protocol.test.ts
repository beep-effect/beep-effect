import {
  CacheProtocolExecution,
  CacheProtocolObservation,
  validateCacheProtocolExecution,
  validateCacheProtocolObservation,
} from "@beep/repo-cli/commands/Cache";
import { Sha256Hex } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { assertTrue, strictEqual } from "@effect/vitest/utils";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { artifact, client, executionInput, input, output } from "./helpers/cache-protocol-fixture.ts";

const digest = Str.repeat(64);
const validate = (value: unknown) =>
  S.decodeUnknownEffect(CacheProtocolObservation)(value).pipe(
    Effect.flatMap(validateCacheProtocolObservation),
    Effect.result
  );

describe("native protocol observation boundary", () => {
  it.effect("accepts coherent wire/native relationships without promotion authority", () =>
    Effect.gen(function* () {
      const receipt = yield* S.decodeUnknownEffect(CacheProtocolObservation)(input);
      const reviewed = yield* validateCacheProtocolObservation(receipt);
      expect(reviewed.authority).toBe("synthetic-native-observation-only");
      expect(reviewed.runs).toHaveLength(6);
    })
  );

  it.effect("rejects duplicate cases, request ids and native summaries", () =>
    Effect.gen(function* () {
      for (const value of [
        { ...input, runs: A.map(input.runs, (run) => ({ ...run, case: "producer" })) },
        { ...input, exchanges: A.map(input.exchanges, (event) => ({ ...event, requestId: "same-request" })) },
        { ...input, runs: A.map(input.runs, (run) => ({ ...run, summary: digest("a") })) },
      ])
        (yield* validate(value)).pipe(Result.isFailure, assertTrue);
    })
  );

  it.effect("rejects missing cases, empty uploads and a producer that did not produce", () =>
    Effect.gen(function* () {
      for (const value of [
        { ...input, runs: A.filter(input.runs, (run) => run.case !== "producer") },
        { ...input, exchanges: A.filter(input.exchanges, (event) => event.case !== "producer") },
        {
          ...input,
          exchanges: A.map(input.exchanges, (event) =>
            event.case === "producer" ? { ...event, artifact: { ...event.artifact, bytes: 0 } } : event
          ),
        },
        {
          ...input,
          runs: A.map(input.runs, (run) =>
            run.case === "producer" ? { ...run, outcome: { _tag: "Rejected", exitCode: 42, restoredOutputs: 0 } } : run
          ),
        },
      ])
        (yield* validate(value)).pipe(Result.isFailure, assertTrue);
    })
  );

  it.effect("rejects a denied upload, a reader upload and mismatched artifact bytes", () =>
    Effect.gen(function* () {
      for (const patch of [{ status: 403 }, { role: "reader" }, { artifact: { ...artifact, bytes: 189 } }]) {
        const exchanges = A.map(input.exchanges, (event) =>
          event.case === "producer" ? { ...event, ...patch } : event
        );
        (yield* validate({ ...input, exchanges })).pipe(Result.isFailure, assertTrue);
      }
    })
  );

  it.effect("rejects a forged hit, restored output after rejection and altered client identity", () =>
    Effect.gen(function* () {
      for (const runs of [
        A.map(input.runs, (run) => (run.case === "replay" ? { ...run, outcome: { _tag: "Produced", output } } : run)),
        A.map(input.runs, (run) =>
          run.case === "wrong-key" ? { ...run, outcome: { _tag: "Rejected", exitCode: 42, restoredOutputs: 1 } } : run
        ),
        A.map(input.runs, (run) =>
          run.case === "replay" ? { ...run, client: { ...client, namespace: "other-epoch" } } : run
        ),
        A.map(input.runs, (run) => (run.case === "replay" ? { ...run, taskHash: "different-task" } : run)),
      ])
        (yield* validate({ ...input, runs })).pipe(Result.isFailure, assertTrue);
    })
  );

  it.effect("rejects unchanged corrupt-body evidence and a missing tag presented as present", () =>
    Effect.gen(function* () {
      for (const name of ["corrupt-body", "missing-tag"]) {
        const exchanges = A.map(input.exchanges, (event) =>
          event.case === name ? { ...event, artifact, tag: "present" } : event
        );
        (yield* validate({ ...input, exchanges })).pipe(Result.isFailure, assertTrue);
      }
    })
  );

  it.effect("rejects promotion claims and oversized or incomplete observation sets", () =>
    Effect.gen(function* () {
      for (const value of [
        { ...input, authority: "qualified" },
        { ...input, runs: [] },
        { ...input, runs: [...input.runs, ...input.runs] },
      ])
        (yield* validate(value)).pipe(Result.isFailure, assertTrue);
    })
  );
});

const validateExecution = (value: unknown) =>
  S.decodeUnknownEffect(CacheProtocolExecution)(value).pipe(
    Effect.flatMap(validateCacheProtocolExecution),
    Effect.result
  );
describe("complete protocol execution boundary", () => {
  it.effect("rejects legacy receipts and missing, duplicated or misattributed roots", () =>
    Effect.gen(function* () {
      (yield* validateExecution({ ...executionInput, schemaVersion: "cache-protocol-execution/v1" })).pipe(
        Result.isFailure,
        assertTrue
      );
      for (const roots of [
        [],
        A.map(executionInput.roots, (root) => ({ ...root, case: "producer" })),
        A.map(executionInput.roots, (root) => ({ ...root, sha256: digest("1") })),
        A.map(executionInput.roots, (root) => ({ ...root, case: "unknown" })),
      ])
        (yield* validateExecution({ ...executionInput, roots })).pipe(Result.isFailure, assertTrue);
    })
  );
  it.effect("joins every integrity and transport case without accepting promotion authority", () =>
    Effect.gen(function* () {
      const result = yield* validateExecution(executionInput);
      result.pipe(Result.isSuccess, assertTrue);
      if (Result.isSuccess(result)) expect(result.success.authority).toBe("synthetic-native-observation-only");
    })
  );
  it.effect("rejects duplicate failures and reused native summaries", () =>
    Effect.gen(function* () {
      for (const failures of [
        A.map(executionInput.failures, (failure) => ({ ...failure, case: "unavailable" })),
        A.map(executionInput.failures, (failure) => ({ ...failure, summary: digest("1") })),
        A.map(executionInput.failures, (failure) => ({ ...failure, taskHash: "other-task" })),
      ])
        (yield* validateExecution({ ...executionInput, failures })).pipe(Result.isFailure, assertTrue);
    })
  );
  it.effect("rejects missing, duplicated, misattributed and edited wire evidence", () =>
    Effect.gen(function* () {
      for (const events of [
        [],
        A.map(executionInput.events, (event) => ({ ...event, sequence: 1 })),
        A.map(executionInput.events, (event) => ({ ...event, scenario: { ...event.scenario, id: "unknown" } })),
        A.map(executionInput.events, (event) => ({ ...event, scenario: { ...event.scenario, fault: "none" } })),
        A.map(executionInput.events, (event) => ({ ...event, role: "writer" })),
        A.map(executionInput.events, (event) => (event.operation === "put" ? { ...event, status: 403 } : event)),
        A.map(executionInput.events, (event) =>
          event.operation === "put" ? { ...event, digest: digest("0") } : event
        ),
      ])
        (yield* validateExecution({ ...executionInput, events })).pipe(Result.isFailure, assertTrue);
    })
  );
  it.effect("rejects missing fault reads, wrong transport status and wrong truncation evidence", () =>
    Effect.gen(function* () {
      for (const events of [
        A.map(executionInput.events, (event) =>
          event.scenario.id === "throttled" ? { ...event, operation: "status" } : event
        ),
        A.map(executionInput.events, (event) =>
          event.scenario.id === "unavailable" ? { ...event, status: 200 } : event
        ),
        A.map(executionInput.events, (event) =>
          event.scenario.id === "truncated-body" ? { ...event, digest: artifact.sha256 } : event
        ),
        A.map(executionInput.events, (event) =>
          event.scenario.id === "truncated-body" ? { ...event, bytes: artifact.bytes } : event
        ),
        A.map(executionInput.events, (event) =>
          event.scenario.id === "throttled" ? { ...event, tagPresent: true } : event
        ),
      ])
        (yield* validateExecution({ ...executionInput, events })).pipe(Result.isFailure, assertTrue);
    })
  );
  it.effect("preserves a genuine producer miss and rejects extra denied integrity reads", () =>
    Effect.gen(function* () {
      const miss = {
        sequence: 10,
        scenario: { id: "producer", fault: "none" },
        operation: "get",
        role: "writer",
        status: 404,
        artifact: "21a66d93ac9926e9",
        digest: null,
        bytes: 0,
        tagPresent: false,
      };
      (yield* validateExecution({ ...executionInput, events: [...executionInput.events, miss] })).pipe(
        Result.isSuccess,
        assertTrue
      );
      for (const patch of [
        { status: 401 },
        { bytes: 1 },
        { tagPresent: true },
        { artifact: "0123456789abcdef" },
        { scenario: { id: "wrong-key", fault: "none" }, role: "reader", status: 403 },
      ])
        (yield* validateExecution({
          ...executionInput,
          events: [...executionInput.events, { ...miss, ...patch }],
        })).pipe(Result.isFailure, assertTrue);
    })
  );
  it.effect("rejects a detached exchange reference or an extra upload", () =>
    Effect.gen(function* () {
      const observation = {
        ...executionInput.observation,
        exchanges: A.map(executionInput.observation.exchanges, (exchange) =>
          exchange.case === "replay" ? { ...exchange, requestId: "wire-100" } : exchange
        ),
      };
      (yield* validateExecution({ ...executionInput, observation })).pipe(Result.isFailure, assertTrue);
      const events = A.map(executionInput.events, (event) =>
        event.scenario.id === "replay" ? { ...event, operation: "put" } : event
      );
      (yield* validateExecution({ ...executionInput, events })).pipe(Result.isFailure, assertTrue);
    })
  );
});

it.effect.prop(
  "rejects schema-generated replay identities that differ from the producer",
  { taskHash: Sha256Hex },
  ({ taskHash }) =>
    Effect.gen(function* () {
      const result = yield* validate({
        ...input,
        runs: A.map(input.runs, (run) => (run.case === "replay" ? { ...run, taskHash } : run)),
      });
      strictEqual(Result.isSuccess(result), taskHash === A.getUnsafe(input.runs, 0).taskHash);
    }),
  { arbitrary: fcRuns(100) }
);
