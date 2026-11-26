// decision: plain-continuation-lines
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Yaml } from "@beep/yaml";
import { assert, describe, it } from "@effect/vitest";
import { assertSuccess, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { parse } from "yaml";

const runs = { arbitrary: fcRuns(200) };

const Word = S.Array(S.Literals(["a", "b", "x", "y", "z"])).check(S.isMinLength(1), S.isMaxLength(4));

const ContinuationLine = S.Struct({
  lead: S.Literals(['"', "'", "|", ">"]),
  body: Word,
  closes: S.Boolean,
  tail: S.Array(Word).check(S.isMaxLength(2)),
  blankBefore: S.Boolean,
  extraIndent: S.Literals([0, 1, 2]),
  separation: S.Literals(["", "\t", " \t"]).annotate({
    description: "Separation blanks after the indentation: YAML 1.2 allows tabs there.",
  }),
});

const Layout = S.Literals(["map", "nested-map", "seq", "compact-map", "root", "flow-seq"]);

type ContinuationLine = typeof ContinuationLine.Type;
type Layout = typeof Layout.Type;

const layouts: Readonly<
  Record<
    Layout,
    { readonly parentIndentPlusOne: number; readonly wrapInDocument: (value: string, body: string) => string }
  >
> = {
  map: { parentIndentPlusOne: 1, wrapInDocument: (value, body) => `k: ${value}\n${body}z: 1\n` },
  "nested-map": { parentIndentPlusOne: 3, wrapInDocument: (value, body) => `p:\n  k: ${value}\n${body}  z: 1\n` },
  seq: { parentIndentPlusOne: 1, wrapInDocument: (value, body) => `- ${value}\n${body}- w\n` },
  "compact-map": { parentIndentPlusOne: 3, wrapInDocument: (value, body) => `- k: ${value}\n${body}  z: 1\n` },
  root: { parentIndentPlusOne: 0, wrapInDocument: (value, body) => `${value}\n${body}` },
  "flow-seq": { parentIndentPlusOne: 1, wrapInDocument: (value, body) => `[${value}\n${body}, w]\n` },
};

const renderLine = (indent: number, line: ContinuationLine): string => {
  const quoteClose = line.closes && (line.lead === '"' || line.lead === "'") ? line.lead : "";
  const tail = A.join(
    A.map(line.tail, (word) => ` ${A.join(word, "")}`),
    ""
  );
  const text = `${line.lead}${A.join(line.body, "")}${quoteClose}${tail}`;
  return `${line.blankBefore ? "\n" : ""}${Str.repeat(indent + line.extraIndent)(" ")}${line.separation}${text}\n`;
};

const render = (layout: Layout, first: ReadonlyArray<string>, lines: ReadonlyArray<ContinuationLine>): string => {
  const { parentIndentPlusOne: fewestContinuationSpaces, wrapInDocument } = layouts[layout];
  return wrapInDocument(
    A.join(first, ""),
    A.join(
      A.map(lines, (line) => renderLine(fewestContinuationSpaces, line)),
      ""
    )
  );
};

describe("plain-scalar continuation lines", () => {
  it.effect.prop(
    "quote- and block-indicator-led continuation lines match the independent yaml oracle, so a shared defect cannot pass",
    [
      Arbitrary.schema(Layout),
      Arbitrary.schema(Word),
      Arbitrary.schema(S.Array(ContinuationLine).check(S.isMinLength(1), S.isMaxLength(3))),
    ],
    ([layout, first, lines]) =>
      Effect.sync(() => {
        const input = render(layout, first, lines);
        assertSuccess(Yaml.parseResult(input), parse(input));
      }),
    runs
  );

  it.effect("a quote-led line that ends at a value indicator or is tab-indented stays invalid", () =>
    Effect.sync(() => {
      for (const input of ['a: x\n  "y": 1\n', "a: x\n  'y': 1\n", 'a: x\n\t"y"\nb: 1\n']) {
        assert.throws(() => parse(input));
        assertTrue(Result.isFailure(Yaml.parseResult(input)), input);
      }
    })
  );
});
