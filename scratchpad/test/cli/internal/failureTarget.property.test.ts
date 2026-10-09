import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
import { CommandNeutralizer } from "../../../effected/github-commands/index.ts";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as MutableRef from "effect/MutableRef";
import { Render } from "../../../effected/cli/Render.ts";
import { sanitize } from "../../../effected/cli/Fmt.ts";
import { FailureTargetCell, fallbackTarget, guardConsumerLines, linesOf, plainFailureLines, readSpans } from "../../../effected/cli/internal/failureTarget.ts";
it.effect.prop("guarding agent consumer lines is idempotent and preserves text after sanitization and command neutralization", [Arbitrary.schema(S.String)], ([text]) => Effect.gen(function* () {
  const target = { ...fallbackTarget, assumed: false, ctx: Render.contextOf({ audience: "agent" }) };
  const cell = MutableRef.make(target);
  const guard = (lines: ReadonlyArray<string>) => guardConsumerLines(lines).pipe(Effect.provideService(FailureTargetCell, cell));
  const once = yield* guard([`\u001b[31m${text}\u001b[0m`]);
  assert.deepStrictEqual(once, [sanitize(text)]);
  assert.deepStrictEqual(yield* guard(once), once);
}), runs);
it.effect.prop("plain failure rendering agrees with its target formatter and has a faithful line serialization", [Arbitrary.schema(S.String)], ([message]) => Effect.sync(() => {
  const safe = `message ${sanitize(message).replace(/[\r\n]/g, " ")} end`;
  const cause = Cause.fail(safe);
  const rendered = plainFailureLines(cause, false);
  assert.deepStrictEqual(rendered, linesOf(cause, fallbackTarget, false));
  assert.deepStrictEqual(rendered.join("\n").split("\n"), rendered);
  assert.strictEqual(rendered.join("\n"), CommandNeutralizer.text(safe));
}), runs);
it.effect.prop("span setting parsing is case-insensitive and stable through its canonical string", [Arbitrary.schema(S.Literals(["app", "all", "off"]))], ([setting]) => Effect.gen(function* () {
  const parse = (raw: string) => readSpans(undefined, "SPANS").pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ SPANS: raw })));
  const parsed = yield* parse(setting.toUpperCase());
  assert.deepStrictEqual(parsed, { spans: setting, invalid: undefined });
  if (parsed.spans === undefined) return assert.fail("a valid setting failed to parse");
  assert.deepStrictEqual(yield* parse(parsed.spans), parsed);
  assert.deepStrictEqual(yield* parse((yield* parse(parsed.spans)).spans ?? ""), parsed);
}), runs);
