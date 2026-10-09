import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import { Redaction } from "../../effected/commands/Redaction.ts";

const runs = { arbitrary: fcRuns(100) };
it.effect.prop("scrubArgs is idempotent and composes with a preceding secret flag", [Arbitrary.schema(S.String.pipe(S.Array))], ([args]) => Effect.sync(() => {
  const framed = ["--token", "private-value", "--", ...args];
  const scrubbed = Redaction.scrubArgs(framed);
  assert.deepStrictEqual(Redaction.scrubArgs(scrubbed), scrubbed);
  assert.strictEqual(scrubbed[0], "--token");
  assert.strictEqual(scrubbed[1], "***");
  assert.deepStrictEqual(Redaction.scrubArgs(args), scrubbed.slice(3));
}), runs);
it.effect.prop("value redaction keeps the non-secret framing and is idempotent for placeholder-disjoint secrets", [Arbitrary.schema(S.String)], ([value]) => Effect.sync(() => {
  // The prefix makes every secret disjoint from both the marker and safe framing.
  const secret = `token-${value}`;
  const secrets = [Redacted.make(secret)];
  const scrubbed = Redaction.apply(`before:${secret}:after`, secrets);
  assert.strictEqual(scrubbed, "before:***:after");
  assert.strictEqual(Redaction.apply(scrubbed, secrets), scrubbed);
  assert.deepStrictEqual(Redaction.applyArgs([secret, "safe"], secrets), ["***", "safe"]);
}), runs);
