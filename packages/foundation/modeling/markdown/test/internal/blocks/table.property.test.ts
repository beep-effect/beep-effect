import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Markdown, MarkdownFormat, MarkdownFormattingOptions, Mdast } from "@beep/markdown";
import { parseBlocks } from "@beep/markdown/internal/blockParser";
import * as BlockRegistry from "@beep/markdown/internal/blockRegistry";
import { CellContent, RawCell, RowSource, ScannedRow, tableHeaderStart } from "@beep/markdown/internal/blocks/table";
import { BlockDialect, BlockStart } from "@beep/markdown/internal/blockTypes";
import { assert, describe, it, vi } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { BlockNode, BlockScanner, BlockStartResult, BlockStartTrigger } from "@beep/markdown/internal/blockTypes";
import type { Paragraph, Root, Table, TableAlign, TableCell } from "@beep/markdown/MarkdownNode";

const runs = { arbitrary: fcRuns(100) };

/** `dialect` with the table header start's trigger wrapped by `trigger`. */
const replaceHeaderTrigger = (dialect: BlockDialect, trigger: (start: BlockStart) => BlockStartTrigger): BlockDialect =>
  new BlockDialect(
    dialect.constructs,
    A.map(dialect.starts, (start) => (start === tableHeaderStart ? new BlockStart(start.name, trigger(start)) : start)),
    dialect.mayStartBlock
  );

/** Run `parse` with the GFM dialect's table header trigger wrapped by `trigger`. */
const withHeaderTrigger = <A>(trigger: (start: BlockStart) => BlockStartTrigger, parse: () => A): A => {
  const lookup = vi
    .spyOn(BlockRegistry, "blockDialect")
    .mockReturnValue(replaceHeaderTrigger(BlockRegistry.blockDialect("gfm"), trigger));
  try {
    return parse();
  } finally {
    lookup.mockRestore();
  }
};

/** Whether the scanner sits on the `| --- |` delimiter line under the paragraph being promoted. */
const isDelimiterUnderParagraph = (scanner: BlockScanner, container: BlockNode): boolean =>
  container.type === "paragraph" && scanner.currentLine === "| --- |";

/** Replace `container`'s provenance runs with copies that count every field read. */
const countSegmentReads = (container: BlockNode, reads: { count: number }): void => {
  const measured = A.map(container.segments, (segment) => ({
    get textOffset() {
      reads.count += 1;
      return segment.textOffset;
    },
    get sourceOffset() {
      reads.count += 1;
      return segment.sourceOffset;
    },
    get length() {
      reads.count += 1;
      return segment.length;
    },
  }));
  container.segments.length = 0;
  for (const segment of measured) container.segments.push(segment);
};

/** The `index`th child block of `block`, failing the test when it is absent. */
const blockAt = (block: BlockNode | undefined, index: number): BlockNode =>
  block?.children[index] ?? assert.fail(`expected child block ${index}`);

/** A top-level block of a parsed document. */
type TopLevel = Root["children"][number];

const asTable = (node: TopLevel | undefined): Table =>
  node !== undefined && node.type === "table" ? node : assert.fail(`expected a table, got ${node?.type}`);

const asParagraph = (node: TopLevel | undefined): Paragraph =>
  node !== undefined && node.type === "paragraph" ? node : assert.fail(`expected a paragraph, got ${node?.type}`);

/** The `index`th cell of `table`'s header row, failing the test when it is absent. */
const headerCell = (table: Table, index: number): TableCell =>
  table.children[0]?.children[index] ?? assert.fail(`expected header cell ${index}`);

/** The value of a node's first child when that child is text. */
const firstText = (node: Paragraph | TableCell): string | undefined => {
  const first = node.children[0];
  return first?.type === "text" ? first.value : undefined;
};

// Positions refer to different byte strings after canonical serialization.
// Compare every semantic mdast field, recursively, excluding only positions.
const semantic = (value: unknown): unknown => {
  if (A.isArray(value)) return A.map(value, semantic);
  if (P.isObject(value))
    return R.map(
      R.filter(value, (_, key) => key !== "position"),
      semantic
    );
  return value;
};
const words = S.Array(S.Literals(["alpha", "beta", "gamma", "delta", "é", "世界"])).pipe(
  Arbitrary.schema,
  Arbitrary.map((items) => `word ${A.join(items, " ")}`)
);

const styles = Arbitrary.schema(S.Literals(["---", ":---", "---:", ":---:"]));
const sourceOf = (text: string, style: string) => `| ${text} | other |\n| ${style} | --- |\n| body | tail |\n`;
const options = MarkdownFormattingOptions.make({ headingStyle: "atx", bulletChar: "-" });

describe("table parser properties", () => {
  it.effect("bounds provenance reads while reclaiming a paragraph above escaped header pipes", () =>
    Effect.sync(() => {
      for (const scale of [500, 1_000, 2_000]) {
        const prefix = Str.repeat(scale)("lead\n");
        const source = `${prefix}| ${Str.repeat(scale)("a\\|")} z |\n| --- |\n`;
        const reads = { count: 0 };
        let promotionReads = 0;
        let promotions = 0;
        const root = withHeaderTrigger(
          (start) =>
            dual(2, (scanner: BlockScanner, container: BlockNode): BlockStartResult => {
              if (!isDelimiterUnderParagraph(scanner, container)) return start.trigger(scanner, container);
              countSegmentReads(container, reads);
              const result = start.trigger(scanner, container);
              promotionReads = reads.count;
              promotions += 1;
              return result;
            }),
          () => parseBlocks(source, { dialect: "gfm" }).root
        );
        assert.strictEqual(promotions, 1);
        assert.isAbove(promotionReads, scale);
        assert.isAtMost(promotionReads, 30 * (scale + 1), `segment reads at scale ${scale}`);
        assert.strictEqual(root.children.length, 2);
        assert.strictEqual(firstText(asParagraph(root.children[0])), Str.slice(0, prefix.length - 1)(prefix));
        const cell = headerCell(asTable(root.children[1]), 0);
        assert.strictEqual(cell.position.start.offset, prefix.length + 2);
        assert.strictEqual(cell.position.end.offset, prefix.length + scale * 3 + 4);
        assert.strictEqual(firstText(cell), `${Str.repeat(scale)("a|")} z`);
      }
    })
  );
  it.effect("keeps reclaimed and header segment boundaries around escapes and injected newlines", () =>
    Effect.sync(() => {
      let promotions = 0;
      const root = withHeaderTrigger(
        (start) =>
          dual(2, (scanner: BlockScanner, container: BlockNode): BlockStartResult => {
            const result = start.trigger(scanner, container);
            if (result !== 2) return result;
            promotions += 1;
            const table = scanner.tip;
            const reclaimed = blockAt(table.parent, 0);
            assert.strictEqual(reclaimed.type, "paragraph");
            assert.strictEqual(reclaimed.stringContent, "a|b\nc|d\n");
            assert.deepStrictEqual(reclaimed.segments, [
              { textOffset: 0, sourceOffset: 0, length: 1 },
              { textOffset: 1, sourceOffset: 2, length: 2 },
              { textOffset: 4, sourceOffset: 5, length: 1 },
              { textOffset: 5, sourceOffset: 7, length: 2 },
            ]);
            const row = blockAt(table, 0);
            assert.strictEqual(blockAt(row, 0).stringContent, "e|f|g ");
            assert.deepStrictEqual(blockAt(row, 0).segments, [
              { textOffset: 0, sourceOffset: 12, length: 1 },
              { textOffset: 1, sourceOffset: 14, length: 2 },
              { textOffset: 3, sourceOffset: 17, length: 3 },
            ]);
            assert.strictEqual(blockAt(row, 1).stringContent, "tail ");
            assert.deepStrictEqual(blockAt(row, 1).segments, [{ textOffset: 0, sourceOffset: 22, length: 5 }]);
            return result;
          }),
        () => parseBlocks("a\\|b\nc\\|d\n| e\\|f\\|g | tail |\n| --- | --- |\n", { dialect: "gfm" }).root
      );
      assert.strictEqual(promotions, 1);
      assert.strictEqual(root.children.length, 2);
    })
  );
  it.effect("drops zero-width provenance runs while unescaping a header cell", () =>
    Effect.sync(() => {
      let promotions = 0;
      const root = withHeaderTrigger(
        (start) =>
          dual(2, (scanner: BlockScanner, container: BlockNode): BlockStartResult => {
            if (!isDelimiterUnderParagraph(scanner, container)) return start.trigger(scanner, container);
            container.segments.length = 0;
            container.segments.push(
              { textOffset: 0, sourceOffset: 0, length: 3 },
              { textOffset: 3, sourceOffset: 3, length: 0 },
              { textOffset: 3, sourceOffset: 3, length: 8 }
            );
            const result = start.trigger(scanner, container);
            assert.strictEqual(result, 2);
            promotions += 1;
            const cell = blockAt(blockAt(scanner.tip, 0), 0);
            assert.strictEqual(cell.stringContent, "abc|def ");
            assert.deepStrictEqual(cell.segments, [
              { textOffset: 0, sourceOffset: 2, length: 1 },
              { textOffset: 1, sourceOffset: 3, length: 2 },
              { textOffset: 3, sourceOffset: 6, length: 5 },
            ]);
            return result;
          }),
        () => parseBlocks("| abc\\|def |\n| --- |\n", { dialect: "gfm" }).root
      );
      assert.strictEqual(promotions, 1);
      assert.strictEqual(firstText(headerCell(asTable(root.children[0]), 0)), "abc|def");
    })
  );
  it.effect("scanner models retain text provenance, cell boundaries and optional scan status", () =>
    Effect.gen(function* () {
      const source = RowSource.make({
        text: "  a\\|b | tail |\n",
        segments: [{ textOffset: 0, sourceOffset: 10, length: 15 }],
      });
      const cell = RawCell.make({ start: 0, contentStart: 2, end: 6 });
      const row = ScannedRow.make({ cells: [cell], paragraphOffset: 0 });
      const content = CellContent.make({
        text: "a|b",
        segments: [
          { textOffset: 0, sourceOffset: 12, length: 1 },
          { textOffset: 1, sourceOffset: 14, length: 2 },
        ],
      });
      const value1 = yield* S.decodeEffect(RowSource)(source);
      assert.deepStrictEqual(value1, source);
      const value2 = yield* S.decodeEffect(RawCell)(cell);
      assert.deepStrictEqual(value2, cell);
      const value3 = yield* S.decodeEffect(ScannedRow)(row);
      assert.deepStrictEqual(value3, row);
      const value4 = yield* S.decodeEffect(ScannedRow)({ ...row, complete: false });
      assert.deepStrictEqual(value4, ScannedRow.make({ ...row, complete: false }));
      const value5 = yield* S.decodeEffect(CellContent)(content);
      assert.deepStrictEqual(value5, content);
      const value6 = yield* S.encodeEffect(RowSource)(source);
      assert.deepStrictEqual(value6, source);
      const value7 = yield* S.encodeEffect(CellContent)(content);
      assert.deepStrictEqual(value7, content);
      assert.isFalse(S.is(ScannedRow)({ ...row, complete: null }));
      assert.isFalse(S.is(RawCell)({ ...cell, end: Number.POSITIVE_INFINITY }));
      assert.isFalse(S.is(RowSource)({ ...source, segments: [{ textOffset: 0, sourceOffset: "10", length: 15 }] }));
    })
  );
  it.effect("escaped cell text keeps its original source span", () =>
    Effect.gen(function* () {
      const source = "| a\\|b | tail |\n| --- | --- |\n| c | d |\n";
      const root = yield* Markdown.parse(source);
      const table = root.children[0];
      assert.ok(table?.type === "table");
      if (table?.type === "table") {
        const cell = table.children[0]?.children[0];
        assert.ok(cell !== undefined);
        if (cell !== undefined) {
          assert.strictEqual(cell.position.start.offset, 2);
          assert.strictEqual(cell.position.end.offset, 6);
          assert.strictEqual(Str.slice(cell.position.start.offset, cell.position.end.offset)(source), "a\\|b");
          const text = cell.children[0];
          assert.strictEqual(text?.type === "text" ? text.value : undefined, "a|b");
        }
      }
    })
  );
  it.effect.prop(
    "parse/stringify preserves all semantic fields and stabilizes",
    [words, styles],
    ([text, style]) =>
      Effect.gen(function* () {
        const source = sourceOf(text, style);
        const parsed = yield* Markdown.parse(source);
        const serialized = yield* Markdown.stringify(parsed);
        const reparsed = yield* Markdown.parse(serialized);
        assert.deepStrictEqual(semantic(reparsed), semantic(parsed));
        const stringify8 = yield* Markdown.stringify(reparsed);
        assert.strictEqual(stringify8, serialized);
      }),
    runs
  );
  it.effect.prop(
    "format is idempotent and keeps parsed content",
    [words, styles],
    ([text, style]) =>
      Effect.gen(function* () {
        const source = sourceOf(text, style);
        const once = MarkdownFormat.formatToString(source, undefined, options);
        assert.strictEqual(MarkdownFormat.formatToString(once, undefined, options), once);
        const parsed9 = yield* Markdown.parse(once);
        const argument = semantic(Mdast.toMdast(parsed9));
        const parsed1 = yield* Markdown.parse(source);
        assert.deepStrictEqual(argument, semantic(Mdast.toMdast(parsed1)));
      }),
    runs
  );
  it.effect.prop(
    "README edit fidelity keeps surrounding bytes exact",
    [words, styles],
    ([text, style]) =>
      Effect.gen(function* () {
        const prefix = "<!-- before  keep spacing -->\n\n";
        const suffix = "\n<!-- after\tkeep tabs -->\n";
        const block = sourceOf(text, style);
        const source = `${prefix}${block}${suffix}`;
        const parsed = yield* Markdown.parse(source);
        const first = parsed.children[1];
        assert.ok(first !== undefined);
        if (first !== undefined) {
          assert.strictEqual(first.position.start.offset, prefix.length);
          assert.ok(Str.slice(first.position.start.offset, first.position.end.offset)(source).length > 0);
        }
        const formatted = MarkdownFormat.formatToString(source, undefined, options);
        assert.ok(Str.startsWith(prefix)(formatted));
        assert.ok(Str.endsWith(suffix)(formatted));
        const parsed10 = yield* Markdown.parse(formatted);
        assert.deepStrictEqual(semantic(Mdast.toMdast(parsed10)), semantic(Mdast.toMdast(parsed)));
      }),
    runs
  );
});

// A reference model of the row scanner and cell splitter: rows are built from
// known cells, so the expected table is known without re-implementing the
// scanner. Covers the split scanners (`scanDelimiterRowLine`,
// `scanRowSource`, `cellContent`) on escaped pipes, code spans, alignment
// colons, whitespace around markers, and short and long body rows.
const Cell = S.Literals(["a", "b c", "x\\|y", "`c`", "é", "1\\|2\\|3", "q!"]);
const Marker = S.Literals(["---", ":---", "---:", ":-:", " - ", "  :--  "]);
const TableShape = S.Struct({
  header: S.NonEmptyArray(S.Struct({ cell: Cell, marker: Marker })).check(S.isMaxLength(4)),
  body: S.Array(S.NonEmptyArray(Cell).check(S.isMaxLength(6))).check(S.isMaxLength(3)),
  outerPipes: S.Boolean,
});

const rowLine = (cells: ReadonlyArray<string>, outerPipes: boolean): string =>
  outerPipes ? `| ${A.join(cells, " | ")} |` : A.join(cells, " | ");

/** The plain text of a cell as the parser should see it: escaped pipes unescaped, code spans unwrapped. */
const expectedText = (cell: string): string => Str.replaceAll("`", "")(Str.replaceAll("\\|", "|")(cell));

const alignOf = (marker: string): TableAlign | null => {
  const trimmed = Str.trim(marker);
  const left = Str.startsWith(":")(trimmed);
  const right = Str.endsWith(":")(trimmed);
  return left && right ? "center" : left ? "left" : right ? "right" : null;
};

describe("table scanner reference model", () => {
  it.effect.prop(
    "a table built from known cells parses back to those cells, padded and truncated to the header",
    [Arbitrary.schema(TableShape)],
    ([shape]) =>
      Effect.sync(() => {
        const columns = shape.header.length;
        const lines = [
          rowLine(
            A.map(shape.header, ({ cell }) => cell),
            shape.outerPipes
          ),
          rowLine(
            A.map(shape.header, ({ marker }) => marker),
            true
          ),
          ...A.map(shape.body, (row) => rowLine(row, true)),
        ];
        const source = `${A.join(lines, "\n")}\n`;
        const table = parseBlocks(source, { dialect: "gfm" }).root.children[0];
        assert.strictEqual(table?.type, "table", source);
        if (table?.type !== "table") return;
        assert.deepStrictEqual(
          table.align,
          A.map(shape.header, ({ marker }) => alignOf(marker))
        );
        const texts = A.map(table.children, (row) =>
          A.map(row.children, (cell) =>
            A.join(
              A.map(cell.children, (child) =>
                child.type === "text" || child.type === "inlineCode" ? child.value : ""
              ),
              ""
            )
          )
        );
        const expectedRows = [
          A.map(shape.header, ({ cell }) => expectedText(cell)),
          ...A.map(shape.body, (row) =>
            A.map(
              A.makeBy(columns, (index) => row[index]),
              (cell) => (cell === undefined ? "" : expectedText(cell))
            )
          ),
        ];
        assert.deepStrictEqual(texts, expectedRows, source);
      }),
    { arbitrary: { ...fcRuns(1000), seed: 0x746162 } }
  );
});
