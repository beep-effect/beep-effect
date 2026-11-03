import { Doc, Glyphs, Render, Status } from "@beep/cli-kit";
import { Markdown } from "@beep/markdown/Markdown";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, identity, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { composite, ESC } from "./helpers/hostileDoc.ts";
import { contextOf } from "./helpers/renderContext.ts";
import type { Block, LinkTargetInput, RenderContext, Style, TokenName } from "@beep/cli-kit";

const Json = S.fromJsonString(S.Unknown);

/** The parts of a parsed node these tests read; the parser is the oracle, so nothing here renders. */
interface N {
  readonly align?: ReadonlyArray<string | null>;
  readonly children?: ReadonlyArray<N>;
  readonly depth?: number;
  readonly lang?: string | null;
  readonly ordered?: boolean;
  readonly type: string;
  readonly url?: string;
  readonly value?: string;
}

const render = (doc: ReadonlyArray<Block>, overrides: Partial<RenderContext.Encoded> = {}) =>
  Effect.map(contextOf(overrides), (ctx) => Render.markdown(doc, ctx));

const parse = (markdown: string) => Effect.map(Markdown.parse(markdown), (root) => root);

/** Render then parse: the tree of what a GFM reader sees. */
const treeOf = (doc: ReadonlyArray<Block>, overrides: Partial<RenderContext.Encoded> = {}) =>
  Effect.flatMap(render(doc, overrides), parse);

const kids = (n: N | undefined): ReadonlyArray<N> => n?.children ?? [];

/** The text a reader sees: text and code values, a hard break or a `<br>` as a line feed. */
const textOf = (n: N): string => {
  if (n.type === "text" || n.type === "inlineCode") return n.value ?? "";
  if (n.type === "break" || (n.type === "html" && n.value === "<br>")) return "\n";
  return pipe(kids(n), A.map(textOf), A.join(""));
};

const descendantTypes = (n: N): ReadonlyArray<string> => [n.type, ...A.flatMap(kids(n), descendantTypes)];

const tableOf = (root: N): N => {
  const table = O.getOrUndefined(A.findFirst(kids(root), (c) => c.type === "table"));
  assert.isDefined(table, "the output has a table");
  return table;
};

const cellTexts = (table: N): ReadonlyArray<ReadonlyArray<string>> =>
  A.map(kids(table), (row) => A.map(kids(row), (cell) => textOf(cell)));

const ALPHABET = ["|", "`", "<", ">", "\\", "\n", "*", "_", "[", "]", "&", "x", "#", "~", " ", "!", "(", ")"];
const upTo = (alphabet: ReadonlyArray<string>, length: number): ReadonlyArray<string> => {
  const out: Array<string> = [];
  let frontier = [""];
  for (let n = 1; n <= length; n++) {
    frontier = A.flatMap(frontier, (prefix) => A.map(alphabet, (ch) => prefix + ch));
    out.push(...frontier);
  }
  return out;
};

describe("Render.markdown: headings and paragraphs", () => {
  it.effect("literal exclamation text immediately before a link stays text and the destination stays a link", () =>
    Effect.gen(function* () {
      const url = "https://example.test/image.png";
      const root = yield* treeOf([Doc.paragraph("!", Doc.link({ url }, "guide"))]);
      const children = kids(kids(root)[0]);
      assert.deepStrictEqual(
        A.map(children, (node) => node.type),
        ["text", "link"]
      );
      assert.strictEqual(children[0]?.value, "!");
      assert.strictEqual(children[1]?.url, url);
      assert.strictEqual(textOf(root), "!guide");
      assert.notInclude(descendantTypes(root), "image");
    })
  );
  it.effect("a heading or section title ending in # keeps it, whatever backslashes come before it", () =>
    Effect.gen(function* () {
      const titles = ["C#", "a #", "a ##", "a\\#", "a\\\\#", "a\\ #", "#", "\\##", "x `#`#"];
      const root = yield* treeOf([
        ...A.map(titles, (title) => Doc.heading(2, title)),
        Doc.section(A.getUnsafe(titles, 3), [Doc.paragraph("body")]),
      ]);
      const headings = A.filter(kids(root), (n) => n.type === "heading");
      assert.deepStrictEqual(A.map(headings, textOf), [...titles, titles[3]]);
    })
  );

  it.effect("a heading is # repeated by its level, with its text", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([
        Doc.heading(1, "One"),
        Doc.heading(2, "Two"),
        Doc.heading(3, "Three"),
        Doc.heading(4, "Four"),
      ]);
      assert.deepStrictEqual(
        A.map(kids(root), (h) => [h.type, h.depth, textOf(h)]),
        [
          ["heading", 1, "One"],
          ["heading", 2, "Two"],
          ["heading", 3, "Three"],
          ["heading", 4, "Four"],
        ]
      );
    })
  );

  it.effect("a section's title is a heading one level deeper for each nesting, and its children follow", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([
        Doc.section("Outer", [Doc.paragraph("a"), Doc.section("Inner", [Doc.paragraph("b")])]),
      ]);
      assert.deepStrictEqual(
        A.map(kids(root), (n) => [n.type, n.depth, textOf(n)]),
        [
          ["heading", 2, "Outer"],
          ["paragraph", undefined, "a"],
          ["heading", 3, "Inner"],
          ["paragraph", undefined, "b"],
        ]
      );
    })
  );

  it.effect("a paragraph parses back to its text, with inline code and links", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([
        Doc.paragraph(
          "run ",
          Doc.code("pnpm test"),
          " or see ",
          Doc.link({ url: "https://example.test/x" }, "the docs")
        ),
      ]);
      const [p] = kids(root);
      assert.isDefined(p);
      assert.deepStrictEqual(
        A.map(kids(p), (c) => c.type),
        ["text", "inlineCode", "text", "link"]
      );
      assert.strictEqual(kids(p)[1]?.value, "pnpm test");
      assert.strictEqual(kids(p)[3]?.url, "https://example.test/x");
      assert.strictEqual(textOf(A.getUnsafe(kids(p), 3)), "the docs");
    })
  );

  it.effect("text cannot inject formatting: every metacharacter stays text", () =>
    Effect.gen(function* () {
      const text = "*em* _em_ **strong** ~~gone~~ [l](https://evil.test) ![i](x) <b>html</b> &amp; `code` # h > q";
      const root = yield* treeOf([Doc.paragraph(text)]);
      assert.strictEqual(kids(root).length, 1);
      const [p] = kids(root);
      assert.isDefined(p);
      assert.deepStrictEqual(A.sort(A.dedupe(descendantTypes(p)), Str.Order), ["paragraph", "text"]);
      assert.strictEqual(textOf(p), text);
    })
  );

  it.effect(
    "text at the start of a line cannot become a block: heading, quote, list, rule, code or setext underline",
    () =>
      Effect.gen(function* () {
        const lines = [
          "# h",
          "## h",
          "> q",
          "- i",
          "+ i",
          "* i",
          "1. i",
          "2) i",
          "---",
          "***",
          "___",
          "===",
          "```",
          "~~~",
          "    indented",
        ];
        for (const line of lines) {
          const root = yield* treeOf([Doc.paragraph(line), Doc.paragraph(line)]);
          assert.deepStrictEqual(
            A.map(kids(root), (n) => n.type),
            ["paragraph", "paragraph"],
            Result.getOrThrow(S.encodeUnknownResult(Json)(line))
          );
          assert.strictEqual(
            textOf(A.getUnsafe(kids(root), 0)),
            Str.trimStart(line),
            Result.getOrThrow(S.encodeUnknownResult(Json)(line))
          );
        }
        const two = yield* treeOf([Doc.paragraph("first\n---\nsecond\n===")]);
        assert.deepStrictEqual(
          A.map(kids(two), (n) => n.type),
          ["paragraph"],
          "an underline after a line cannot make a heading"
        );
      })
  );

  it.effect("a line of dashes, pluses, equals and spaces is text, not a thematic break or setext underline", () =>
    Effect.gen(function* () {
      const lines = [
        "-- --",
        "--- -",
        "- - -",
        "-  -  -",
        "= =",
        "== ==",
        "+ + +",
        "+-",
        "-=",
        "---",
        "===",
        "- -- ---",
        "-",
      ];
      for (const line of lines) {
        const alone = yield* treeOf([Doc.paragraph(line)]);
        assert.deepStrictEqual(
          A.map(kids(alone), (n) => n.type),
          ["paragraph"],
          Result.getOrThrow(S.encodeUnknownResult(Json)(line))
        );
        assert.strictEqual(
          textOf(A.getUnsafe(kids(alone), 0)),
          Str.trim(line),
          Result.getOrThrow(S.encodeUnknownResult(Json)(line))
        );
        const after = yield* treeOf([Doc.paragraph(`a\n${line}`)]);
        assert.deepStrictEqual(
          A.map(kids(after), (n) => n.type),
          ["paragraph"],
          `after: ${Result.getOrThrow(S.encodeUnknownResult(Json)(line))}`
        );
        assert.strictEqual(
          textOf(A.getUnsafe(kids(after), 0)),
          `a\n${Str.trim(line)}`,
          `after: ${Result.getOrThrow(S.encodeUnknownResult(Json)(line))}`
        );
      }
    })
  );

  it.effect(
    "property: every line of up to 6 characters over - + = space and a, and seeded multi-line texts, parse as one paragraph of the same text",
    () =>
      Effect.gen(function* () {
        const alphabet = ["-", "+", "=", " ", "a"];
        const ctx = yield* contextOf();
        const expectedOf = (text: string): string | undefined => {
          const lines = pipe(
            text,
            Str.split("\n"),
            A.filter((line) => Str.trim(line) !== ""),
            A.map((line) => Str.trimStart(line))
          );
          return lines.length === 0 ? undefined : pipe(lines, A.join("\n"), Str.trimEnd);
        };
        const failures: Array<string> = [];
        let cases = 0;
        const check = (text: string): void => {
          const expected = expectedOf(text);
          if (expected === undefined) return;
          cases++;
          const parsed = Markdown.parseResult(Render.markdown([Doc.paragraph(text)], ctx));
          if (parsed._tag !== "Success") {
            failures.push(
              `${Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(text), identity)}: parse failed`
            );
            return;
          }
          const node = parsed.success;
          const ok = kids(node).length === 1 && kids(node)[0]?.type === "paragraph" && textOf(node) === expected;
          if (!ok && failures.length < 5)
            failures.push(
              `${Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(text), identity)} -> ${Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(A.map(kids(node), (n) => n.type)), identity)}`
            );
        };
        for (const text of upTo(alphabet, 6)) check(text);
        // A fixed-seed generator: the same multi-line texts every run.
        let seed = 0x2f6e2b1;
        const next = (n: number): number => {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          return seed % n;
        };
        for (let i = 0; i < 4000; i++) {
          const lineCount = 1 + next(3);
          const lines = Array.from({ length: lineCount }, () =>
            A.join(
              Array.from({ length: 1 + next(8) }, () => alphabet[next(alphabet.length)] ?? ""),
              ""
            )
          );
          check(A.join(lines, "\n"));
        }
        assert.isAbove(cases, 15_000);
        assert.deepStrictEqual(failures, []);
      }),
    { timeout: 120_000 }
  );

  it.effect(
    "text that looks like an autolink stays text: URLs and www (an email may become a harmless mailto link)",
    () =>
      Effect.gen(function* () {
        const text =
          "see https://evil.test/x and http://a.test and HTTPS://B.TEST and ftp://files.test/x and FTP://Y.TEST and git+ssh://h/r and www.evil.test and WWW.X.TEST now";
        const root = yield* treeOf([Doc.paragraph(text)]);
        const [p] = kids(root);
        assert.isDefined(p);
        assert.deepStrictEqual(A.sort(A.dedupe(descendantTypes(p)), Str.Order), ["paragraph", "text"]);
        assert.strictEqual(textOf(p), text);
      })
  );

  it.effect(
    "small-alphabet property: any text of up to 3 characters parses back to itself as one paragraph",
    () =>
      Effect.gen(function* () {
        const alphabet = [
          "x",
          "*",
          "_",
          "`",
          "[",
          "]",
          "(",
          ")",
          "<",
          ">",
          "&",
          "#",
          "~",
          "|",
          "\\",
          "\n",
          " ",
          "-",
          "+",
          "=",
          "1",
          ".",
          "!",
          ":",
          "@",
        ];
        const ctx = yield* contextOf();
        const failures: Array<string> = [];
        let cases = 0;
        for (const text of upTo(alphabet, 3)) {
          const lines = pipe(
            text,
            Str.split("\n"),
            A.filter((line) => Str.trim(line) !== ""),
            A.map((line) => Str.trimStart(line))
          );
          if (lines.length === 0) continue;
          const expected = pipe(lines, A.join("\n"), Str.trimEnd);
          const root = yield* parse(Render.markdown([Doc.paragraph(text)], ctx));
          cases++;
          const types = A.dedupe(descendantTypes(root));
          const ok =
            kids(root).length === 1 &&
            kids(root)[0]?.type === "paragraph" &&
            A.every(types, (t) => ["root", "paragraph", "text", "break"].includes(t)) &&
            textOf(root) === expected;
          if (!ok && failures.length < 5)
            failures.push(
              `${Result.getOrThrow(S.encodeUnknownResult(Json)(text))} -> ${Result.getOrThrow(S.encodeUnknownResult(Json)(types))} ${Result.getOrThrow(S.encodeUnknownResult(Json)(textOf(root)))}`
            );
        }
        assert.isAbove(cases, 10_000, "the enumeration ran");
        assert.deepStrictEqual(failures, []);
      }),
    { timeout: 120_000 }
  );
});

describe("Render.markdown: tables", () => {
  it.effect("is a GFM pipe table: N rows by M cells whose text is the input, with the alignment", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([
        Doc.table(
          [
            { header: "Name" },
            { header: "Count", align: "right" },
            { header: "Mid", align: "center" },
            { header: "L", align: "left" },
          ],
          [
            ["alpha", "1", "m", "x"],
            ["beta", "22", "n", "y"],
          ]
        ),
      ]);
      const table = tableOf(root);
      assert.deepStrictEqual(
        table.align,
        A.map([null, "right", "center", "left"], (a) => a)
      );
      assert.deepStrictEqual(cellTexts(table), [
        ["Name", "Count", "Mid", "L"],
        ["alpha", "1", "m", "x"],
        ["beta", "22", "n", "y"],
      ]);
    })
  );

  it.effect("a cell with a pipe, backticks, an angle bracket or a line break parses back to the intended text", () =>
    Effect.gen(function* () {
      const cells = [
        "a | b",
        "`tick`",
        "back`tick",
        "``double``",
        "<tag> & </tag>",
        "<br>",
        "line1\nline2\nline3",
        "*star* _under_ [link](x)",
        "trailing backslash\\",
        "x \\| y",
        "# not a heading",
        "| leading and trailing |",
      ];
      const root = yield* treeOf([
        Doc.table(
          [{ header: "h" }],
          A.map(cells, (c) => [c])
        ),
      ]);
      const table = tableOf(root);
      assert.strictEqual(kids(table).length, cells.length + 1, "one row per cell plus the header");
      assert.deepStrictEqual(
        A.map(cellTexts(table).slice(1), (row) => row[0]),
        A.map(cells, (c) => Str.trim(c))
      );
      for (const row of kids(table)) {
        for (const cell of kids(row)) {
          const htmls = pipe(
            kids(cell),
            A.filter((c) => c.type === "html"),
            A.map((c) => c.value)
          );
          assert.isTrue(
            A.every(htmls, (h) => h === "<br>"),
            "the only HTML is the renderer's own line break"
          );
          assert.isFalse(
            A.some(descendantTypes(cell), (t) => ["link", "emphasis", "strong", "delete", "inlineCode"].includes(t))
          );
        }
      }
    })
  );

  it.effect("inline code in a cell keeps its pipes and backticks", () =>
    Effect.gen(function* () {
      const codes = [
        "a|b",
        "a`b",
        "``",
        "` x `",
        " lead",
        "trail ",
        "x",
        "||",
        "a\\|b",
        "\\|",
        "a\\",
        "\\\\|",
        "\\",
        "`\\|`",
      ];
      const root = yield* treeOf([
        Doc.table(
          [{ header: "c" }],
          A.map(codes, (c) => [Doc.code(c)])
        ),
      ]);
      const values = A.map(kids(tableOf(root)).slice(1), (row) => A.map(kids(kids(row)[0]), (n) => [n.type, n.value]));
      // A `|` after an odd run of backslashes cannot be held by a code span in a cell (GFM's scanner pairs a backslash
      // with the next character, and the unescape then leaves an even run), so that code is `<code>` around text.
      const html = HashSet.make("a\\|b", "\\|", "`\\|`");
      assert.deepStrictEqual(
        values,
        A.map(codes, (c) =>
          HashSet.has(html, c)
            ? [
                ["html", "<code>"],
                ["text", c],
                ["html", "</code>"],
              ]
            : [["inlineCode", c]]
        )
      );
    })
  );

  it.effect("small-alphabet property: inline code in a cell of up to 5 characters reads back as itself", () =>
    Effect.gen(function* () {
      const ctx = yield* contextOf();
      const codes = A.filter(upTo(["\\", "|", "`", " ", "x"], 5), (c) => Str.trim(c) !== "");
      const markdown = Render.markdown(
        [
          Doc.table(
            [{ header: "c" }, { header: "after" }],
            A.map(codes, (c) => [[Doc.code(c)], "z"])
          ),
        ],
        ctx
      );
      const parsed1 = yield* parse(markdown);
      const rows = kids(tableOf(parsed1)).slice(1);
      assert.strictEqual(rows.length, codes.length);
      const failures = A.flatMap(codes, (c, index) => {
        const cells = kids(rows[index]);
        const got = A.map(cells, textOf);
        return got.length === 2 && got[0] === c && got[1] === "z"
          ? []
          : [
              `${Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(c), identity)} -> ${Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(got), identity)}`,
            ];
      });
      assert.deepStrictEqual(failures.slice(0, 5), []);
    })
  );

  it.effect(
    "small-alphabet property: any cell of up to 3 characters parses back to its trimmed text, and only that",
    () =>
      Effect.gen(function* () {
        const ctx = yield* contextOf();
        const cells = upTo(ALPHABET, 3);
        const failures: Array<string> = [];
        // One table of many rows per batch keeps the parse count low while every cell is still checked by position.
        for (let start = 0; start < cells.length; start += 400) {
          const batch = cells.slice(start, start + 400);
          const markdown = Render.markdown(
            [
              Doc.table(
                [{ header: "h" }],
                A.map(batch, (c) => [c])
              ),
            ],
            ctx
          );
          const parsed2 = yield* parse(markdown);
          const table = tableOf(parsed2);
          const rows = kids(table).slice(1);
          if (rows.length !== batch.length)
            failures.push(`batch ${start}: ${rows.length} rows, wanted ${batch.length}`);
          A.forEach(batch, (cell, index) => {
            const row = rows[index];
            const got = row === undefined ? undefined : A.map(kids(row), textOf);
            const expected = Str.trim(cell);
            const types = row === undefined ? [] : descendantTypes(row);
            const clean = A.every(types, (t) => ["tableRow", "tableCell", "text", "html"].includes(t));
            if (got?.length !== 1 || got[0] !== expected || !clean) {
              if (failures.length < 5)
                failures.push(
                  `${Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(cell), identity)} -> ${Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(got), identity)} ${Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(types), identity)}`
                );
            }
          });
        }
        assert.isAbove(cells.length, 5_000);
        assert.deepStrictEqual(failures, []);
      }),
    { timeout: 120_000 }
  );

  it.effect("pads a short row and widens for a long one, and has an empty header when none is given", () =>
    Effect.gen(function* () {
      const treeOf3 = yield* treeOf([Doc.table([{ header: "a" }, { header: "b" }], [["1"], ["1", "2", "3"]])]);
      const padded = tableOf(treeOf3);
      assert.deepStrictEqual(cellTexts(padded), [
        ["a", "b", ""],
        ["1", "", ""],
        ["1", "2", "3"],
      ]);
      const treeOf4 = yield* treeOf([Doc.table([{ header: [] }, { header: [] }], [["x", "y"]])]);
      const headerless = tableOf(treeOf4);
      assert.deepStrictEqual(cellTexts(headerless), [
        ["", ""],
        ["x", "y"],
      ]);
    })
  );

  it.effect("a cap shows that many rows, then the overflow as a paragraph after the table", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([
        Doc.table([{ header: "n" }], [["1"], ["2"], ["3"]], {
          cap: 1,
          overflow: (hidden) => `… ${hidden} more (see \`tool\`)`,
        }),
      ]);
      assert.deepStrictEqual(
        A.map(kids(root), (n) => n.type),
        ["table", "paragraph"]
      );
      assert.strictEqual(kids(tableOf(root)).length, 2);
      assert.strictEqual(textOf(A.getUnsafe(kids(root), 1)), "… 2 more (see `tool`)");
    })
  );
});

describe("Render.markdown: code, diff, collapsible and callout", () => {
  const fenceValue = (n: N | undefined): string => Str.replace(/\n$/, "")(n?.value ?? "");

  it.effect("a code block is a fence with its language and exactly its text, however many backticks it holds", () =>
    Effect.gen(function* () {
      const texts = [
        "let a = 1;\n\nlet b = 2;",
        "```",
        "````\n```js\nx\n```\n````",
        "~~~\nx\n~~~",
        "    indented\n  \ttab",
        "",
        "a ` b ``` c",
      ];
      for (const text of texts) {
        const root = yield* treeOf([Doc.codeBlock(text, "ts")]);
        assert.deepStrictEqual(
          A.map(kids(root), (n) => n.type),
          ["code"],
          Result.getOrThrow(S.encodeUnknownResult(Json)(text))
        );
        assert.strictEqual(kids(root)[0]?.lang, "ts");
        assert.strictEqual(
          fenceValue(kids(root)[0]),
          Str.replace(/\t/g, " ")(text),
          Result.getOrThrow(S.encodeUnknownResult(Json)(text))
        );
      }
      const noLang = yield* treeOf([Doc.codeBlock("x")]);
      assert.isTrue(kids(noLang)[0]?.lang === null || kids(noLang)[0]?.lang === undefined);
    })
  );

  it.effect("a language with control characters gets none of them: no ESC reaches the info string", () =>
    Effect.gen(function* () {
      const out = yield* render([Doc.codeBlock("x", "ts\u001B[31m")]);
      assert.notInclude(out, ESC);
      assert.notMatch(out, /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/);
      const parsed5 = yield* parse(out);
      assert.strictEqual(kids(parsed5)[0]?.type, "code");
    })
  );

  it.effect("a hostile language cannot break the fence", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([Doc.codeBlock("body", "ts`\n# injected"), Doc.paragraph("after")]);
      assert.deepStrictEqual(
        A.map(kids(root), (n) => n.type),
        ["code", "paragraph"]
      );
      assert.strictEqual(fenceValue(kids(root)[0]), "body");
    })
  );

  it.effect("a diff is a fence whose language is diff, with '-' and '+' lines", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([Doc.diff("a\n```\nb", "c")]);
      const [code] = kids(root);
      assert.strictEqual(code?.type, "code");
      assert.strictEqual(code?.lang, "diff");
      assert.strictEqual(fenceValue(code), "- a\n- ```\n- b\n+ c");
    })
  );

  it.effect("a diff cap limits each side and marks what is left", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([Doc.diff("1\n2\n3\n4", "x\ny", { cap: 2 })]);
      assert.strictEqual(fenceValue(kids(root)[0]), "- 1\n- 2\n  … 2 more lines\n+ x\n+ y");
    })
  );

  it.effect(
    "a collapsible is a details HTML block with the title in summary, then the body as markdown, then the close",
    () =>
      Effect.gen(function* () {
        const root = yield* treeOf([
          Doc.collapsible("Stack", [Doc.paragraph("frame ", Doc.code("one")), Doc.codeBlock("a\nb")]),
        ]);
        assert.deepStrictEqual(
          A.map(kids(root), (n) => n.type),
          ["html", "paragraph", "code", "html"]
        );
        assert.strictEqual(kids(root)[0]?.value, "<details><summary>Stack</summary>");
        assert.strictEqual(kids(root)[3]?.value, "</details>");
        assert.deepStrictEqual(
          A.map(kids(kids(root)[1]), (n) => n.type),
          ["text", "inlineCode"]
        );
        const open = yield* treeOf([Doc.collapsible("T", [], { open: true })]);
        assert.strictEqual(kids(open)[0]?.value, "<details open><summary>T</summary>");
      })
  );

  it.effect("a hostile collapsible title is escaped HTML, so it cannot close the summary or add elements", () =>
    Effect.gen(function* () {
      const title = `</summary></details><img src=x onerror=alert(1)> "q" & <b>`;
      const root = yield* treeOf([Doc.collapsible(title, [Doc.paragraph("body")])]);
      const htmls = pipe(
        kids(root),
        A.filter((n) => n.type === "html"),
        A.map((n) => n.value)
      );
      assert.deepStrictEqual(htmls.length, 2);
      assert.strictEqual(
        htmls[0],
        "<details><summary>&lt;/summary&gt;&lt;/details&gt;&lt;img src=x onerror=alert(1)&gt; &quot;q&quot; &amp; &lt;b&gt;</summary>"
      );
      assert.strictEqual(htmls[1], "</details>");
    })
  );

  it.effect("a callout is a blockquote opening with [!KIND], then its body, for every kind", () =>
    Effect.gen(function* () {
      for (const kind of ["note", "tip", "important", "warning", "caution"] as const) {
        const root = yield* treeOf([Doc.callout(kind, [Doc.paragraph("careful ", Doc.code("x")), Doc.codeBlock("y")])]);
        assert.deepStrictEqual(
          A.map(kids(root), (n) => n.type),
          ["blockquote"],
          kind
        );
        const [quote] = kids(root);
        assert.deepStrictEqual(
          A.map(kids(quote), (n) => n.type),
          ["paragraph", "code"],
          kind
        );
        assert.strictEqual(textOf(A.getUnsafe(kids(quote), 0)), `[!${Str.toUpperCase(kind)}]\ncareful x`, kind);
      }
      const empty = yield* treeOf([Doc.callout("note", []), Doc.paragraph("after")]);
      assert.deepStrictEqual(
        A.map(kids(empty), (n) => n.type),
        ["blockquote", "paragraph"]
      );
      assert.strictEqual(textOf(A.getUnsafe(kids(kids(empty)[0]), 0)), "[!NOTE]");
    })
  );
});

describe("Render.markdown: links", () => {
  it.effect("a URL link is [label](url), even when the URL has spaces, parentheses or backslashes", () =>
    Effect.gen(function* () {
      for (const url of [
        "https://example.test/x",
        "https://example.test/a(b)c",
        "https://example.test/a b",
        "https://example.test/a\\b",
        "/relative/path",
        "#fragment",
        "mailto:a@b.test",
      ]) {
        const root = yield* treeOf([Doc.paragraph("x ", Doc.link({ url }, "the [label]"), " y")]);
        const link = O.getOrUndefined(A.findFirst(kids(kids(root)[0]), (n) => n.type === "link"));
        assert.isDefined(link, url);
        assert.strictEqual(link?.url, url, url);
        assert.strictEqual(textOf(link), "the [label]", url);
      }
    })
  );

  it.effect("a URL holding a pipe or a backtick stays one link in a table cell: both are percent-encoded", () =>
    Effect.gen(function* () {
      // GFM splits a row into cells before it reads inlines, so a raw `|` in a destination splits the row, and a
      // backtick can open a code span that swallows the link. Percent-encoding either is the same URL.
      const urls = [
        "https://x.test/a|b",
        "https://x.test/a`b",
        "https://x.test/a`b`c|d",
        "https://x.test/a b|c",
        "https://x.test/a(b)|`c",
      ];
      const root = yield* treeOf([
        Doc.table(
          [{ header: "h" }, { header: "after" }],
          A.map(urls, (url) => [[Doc.link({ url }, "l")], "z"])
        ),
      ]);
      const rows = kids(tableOf(root)).slice(1);
      assert.strictEqual(rows.length, urls.length);
      A.forEach(urls, (url, index) => {
        const cells = kids(rows[index]);
        assert.strictEqual(cells.length, 2, `${url}: the row keeps its two cells`);
        assert.deepStrictEqual(
          A.map(kids(cells[0]), (n) => [n.type, n.url, textOf(n)]),
          [["link", pipe(url, Str.replaceAll("|", "%7C"), Str.replaceAll("`", "%60")), "l"]],
          url
        );
        assert.strictEqual(textOf(A.getUnsafe(cells, 1)), "z", url);
      });
    })
  );

  it.effect("a URL with an unsafe scheme is not a link: the target is shown as code", () =>
    Effect.gen(function* () {
      for (const url of [
        "javascript:alert(1)",
        "JaVaScRiPt:alert(1)",
        " javascript:alert(1)",
        "data:text/html,<script>",
        "vbscript:x",
      ]) {
        const root = yield* treeOf([Doc.paragraph(Doc.link({ url }, "click"))]);
        const types = descendantTypes(A.getUnsafe(kids(root), 0));
        assert.notInclude(types, "link", url);
        assert.include(types, "inlineCode", url);
        assert.strictEqual(textOf(A.getUnsafe(kids(root), 0)), `click (${Str.replace(/\s+/g, " ")(url)})`);
      }
    })
  );

  it.effect(
    "an unsafe scheme cannot hide behind an HTML entity, whitespace or a line break: what is parsed is what was checked",
    () =>
      Effect.gen(function* () {
        const hidden = [
          "java&#x73;&#x63;ript:alert(1)",
          "javascript&colon;alert(1)",
          "javascript&#58;alert(1)",
          "jav&Tab;ascript:alert(1)",
          "java\nscript:alert(1)",
          "java\tscript:alert(1)",
          "java script:alert(1)",
          "  \u0001javascript:alert(1)",
          "JAVA&#x53;&#x43;RIPT:alert(1)",
          "data&colon;text/html,x",
        ];
        for (const url of hidden) {
          const root = yield* treeOf([Doc.paragraph("x ", Doc.link({ url }, "click"))]);
          const links = A.filter([...descendants(root)], (n) => n.type === "link");
          for (const link of links) {
            // A link that is emitted decodes to exactly the URL text that was given, so the check saw what a reader sees.
            assert.strictEqual(
              link.url,
              pipe(url, Str.replace(/[\r\n]/g, ""), Str.trim),
              Result.getOrThrow(S.encodeUnknownResult(Json)(url))
            );
            assert.notMatch(
              link.url ?? "",
              /^\s*j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/i,
              Result.getOrThrow(S.encodeUnknownResult(Json)(url))
            );
          }
        }
        // The ones that spell a dangerous scheme once whitespace, a control character or a line break is gone are not links.
        for (const url of [
          "java\nscript:alert(1)",
          "java\tscript:alert(1)",
          "java script:alert(1)",
          "  \u0001javascript:alert(1)",
        ]) {
          const root = yield* treeOf([Doc.paragraph(Doc.link({ url }, "click"))]);
          assert.notInclude(
            descendantTypes(A.getUnsafe(kids(root), 0)),
            "link",
            Result.getOrThrow(S.encodeUnknownResult(Json)(url))
          );
          assert.include(
            descendantTypes(A.getUnsafe(kids(root), 0)),
            "inlineCode",
            Result.getOrThrow(S.encodeUnknownResult(Json)(url))
          );
        }
      })
  );

  it.effect("an ampersand in a URL survives: a query string and entity-looking text parse back as written", () =>
    Effect.gen(function* () {
      for (const url of [
        "https://example.test/?a=1&b=2",
        "https://example.test/?q=&amp;x",
        "https://example.test/a&lt;b",
        "/p?x=&#35;",
      ]) {
        const root = yield* treeOf([Doc.paragraph(Doc.link({ url }, "l"))]);
        const link = O.getOrUndefined(A.findFirst(descendants(root), (n) => n.type === "link"));
        assert.strictEqual(link?.url, url, url);
      }
    })
  );

  it.effect(
    "a file link with an absolute path is a file:// link; without a URL form it is the label and path:line:col as code",
    () =>
      Effect.gen(function* () {
        const displayPath = (p: string) => Str.replace("/repo/", "")(p);
        const abs = yield* treeOf([Doc.paragraph(Doc.link({ file: "/repo/my dir/a.ts", line: 3, col: 4 }, "a.ts"))], {
          displayPath,
        });
        const link = O.getOrUndefined(A.findFirst(kids(kids(abs)[0]), (n) => n.type === "link"));
        assert.strictEqual(link?.url, "file:///repo/my%20dir/a.ts");
        assert.isDefined(link);
        assert.strictEqual(textOf(link), "a.ts");
        const rel = yield* treeOf([Doc.paragraph(Doc.link({ file: "src/a.ts", line: 3, col: 4 }, "a.ts"))], {
          displayPath,
        });
        const parts = kids(kids(rel)[0]);
        assert.notInclude(descendantTypes(A.getUnsafe(kids(rel), 0)), "link");
        assert.deepStrictEqual(
          A.map(parts, (n) => [n.type, n.value]),
          [
            ["text", "a.ts ("],
            ["inlineCode", "src/a.ts:3:4"],
            ["text", ")"],
          ]
        );
      })
  );

  it.effect("a link whose label is its target shows it once", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([Doc.paragraph(Doc.link({ file: "src/a.ts", line: 3 }, "src/a.ts:3"))]);
      assert.strictEqual(textOf(A.getUnsafe(kids(root), 0)), "src/a.ts:3");
    })
  );
});

describe("Render.markdown: lists, trees and counts", () => {
  it.effect("a list is a bullet list of its items, nested lists included, with the overflow row after it", () =>
    Effect.gen(function* () {
      const items = A.map(["a", "b", "c"], (t) => Doc.paragraph(t));
      const root = yield* treeOf([
        Doc.list([Doc.paragraph("one two"), Doc.list([Doc.paragraph("inner")]), Doc.codeBlock("x\ny")]),
      ]);
      const [list] = kids(root);
      assert.strictEqual(list?.type, "list");
      assert.strictEqual(list?.ordered, false);
      assert.strictEqual(kids(list).length, 3);
      assert.strictEqual(textOf(A.getUnsafe(kids(kids(list)[0]), 0)), "one two");
      assert.strictEqual(kids(kids(list)[1])[0]?.type, "list");
      assert.strictEqual(kids(kids(list)[2])[0]?.type, "code");

      const capped = yield* treeOf([Doc.list(items, { cap: 2 })]);
      assert.deepStrictEqual(
        A.map(kids(capped), (n) => n.type),
        ["list", "paragraph"]
      );
      assert.strictEqual(kids(kids(capped)[0]).length, 2);
      assert.strictEqual(textOf(A.getUnsafe(kids(capped), 1)), "… 1 more");
      const ascii = yield* treeOf([Doc.list(items, { cap: 0 })], { glyphs: Glyphs.ascii });
      assert.deepStrictEqual(
        A.map(kids(ascii), (n) => n.type),
        ["paragraph"]
      );
      assert.strictEqual(textOf(A.getUnsafe(kids(ascii), 0)), "... 3 more");
    })
  );

  it.effect("a tree is its root label, then its children as nested lists", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([
        Doc.tree({
          label: [Doc.code("root")],
          children: [{ label: "a", children: [{ label: "a1" }, { label: "a2" }] }, { label: "b" }],
        }),
      ]);
      assert.deepStrictEqual(
        A.map(kids(root), (n) => n.type),
        ["paragraph", "list"]
      );
      assert.strictEqual(kids(kids(root)[0])[0]?.type, "inlineCode");
      const top = kids(kids(root)[1]);
      assert.deepStrictEqual(
        A.map(top, (item) => textOf(A.getUnsafe(kids(item), 0))),
        ["a", "b"]
      );
      assert.deepStrictEqual(
        A.map(kids(kids(top[0])[1]), (item) => textOf(A.getUnsafe(kids(item), 0))),
        ["a1", "a2"]
      );
      const lone = yield* treeOf([Doc.tree({ label: "only" })]);
      assert.deepStrictEqual(
        A.map(kids(lone), (n) => n.type),
        ["paragraph"]
      );
    })
  );

  const counters = [
    Doc.counter(Status.core, "success", { key: "ok", label: "passed", n: 3 }),
    Doc.counter(Status.core, "failure", { key: "bad", label: "failed", n: 1 }),
    Doc.counter(Status.core, "pending", { key: "todo", label: "todo", n: 0 }),
  ];

  it.effect("Counts inline is one paragraph with the headline share of the total and the duration", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([
        Doc.counts({ label: "Widgets", counters, qualifier: "(1 flaky)", durationMs: 1200, layout: "inline" }),
      ]);
      assert.deepStrictEqual(
        A.map(kids(root), (n) => n.type),
        ["paragraph"]
      );
      assert.strictEqual(textOf(A.getUnsafe(kids(root), 0)), "Widgets: 3/4 passed, 1 failed (1 flaky) (1.2s)");
    })
  );

  it.effect("a line break in a counter label cannot start a block: no heading, setext heading, rule or extra row", () =>
    Effect.gen(function* () {
      const counter = (label: string) => Doc.counter(Status.core, "failure", { key: "f", label, n: 1 });
      for (const label of ["x\n# h", "x\n---", "x\r\n===", "\r# h", "x\r- item", "x\n> q", "x\n```"]) {
        const inline = yield* treeOf([Doc.counts({ counters: [counter(label)], layout: "inline" })]);
        assert.deepStrictEqual(
          A.map(kids(inline), (n) => n.type),
          ["paragraph"],
          `inline ${Result.getOrThrow(S.encodeUnknownResult(Json)(label))}`
        );
        const columns = yield* treeOf([Doc.counts({ counters: [counter(label)], layout: "columns" })]);
        assert.deepStrictEqual(
          A.map(kids(columns), (n) => n.type),
          ["list"],
          `columns ${Result.getOrThrow(S.encodeUnknownResult(Json)(label))}`
        );
        assert.strictEqual(
          kids(kids(columns)[0]).length,
          1,
          `columns ${Result.getOrThrow(S.encodeUnknownResult(Json)(label))}: one item`
        );
        const row = yield* treeOf([Doc.counts({ counters: [counter(label)], layout: "row" })]);
        assert.deepStrictEqual(
          A.map(kids(row), (n) => n.type),
          ["table"],
          `row ${Result.getOrThrow(S.encodeUnknownResult(Json)(label))}`
        );
        assert.strictEqual(
          kids(tableOf(row)).length,
          2,
          `row ${Result.getOrThrow(S.encodeUnknownResult(Json)(label))}: a header and one row`
        );
      }
    })
  );

  it.effect("Counts as a row is a table of one row: a header of the counter labels over their numbers", () =>
    Effect.gen(function* () {
      const treeOf6 = yield* treeOf([Doc.counts({ label: "Widgets", counters, durationMs: 61000, layout: "row" })]);
      const table = tableOf(treeOf6);
      assert.deepStrictEqual(cellTexts(table), [
        ["passed", "failed", "duration"], // every column named; the label goes above the table
        ["3/4", "1", "1m 1s"],
      ]);
    })
  );

  it.effect(
    "a counter label cannot start a block in the columns list: no heading, code, nested list, quote or rule",
    () =>
      Effect.gen(function* () {
        const labels = [
          "# h",
          "## h",
          "    code",
          "\tcode",
          "- x",
          "+ x",
          "* x",
          "1. x",
          "2) x",
          "> q",
          "---",
          "===",
          "```",
          "~~~",
          "<div>",
          "[x]: y",
        ];
        for (const label of labels) {
          const counts = Doc.counts({
            counters: [
              Doc.counter(Status.core, "failure", { key: "f", label, n: 1 }),
              Doc.counter(Status.core, "success", { key: "p", label: "ok", n: 2 }),
            ],
            layout: "columns",
          });
          const root = yield* treeOf([counts]);
          assert.deepStrictEqual(
            A.map(kids(root), (n) => n.type),
            ["list"],
            Result.getOrThrow(S.encodeUnknownResult(Json)(label))
          );
          const items = kids(kids(root)[0]);
          assert.strictEqual(items.length, 2, `${Result.getOrThrow(S.encodeUnknownResult(Json)(label))}: two items`);
          for (const item of items) {
            assert.deepStrictEqual(
              A.map(kids(item), (n) => n.type),
              ["paragraph"],
              `${Result.getOrThrow(S.encodeUnknownResult(Json)(label))}: an item is one paragraph`
            );
            assert.deepStrictEqual(
              A.sort(A.dedupe(descendantTypes(item)), Str.Order),
              ["listItem", "paragraph", "text"],
              Result.getOrThrow(S.encodeUnknownResult(Json)(label))
            );
          }
          assert.strictEqual(
            textOf(A.getUnsafe(items, 0)),
            `${Str.trimStart(label)}: 1`,
            Result.getOrThrow(S.encodeUnknownResult(Json)(label))
          );
        }
      })
  );

  it.effect("Counts as columns is a list of label and number pairs", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([Doc.counts({ label: "Summary", counters, layout: "columns" })]);
      assert.deepStrictEqual(
        A.map(kids(root), (n) => n.type),
        ["paragraph", "list"]
      );
      assert.deepStrictEqual(
        A.map(kids(kids(root)[1]), (item) => textOf(item)),
        ["passed: 3", "failed: 1"]
      );
    })
  );

  it.effect("a status glyph from the context's glyph set, including the bracketed ASCII one, stays text", () =>
    Effect.gen(function* () {
      const unicode = yield* treeOf([Doc.paragraph(Doc.status(Status.core, "failure"), " bad")]);
      assert.strictEqual(textOf(A.getUnsafe(kids(unicode), 0)), "✗ bad");
      const ascii = yield* treeOf([Doc.paragraph(Doc.status(Status.core, "failure"), " bad")], {
        glyphs: Glyphs.ascii,
      });
      assert.strictEqual(textOf(A.getUnsafe(kids(ascii), 0)), "[FAIL] bad");
      assert.notInclude(descendantTypes(A.getUnsafe(kids(ascii), 0)), "linkReference");
    })
  );

  it.effect("a path joins with the audience's separator", () =>
    Effect.gen(function* () {
      const human = yield* treeOf([Doc.paragraph(Doc.path("a", "b"))]);
      assert.strictEqual(textOf(A.getUnsafe(kids(human), 0)), "a › b");
      const agent = yield* treeOf([Doc.paragraph(Doc.path("a", "b"))], { audience: "agent" });
      assert.strictEqual(textOf(A.getUnsafe(kids(agent), 0)), "a > b");
    })
  );
});

describe("Render.markdown: no ANSI, and a hostile document stays inside its own structure", () => {
  it.effect("no escape of any kind, and paint and link are never called", () =>
    Effect.gen(function* () {
      const calls: Array<string> = [];
      const out = yield* render(composite({ codeAndPath: true }), {
        paint: dual(2, (_t: TokenName | Style.Encoded, text: string): string => {
          calls.push("paint");
          return `${ESC}[1m${text}${ESC}[0m`;
        }),
        link: dual(2, (_t: LinkTargetInput, label: string): string => {
          calls.push("link");
          return `${ESC}]8;;u\u0007${label}${ESC}]8;;\u0007`;
        }),
      });
      assert.deepStrictEqual(calls, []);
      assert.notInclude(out, ESC);
      assert.notMatch(out, /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/);
    })
  );

  it.effect("the parsed hostile composite holds only the structure the renderer emitted", () =>
    Effect.gen(function* () {
      const root = yield* treeOf(composite({ codeAndPath: true }));
      const types = A.map(kids(root), (n) => n.type);
      assert.deepStrictEqual(
        A.filter(types, (t) => t === "thematicBreak"),
        [],
        "no rule from user text"
      );
      const htmls = pipe(
        kids(root),
        A.filter((n) => n.type === "html"),
        A.map((n) => n.value)
      );
      assert.isTrue(
        A.every(htmls, (h) => /^(<details( open)?><summary>[^<]*<\/summary>|<\/details>)$/.test(h ?? "")),
        Result.getOrThrow(S.encodeUnknownResult(Json)(htmls))
      );
      for (const link of A.filter([...descendants(root)], (n) => n.type === "link")) {
        assert.match(
          link.url ?? "",
          /^(https:\/\/x\.test\/|file:\/\/\/repo\/)/,
          "a link is one the document asked for"
        );
      }
      const inlineHtml = A.filter(
        [...descendants(root)],
        (n) => n.type === "html" && n.value !== "<br>" && !htmls.includes(n.value)
      );
      assert.deepStrictEqual(inlineHtml, [], "no HTML from user text");
    })
  );
});

function* descendants(n: N): Generator<N> {
  for (const child of kids(n)) {
    yield child;
    yield* descendants(child);
  }
}

describe("Render.markdown: okfit's trial (verbatim, link suffix, counts share, annotations)", () => {
  it.effect("verbatim is one fenced code block whose text is the indented lines exactly", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([Doc.verbatim("verified:\n  - by: x ```\n  at: y", { indent: 2 })]);
      const code = kids(root);
      assert.lengthOf(code, 1);
      assert.strictEqual(code[0]?.type, "code");
      // The parser keeps the fence's final line break in the value, as the code-block tests above note.
      assert.strictEqual(Str.replace(/\n$/, "")(code[0]?.value ?? ""), "  verified:\n    - by: x ```\n    at: y");
    })
  );

  it.effect("a file link with no URL form drops its suffix with suffix: false, and a missing target is text", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([
        Doc.paragraph(
          Doc.link({ file: "a.md", line: 2 }, "here", { suffix: false }),
          " and ",
          Doc.link(undefined, "(bundle)")
        ),
      ]);
      assert.deepStrictEqual(descendantTypes(root), ["root", "paragraph", "text"]);
      assert.strictEqual(textOf(root), "here and (bundle)");
    })
  );

  it.effect("share: false drops the headline share", () =>
    Effect.gen(function* () {
      const counters = [
        Doc.counter(Status.core, "failure", { key: "error", label: "errors", n: 2 }),
        Doc.counter(Status.core, "warning", { key: "warning", label: "warnings", n: 1 }),
      ];
      const treeOf7 = yield* treeOf([Doc.counts({ layout: "inline", counters, share: false })]);
      assert.strictEqual(textOf(treeOf7), "2 errors, 1 warnings");
    })
  );

  it.effect("an annotation renders nothing, and adds no blank block", () =>
    Effect.gen(function* () {
      const annotation = Doc.annotation({ level: "error" }, "x");
      const render8 = yield* render([annotation]);
      assert.strictEqual(render8, "");
      const render9 = yield* render([Doc.paragraph("a"), annotation, Doc.paragraph("b")]);
      const render12 = yield* render([Doc.paragraph("a"), Doc.paragraph("b")]);
      assert.strictEqual(render9, render12);
    })
  );
});

describe("Render.markdown: reporter blocks (parsed back)", () => {
  const passed = (n: number) => Doc.counter(Status.core, "success", { key: "passed", label: "passed", n });
  const failed = (n: number) => Doc.counter(Status.core, "failure", { key: "failed", label: "failed", n });

  it.effect("strong is a strong node and em an emphasis node, their text escaped", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([
        Doc.paragraph("a ", Doc.strong("To*tal"), " and ", Doc.em("x_y"), " ", Doc.strong(" pad ")),
      ]);
      const paragraph = kids(root)[0];
      const types = A.map(kids(paragraph), (n) => n.type);
      assert.deepStrictEqual(types.slice(0, 4), ["text", "strong", "text", "emphasis"]);
      assert.strictEqual(textOf(A.getUnsafe(kids(paragraph), 1)), "To*tal");
      assert.strictEqual(textOf(A.getUnsafe(kids(paragraph), 3)), "x_y");
      assert.include(descendantTypes(root).slice(6), "strong", "spaces at a run's edge stay outside its markers");
    })
  );

  it.effect("lines are one paragraph with a hard break between entries, so they never collapse", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([Doc.lines(["one", "two", "- three"])]);
      assert.lengthOf(kids(root), 1);
      assert.strictEqual(kids(root)[0]?.type, "paragraph");
      assert.strictEqual(textOf(root), "one\ntwo\n- three");
      assert.lengthOf(
        A.filter(descendantTypes(root), (type) => type === "break"),
        2
      );
    })
  );

  it.effect("with linkBase a file link goes to linkBase plus the display path and #L<line>", () =>
    Effect.gen(function* () {
      const root = yield* treeOf(
        [Doc.paragraph(Doc.link({ file: "/repo/src/a b.ts", line: 3 }, "a.ts"), " ", Doc.file("/repo/src/c.ts"))],
        {
          linkBase: "https://github.com/o/r/blob/sha/",
          displayPath: (a) => Str.replace("/repo/", "")(a),
        }
      );
      const link = kids(kids(root)[0])[0];
      assert.strictEqual(link?.type, "link");
      assert.strictEqual(link?.url, "https://github.com/o/r/blob/sha/src/a%20b.ts#L3");
      assert.strictEqual(textOf(root), "a.ts src/c.ts");
      assert.lengthOf(
        A.filter(descendantTypes(root), (type) => type === "link"),
        1,
        "a file is never linked"
      );
    })
  );

  it.effect("countsTable is a table: a column per counter, a row per entry, and the total row", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([
        Doc.countsTable(
          [
            { label: "web", counters: [passed(3), failed(1)] },
            { label: "api", counters: [passed(2)] },
          ],
          { totalRow: "All" }
        ),
      ]);
      assert.deepStrictEqual(cellTexts(tableOf(root)), [
        ["", "passed", "failed"],
        ["web", "3", "1"],
        ["api", "2", ""],
        ["All", "5", "1"],
      ]);
    })
  );

  it.effect("G4: the row layout's duration column has a header, never an empty one", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([Doc.counts({ layout: "row", counters: [passed(3), failed(1)], durationMs: 250 })]);
      const header = cellTexts(tableOf(root))[0] ?? [];
      assert.deepStrictEqual(header, ["passed", "failed", "duration"]);
    })
  );

  it.effect("counts suffix follows the duration", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([
        Doc.counts({ layout: "inline", counters: [passed(3), failed(1)], durationMs: 250, suffix: "across 3 files" }),
      ]);
      assert.strictEqual(textOf(root), "3/4 passed, 1 failed (250ms) across 3 files");
    })
  );

  it.effect("a compact list item's children have no blank line between them, so the list stays tight", () =>
    Effect.gen(function* () {
      const item = Doc.section("FAIL a.test.ts", [Doc.paragraph("expected 1"), Doc.paragraph("got 2")]);
      const out = yield* render([Doc.list([item], { compact: true })]);
      assert.notInclude(out, "\n\n");
      const root = yield* parse(out);
      assert.strictEqual(kids(root)[0]?.type, "list");
      assert.include(textOf(root), "expected 1");
    })
  );

  it.effect("a line is one paragraph", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([Doc.line("one\ntwo", { truncate: true })]);
      assert.deepStrictEqual(descendantTypes(root), ["root", "paragraph", "text"]);
      assert.strictEqual(textOf(root), "one two");
    })
  );

  it.effect("diffText is a diff fence holding the text as given", () =>
    Effect.gen(function* () {
      const unified = "@@ -1 +1 @@\n-old\n+new\n context ```";
      const treeOf10 = yield* treeOf([Doc.diffText(unified)]);
      const code = kids(treeOf10)[0];
      assert.strictEqual(code?.type, "code");
      assert.strictEqual(code?.lang, "diff");
      assert.strictEqual(Str.replace(/\n$/, "")(code?.value ?? ""), unified);
    })
  );

  it.effect("a pipe-style table is still a GFM table in markdown", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([Doc.table([{ header: "File" }], [["a.ts"]], { style: "pipe" })]);
      assert.deepStrictEqual(cellTexts(tableOf(root)), [["File"], ["a.ts"]]);
    })
  );
});

describe("Render.markdown: emphasis, list caps, counts headers, link fallbacks and duration columns", () => {
  const passed = (n: number) => Doc.counter(Status.core, "success", { key: "passed", label: "passed", n });
  const failed = (n: number) => Doc.counter(Status.core, "failure", { key: "failed", label: "failed", n });

  it.effect("em is *…*, so it opens and closes inside a word too", () =>
    Effect.gen(function* () {
      const out = yield* render([Doc.paragraph("a", Doc.em("b"), "c")]);
      assert.strictEqual(out, "a*b*c");
      const parsed11 = yield* parse(out);
      const paragraph = kids(parsed11)[0];
      assert.deepStrictEqual(
        A.map(kids(paragraph), (n) => n.type),
        ["text", "emphasis", "text"]
      );
    })
  );

  it.effect("a list's cap counts the items left after annotations are skipped", () =>
    Effect.gen(function* () {
      const annotation = Doc.annotation({ level: "error" }, "x");
      const root = yield* treeOf([
        Doc.list([annotation, Doc.paragraph("a"), Doc.paragraph("b"), Doc.paragraph("c")], { cap: 2 }),
      ]);
      assert.lengthOf(kids(kids(root)[0]), 2, "two items shown");
      assert.strictEqual(textOf(A.getUnsafe(kids(root), 1)), "… 1 more");
    })
  );

  it.effect("a row of counts has a header for every column: the label goes above, qualifier and suffix below", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([
        Doc.counts({
          layout: "row",
          label: "Widgets",
          counters: [passed(3), failed(1)],
          qualifier: "(1 flaky)",
          durationMs: 250,
          suffix: "across 3 files",
        }),
      ]);
      assert.deepStrictEqual(
        A.map(kids(root), (n) => n.type),
        ["paragraph", "table", "paragraph"]
      );
      const cells = cellTexts(tableOf(root));
      assert.deepStrictEqual(cells, [
        ["passed", "failed", "duration"],
        ["3/4", "1", "250ms"],
      ]);
      assert.isTrue(
        A.every(cells[0] ?? [], (cell) => cell !== ""),
        "no empty header"
      );
      assert.strictEqual(textOf(A.getUnsafe(kids(root), 0)), "Widgets");
      assert.strictEqual(textOf(A.getUnsafe(kids(root), 2)), "(1 flaky) across 3 files");
    })
  );

  it.effect("with linkBase, a display path that is absolute or climbs with .. falls back to the no-URL form", () =>
    Effect.gen(function* () {
      for (const display of ["/abs/x.ts", "../x.ts", "a/../../x.ts", "C:\\x.ts"]) {
        const root = yield* treeOf([Doc.paragraph(Doc.link({ file: "/repo/x.ts", line: 2 }, "x"))], {
          linkBase: "https://github.com/o/r/blob/sha/",
          displayPath: () => display,
        });
        assert.notInclude(descendantTypes(root), "link", display);
        assert.include(descendantTypes(root), "inlineCode", display);
      }
    })
  );

  it.effect("an empty entry of Doc.lines is kept as an empty line between hard breaks", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([Doc.lines(["one", "", "two"])]);
      assert.lengthOf(kids(root), 1, "still one paragraph");
      assert.strictEqual(textOf(root), "one\n\ntwo");
    })
  );
});

describe("countsTable: a real totals table (A4)", () => {
  const count = (key: string, label: string, status: "success" | "failure" | "skip", n: number) =>
    Doc.counter(Status.core, status, { key, label, n });
  const project = (name: string, p: number, f: number, t: number, s: number, durationMs?: number) => ({
    label: name,
    counters: [
      count("passed", "Passed", "success", p),
      count("failed", "Failed", "failure", f),
      count("timedOut", "Timed out", "failure", t),
      count("skipped", "Skipped", "skip", s),
    ],
    ...(durationMs === undefined ? {} : { durationMs }),
  });

  it.effect("vitest-agent's case: a Project header, a Duration column and a summed total", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([
        Doc.countsTable([project("unit", 10, 1, 0, 2, 67_000), project("e2e", 3, 0, 1, 0, 5_000)], {
          labelHeader: "Project",
          durationHeader: "Duration",
          totalRow: Doc.strong("Total"),
        }),
      ]);
      assert.deepStrictEqual(cellTexts(tableOf(root)), [
        ["Project", "Passed", "Failed", "Timed out", "Skipped", "Duration"],
        ["unit", "10", "1", "0", "2", "1m 7s"],
        ["e2e", "3", "0", "1", "0", "5s"],
        ["Total", "13", "1", "1", "2", "1m 12s"],
      ]);
    })
  );

  it.effect("a row without a duration has an empty cell and counts as zero in the total", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([
        Doc.countsTable([project("unit", 1, 0, 0, 0, 1_500), project("lint", 1, 0, 0, 0)], { totalRow: true }),
      ]);
      const rows = cellTexts(tableOf(root));
      assert.strictEqual(rows[0]?.[0], "", "control: the label header stays empty when unset");
      assert.strictEqual(rows[0]?.[5], "duration");
      assert.strictEqual(rows[2]?.[5], "");
      assert.strictEqual(rows[3]?.[5], "1.5s");
    })
  );

  it.effect("with no duration anywhere there is no duration column", () =>
    Effect.gen(function* () {
      const root = yield* treeOf([Doc.countsTable([project("unit", 1, 0, 0, 0)], { labelHeader: "Project" })]);
      assert.deepStrictEqual(cellTexts(tableOf(root))[0], ["Project", "Passed", "Failed", "Timed out", "Skipped"]);
    })
  );
});
