import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

import { sanitize } from "@beep/cli-kit/Fmt";
import {
  FailureTargetCell,
  fallbackTarget,
  guardConsumerLines,
  linesOf,
  plainFailureLines,
  readSpans,
} from "@beep/cli-kit/internal/failureTarget";
import { Render } from "@beep/cli-kit/Render";
import { CommandNeutralizer } from "@beep/github-commands";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import { pipe } from "effect/Function";
import * as MutableRef from "effect/MutableRef";
import * as Str from "effect/String";

it.effect.prop(
  "guarding agent consumer lines is idempotent and preserves text after sanitization and command neutralization",
  [Arbitrary.schema(S.String)],
  ([text]) =>
    Effect.gen(function* () {
      const target = { ...fallbackTarget, assumed: false, ctx: Render.contextOf({ audience: "agent" }) };
      const cell = MutableRef.make(target);
      const guard = (lines: ReadonlyArray<string>) =>
        guardConsumerLines(lines).pipe(Effect.provideService(FailureTargetCell, cell));
      const once = yield* guard([`\u001b[31m${text}\u001b[0m`]);
      assert.deepStrictEqual(once, [sanitize(text)]);
      const guard1 = yield* guard(once);
      assert.deepStrictEqual(guard1, once);
    }),
  runs
);
it.effect.prop(
  "plain failure rendering agrees with its target formatter and has a faithful line serialization",
  [Arbitrary.schema(S.String)],
  ([message]) =>
    Effect.sync(() => {
      const safe = `message ${Str.replace(/[\r\n]/g, " ")(sanitize(message))} end`;
      const cause = Cause.fail(safe);
      const rendered = plainFailureLines(cause, false);
      assert.deepStrictEqual(rendered, linesOf(cause, fallbackTarget, false));
      assert.deepStrictEqual(pipe(rendered, A.join("\n"), Str.split("\n")), rendered);
      assert.strictEqual(A.join(rendered, "\n"), CommandNeutralizer.text(safe));
    }),
  runs
);
it.effect.prop(
  "span setting parsing is case-insensitive and stable through its canonical string",
  [Arbitrary.schema(S.Literals(["app", "all", "off"]))],
  ([setting]) =>
    Effect.gen(function* () {
      const parse = (raw: string) =>
        readSpans(undefined, "SPANS").pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ SPANS: raw }))
        );
      const parsed = yield* parse(Str.toUpperCase(setting));
      assert.deepStrictEqual(parsed, { spans: setting, invalid: undefined });
      if (parsed.spans === undefined) return assert.fail("a valid setting failed to parse");
      const parsed2 = yield* parse(parsed.spans);
      assert.deepStrictEqual(parsed2, parsed);
      const parsed3 = yield* parse((yield* parse(parsed.spans)).spans ?? "");
      assert.deepStrictEqual(parsed3, parsed);
    }),
  runs
);
