import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { scanFrontmatter, scanRawFrontmatter } from "../../../../effected/markdown/internal/blocks/frontmatter.ts";
import type { SourceLine } from "../../../../effected/markdown/internal/preprocess.ts";
import { preprocessLines } from "../../../../effected/markdown/internal/preprocess.ts";
describe("frontmatter scanner boundary coverage", () => {
 it.effect("empty and displaced line tables do not capture", () => Effect.sync(() => {
  assert.strictEqual(scanFrontmatter([], ""), null);
  assert.strictEqual(scanFrontmatter([{text: "---", start: 1}], " ---"), null);
  const lines: SourceLine[] = new Array<SourceLine>(3);
  lines[0] = {text: "---", start: 0}; lines[2] = {text: "---", start: 4};
  assert.deepStrictEqual(scanFrontmatter(lines, "---\n---"), {format: "yaml", value: "", lineCount: 3, endOffset: 7});
  lines[1] = {text: "x", start: 4}; delete lines[2]; lines[3] = {text: "---", start: 6};
  assert.strictEqual(scanFrontmatter(lines, "---\nx\n---")?.value, "");
  assert.deepStrictEqual(scanRawFrontmatter("---\rx\r---\rbody"), {format: "yaml", value: "x\r", newline: "\r", bodyOffset: 10});
 }));
 it.effect("both call forms capture CRLF content and preserve raw body boundaries", () => Effect.sync(() => {
  const text = "---\r\na: 1\r\nb: 2\r\n---\r\nbody";
  assert.strictEqual(scanFrontmatter(text)(preprocessLines(text))?.value, "a: 1\r\nb: 2");
  const raw = scanRawFrontmatter(text);
  assert.strictEqual(raw?.value, "a: 1\r\nb: 2\r\n");
  assert.strictEqual(text.slice(raw?.bodyOffset), "body");
 }));
 it.effect("a missing closer rejects capture and an EOF closer records the exact boundary", () => Effect.sync(() => {
  const missing = "---\nmissing";
  assert.strictEqual(scanRawFrontmatter(missing), null);
  assert.strictEqual(scanFrontmatter(preprocessLines(missing), missing), null);
  assert.deepStrictEqual(scanRawFrontmatter("---\nx\n---"), {format: "yaml", value: "x\n", newline: "\n", bodyOffset: 9});
 }));
});
