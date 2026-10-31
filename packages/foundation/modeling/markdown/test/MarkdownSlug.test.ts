// The anchor-slug rule, pinned against `@effect/markdown-toc` 0.1.0: every
// expected value here was produced by that package's `slugify`, `titleize`
// and `querystring.escape`, except the lone-surrogate anchor, which the kit
// pins on its own (the R5b differential in `goals/effected-promotion/research/`
// covers the repo's own headings; these are the rule's edges).

import { HeadingSlug, MarkdownSlug } from "@beep/markdown/MarkdownSlug";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const decodeSlug = S.decodeUnknownResult(HeadingSlug);

describe("MarkdownSlug", () => {
  describe("linkText", () => {
    it("takes the text of a heading that opens with an inline link", () => {
      assert.strictEqual(MarkdownSlug.linkText("[Guide](./guide.md) and more"), "Guide");
      assert.strictEqual(MarkdownSlug.linkText("[**bold**](x) rest"), "**bold**");
    });

    it("leaves every other heading as written", () => {
      assert.strictEqual(MarkdownSlug.linkText("Plain heading"), "Plain heading");
      assert.strictEqual(MarkdownSlug.linkText("[ref][id] later"), "[ref][id] later");
      assert.strictEqual(MarkdownSlug.linkText("see [Guide](./g.md)"), "see [Guide](./g.md)");
      assert.strictEqual(MarkdownSlug.linkText(""), "");
    });
  });

  describe("slugify", () => {
    it("lower-cases, hyphenates spaces and doubles tabs", () => {
      assert.strictEqual(MarkdownSlug.slugify("Exports Grouped by Category"), "exports-grouped-by-category");
      assert.strictEqual(MarkdownSlug.slugify("Two  spaces"), "two--spaces");
      assert.strictEqual(MarkdownSlug.slugify("tab\there"), "tab--here");
    });

    it("deletes HTML tags and the fixed ASCII and CJK punctuation lists", () => {
      assert.strictEqual(MarkdownSlug.slugify("Use <b>Effect.gen</b> now"), "use-effectgen-now");
      assert.strictEqual(MarkdownSlug.slugify("Effect.fn (function)"), "effectfn-function");
      assert.strictEqual(MarkdownSlug.slugify("`Point` (class)"), "point-class");
      assert.strictEqual(
        MarkdownSlug.slugify("a|b$c&d~e=f\\g/h@i+j*k!l?m{n[o]p}q.r,s;t:u'v\"w^x<y>z"),
        "abcdefghijklmnopqrstuvwxz"
      );
      assert.strictEqual(MarkdownSlug.slugify("日本語、見出し！"), "日本語見出し");
      assert.strictEqual(MarkdownSlug.slugify("〔a〕「b」《c》—d…e"), "abcde");
      assert.strictEqual(MarkdownSlug.slugify("snake_case stays"), "snake_case-stays");
    });

    it("keeps punctuation outside the lists, non-Latin letters included", () => {
      assert.strictEqual(MarkdownSlug.slugify("a×b÷c ǅ § ¿ €"), "a×b÷c-ǆ-§-¿-€");
      assert.strictEqual(MarkdownSlug.slugify("Ω and ж and 中"), "ω-and-ж-and-中");
    });

    it("folds Latin-1 and Latin Extended-A letters to ASCII, with the diacritics-map exceptions", () => {
      assert.strictEqual(MarkdownSlug.slugify("Straße über Ærø"), "strasse-uber-aero");
      assert.strictEqual(MarkdownSlug.slugify("Đ ı Ŋ Œ ĸ ŉ Ħ ŀ Ł Ŧ ĳ þ ð ß"), "d-i-n-oe-q-n-h-l-l-t-ij-th-d-ss");
      assert.strictEqual(MarkdownSlug.slugify("Éé Ññ Çç Žž Ůů Őő"), "ee-nn-cc-zz-uu-oo");
      // U+017F (ſ) is the first code point past the fold range; a combining mark on an ASCII letter is not folded either.
      assert.strictEqual(MarkdownSlug.slugify("ſ é"), "ſ-é");
    });

    it("slugs the leading link's text and appends a positive ordinal", () => {
      assert.strictEqual(MarkdownSlug.slugify("[Guide](./guide.md) and more"), "guide");
      assert.strictEqual(MarkdownSlug.slugify("Signature", 2), "signature-2");
      assert.strictEqual(MarkdownSlug.slugify("~~deprecated~~ make", 1), "deprecated-make-1");
      assert.strictEqual(MarkdownSlug.slugify("make", 0), "make");
    });

    it("yields a value the HeadingSlug schema accepts", () => {
      const headings = [
        "Exports Grouped by Category",
        "Use <b>x</b>\tnow",
        "[Guide](./g.md) more",
        "日本語、見出し！",
        "",
      ];
      A.forEach(headings, (heading) =>
        assertSuccess(decodeSlug(MarkdownSlug.slugify(heading)), MarkdownSlug.slugify(heading))
      );
    });
  });

  describe("titleize", () => {
    it("takes the leading link text, deletes tags, collapses runs of spaces and tabs and trims", () => {
      assert.strictEqual(MarkdownSlug.titleize(" Use  <code>pipe</code>\tnow "), "Use pipe now");
      assert.strictEqual(MarkdownSlug.titleize("Use  <b>Effect.gen</b>   now"), "Use Effect.gen now");
      assert.strictEqual(MarkdownSlug.titleize("[Guide](./guide.md) and more"), "Guide");
      assert.strictEqual(MarkdownSlug.titleize("<http://a.b> auto"), "auto");
      assert.strictEqual(MarkdownSlug.titleize("`Point` (class)"), "`Point` (class)");
    });
  });

  describe("anchor", () => {
    it("prefixes # and percent-escapes everything outside the unreserved set", () => {
      assert.strictEqual(MarkdownSlug.anchor("effectfn-function"), "#effectfn-function");
      assert.strictEqual(MarkdownSlug.anchor("snake_case-stays"), "#snake_case-stays");
      assert.strictEqual(MarkdownSlug.anchor("日本語"), "#%E6%97%A5%E6%9C%AC%E8%AA%9E");
      assert.strictEqual(MarkdownSlug.anchor("a×b-§"), "#a%C3%97b-%C2%A7");
      assert.strictEqual(MarkdownSlug.anchor(""), "#");
    });

    it("replaces a lone surrogate instead of throwing (the kit's own rule: no file-decoded source carries one)", () => {
      assert.strictEqual(MarkdownSlug.anchor("x\ud800y"), "#x%EF%BF%BDy");
    });
  });

  describe("HeadingSlug", () => {
    it("rejects a slug with an ASCII space or tab", () => {
      assertFailure(
        Result.mapError(decodeSlug("has space"), (error) => error._tag),
        "SchemaError"
      );
      assert.isFalse(S.is(HeadingSlug)("has\ttab"));
      assert.isTrue(S.is(HeadingSlug)("has-no-space_or-tab"));
      assert.isTrue(S.is(HeadingSlug)(""));
    });
  });
});
