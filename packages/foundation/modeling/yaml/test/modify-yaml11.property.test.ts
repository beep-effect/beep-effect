// decision: yaml-1-1-compat-quotes-the-union
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { YamlStringifyOptions } from "@beep/yaml";
import { YamlFormat } from "@beep/yaml/YamlFormat";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { parse } from "yaml";

const runs = { arbitrary: fcRuns(500) };

const read11 = (text: string): unknown => parse(text, { version: "1.1" });

const ResolverChar = S.Literals([
  "0",
  "1",
  "7",
  "9",
  "_",
  ":",
  ".",
  "+",
  "-",
  "e",
  "x",
  "b",
  "o",
  "n",
  "N",
  "y",
  "Y",
  "f",
  "O",
  "a",
  "i",
  "l",
  "s",
  "t",
  "r",
  "u",
  "~",
  "<",
]).annotate({ description: "The characters the YAML 1.1 implicit resolvers key on." });
const Chars = S.Array(ResolverChar).check(S.isMinLength(1), S.isMaxLength(6));

const SPELLINGS: ReadonlyArray<string> = [
  "y",
  "Y",
  "yes",
  "Yes",
  "YES",
  "n",
  "N",
  "no",
  "No",
  "NO",
  "true",
  "True",
  "TRUE",
  "false",
  "False",
  "FALSE",
  "on",
  "On",
  "ON",
  "off",
  "Off",
  "OFF",
  "~",
  "null",
  "Null",
  "NULL",
  "0b101",
  "0777",
  "0x1F",
  "1_000",
  "1:30",
  "190:20:30",
  "1.5",
  "1_0.5",
  "6.8523015e+5",
  "1:30.5",
  ".inf",
  "-.Inf",
  ".NaN",
  "2026-10-31",
  "2001-12-14t21:59:43.10-05:00",
  "<<",
];

const field =
  (name: string) =>
  (document: unknown): unknown =>
    P.hasProperty(document, name) ? document[name] : undefined;

const EDITS: ReadonlyArray<{
  readonly name: string;
  readonly text: string;
  readonly path: (value: string) => ReadonlyArray<string>;
  readonly read: (document: unknown) => unknown;
}> = [
  {
    name: "insert a value",
    text: "%YAML 1.1\n---\na: 1\n",
    path: () => ["b"],
    read: field("b"),
  },
  {
    name: "splice a plain value",
    text: "%YAML 1.1\n---\na: x # keep\n",
    path: () => ["a"],
    read: field("a"),
  },
  {
    name: "replace a block value",
    text: "%YAML 1.1\n---\na: |\n  x\nb: 1\n",
    path: () => ["a"],
    read: field("a"),
  },
  {
    name: "insert a key",
    text: "%YAML 1.1\n---\nm:\n  k: 1\n",
    path: (value) => ["m", value],
    read: (document) => {
      const m = field("m")(document);
      return P.isObject(m) ? A.filter(R.keys(m), (key) => key !== "k") : [];
    },
  },
];

const roundTrips = Effect.fnUntraced(function* (value: string, options?: YamlStringifyOptions) {
  for (const edit of EDITS) {
    const written = yield* YamlFormat.modifyToString(edit.text, edit.path(value), value, options);
    const read = edit.read(read11(written));
    deepStrictEqual(
      edit.name === "insert a key" ? read : [read],
      [value],
      `${edit.name}: under a %YAML 1.1 directive modify quotes every fresh string the 1.1 schema would coerce (bool, null, binary/octal/decimal/hex/sexagesimal int, float, sexagesimal float, .inf/.nan, timestamp, the << merge key), so yaml's 1.1 parse reads back that same string; over-quoting is the safe direction, so only string identity is asserted`
    );
  }
});

describe("YamlFormat.modify under %YAML 1.1", () => {
  it.effect(
    "writes every spelling 1.1 coerces where 1.2 Core keeps a string, plus shared nulls and booleans, as a string",
    () =>
      Effect.gen(function* () {
        for (const value of SPELLINGS) {
          yield* roundTrips(value);
          yield* roundTrips(value, YamlStringifyOptions.make({ quoteStyle: "auto" }));
        }
      })
  );

  it.effect.prop(
    "reads every written string back as that string under the yaml 1.1 reader",
    [Arbitrary.schema(Chars)],
    ([chars]) => roundTrips(A.join(chars, "")),
    runs
  );

  it.effect("inserts and replaces on, yes, 0777 and 1:30 as strings", () =>
    Effect.gen(function* () {
      for (const value of ["on", "yes", "0777", "1:30"]) {
        const inserted = yield* YamlFormat.modifyToString("%YAML 1.1\n---\na: on\n", ["b"], value);
        strictEqual(
          inserted,
          `%YAML 1.1\n---\na: on\nb: '${value}'\n`,
          "a fresh plain string such as on, yes, 0777 or 1:30 is safe in YAML 1.2 but reads back as a boolean, an int or a sexagesimal number under 1.1"
        );
        deepStrictEqual(
          read11(inserted),
          { a: true, b: value },
          "the source `a: on` keeps its bytes, and with them its 1.1 meaning"
        );
        const replaced = yield* YamlFormat.modifyToString("%YAML 1.1\n---\na: on\nb: x\n", ["b"], value);
        strictEqual(replaced, `%YAML 1.1\n---\na: on\nb: '${value}'\n`);
        deepStrictEqual(read11(replaced), { a: true, b: value });
      }
    })
  );

  it.effect("quotes coerced strings inside fresh sequences and mappings, beside valueless source keys", () =>
    Effect.gen(function* () {
      const written = yield* YamlFormat.modifyToString(
        "%YAML 1.1\n---\nempty:\nlist: x\n",
        ["list"],
        ["off", { on: "1:30", plain: "redis" }, 1]
      );
      strictEqual(written, "%YAML 1.1\n---\nempty:\nlist:\n- 'off'\n- 'on': '1:30'\n  plain: redis\n- 1\n");
      deepStrictEqual(read11(written), { empty: null, list: ["off", { on: "1:30", plain: "redis" }, 1] });
    })
  );

  it.effect("keeps today's output under %YAML 1.2 and without a directive", () =>
    Effect.gen(function* () {
      const modifyToString1 = yield* YamlFormat.modifyToString("%YAML 1.2\n---\na: 1\n", ["b"], "on");
      strictEqual(modifyToString1, "%YAML 1.2\n---\na: 1\nb: on\n");
      const modifyToString2 = yield* YamlFormat.modifyToString("a: x\n", ["a"], "1:30");
      strictEqual(modifyToString2, "a: 1:30\n");
    })
  );

  it.effect("refuses any other declared version with UnsupportedYamlVersion", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(YamlFormat.modify("%YAML 1.3\n---\na: 1\n", ["b"], "on"));
      strictEqual(error.diagnostics[0]?.code, "UnsupportedYamlVersion");
    })
  );
});
