import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
import { Doc } from "../../../effected/cli/Doc.ts";
import { Render } from "../../../effected/cli/Render.ts";
import { capOf, renderDoc, renderDocLines, targetText, textLines, trimLine } from "../../../effected/cli/internal/renderDoc.ts";
import { plainInline } from "../../../effected/cli/internal/renderPlain.ts";
const ctx = Render.contextOf({ audience: "agent" });
const flavour = { inline: plainInline, finish: (line: ReadonlyArray<{ readonly text: string }>) => A.join(A.map(line, (span) => span.text), "") };
it.effect.prop("textLines: parse/stringify fidelity and normalized line-ending idempotence", [Arbitrary.schema(S.String)], ([text]) => Effect.sync(() => {
  const parsed = textLines(text);
  const stringified = `${A.join(parsed, "\n")}\n`;
  assert.deepStrictEqual(textLines(stringified), parsed);
  assert.strictEqual(A.join(textLines(stringified), "\n"), A.join(parsed, "\n"));
}), runs);
it.effect.prop("trimLine is idempotent and keeps all non-trailing text", [S.String.pipe(S.Array, Arbitrary.schema)], ([strings]) => Effect.sync(() => {
  const spans = A.map(strings, (text) => ({ text }));
  const trimmed = trimLine(spans);
  assert.deepStrictEqual(trimLine(trimmed), trimmed);
  assert.strictEqual(A.join(A.map(trimmed, (span) => span.text), ""), A.join(strings, "").trimEnd());
}), runs);
it.effect.prop("renderDoc and its line parser preserve verbatim text with idempotent rendering", [Arbitrary.schema(S.String)], ([text]) => Effect.sync(() => {
  const doc = [Doc.verbatim(`prefix ${text} suffix`)];
  const once = renderDoc(doc, ctx, flavour);
  assert.deepStrictEqual(renderDocLines(doc, ctx, flavour), textLines(once));
  assert.strictEqual(renderDoc([Doc.verbatim(once)], ctx, flavour), once);
  assert.deepStrictEqual(textLines(renderDoc([Doc.verbatim(A.join(textLines(once), "\n"))], ctx, flavour)), textLines(once));
}), runs);
it.effect.prop("cap normalization is idempotent and file target rendering retains location coordinates", [Arbitrary.schema(S.Int)], ([n]) => Effect.sync(() => {
  assert.strictEqual(capOf(capOf(n)), capOf(n));
  const rendered = targetText({ file: "source.ts", line: n, col: 2 }, ctx);
  const parts = rendered.split(":");
  assert.deepStrictEqual(parts, ["source.ts", String(n), "2"]);
  const recovered = { file: A.getUnsafe(parts, 0), line: Number(A.getUnsafe(parts, 1)), col: Number(A.getUnsafe(parts, 2)) };
  assert.strictEqual(recovered.file, "source.ts");
  assert.isTrue(recovered.line === n);
  assert.strictEqual(recovered.col, 2);
  assert.strictEqual(targetText(recovered, ctx), rendered);
}), runs);
