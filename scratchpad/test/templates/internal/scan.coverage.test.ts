import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { CommentStyle } from "../../../effected/templates/CommentStyle.ts";
import { SectionId } from "../../../effected/templates/Section.ts";
import { SectionDialect } from "../../../effected/templates/SectionDialect.ts";
import { scan } from "../../../effected/templates/internal/scan.ts";

describe("scanner boundary coverage", () => {
  it.effect("counts a marker matched by duplicate styles only once", () => Effect.sync(() => {
    const dialect = SectionDialect.make({ phrase: "MANAGED SECTION", styles: [CommentStyle.hash, CommentStyle.hash] });
    const id = SectionId.make({ key: "tool", commentStyle: CommentStyle.hash });
    const result = scan(`${dialect.beginMarker(id)}\nbody\n${dialect.endMarker(id)}`, dialect);
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.sections.length, 1);
      assert.strictEqual(result.sections[0]?.section.content, "body");
    }
  }));
  it.effect("preserves a lone CR between marker lines as content", () => Effect.sync(() => {
    const dialect = SectionDialect.default;
    const id = SectionId.make({ key: "tool", commentStyle: CommentStyle.hash });
    for (const separator of ["\r"]) {
      const result = scan(`${dialect.beginMarker(id)}${separator}${dialect.endMarker(id)}`, dialect);
      assert.strictEqual(result.ok, true);
      if (result.ok) assert.strictEqual(result.sections[0]?.section.content, separator);
    }
  }));
});


describe("linear marker recognition regressions", () => {
  it("preserves marker offsets, quoted rules, CRLF and first-style priority", () => {
    const plain = CommentStyle.make({ prefix: "<!--" });
    const dialect = SectionDialect.make({ phrase: "MANAGED SECTION", styles: [plain, CommentStyle.html] });
    const begin = '<!-- --- BEGIN tool MANAGED SECTION note="--- quoted ---" --- -->  \t';
    const end = '<!-- --- END tool MANAGED SECTION --- --> \t';
    const text = "\uFEFF" + begin + "\r\nbody\r\n" + end + "\r\nfooter";
    const result = scan(text, dialect);
    if (!result.ok) assert.fail("well-formed quoted attributes must scan");
    assert.strictEqual(result.sections.length, 1);
    const placed = result.sections[0];
    assert.isDefined(placed);
    assert.strictEqual(placed.start, 1);
    assert.strictEqual(placed.end, 1 + begin.length + "\r\nbody\r\n".length + end.length);
    assert.strictEqual(placed.line, 1);
    assert.strictEqual(text.slice(placed.start, placed.end), begin + "\r\nbody\r\n" + end);
    assert.strictEqual(placed.section.commentStyle, CommentStyle.html);
    assert.deepStrictEqual(placed.section.attributes, { note: "--- quoted ---" });
    assert.strictEqual(placed.section.content, "body");
    const duplicate = SectionDialect.make({ phrase: "MANAGED SECTION", styles: [CommentStyle.html, CommentStyle.html] });
    const repeated = scan(text, duplicate);
    if (!repeated.ok) assert.fail("duplicate styles must scan once");
    assert.strictEqual(repeated.sections.length, 1);
    assert.strictEqual(repeated.sections[0]?.section.commentStyle, duplicate.styles[0]);
    const firstStyle = CommentStyle.make({ prefix: "%", suffix: " " });
    const secondStyle = CommentStyle.make({ prefix: "%" });
    const priority = SectionDialect.make({ phrase: "MANAGED SECTION", styles: [firstStyle, secondStyle] });
    const priorityId = SectionId.make({ key: "tool", commentStyle: firstStyle });
    const both = `${priority.beginMarker(priorityId)}\nbody\n${priority.endMarker(priorityId)}`;
    const firstWins = scan(both, priority);
    if (!firstWins.ok) assert.fail("compatible styles must use first-style priority");
    assert.strictEqual(firstWins.sections.length, 1);
    assert.strictEqual(firstWins.sections[0]?.section.commentStyle, firstStyle);

  });

  it("scans adversarial malformed tails at increasing sizes and keeps them ordinary content", () => {
    const dialect = SectionDialect.default;
    const id = SectionId.make({ key: "tool", commentStyle: CommentStyle.hash });
    for (const size of [4096, 16384, 65536, 262144]) {
      const malformed = '# --- BEGIN other MANAGED SECTION x' + " ".repeat(size) + "!";
      const text = `${dialect.beginMarker(id)}\n${malformed}\n${dialect.endMarker(id)}`;
      const result = scan(text, dialect);
      if (!result.ok) assert.fail("malformed markers remain content");
      assert.strictEqual(result.sections.length, 1);
      assert.strictEqual(result.sections[0]?.section.content, malformed);
      const attributedEnd = '# --- END tool MANAGED SECTION x="value" ---';
      const unterminated = scan(`${dialect.beginMarker(id)}\n${attributedEnd}`, dialect);
      if (unterminated.ok) assert.fail("an attributed END cannot close a section");
      assert.strictEqual(unterminated.failure.reason, "unterminatedSection");
    }
  });
});
