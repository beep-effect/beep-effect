import { CacheProtocolObservation, validateCacheProtocolObservation } from "@beep/repo-cli/commands/Cache";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const digest = Str.repeat(64);
const client = { version: "2.11.4", sha256: digest("a"), namespace: "protocol-stable" };
const output = { sha256: digest("b"), bytes: 22 };
const artifact = { sha256: digest("c"), bytes: 188 };
const cases = ["producer", "replay", "missing-tag", "invalid-tag", "corrupt-body", "wrong-key"];
const input = {
  schemaVersion: "cache-protocol-observation/v1",
  authority: "synthetic-native-observation-only",
  channel: "stable",
  client,
  runs: A.map(cases, (name, index) => ({
    case: name,
    taskHash: "21a66d93ac9926e9",
    client,
    summary: digest(`${index + 1}`),
    outcome:
      name === "producer"
        ? { _tag: "Produced", output }
        : name === "replay"
          ? { _tag: "Replayed", output }
          : { _tag: "Rejected", exitCode: 42, restoredOutputs: 0 },
  })),
  exchanges: A.map(cases, (name, index) => ({
    case: name,
    taskHash: "21a66d93ac9926e9",
    requestId: `request-${index}`,
    method: name === "producer" ? "PUT" : "GET",
    role: name === "producer" ? "writer" : "reader",
    status: 200,
    tag: name === "missing-tag" ? "absent" : "present",
    artifact: name === "corrupt-body" ? { ...artifact, sha256: digest("d") } : artifact,
  })),
};
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
        expect(Result.isFailure(yield* validate(value))).toBe(true);
    })
  );

  it.effect("rejects a denied upload, a reader upload and mismatched artifact bytes", () =>
    Effect.gen(function* () {
      for (const patch of [{ status: 403 }, { role: "reader" }, { artifact: { ...artifact, bytes: 189 } }]) {
        const exchanges = A.map(input.exchanges, (event) =>
          event.case === "producer" ? { ...event, ...patch } : event
        );
        expect(Result.isFailure(yield* validate({ ...input, exchanges }))).toBe(true);
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
        expect(Result.isFailure(yield* validate({ ...input, runs }))).toBe(true);
    })
  );

  it.effect("rejects unchanged corrupt-body evidence and a missing tag presented as present", () =>
    Effect.gen(function* () {
      for (const name of ["corrupt-body", "missing-tag"]) {
        const exchanges = A.map(input.exchanges, (event) =>
          event.case === name ? { ...event, artifact, tag: "present" } : event
        );
        expect(Result.isFailure(yield* validate({ ...input, exchanges }))).toBe(true);
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
        expect(Result.isFailure(yield* validate(value))).toBe(true);
    })
  );
});
