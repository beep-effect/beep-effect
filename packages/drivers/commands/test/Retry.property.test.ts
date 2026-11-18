import { Retry, TRANSIENT_PATTERNS } from "@beep/commands/Retry";
import { CommandFailedError } from "@beep/commands/Run";
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };
it.effect.prop(
  "every network marker is transient in either stream but cannot make a timeout retryable",
  [Arbitrary.schema(S.String)],
  ([context]) =>
    Effect.forEach(
      TRANSIENT_PATTERNS,
      (pattern) =>
        Effect.forEach(
          ["stdout", "stderr"] as const,
          (stream) =>
            Effect.sync(() => {
              const error = CommandFailedError.make({
                kind: "nonZero",
                command: "tool",
                args: [],
                [stream]: `${context}\n${Str.toUpperCase(pattern)}`,
              });
              assert.isTrue(Retry.isTransient(error));
              assert.isTrue(Retry.transient().while(error));
              assert.isFalse(
                Retry.transient({ also: [pattern] }).while(CommandFailedError.make({ ...error, kind: "timeout" }))
              );
            }),
          { concurrency: 1, discard: true }
        ),
      { concurrency: 1, discard: true }
    ),
  runs
);
