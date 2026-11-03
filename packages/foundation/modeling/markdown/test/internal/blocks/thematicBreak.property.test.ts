import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Markdown } from "@beep/markdown/Markdown";
import { MarkdownFormat, MarkdownFormattingOptions } from "@beep/markdown/MarkdownFormat";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };
it.effect.prop(
  "thematic breaks retain author marker spelling and normalize idempotently without changing surrounding bytes",
  [
    Arbitrary.schema(S.Literals(["-", "_", "*"])),
    Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 3, maximum: 30 }))),
  ],
  ([marker, count]) =>
    Effect.gen(function* () {
      const source = `${Str.repeat(count)(marker)}\n`;
      const parsed = yield* Markdown.parse(source);
      const [node] = parsed.children;
      assert.strictEqual(node?.type, "thematicBreak");
      assert.strictEqual(node?.type === "thematicBreak" ? node.markerChar : undefined, marker);
      const serialized = yield* Markdown.stringify(parsed);
      const reparsed = yield* Markdown.parse(serialized);
      const [again] = reparsed.children;
      assert.strictEqual(again?.type === "thematicBreak" ? again.markerChar : undefined, marker);
      const stringify1 = yield* Markdown.stringify(reparsed);
      assert.strictEqual(stringify1, serialized);
      const surrounded = `<!-- untouched -->\n\n${source}\nparagraph  spacing\n`;
      const options = MarkdownFormattingOptions.make({ thematicBreakChar: "*" });
      const formatted = MarkdownFormat.formatToString(surrounded, undefined, options);
      assert.strictEqual(formatted, marker === "*" ? surrounded : `<!-- untouched -->\n\n***\n\nparagraph  spacing\n`);
      assert.strictEqual(MarkdownFormat.formatToString(formatted, undefined, options), formatted);
    }),
  runs
);
