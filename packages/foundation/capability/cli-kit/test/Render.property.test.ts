import { Doc } from "@beep/cli-kit/Doc";
import { Fmt } from "@beep/cli-kit/Fmt";
import { Render } from "@beep/cli-kit/Render";
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };
const context = Render.contextOf({ audience: "agent", neutralizeWorkflowCommands: false });
const textSchema = S.String;
const JsonText = S.fromJsonString(S.String);

const contentKeepingBreaksInside = (value: string): string => `content:${value}:end`;

it.effect("verbatim drops one terminal line break while preserving preceding blank lines", () =>
  Effect.sync(() => {
    for (const format of [Render.plain, Render.ansi, Render.githubLog]) {
      assert.strictEqual(format([Doc.verbatim("content:\n")], context), "content:");
      assert.strictEqual(format([Doc.verbatim("content:\n\n")], context), "content:\n");
    }
    assert.strictEqual(Render.markdown([Doc.verbatim("content:\n")], context), "```\ncontent:\n```");
    assert.strictEqual(Render.markdown([Doc.verbatim("content:\n\n")], context), "```\ncontent:\n\n```");
  })
);

for (const [name, format] of [
  ["plain", Render.plain],
  ["ansi", Render.ansi],
] as const) {
  it.effect.prop(
    `${name}: verbatim formatting is idempotent and preserves sanitized text`,
    [Arbitrary.schema(textSchema)],
    ([value]) =>
      Effect.gen(function* () {
        const text = contentKeepingBreaksInside(value);
        const formatted = format([Doc.verbatim(text)], context);
        const expected = Str.replace(/\r\n?/g, "\n")(Fmt.sanitize(text));
        assert.strictEqual(formatted, expected);
        assert.strictEqual(format([Doc.verbatim(formatted)], context), formatted);
        const serialized = yield* S.encodeEffect(JsonText)(formatted);
        const parsed = yield* S.decodeEffect(JsonText)(serialized);
        assert.strictEqual(format([Doc.verbatim(parsed)], context), formatted);
        assert.notInclude(formatted, "\u001b");
      }),
    runs
  );
}

it.effect.prop(
  "GitHub log formatting is idempotent and preserves text after neutralizing commands",
  [Arbitrary.schema(textSchema)],
  ([value]) =>
    Effect.gen(function* () {
      const text = contentKeepingBreaksInside(value);
      const formatted = Render.githubLog([Doc.verbatim(text)], context);
      assert.strictEqual(Render.githubLog([Doc.verbatim(formatted)], context), formatted);
      const serialized = yield* S.encodeEffect(JsonText)(formatted);
      const parsed = yield* S.decodeEffect(JsonText)(serialized);
      assert.strictEqual(Render.githubLog([Doc.verbatim(parsed)], context), formatted);
      assert.notInclude(formatted, "##[");
      assert.notMatch(formatted, /^\s*::/m);
      assert.notInclude(formatted, "\u001b");
    }),
  runs
);

it.effect.prop(
  "markdown verbatim fences preserve sanitized content and reformat idempotently",
  [Arbitrary.schema(textSchema)],
  ([value]) =>
    Effect.gen(function* () {
      const text = contentKeepingBreaksInside(value);
      const formatted = Render.markdown([Doc.verbatim(text)], context);
      const lines = Str.split(formatted, "\n");
      const fence = lines[0] ?? "";
      assert.match(fence, /^`{3,}$/);
      assert.strictEqual(lines[lines.length - 1], fence);
      const parsed = A.join(lines.slice(1, -1), "\n");
      assert.strictEqual(
        parsed,
        Str.replace(/\r\n?/g, "\n")(Fmt.sanitize(text)),
        "reading the fence is the inverse; treating the fence itself as content adds a block"
      );
      assert.strictEqual(Render.markdown([Doc.verbatim(parsed)], context), formatted);
      const serialized = yield* S.encodeEffect(JsonText)(parsed);
      const decoded = yield* S.decodeEffect(JsonText)(serialized);
      assert.strictEqual(Render.markdown([Doc.verbatim(decoded)], context), formatted);
    }),
  runs
);
