import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Doc } from "../../effected/cli/Doc.ts";
import { Fmt } from "../../effected/cli/Fmt.ts";
import { Render } from "../../effected/cli/Render.ts";

const runs = { arbitrary: fcRuns(100) };
const context = Render.contextOf({ audience: "agent", neutralizeWorkflowCommands: false });
const textSchema = S.String;
const JsonText = S.fromJsonString(S.String);

// textLines drops the empty line contributed by a terminal line break. Keep
// generated line breaks inside the content for the idempotence properties.
it.effect("verbatim drops one terminal line break while preserving preceding blank lines", () => Effect.sync(() => {
  for (const format of [Render.plain, Render.ansi, Render.githubLog]) {
    assert.strictEqual(format([Doc.verbatim("content:\n")], context), "content:");
    assert.strictEqual(format([Doc.verbatim("content:\n\n")], context), "content:\n");
  }
  assert.strictEqual(Render.markdown([Doc.verbatim("content:\n")], context), "```\ncontent:\n```");
  assert.strictEqual(Render.markdown([Doc.verbatim("content:\n\n")], context), "```\ncontent:\n\n```");
}));

for (const [name, format] of [["plain", Render.plain], ["ansi", Render.ansi]] as const) {
  it.effect.prop(`${name}: verbatim formatting is idempotent and preserves sanitized text`, [Arbitrary.schema(textSchema)], ([value]) => Effect.gen(function* () {
    const text = `content:${value}:end`;
    const formatted = format([Doc.verbatim(text)], context);
    const expected = Fmt.sanitize(text).replace(/\r\n?/g, "\n");
    assert.strictEqual(formatted, expected);
    assert.strictEqual(format([Doc.verbatim(formatted)], context), formatted);
    const serialized = yield* S.encodeEffect(JsonText)(formatted);
    const parsed = yield* S.decodeEffect(JsonText)(serialized);
    assert.strictEqual(format([Doc.verbatim(parsed)], context), formatted);
    assert.notInclude(formatted, "\u001b");
  }), runs);
}

it.effect.prop("GitHub log formatting is idempotent and preserves text after neutralizing commands", [Arbitrary.schema(textSchema)], ([value]) => Effect.gen(function* () {
    const text = `content:${value}:end`;
  const formatted = Render.githubLog([Doc.verbatim(text)], context);
  assert.strictEqual(Render.githubLog([Doc.verbatim(formatted)], context), formatted);
  const serialized = yield* S.encodeEffect(JsonText)(formatted);
  const parsed = yield* S.decodeEffect(JsonText)(serialized);
  assert.strictEqual(Render.githubLog([Doc.verbatim(parsed)], context), formatted);
  assert.notInclude(formatted, "##[");
  assert.notMatch(formatted, /^\s*::/m);
  assert.notInclude(formatted, "\u001b");
}), runs);

// Markdown verbatim output is a fenced block. Reading the fence is the inverse
// for this document variant; treating the fence itself as content adds a block.
it.effect.prop("markdown verbatim fences preserve sanitized content and reformat idempotently", [Arbitrary.schema(textSchema)], ([value]) => Effect.gen(function* () {
    const text = `content:${value}:end`;
  const formatted = Render.markdown([Doc.verbatim(text)], context);
  const lines = formatted.split("\n");
  const fence = lines[0] ?? "";
  assert.match(fence, /^`{3,}$/);
  assert.strictEqual(lines[lines.length - 1], fence);
  const parsed = lines.slice(1, -1).join("\n");
  assert.strictEqual(parsed, Fmt.sanitize(text).replace(/\r\n?/g, "\n"));
  assert.strictEqual(Render.markdown([Doc.verbatim(parsed)], context), formatted);
  const serialized = yield* S.encodeEffect(JsonText)(parsed);
  const decoded = yield* S.decodeEffect(JsonText)(serialized);
  assert.strictEqual(Render.markdown([Doc.verbatim(decoded)], context), formatted);
}), runs);
