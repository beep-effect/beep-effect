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

const Item = S.Literals(["0", "false", "x", "{x: 1}", "[y]", "map", "|", "|+", ">-"]);

const Entry = S.Struct({
  value: S.Literals(["scalar", "flow", "compact-seq", "deeper-seq"]),
  items: S.Array(Item).check(S.isMinLength(1), S.isMaxLength(3)),
  commentBefore: S.Boolean,
});

const Layout = S.Literals(["root", "nested-map", "nested-seq", "wide-entry"]);

const Trailer = S.Literals(["none", "next-item", "outer-key"]);

type Item = typeof Item.Type;
type Entry = typeof Entry.Type;
type Layout = typeof Layout.Type;
type Trailer = typeof Trailer.Type;

const layouts: Readonly<
  Record<
    Layout,
    {
      readonly itemOpening: string;
      readonly keyColumn: number;
      readonly dashColumn: number;
      readonly outerKeyText: string;
    }
  >
> = {
  root: { itemOpening: "- ", keyColumn: 2, dashColumn: 0, outerKeyText: "" },
  "nested-map": { itemOpening: "p:\n  - ", keyColumn: 4, dashColumn: 2, outerKeyText: "q: 1\n" },
  "nested-seq": { itemOpening: "- - ", keyColumn: 4, dashColumn: 2, outerKeyText: "- w\n" },
  "wide-entry": { itemOpening: "-   ", keyColumn: 4, dashColumn: 0, outerKeyText: "" },
};

const spaces = (n: number): string => Str.repeat(n)(" ");

const blockItems: ReadonlyArray<Item> = ["|", "|+", ">-"];

const renderItem = (column: number, item: Item): string => {
  if (A.contains(blockItems, item)) return `${spaces(column)}- ${item}\n${spaces(column + 2)}t\n`;
  if (item === "map") return `${spaces(column)}- x: 1\n${spaces(column + 2)}y: 2\n`;
  return `${spaces(column)}- ${item}\n`;
};

const renderValue = (keys: number, entry: Entry): string => {
  if (entry.value === "scalar") return " 1\n";
  if (entry.value === "flow") return " [1, 2]\n";
  const column = entry.value === "compact-seq" ? keys : keys + 2;
  return `\n${A.join(
    A.map(entry.items, (item) => renderItem(column, item)),
    ""
  )}`;
};

const renderEntry = (keys: number, entry: Entry, index: number): string => {
  const indent = index === 0 ? "" : spaces(keys);
  const comment = index > 0 && entry.commentBefore ? `${spaces(keys)}# note\n` : "";
  return `${comment}${indent}k${index}:${renderValue(keys, entry)}`;
};

const render = (layout: Layout, entries: ReadonlyArray<Entry>, trailer: Trailer): string => {
  const { itemOpening, keyColumn, dashColumn, outerKeyText } = layouts[layout];
  const body = A.join(
    A.map(entries, (entry, index) => renderEntry(keyColumn, entry, index)),
    ""
  );
  const tail = trailer === "next-item" ? `${spaces(dashColumn)}- z: 1\n` : trailer === "outer-key" ? outerKeyText : "";
  return `${itemOpening}${body}${tail}`;
};

describe("compact block sequences in sequence-item mappings", () => {
  it.effect.prop(
    "compact and block-scalar sequence values match the yaml oracle",
    [
      Arbitrary.schema(Layout),
      Arbitrary.schema(S.Array(Entry).check(S.isMinLength(1), S.isMaxLength(3))),
      Arbitrary.schema(Trailer),
    ],
    ([layout, entries, trailer]) =>
      Effect.sync(() => {
        const input = render(layout, entries, trailer);
        assertSuccess(Yaml.parseResult(input), parse(input));
      }),
    runs
  );

  it.effect(
    "parses a block sequence at the mapping's own indent inside a sequence item (YAML 1.2 l+block-sequence(n-1))",
    () =>
      Effect.gen(function* () {
        const secondKey = "- a: 1\n  b:\n  - 0\n";
        const secondKeyValue = yield* Yaml.parse(secondKey);
        assert.deepStrictEqual(
          secondKeyValue,
          parse(secondKey),
          "inside a sequence item the mapping's keys sit past the dash; a second key with such a value used to fail with InvalidIndentation"
        );
        const blockScalarItem = "- a:\n  - |\n    t\n  b: 1\n";
        const blockScalarItemValue = yield* Yaml.parse(blockScalarItem);
        assert.deepStrictEqual(
          blockScalarItemValue,
          parse(blockScalarItem),
          "a block scalar item followed by a sibling key used to be mis-nested into a mapping; the independent oracle is the yaml devDependency, so a shared-defect round-trip cannot go green"
        );
      })
  );

  it.effect("a sequence after a scalar value or left of the keys stays invalid", () =>
    Effect.sync(() => {
      for (const input of ["- a:\n  - 0\n  b: 1\n  - 2\n", "- a: 1\n  - 0\n", "- a:\n  - 0\n  b:\n  - 1\n - 2\n"]) {
        assert.throws(() => parse(input));
        assertTrue(Result.isFailure(Yaml.parseResult(input)), input);
      }
    })
  );
});
