import { identity } from "effect/Function";
// The string-level frontmatter surface: split raw source at the closed fence
// grammar without parsing anything, and join back byte-exactly.

import { FrontmatterSource, FrontmatterSourceBlock, FrontmatterSourceSplit } from "@beep/markdown/FrontmatterSource";
import { Markdown, MarkdownParseOptions } from "@beep/markdown/Markdown";
import { assert, describe, it } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const UnknownJson = S.fromJsonString(S.Unknown);

const split = FrontmatterSource.split;
const join = FrontmatterSource.join;

/** The format of the parser's head frontmatter capture, when it captured one. */
const capturedFormat = (source: string): string | undefined => {
  const parsed = Markdown.parseResult(source, MarkdownParseOptions.make({ frontmatter: true }));
  assertSuccess(parsed, Result.getOrThrow(parsed));
  const head = Result.getOrThrow(parsed).children[0];
  return head?.type === "frontmatter" ? head.format : undefined;
};

describe("FrontmatterSource", () => {
  describe("split", () => {
    it("splits a yaml block with byte-exact boundaries", () => {
      const source = "---\ntitle: hi\n---\n\n# Body\n";
      const result = split(source);
      assert.strictEqual(result.frontmatter?.format, "yaml");
      assert.strictEqual(result.frontmatter?.value, "title: hi\n");
      assert.strictEqual(result.frontmatter?.newline, "\n");
      assert.strictEqual(result.body, "\n# Body\n");
      assert.strictEqual(result.bodyOffset, 18);
    });

    it("recognizes the whole closed fence set and nothing else", () => {
      assert.strictEqual(split("+++\na = 1\n+++\nb\n").frontmatter?.format, "toml");
      assert.strictEqual(split('---json\n{"a":1}\n---\nb\n').frontmatter?.format, "json");
      // Not fences: wrong spelling, indentation, unknown language hints.
      for (const source of [
        "----\nx\n----\n",
        "---- \nx\n---\n",
        "---yaml\nx\n---\n",
        " ---\nx\n---\n",
        "---\nx\n ---\n",
        "--- x\nx\n---\n",
      ]) {
        assert.strictEqual(split(source).frontmatter, undefined, source);
      }
    });

    it("accepts trailing spaces and tabs on both fence lines for every fence style", () => {
      for (const [open, close, format] of [
        ["---", "---", "yaml"],
        ["+++", "+++", "toml"],
        ["---json", "---", "json"],
      ] as const) {
        for (const pad of [" ", "\t", " \t"]) {
          for (const [opening, closing] of [
            [`${open}${pad}`, close],
            [open, `${close}${pad}`],
            [`${open}${pad}`, `${close}${pad}`],
          ]) {
            const source = `${opening}\nkey\n${closing}\nBody\n`;
            const result = split(source);
            assert.strictEqual(result.frontmatter?.format, format, source);
            assert.strictEqual(result.frontmatter?.value, "key\n", source);
            assert.strictEqual(result.body, "Body\n", source);
            assert.strictEqual(result.bodyOffset, source.length - "Body\n".length, source);
          }
        }
      }
    });

    it("closes the changeset shape '--- ' that @changesets/parse releases", () => {
      const result = split('---\n"@beep/x": patch\n--- \n\nBody\n');
      assert.strictEqual(result.frontmatter?.format, "yaml");
      assert.strictEqual(result.frontmatter?.value, '"@beep/x": patch\n');
      assert.strictEqual(result.body, "\nBody\n");
    });

    it("accepts padded fences under CRLF", () => {
      const result = split("--- \r\na: 1\r\n---\t\r\nbody");
      assert.strictEqual(result.frontmatter?.newline, "\r\n");
      assert.strictEqual(result.frontmatter?.value, "a: 1\r\n");
      assert.strictEqual(result.body, "body");
    });

    it("closes at the first fence and leaves a later padded thematic break in the body", () => {
      const result = split("---\na: 1\n---\n\nintro\n\n--- \n\nafter\n");
      assert.strictEqual(result.frontmatter?.value, "a: 1\n");
      assert.strictEqual(result.body, "\nintro\n\n--- \n\nafter\n");
    });

    it("treats an unclosed fence as no frontmatter, body verbatim", () => {
      const source = "---\ntitle: hi\n";
      const result = split(source);
      assert.strictEqual(result.frontmatter, undefined);
      assert.strictEqual(result.body, source);
      assert.strictEqual(result.bodyOffset, 0);
    });

    it("keeps an empty block and a blank-line block distinct", () => {
      assert.strictEqual(split("---\n---\nbody").frontmatter?.value, "");
      assert.strictEqual(split("---\n\n---\nbody").frontmatter?.value, "\n");
    });

    it("records CRLF fence terminators and keeps interior terminators verbatim", () => {
      const source = "---\r\na: 1\r\nb: 2\r\n---\r\nbody";
      const result = split(source);
      assert.strictEqual(result.frontmatter?.newline, "\r\n");
      assert.strictEqual(result.frontmatter?.value, "a: 1\r\nb: 2\r\n");
      assert.strictEqual(result.body, "body");
    });

    it("handles a closing fence at end of document", () => {
      const source = "---\nfoo: 1\n---";
      const result = split(source);
      assert.strictEqual(result.frontmatter?.value, "foo: 1\n");
      assert.strictEqual(result.body, "");
      assert.strictEqual(result.bodyOffset, source.length);
    });

    it("keeps value bytes verbatim — no U+0000 substitution at string level", () => {
      const result = split("---\na: \u0000\n---\nb");
      assert.strictEqual(result.frontmatter?.value, "a: \u0000\n");
    });

    it("agrees with body === source.slice(bodyOffset) on every input", () => {
      for (const source of [
        "---\ntitle: hi\n---\nbody\n",
        "---\n---\n",
        "+++\n+++\nx",
        "no frontmatter at all\n",
        "---\nunclosed\n",
        "",
      ]) {
        const result = split(source);
        assert.strictEqual(result.body, Str.slice(result.bodyOffset)(source), source);
      }
    });

    it("agrees with the parser's capture toggle about block existence and format", () => {
      for (const source of [
        "---\ntitle: hi\n---\nbody\n",
        "+++\na = 1\n+++\n",
        '---json\n{"a":1}\n---\n',
        "---\nunclosed\n",
        "# plain\n",
        "---\n---\n",
        "--- \na: 1\n---\t\n",
        "+++\t\na = 1\n+++ \n",
        '---json \n{"a":1}\n--- \n',
        "---\na: 1\n ---\n",
        "---- \na: 1\n---\n",
      ]) {
        assert.strictEqual(split(source).frontmatter?.format, capturedFormat(source), source);
      }
    });
  });

  describe("join", () => {
    it("round-trips unmodified sources byte-exactly", () => {
      for (const source of [
        "---\ntitle: hi\n---\n\n# Body\n",
        "---\ntitle: hi\n---\nbody",
        "---\n---\n",
        "---\n\n---\nbody\n",
        "+++\na = 1\nb = 2\n+++\ntext\n",
        '---json\n{"a": 1}\n---\n\ncontent\n',
        "---\r\na: 1\r\n---\r\nbody\r\n",
        "# no block here\n",
        "---\nunclosed, so body verbatim\n",
        "",
      ]) {
        assert.strictEqual(
          join(split(source)),
          source,
          Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(source), identity)
        );
      }
    });

    it("normalizes the one unterminated spelling: a closing fence at EOF gains a newline", () => {
      const source = "---\nfoo: 1\n---";
      assert.strictEqual(join(split(source)), `${source}\n`);
    });

    it("writes canonical fences when the source fences carried trailing whitespace", () => {
      assert.strictEqual(join(split("--- \na: 1\n---\t\nbody\n")), "---\na: 1\n---\nbody\n");
      assert.strictEqual(join(split("+++ \t\na = 1\n+++ \nbody\n")), "+++\na = 1\n+++\nbody\n");
      assert.strictEqual(join(split('---json\t\n{"a":1}\n--- \r\nbody')), '---json\n{"a":1}\n---\nbody');
    });

    it("serializes hand-built parts, appending the missing value terminator", () => {
      const result = join(
        FrontmatterSourceSplit.make({
          frontmatter: FrontmatterSourceBlock.make({ format: "yaml", value: "a: 1" }),
          body: "hi\n",
        })
      );
      assert.strictEqual(result, "---\na: 1\n---\nhi\n");
    });

    it("serializes every format's fence spelling", () => {
      const body = "b\n";
      const of = (format: "yaml" | "toml" | "json"): string =>
        join(
          FrontmatterSourceSplit.make({
            frontmatter: FrontmatterSourceBlock.make({ format, value: "v\n" }),
            body,
          })
        );
      assert.strictEqual(of("yaml"), "---\nv\n---\nb\n");
      assert.strictEqual(of("toml"), "+++\nv\n+++\nb\n");
      assert.strictEqual(of("json"), "---json\nv\n---\nb\n");
    });

    it("returns the body verbatim when there is no block", () => {
      assert.strictEqual(join(FrontmatterSourceSplit.make({ body: "# doc\n" })), "# doc\n");
    });

    it("honors a hand-built CRLF newline", () => {
      const result = join(
        FrontmatterSourceSplit.make({
          frontmatter: FrontmatterSourceBlock.make({ format: "yaml", value: "a: 1", newline: "\r\n" }),
          body: "b",
        })
      );
      assert.strictEqual(result, "---\r\na: 1\r\n---\r\nb");
    });
  });
});
