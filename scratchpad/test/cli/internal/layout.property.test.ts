import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
import { Doc } from "../../../effected/cli/Doc.ts";
import { Render } from "../../../effected/cli/Render.ts";
import { sanitize } from "../../../effected/cli/Fmt.ts";
import { flatten, widthOf, truncateSpans, wrapSpans, paintSpans } from "../../../effected/cli/internal/layout.ts";
import { displayWidth } from "../../../effected/cli/internal/displayWidth.ts";
const ctx = Render.contextOf({ audience: "agent" });
const width = S.Int.check(S.isBetween({ minimum: 1, maximum: 40 }));
it.effect.prop("flattening and painting preserve sanitized content and have an idempotent plain representation", [Arbitrary.schema(S.String)], ([text]) => Effect.sync(() => {
  const flat = flatten([Doc.strong(Doc.em(Doc.text(text)))], ctx);
  const rendered = paintSpans(flat, ctx);
  assert.strictEqual(rendered, sanitize(text));
  const parsed = flatten([Doc.text(rendered)], ctx);
  assert.strictEqual(paintSpans(parsed, ctx), rendered);
  assert.deepStrictEqual(flatten([Doc.text(paintSpans(parsed, ctx))], ctx), parsed);
  assert.strictEqual(widthOf(flat), displayWidth(sanitize(text)));
}), runs);
it.effect.prop("truncation is idempotent and wrapping has a faithful canonical line representation", [Arbitrary.schema(S.String), Arbitrary.schema(width)], ([text, columns]) => Effect.sync(() => {
  const spans = flatten([Doc.text(text)], ctx);
  const clipped = truncateSpans(spans, columns, "…");
  assert.deepStrictEqual(truncateSpans(clipped, columns, "…"), clipped);
  assert.isAtMost(widthOf(clipped), columns);
  const wrapped = wrapSpans(spans, columns);
  const lines = wrapped.map((line) => paintSpans(line, ctx));
  // Reparse each canonical output line separately, retaining blank lines too.
  const reparsed = lines.map((line) => flatten([Doc.text(line)], ctx));
  assert.deepStrictEqual(reparsed.map((line) => paintSpans(line, ctx)), lines);
  assert.deepStrictEqual(reparsed.map((line) => wrapSpans(line, columns).map((part) => paintSpans(part, ctx)).join("\n")), lines);
  const words = sanitize(text).replace(/\s/g, "");
  assert.strictEqual(lines.join("").replace(/\s/g, ""), words);
}), runs);
