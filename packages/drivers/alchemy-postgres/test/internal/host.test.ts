/**
 * The bounded summaries the driver host logs in place of a failure: a tag
 * capped at 64 characters, the kind of failure when nothing is tagged, and the
 * role of a backfill job address without its key.
 */
import { causeTagOf, failureTagOf, roleOf } from "@beep/alchemy-postgres/internal/host";
import { describe, it } from "@effect/vitest";
import { strictEqual } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";

class ProbeFailed {
  readonly _tag = "ProbeFailed";
  readonly message = "secret instance probe-77";
}

const longTag = Str.repeat(80)("T");

describe("host failure summaries", () => {
  it.effect("logs a tagged value by its tag and anything else as untagged", () =>
    Effect.sync(() => {
      strictEqual(failureTagOf(new ProbeFailed()), "ProbeFailed");
      strictEqual(failureTagOf({ _tag: 42 }), "Untagged");
      strictEqual(failureTagOf("secret rejection text"), "Untagged");
      strictEqual(failureTagOf(undefined), "Untagged");
    })
  );

  it.effect("caps a tag at 64 characters", () =>
    Effect.sync(() => {
      strictEqual(failureTagOf({ _tag: longTag }), Str.repeat(64)("T"));
      strictEqual(causeTagOf(Cause.fail({ _tag: longTag })), Str.repeat(64)("T"));
    })
  );

  it.effect("summarizes a cause as interruption, a tag, or an untagged failure or defect", () =>
    Effect.sync(() => {
      strictEqual(causeTagOf(Cause.interrupt(7)), "Interrupted");
      strictEqual(causeTagOf(Cause.fail(new ProbeFailed())), "ProbeFailed");
      strictEqual(causeTagOf(Cause.die(new ProbeFailed())), "ProbeFailed");
      strictEqual(causeTagOf(Cause.fail("secret failure text")), "UntaggedFailure");
      strictEqual(causeTagOf(Cause.die("secret defect text")), "UntaggedDefect");
      strictEqual(causeTagOf(Cause.combine(Cause.interrupt(7), Cause.fail("secret"))), "UntaggedFailure");
    })
  );

  it.effect("logs a backfill job address by its role only", () =>
    Effect.sync(() => {
      strictEqual(roleOf("node:Probe/secret-instance"), "node");
      strictEqual(roleOf("run:view:Totals"), "run");
      strictEqual(roleOf("scanner:view:Totals/Probe/secret-instance"), "scanner");
      strictEqual(roleOf("source:Probe/secret-instance"), "source");
      strictEqual(roleOf("consumer:view:Totals/secret-key"), "consumer");
      strictEqual(roleOf("unprefixed"), "unprefixed");
    })
  );
});
