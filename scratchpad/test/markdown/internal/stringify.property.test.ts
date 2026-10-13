import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
import { parseBlocks } from "../../../effected/markdown/internal/blockParser.ts";
import { stringifyTree } from "../../../effected/markdown/internal/stringify.ts";
import { renderHtml } from "../e2e/support/htmlWriter.ts";
import { normalizeHtml } from "../e2e/support/normalizeHtml.ts";
const prose = Arbitrary.schema(S.String).pipe(Arbitrary.map((value) => `word${Array.from(value, (char) => char.codePointAt(0)?.toString(16)).join("")}`));
describe("stringify property floor and README fidelity", () => {
  it.effect.prop("canonical formatting is idempotent and reparsing is render-equivalent in both dialects", [prose, prose], ([label, content]) => Effect.sync(() => {
    for (const dialect of ["commonmark", "gfm"] as const) {
      const source = `Title ${label}\n===\n\n+ *${content}*\n+ **${label}**\n\n~~~ts\n${content}\n~~~\n\n> [${label}](/${content})\n`;
      const first = parseBlocks(source, { dialect }).root;
      const canonical = stringifyTree(first);
      const second = parseBlocks(canonical, { dialect }).root;
      assert.strictEqual(stringifyTree(second), canonical);
      assert.strictEqual(normalizeHtml(renderHtml(second, { gfm: dialect === "gfm" })), normalizeHtml(renderHtml(first, { gfm: dialect === "gfm" })));
      assert.include(canonical, `Title ${label}\n===`);
      assert.include(canonical, `+ *${content}*`);
      assert.include(canonical, `~~~ts\n${content}\n~~~`);
      assert.strictEqual(canonical.endsWith("\n"), true);
    }
  }), runs);
});
