// decision: quote-fallback-defaults
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Yaml, YamlStringifyOptions } from "@beep/yaml";
import { describe, it } from "@effect/vitest";
import { assertSuccess, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { parse, stringify } from "yaml";

const runs = { arbitrary: fcRuns(500) };

const autoInOracleSequenceLayout = YamlStringifyOptions.make({ indentSequences: true, quoteStyle: "auto" });

const QuotingChar = S.Literals([
  "a",
  "b",
  "1",
  " ",
  "\t",
  "'",
  '"',
  ":",
  "#",
  "-",
  "?",
  "@",
  "`",
  "!",
  "&",
  "*",
  "%",
  "|",
  ">",
  ",",
  "[",
  "]",
  "{",
  "}",
  "~",
  "\\",
]).annotate({ description: "The characters that drive the quoting decision." });

const Chars = S.Array(QuotingChar).check(S.isMinLength(1), S.isMaxLength(7));

const startsWithDocumentMarker = (value: string): boolean =>
  Str.startsWith("---")(value) || Str.startsWith("...")(value);

describe('quoteStyle "auto"', () => {
  it.effect.prop(
    "renders a mapping value and a sequence item exactly as the yaml writer does, except a document-marker value",
    [Arbitrary.schema(Chars)],
    ([chars]) =>
      Effect.gen(function* () {
        const value = A.join(chars, "");
        if (startsWithDocumentMarker(value)) return;
        const document = { k: value, l: [value] };
        const emitted = yield* Yaml.stringify(document, autoInOracleSequenceLayout);
        strictEqual(
          emitted,
          stringify(document, { lineWidth: 0 }),
          `"auto" claims the yaml package's default quote choice (singleQuote: null): single quotes for a value holding " and no ', double quotes otherwise, an interior tab left plain or kept literal inside single quotes; checked byte for byte with lineWidth: 0`
        );
        assertSuccess(Yaml.parseResult(emitted), parse(emitted));
      }),
    runs
  );

  it.effect.prop(
    "renders a mapping key exactly as the yaml writer does, except a document-marker key",
    [Arbitrary.schema(Chars)],
    ([chars]) =>
      Effect.gen(function* () {
        const key = A.join(chars, "");
        if (startsWithDocumentMarker(key)) return;
        const document = { [key]: 1 };
        const stringify1 = yield* Yaml.stringify(document, autoInOracleSequenceLayout);
        strictEqual(stringify1, stringify(document, { lineWidth: 0 }));
      }),
    runs
  );
});
