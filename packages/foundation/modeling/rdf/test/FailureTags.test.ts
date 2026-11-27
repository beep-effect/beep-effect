import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe } from "@effect/vitest";
import { assertExitFailure, assertExitSuccess, assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { mapFailureTags, mapResultFailureTag } from "./helpers/FailureTags.ts";

describe("failure tag projection keeps the complete cause, unlike a lossy Exit.mapError", () => {
  it.prop(
    "retains typed failure, defect and interruption reasons together",
    { tag: S.String, defect: S.String, fiberId: S.Int },
    ({ tag, defect, fiberId }) => {
      const input = Exit.failCause(
        Cause.combine(Cause.fail({ _tag: tag }), Cause.combine(Cause.die(defect), Cause.interrupt(fiberId)))
      );
      const expected = Cause.combine(Cause.fail(tag), Cause.combine(Cause.die(defect), Cause.interrupt(fiberId)));
      assertExitFailure(mapFailureTags(input), expected);
    },
    { arbitrary: fcRuns(25) }
  );

  it.prop(
    "preserves successful payloads",
    { value: S.Unknown },
    ({ value }) => {
      assertExitSuccess(mapFailureTags(Exit.succeed(value)), value);
    },
    { arbitrary: fcRuns(25) }
  );

  it.prop(
    "projects Result failures to their tag and keeps successes",
    { tag: S.String, value: S.Unknown },
    ({ tag, value }) => {
      assertFailure(mapResultFailureTag(Result.fail({ _tag: tag })), tag);
      assertSuccess(mapResultFailureTag(Result.succeed(value)), value);
    },
    { arbitrary: fcRuns(25) }
  );
});
