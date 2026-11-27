import { GitHubHeadingDepth, GitHubListOptions, GitHubMarkdown } from "@beep/github-reporting/GitHubMarkdown";
import { Markdown } from "@beep/markdown/Markdown";
import { assert, describe, it } from "@effect/vitest";
import { assertFalse } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { deliberatelyInvalid } from "./support/deliberatelyInvalid.ts";

describe("GitHubMarkdown", () => {
  it("heading and list schemas preserve literal depths and exact optional options", () => {
    for (const depth of [1, 2, 3, 4, 5, 6]) assert.isTrue(S.is(GitHubHeadingDepth)(depth));
    for (const depth of [0, 7, 1.5, "2"]) assert.isFalse(S.is(GitHubHeadingDepth)(depth));
    for (const options of [{}, { ordered: false }, { ordered: true }]) {
      const input: GitHubListOptions.Encoded = options;
      const decoded = Result.getOrThrow(S.decodeResult(GitHubListOptions)(input));
      assert.deepStrictEqual<GitHubListOptions.Encoded>(decoded, input);
      assert.deepStrictEqual(Result.getOrThrow(S.encodeResult(GitHubListOptions)(decoded)), input);
    }
    assert.isFalse(S.is(GitHubListOptions)({ ordered: "true" }));
    assertFalse(S.is(GitHubListOptions)({ ordered: undefined }));
  });

  describe("table — escaping is the safety argument", () => {
    it("CR, CRLF and LF in headers and cells preserve one data row", () => {
      for (const ending of ["\r", "\r\n", "\n"]) {
        const rendered = GitHubMarkdown.table([`first${ending}header`, "second"], [[`left${ending}right`, "ok"]]);
        assert.strictEqual(rendered, "| first<br>header | second |\n| --- | --- |\n| left<br>right | ok |");
        const table = Result.getOrThrow(Markdown.parseResult(rendered)).children[0];
        if (table?.type !== "table") return assert.fail("expected a table");
        assert.lengthOf(table.children, 2);
        for (const row of table.children) assert.lengthOf(row.children, 2);
      }
    });

    it("a cell carrying `>=1 || <2` must not shift columns", () => {
      assert.strictEqual(
        GitHubMarkdown.table(["Check", "Outcome"], [[">=1 || <2", "ok"]]),
        "| Check | Outcome |\n| --- | --- |\n| >=1 \\|\\| <2 | ok |",
        'joining cells with " | " let a semver range add two phantom columns'
      );
    });

    it("cells are pre-rendered markdown and pass through verbatim", () => {
      const out = GitHubMarkdown.table(["Check"], [["[build](https://example.dev) **bold**"]]);
      assert.include(out, "[build](https://example.dev) **bold**");
    });

    it("a short row pads to the header width instead of shifting", () => {
      assert.strictEqual(
        GitHubMarkdown.table(["A", "B", "C"], [["only"]]),
        "| A | B | C |\n| --- | --- | --- |\n| only |  |  |"
      );
    });

    it("a cell carrying a newline stays one row — line breaks become <br>", () => {
      assert.strictEqual(
        GitHubMarkdown.table(["Check", "Log"], [["build", "line one\nline two"]]),
        "| Check | Log |\n| --- | --- |\n| build | line one<br>line two |",
        "like an unescaped pipe, a raw newline in a cell (a multi-line format result, npm stderr) would end the row"
      );
    });
  });

  describe("code", () => {
    it("inline code containing a backtick widens the delimiter", () => {
      assert.strictEqual(GitHubMarkdown.code("a ` b"), "``a ` b``");
    });

    it("a code block whose content contains a fence lengthens the fence", () => {
      assert.strictEqual(GitHubMarkdown.codeBlock("a\n```\nb", "ts"), "````ts\na\n```\nb\n````");
    });

    it("a code block without a language carries a bare fence", () => {
      assert.strictEqual(GitHubMarkdown.codeBlock("plain"), "```\nplain\n```");
    });
  });

  describe("link", () => {
    it("lone, odd and even trailing backslash runs stay inside one link", () => {
      for (const [label, escaped, visible] of [
        ["\\", "\\\\", "\\"],
        ["abc\\", "abc\\\\", "abc\\"],
        ["abc\\\\\\", "abc\\\\\\\\", "abc\\\\"],
        ["abc\\\\", "abc\\\\", "abc\\"],
        ["abc\\\\\\\\", "abc\\\\\\\\", "abc\\\\"],
      ] as const) {
        const rendered = GitHubMarkdown.link(label, "https://example.test");
        assert.strictEqual(rendered, `[${escaped}](https://example.test)`);
        const root = Result.getOrThrow(Markdown.parseResult(rendered));
        assert.lengthOf(root.children, 1);
        const paragraph = root.children[0];
        if (paragraph?.type !== "paragraph") return assert.fail("expected a paragraph");
        assert.lengthOf(paragraph.children, 1);
        const link = paragraph.children[0];
        if (link?.type !== "link") return assert.fail("expected one complete link");
        assert.strictEqual(link.url, "https://example.test");
        assert.lengthOf(link.children, 1);
        const text = link.children[0];
        if (text?.type !== "text") return assert.fail("expected a text label");
        assert.strictEqual(text.value, visible);
      }
    });

    it("an unmatched opening or closing bracket stays inside one complete link label", () => {
      for (const label of ["left]right", "left[right", "[left]right]", "[left[right]", "😀left]right"]) {
        const paragraph = Result.getOrThrow(Markdown.parseResult(GitHubMarkdown.link(label, "https://example.test")))
          .children[0];
        if (paragraph?.type !== "paragraph") return assert.fail("expected a paragraph");
        assert.lengthOf(paragraph.children, 1);
        const link = paragraph.children[0];
        if (link?.type !== "link") return assert.fail("expected the whole label inside one link");
        assert.strictEqual(link.url, "https://example.test");
        assert.lengthOf(link.children, 1);
        const text = link.children[0];
        if (text?.type !== "text") return assert.fail("expected a text label");
        assert.strictEqual(text.value, label);
      }
    });

    it("bracket escaping preserves emphasis, inline code, balanced brackets and existing escapes", () => {
      const label = "**bold** *em* `left[right` [balanced] \\[escaped\\] left]right";
      const rendered = GitHubMarkdown.link(label, "https://example.test");
      assert.strictEqual(
        rendered,
        "[**bold** *em* `left[right` [balanced] \\[escaped\\] left\\]right](https://example.test)"
      );
      const paragraph = Result.getOrThrow(Markdown.parseResult(rendered)).children[0];
      if (paragraph?.type !== "paragraph") return assert.fail("expected a paragraph");
      assert.lengthOf(paragraph.children, 1);
      const link = paragraph.children[0];
      if (link?.type !== "link") return assert.fail("expected one link");
      assert.deepStrictEqual(
        A.map(link.children, (child) => child.type),
        ["strong", "text", "emphasis", "text", "inlineCode", "text"]
      );
      const code = link.children[4];
      if (code?.type !== "inlineCode") return assert.fail("expected inline code");
      assert.strictEqual(code.value, "left[right");
      const tail = link.children[5];
      if (tail?.type !== "text") return assert.fail("expected trailing text");
      assert.strictEqual(tail.value, " [balanced] [escaped] left]right");
    });

    it("a url the destination cannot carry raw is angle-bracketed", () => {
      assert.strictEqual(
        GitHubMarkdown.link("the check", "https://x.dev/a b(c)"),
        "[the check](<https://x.dev/a b(c)>)"
      );
    });

    it("an ordinary url stays bare", () => {
      assert.strictEqual(GitHubMarkdown.link("npm", "https://www.npmjs.com/"), "[npm](https://www.npmjs.com/)");
    });
  });

  describe("heading", () => {
    it("LF, bare CR and CRLF remain inline inside one heading", () => {
      for (const ending of ["\n", "\r", "\r\n"]) {
        const rendered = GitHubMarkdown.heading(`a${ending}b`);
        assert.strictEqual(rendered, "## a<br>b");
        const root = Result.getOrThrow(Markdown.parseResult(rendered));
        assert.lengthOf(root.children, 1);
        const heading = root.children[0];
        if (heading?.type !== "heading") return assert.fail("expected one heading");
        assert.strictEqual(heading.depth, 2);
        assert.deepStrictEqual(
          A.map(heading.children, (child) => child.type),
          ["text", "html", "text"]
        );
      }
    });

    it("defaults to level 2", () => {
      assert.strictEqual(GitHubMarkdown.heading("Release Validation"), "## Release Validation");
    });

    it("renders the requested depth", () => {
      assert.strictEqual(GitHubMarkdown.heading("Details", 3), "### Details");
    });
  });

  describe("list", () => {
    const assertOneItemList = (rendered: string, ordered: boolean) => {
      const root = Result.getOrThrow(Markdown.parseResult(rendered));
      assert.lengthOf(root.children, 1);
      const list = root.children[0];
      if (list?.type !== "list") return assert.fail("expected a list");
      assert.strictEqual(list.ordered, ordered);
      assert.lengthOf(list.children, 1);
      assert.lengthOf(list.children[0]?.children ?? [], 1);
    };

    it.each([
      { ending: "\r", ordered: false, expected: "- a\n  b" },
      { ending: "\r", ordered: true, expected: "1. a\n   b" },
      { ending: "\r\n", ordered: false, expected: "- a\n  b" },
      { ending: "\r\n", ordered: true, expected: "1. a\n   b" },
    ])(
      "bare CR and CRLF continuations stay in one list item ($ending, ordered $ordered)",
      ({ ending, ordered, expected }) => {
        const rendered = GitHubMarkdown.list([`a${ending}b`], { ordered });
        assert.strictEqual(rendered, expected);
        assertOneItemList(rendered, ordered);
      }
    );

    it("renders bullets, and a multi-line item stays inside its bullet", () => {
      assert.strictEqual(
        GitHubMarkdown.list(["first **bold**", "second line1\nline2"]),
        "- first **bold**\n- second line1\n  line2"
      );
    });

    it("renders ordered items", () => {
      assert.strictEqual(GitHubMarkdown.list(["one", "two"], { ordered: true }), "1. one\n2. two");
    });
  });

  describe("details", () => {
    it("wraps the body in blank lines so GitHub renders the markdown inside", () => {
      assert.strictEqual(
        GitHubMarkdown.details("<strong>logs</strong>", "| A |\n| --- |\n| x |"),
        "<details>\n<summary><strong>logs</strong></summary>\n\n| A |\n| --- |\n| x |\n\n</details>"
      );
    });
  });

  describe("raw", () => {
    it("is the identity, by name", () => {
      const rendered = "already **markdown** with a [link](url)";
      assert.strictEqual(GitHubMarkdown.raw(rendered), rendered);
    });
  });

  describe("tableFor — the schema is the single authority for the table's shape", () => {
    it("bare CR in schema-derived headers and values preserves one data row", () => {
      const Row = S.Struct({ detail: S.String.annotate({ title: "first\rheader" }), outcome: S.String });
      const rendered = GitHubMarkdown.tableFor(Row).render([{ detail: "left\rright", outcome: "ok" }]);
      assert.strictEqual(rendered, "| first<br>header | outcome |\n| --- | --- |\n| left<br>right | ok |");
      const table = Result.getOrThrow(Markdown.parseResult(rendered)).children[0];
      if (table?.type !== "table") return assert.fail("expected a table");
      assert.lengthOf(table.children, 2);
      for (const row of table.children) assert.lengthOf(row.children, 2);
    });

    it("headers come from title annotations, falling back to the field name", () => {
      const Row = S.Struct({
        name: S.String.annotate({ title: "Check" }),
        detail: S.String,
      });
      assert.strictEqual(
        GitHubMarkdown.tableFor(Row).render([{ name: "build", detail: "clean" }]),
        "| Check | detail |\n| --- | --- |\n| build | clean |"
      );
    });

    it("a per-column header override beats the annotation", () => {
      const Row = S.Struct({ name: S.String.annotate({ title: "Check" }) });
      assert.strictEqual(
        GitHubMarkdown.tableFor(Row, { columns: { name: { header: "Step" } } }).render([{ name: "build" }]),
        "| Step |\n| --- |\n| build |"
      );
    });

    it("column order is field declaration order, not row-object key order", () => {
      const Row = S.Struct({
        first: S.String,
        second: S.String,
        third: S.String,
      });
      const out = GitHubMarkdown.tableFor(Row).render([{ third: "3", first: "1", second: "2" }]);
      assert.strictEqual(
        out,
        "| first | second | third |\n| --- | --- | --- |\n| 1 | 2 | 3 |",
        "the row spells its keys in another order, and a typed row still cannot transpose columns"
      );
    });

    it("a typed field projects through its own codec", () => {
      const Row = S.Struct({
        name: S.String,
        at: S.DateTimeUtcFromString.annotate({ title: "When" }),
        outcome: S.Literals(["passed", "failed"]),
      });
      assert.strictEqual(
        GitHubMarkdown.tableFor(Row).render([
          { name: "build", at: DateTime.makeUnsafe("2026-07-26T12:30:00Z"), outcome: "passed" },
        ]),
        "| name | When | outcome |\n| --- | --- | --- |\n| build | 2026-07-26T12:30:00.000Z | passed |"
      );
    });

    it("a field whose encoded side is not a string renders through its required formatter", () => {
      const Row = S.Struct({ at: S.DateTimeUtc });
      const table = GitHubMarkdown.tableFor(Row, {
        columns: { at: { format: (value) => DateTime.formatIso(value) } },
      });
      assert.strictEqual(
        table.render([{ at: DateTime.makeUnsafe("2026-07-26T12:30:00Z") }]),
        "| at |\n| --- |\n| 2026-07-26T12:30:00.000Z |",
        "v4's Schema.DateTimeUtc encodes to DateTime.Utc itself, so there is no string projection to borrow"
      );

      // @ts-expect-error -- a non-string-encoded field makes `options` required. Owner: @beep/github-reporting. Exit: remove if the API is meant to accept this.
      GitHubMarkdown.tableFor(Row);
      // @ts-expect-error -- and its column entry cannot omit `format`. Owner: @beep/github-reporting. Exit: remove if the API is meant to accept this.
      GitHubMarkdown.tableFor(Row, { columns: { at: { header: "When" } } });
    });

    it("escaping is inherited from table — a cell carrying pipes cannot shift columns", () => {
      const Row = S.Struct({ range: S.String, outcome: S.String });
      assert.strictEqual(
        GitHubMarkdown.tableFor(Row).render([{ range: ">=1 || <2", outcome: "ok" }]),
        "| range | outcome |\n| --- | --- |\n| >=1 \\|\\| <2 | ok |"
      );
    });

    it("an absent optional field renders as an empty cell", () => {
      const Row = S.Struct({ name: S.String, note: S.optionalKey(S.String) });
      assert.strictEqual(
        GitHubMarkdown.tableFor(Row).render([{ name: "build" }, { name: "test", note: "flaky" }]),
        "| name | note |\n| --- | --- |\n| build |  |\n| test | flaky |"
      );
    });

    it("re-rendering from current state is just calling render again", () => {
      const Row = S.Struct({ name: S.String, outcome: S.Literals(["queued", "passed"]) });
      const table = GitHubMarkdown.tableFor(Row);
      const rows: Array<typeof Row.Type> = [{ name: "build", outcome: "queued" }];
      const before = table.render(rows);
      assert.strictEqual(before, "| name | outcome |\n| --- | --- |\n| build | queued |");
      rows[0] = { name: "build", outcome: "passed" };
      rows.push({ name: "test", outcome: "queued" });
      assert.strictEqual(
        table.render(rows),
        "| name | outcome |\n| --- | --- |\n| build | passed |\n| test | queued |"
      );
      assert.strictEqual(
        table.render([{ name: "build", outcome: "queued" }]),
        before,
        "identical rows are byte-identical output: the renderer holds no state"
      );
    });
  });

  describe("a render cannot fail — the reason consumers need not Effect.try-wrap", () => {
    it("nesting the writer's own output 1000 deep does not deepen the tree", () => {
      let nested = "leaf";
      for (let index = 0; index < 1000; index += 1) {
        nested = GitHubMarkdown.list([nested]);
      }
      assert.include(
        nested,
        "leaf",
        "the serializer's only failure is its 256 depth cap, and every member wraps pre-rendered markdown in one passthrough node, so this tree stays three levels deep"
      );
    });

    it("a deeply nested fragment from elsewhere is one passthrough node, not a tree", () => {
      const deep = `${Str.repeat(500)("> ")}quoted`;
      const out = GitHubMarkdown.table(["Note"], [[deep]]);
      assert.include(out, "quoted", "markup that would nest 500 deep if parsed passes through unparsed");
    });

    it("every serializing member survives input that is pathological for its own construct", () => {
      const hostile = `${Str.repeat(300)("`")}\n\`\`\`\n| a | b |\n`;
      assert.isString(
        GitHubMarkdown.codeBlock(hostile, "text"),
        "fences, pipes, newlines, backticks and URL parens at size never reach the serializer's failure arm"
      );
      assert.isString(GitHubMarkdown.code(hostile));
      assert.isString(GitHubMarkdown.table(["A"], [[hostile]]));
      assert.isString(GitHubMarkdown.list([hostile]));
      assert.isString(GitHubMarkdown.link(hostile, "https://example.dev/a(b) c"));
    });

    it("the one reachable throw is the CODEC, and only for a value smuggled past the types", () => {
      const Row = S.Struct({ name: S.String });
      const table = GitHubMarkdown.tableFor(Row);
      assert.include(table.render([{ name: "build" }]), "| build |", "a well-typed row is total");
      let caught: unknown;
      try {
        table.render([deliberatelyInvalid<{ name: string }>({ name: 7 })]);
      } catch (error) {
        caught = error;
      }
      if (!S.isSchemaError(caught)) {
        assert.fail("expected a SchemaError, not a serializer failure or a stray TypeError");
      }
      assert.strictEqual(
        caught._tag,
        "SchemaError",
        "the cell goes through encodeSync, so a value cast past the types throws: the serializer cannot fail, but tableFor can throw"
      );
    });

    it("a user-supplied format function is the other way a render can throw", () => {
      const Row = S.Struct({ count: S.Finite });
      const table = GitHubMarkdown.tableFor(Row, {
        columns: {
          count: {
            format: (value) => {
              if (value === 0) throw new RangeError("nope");
              return String(value);
            },
          },
        },
      });
      assert.include(table.render([{ count: 3 }]), "| 3 |");
      assert.throws(
        () => table.render([{ count: 0 }]),
        RangeError,
        undefined,
        "format bypasses the codec, so its totality is the caller's to guarantee"
      );
    });
  });
});
