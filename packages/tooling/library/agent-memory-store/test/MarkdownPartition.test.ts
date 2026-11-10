import {
  checkReplacement,
  NodeReplacement,
  NodeReplacementOutOfRangeError,
  partition,
  partitionTree,
} from "@beep/agent-memory-store";
import { List, ListItem, Markdown, Paragraph, Root } from "@beep/markdown";
import { describe, expect, it } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { MarkdownPartition } from "@beep/agent-memory-store";

// Synthetic fixtures only; the goals/** fixture belongs to the projector stage.

const cut = (text: string): ReadonlyArray<readonly [string, string]> =>
  A.map(partition(text).nodes, (node) => [node.kind, node.text] as const);

const assertExactPartition = (text: string, result: MarkdownPartition): void => {
  expect(
    A.join(
      A.map(result.nodes, (node) => node.text),
      ""
    )
  ).toBe(text);
  let offset = 0;
  for (const node of result.nodes) {
    expect(node.range.offset).toBe(offset);
    expect(node.range.length).toBe(node.text.length);
    expect(node.text.length).toBeGreaterThan(0);
    expect(Str.slice(node.range.offset, node.range.offset + node.range.length)(text)).toBe(node.text);
    offset += node.range.length;
  }
  expect(offset).toBe(text.length);
};

const encoder = new TextEncoder();

const assertByteIdentity = (text: string, result: MarkdownPartition): void => {
  const bytes = A.flatMap(result.nodes, (node) => A.fromIterable(encoder.encode(node.text)));
  expect(bytes).toEqual(A.fromIterable(encoder.encode(text)));
};

const check = (text: string, start: number, end: number, replacement: string) =>
  Result.getOrThrow(checkReplacement(partition(text), NodeReplacement.make({ start, end, text: replacement })));

describe("MarkdownPartition constructs", () => {
  it("returns no nodes for an empty file", () => {
    const result = partition("");
    expect(result.nodes).toEqual([]);
    expect(result.fallback).toBe("none");
  });

  it("cuts headings and paragraphs as single nodes with gaps between", () => {
    expect(cut("# Title\n\nFirst line\nsecond line\n\nSetext\n======\n")).toEqual([
      ["heading", "# Title"],
      ["gap", "\n\n"],
      ["paragraph", "First line\nsecond line"],
      ["gap", "\n\n"],
      ["heading", "Setext\n======"],
      ["gap", "\n"],
    ]);
  });

  it("keeps list markers inside list-item nodes for every marker style", () => {
    expect(cut("- one\n* two\n+ three\n1. four\n10) five\n- [ ] task\n")).toEqual([
      ["listItem", "- one"],
      ["gap", "\n"],
      ["listItem", "* two"],
      ["gap", "\n"],
      ["listItem", "+ three"],
      ["gap", "\n"],
      ["listItem", "1. four"],
      ["gap", "\n"],
      ["listItem", "10) five"],
      ["gap", "\n"],
      ["listItem", "- [ ] task"],
      ["gap", "\n"],
    ]);
  });

  it("cuts nested list items and continuation blocks with their indentation inside the node", () => {
    expect(cut("- parent\n  - child\n    - grandchild\n\n  continuation\n- next\n")).toEqual([
      ["listItem", "- parent"],
      ["gap", "\n"],
      ["listItem", "  - child"],
      ["gap", "\n"],
      ["listItem", "    - grandchild"],
      ["gap", "\n\n"],
      ["paragraph", "  continuation"],
      ["gap", "\n"],
      ["listItem", "- next"],
      ["gap", "\n"],
    ]);
  });

  it("keeps a lazy continuation line inside its list item", () => {
    expect(cut("- one\nlazy\n- two\n")).toEqual([
      ["listItem", "- one\nlazy"],
      ["gap", "\n"],
      ["listItem", "- two"],
      ["gap", "\n"],
    ]);
  });

  it("keeps a list item that opens with a container whole", () => {
    expect(cut("- - inner\n  - sibling\n")).toEqual([
      ["listItem", "- - inner\n  - sibling"],
      ["gap", "\n"],
    ]);
  });

  it("cuts table rows with the delimiter row inside the header row node", () => {
    expect(cut("| a | b |\n|---|:-:|\n| 1 | 2 |\n| 3 | 4 |\n")).toEqual([
      ["tableRow", "| a | b |\n|---|:-:|"],
      ["gap", "\n"],
      ["tableRow", "| 1 | 2 |"],
      ["gap", "\n"],
      ["tableRow", "| 3 | 4 |"],
      ["gap", "\n"],
    ]);
    expect(cut("| a |\n|---|")).toEqual([["tableRow", "| a |\n|---|"]]);
  });

  it("cuts a table inside a list item row by row", () => {
    expect(cut("- intro\n\n  | a |\n  |---|\n  | 1 |\n")).toEqual([
      ["listItem", "- intro"],
      ["gap", "\n\n"],
      ["tableRow", "  | a |\n  |---|"],
      ["gap", "\n"],
      ["tableRow", "  | 1 |"],
      ["gap", "\n"],
    ]);
  });

  it("cuts fenced code as one node, closed or not", () => {
    expect(cut("```ts\nconst a = 1\n\nconst b = 2\n```\n")).toEqual([
      ["codeFence", "```ts\nconst a = 1\n\nconst b = 2\n```"],
      ["gap", "\n"],
    ]);
    expect(cut("~~~\nopen\n")).toEqual([
      ["codeFence", "~~~\nopen"],
      ["gap", "\n"],
    ]);
  });

  it("maps indented code to a codeFence node", () => {
    expect(cut("para\n\n    indented\n    more\n")).toEqual([
      ["paragraph", "para"],
      ["gap", "\n\n"],
      ["codeFence", "    indented\n    more"],
      ["gap", "\n"],
    ]);
  });

  it("captures YAML frontmatter as a frontmatter node", () => {
    expect(cut("---\ntitle: Notes\n---\n# Notes\n")).toEqual([
      ["frontmatter", "---\ntitle: Notes\n---"],
      ["gap", "\n"],
      ["heading", "# Notes"],
      ["gap", "\n"],
    ]);
  });

  it("maps thematic breaks and HTML blocks to their own kinds", () => {
    expect(cut("***\n\n<div>\nraw\n</div>\n")).toEqual([
      ["thematicBreak", "***"],
      ["gap", "\n\n"],
      ["html", "<div>\nraw\n</div>"],
      ["gap", "\n"],
    ]);
  });

  it("keeps a block quote whole as one paragraph node, prefixes included", () => {
    expect(cut("> quoted\n> - item\n>\n> more\n")).toEqual([
      ["paragraph", "> quoted\n> - item\n>\n> more"],
      ["gap", "\n"],
    ]);
  });

  it("maps link reference and footnote definitions to paragraph nodes", () => {
    expect(cut("[ref]: https://example.com\n\n[^note]: A footnote.\n")).toEqual([
      ["paragraph", "[ref]: https://example.com"],
      ["gap", "\n\n"],
      ["paragraph", "[^note]: A footnote."],
      ["gap", "\n"],
    ]);
  });

  it("parses MDX-looking syntax as ordinary Markdown", () => {
    expect(cut("import X from './x'\n\n<Note>\nhi\n</Note>\n")).toEqual([
      ["paragraph", "import X from './x'"],
      ["gap", "\n\n"],
      ["html", "<Note>\nhi\n</Note>"],
      ["gap", "\n"],
    ]);
  });

  it("ends on the last content node when the file has no trailing newline", () => {
    expect(cut("# Title\n\nlast")).toEqual([
      ["heading", "# Title"],
      ["gap", "\n\n"],
      ["paragraph", "last"],
    ]);
  });

  it("keeps CRLF line endings verbatim in nodes and gaps", () => {
    expect(cut("# Title\r\n\r\n- one\r\n- two\r\n")).toEqual([
      ["heading", "# Title"],
      ["gap", "\r\n\r\n"],
      ["listItem", "- one"],
      ["gap", "\r\n"],
      ["listItem", "- two"],
      ["gap", "\r\n"],
    ]);
  });

  it("keeps a byte order mark as the first gap and still recognizes the heading", () => {
    expect(cut("﻿# Title\n")).toEqual([
      ["gap", "﻿"],
      ["heading", "# Title"],
      ["gap", "\n"],
    ]);
    expect(cut("﻿---\na: 1\n---\n")).toEqual([
      ["gap", "﻿"],
      ["frontmatter", "---\na: 1\n---"],
      ["gap", "\n"],
    ]);
  });

  it("keeps tabs verbatim", () => {
    expect(cut("-\tone\n\t- two\n")).toEqual([
      ["listItem", "-\tone"],
      ["gap", "\n"],
      ["listItem", "\t- two"],
      ["gap", "\n"],
    ]);
  });

  it("holds a whitespace-only file in one gap", () => {
    expect(cut("\n \n\t\n")).toEqual([["gap", "\n \n\t\n"]]);
  });

  it("counts ranges in UTF-16 code units and keeps byte identity for non-ASCII text", () => {
    const text = "# Café ✓ 😀\n\n- 😀 émoji\n- 漢字\n";
    const result = partition(text);
    assertExactPartition(text, result);
    assertByteIdentity(text, result);
    const item = result.nodes[2];
    expect(item?.text).toBe("- 😀 émoji");
    // "# Café ✓ 😀" is 11 UTF-16 code units (the emoji counts 2) and the blank line adds 2.
    expect(item?.range.offset).toBe(13);
    // The emoji is a surrogate pair: two UTF-16 code units, four UTF-8 bytes.
    expect(item?.range.length).toBe(10);
  });

  it("partitions a file the parser rejects as one unparsed node", () => {
    const text = `${A.join(A.replicate("> ", 300), "")}deep\n`;
    const result = partition(text);
    expect(result.fallback).toBe("unparsed");
    expect(cut(text)).toEqual([["paragraph", text]]);
  });
});

describe("MarkdownPartition reparse check", () => {
  it("reports a stable in-place edit of one list item", () => {
    const result = check("- one\n- two\n- three\n", 2, 3, "- TWO");
    expect(result.stable).toBe(true);
    expect(result.disturbed).toEqual([]);
    expect(A.map(result.region, (node) => node.text)).toEqual(["- TWO"]);
    expect(
      A.join(
        A.map(result.edited.nodes, (node) => node.text),
        ""
      )
    ).toBe("- one\n- TWO\n- three\n");
  });

  it("reports a stable deletion and insertion", () => {
    expect(check("one\n\ntwo\n\nthree\n", 2, 4, "").stable).toBe(true);
    const inserted = check("one\n\ntwo\n", 2, 2, "mid\n\n");
    expect(inserted.stable).toBe(true);
    expect(A.map(inserted.region, (node) => [node.kind, node.text])).toEqual([
      ["paragraph", "mid"],
      ["gap", "\n\n"],
    ]);
  });

  it("flags a gap edit that merges two paragraphs", () => {
    const result = check("one\n\ntwo\n", 1, 2, "\n");
    expect(result.stable).toBe(false);
    expect(result.disturbed).toEqual([0, 2]);
    expect(A.map(result.region, (node) => node.text)).toEqual(["one\ntwo"]);
  });

  it("flags an edit that opens a fence and swallows later nodes", () => {
    const result = check("# Title\n\npara\n\n- item\n", 0, 1, "```");
    expect(result.stable).toBe(false);
    expect(result.disturbed).toEqual([1, 2, 3, 4]);
  });

  it("flags an edit that turns the next paragraph into a setext heading underline target", () => {
    const result = check("intro\n\n---\n", 1, 2, "\n");
    expect(result.stable).toBe(false);
    expect(result.disturbed).toEqual([0, 2]);
  });

  it("refuses a run outside the partition", () => {
    const base = partition("one\n");
    const outside = checkReplacement(base, NodeReplacement.make({ start: 1, end: 3, text: "" }));
    outside.pipe(Result.isFailure, assertTrue);
    const backwards = checkReplacement(base, NodeReplacement.make({ start: 1, end: 0, text: "" }));
    const failure = Result.getFailure(backwards);
    expect(O.exists(failure, S.is(NodeReplacementOutOfRangeError))).toBe(true);
    assertSome(
      O.map(failure, (error) => [error.start, error.end, error.nodeCount]),
      [1, 0, 2]
    );
  });
});

// Hand-built trees stand in for parser output with unusable positions.
const span = (start: number, end: number) => ({
  start: { line: 1, column: start + 1, offset: start },
  end: { line: 1, column: end + 1, offset: end },
});

describe("MarkdownPartition fallback", () => {
  it("matches partition when handed the parsed tree", () => {
    const text = "# Title\n\n- one\n- two\n\n| a |\n|---|\n| 1 |\n";
    const root = Result.getOrThrow(Markdown.parseResult(text, { frontmatter: true }));
    expect(partitionTree(text, root)).toEqual(partition(text));
    expect(partitionTree("", root).nodes).toEqual([]);
  });

  it("cuts a block with overlapping child positions as one node", () => {
    const text = "- a\n- b\n\nafter\n";
    const root = Root.make({
      children: [
        List.make({
          children: [
            ListItem.make({ children: [], position: span(0, 7) }),
            ListItem.make({ children: [], position: span(4, 6) }),
          ],
          position: span(0, 7),
        }),
        Paragraph.make({ children: [], position: span(9, 14) }),
      ],
      position: span(0, text.length),
    });
    const result = partitionTree(text, root);
    expect(result.fallback).toBe("block");
    expect(A.map(result.nodes, (node) => [node.kind, node.text])).toEqual([
      ["listItem", "- a\n- b"],
      ["gap", "\n\n"],
      ["paragraph", "after"],
      ["gap", "\n"],
    ]);
    assertExactPartition(text, result);
  });

  it("cuts the whole file as one node when top-level positions run backwards or leave the file", () => {
    const text = "one\n\ntwo\n";
    const backwards = Root.make({
      children: [
        Paragraph.make({ children: [], position: span(5, 8) }),
        Paragraph.make({ children: [], position: span(0, 3) }),
      ],
      position: span(0, text.length),
    });
    const outside = Root.make({
      children: [Paragraph.make({ children: [], position: span(0, 40) })],
      position: span(0, 40),
    });
    for (const root of [backwards, outside]) {
      const result = partitionTree(text, root);
      expect(result.fallback).toBe("file");
      expect(A.map(result.nodes, (node) => [node.kind, node.text])).toEqual([["paragraph", text]]);
    }
  });

  it("never puts a boundary inside a surrogate pair", () => {
    const text = "😀😀\n";
    const root = Root.make({
      children: [Paragraph.make({ children: [], position: span(1, 4) })],
      position: span(0, text.length),
    });
    const result = partitionTree(text, root);
    expect(result.fallback).toBe("file");
    assertByteIdentity(text, result);
  });
});

const Fragment = S.Literals([
  "# Heading",
  "Setext\n===",
  "plain text",
  "- item",
  "  - nested",
  "1. ordered",
  "* star",
  "| a | b |",
  "|---|---|",
  "```",
  "~~~ts",
  "    code",
  "> quote",
  "---",
  "***",
  "<div>",
  "</div>",
  "<!-- note -->",
  "[ref]: https://example.com",
  "[^1]: foot",
  "\t- tabbed",
  "Café ✓ 😀",
  "﻿",
  "",
  " ",
  "\n",
  "\r\n",
  "\r",
  "\t",
  "|",
  "`",
  "[x]",
  "\\",
]);

const Separator = S.Literals(["\n", "\n\n", "\r\n", "", " "]);

const markdownLike = Arbitrary.map(
  Arbitrary.array(Arbitrary.all([Arbitrary.schema(Fragment), Arbitrary.schema(Separator)]), { maxLength: 40 }),
  (pieces) =>
    A.join(
      A.map(pieces, ([fragment, separator]) => `${fragment}${separator}`),
      ""
    )
);

const anyText = Arbitrary.schema(S.String);

describe("MarkdownPartition properties", () => {
  it.prop(
    "concatenates the node texts back to the input for Markdown-like text",
    [markdownLike],
    ([text]) => {
      const result = partition(text);
      assertExactPartition(text, result);
      assertByteIdentity(text, result);
    },
    { arbitrary: { runs: 300 } }
  );

  it.prop(
    "concatenates the node texts back to the input for arbitrary strings",
    [anyText],
    ([text]) => {
      assertExactPartition(text, partition(text));
    },
    { arbitrary: { runs: 200 } }
  );

  it.prop(
    "reports an identity replacement as stable",
    [markdownLike],
    ([text]) => {
      const base = partition(text);
      for (const [index, node] of A.map(base.nodes, (value, position) => [position, value] as const)) {
        const result = Result.getOrThrow(
          checkReplacement(base, NodeReplacement.make({ start: index, end: index + 1, text: node.text }))
        );
        expect(result.stable).toBe(true);
        expect(result.edited.nodes).toEqual(base.nodes);
      }
    },
    { arbitrary: { runs: 50 } }
  );
});
