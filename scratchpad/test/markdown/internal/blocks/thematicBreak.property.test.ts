import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Markdown } from "../../../../effected/markdown/Markdown.ts";
import { MarkdownFormat, MarkdownFormattingOptions } from "../../../../effected/markdown/MarkdownFormat.ts";

const runs = { arbitrary: fcRuns(100) };
it.effect.prop("thematic breaks retain author marker spelling and normalize idempotently without changing surrounding bytes", [Arbitrary.schema(S.Literals(["-", "_", "*"])), Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 3, maximum: 30 })))], ([marker, count]) => Effect.gen(function* () {
  const source = `${marker.repeat(count)}\n`;
  const parsed = yield* Markdown.parse(source);
  const [node] = parsed.children;
  assert.strictEqual(node?.type, "thematicBreak");
  assert.strictEqual(node?.type === "thematicBreak" ? node.markerChar : undefined, marker);
  const serialized = yield* Markdown.stringify(parsed);
  const reparsed = yield* Markdown.parse(serialized);
  const [again] = reparsed.children;
  assert.strictEqual(again?.type === "thematicBreak" ? again.markerChar : undefined, marker);
  assert.strictEqual(yield* Markdown.stringify(reparsed), serialized);
  const surrounded = `<!-- untouched -->\n\n${source}\nparagraph  spacing\n`;
  const options = MarkdownFormattingOptions.make({ thematicBreakChar: "*" });
  const formatted = MarkdownFormat.formatToString(surrounded, undefined, options);
  assert.strictEqual(formatted, marker === "*" ? surrounded : `<!-- untouched -->\n\n***\n\nparagraph  spacing\n`);
  assert.strictEqual(MarkdownFormat.formatToString(formatted, undefined, options), formatted);
}), runs);
