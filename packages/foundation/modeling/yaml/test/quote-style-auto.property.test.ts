// `quoteStyle: "auto"` against the `yaml` devDependency's own writer.
//
// "auto" claims the `yaml` npm package's default quote choice (its
// `singleQuote: null`): single quotes for a value holding `"` and no `'`,
// double quotes otherwise, an interior tab left plain or kept literal inside
// single quotes. The oracle is that package's `stringify` with `lineWidth: 0`,
// so the claim is checked byte for byte over values built from the characters
// that drive the quoting decision.
//
// One divergence is deliberate and excluded: a value that starts with a
// document marker (`---` or `...`). The kit quotes it at every position,
// because at a line start it would end or open a document; `yaml` leaves it
// plain inside a mapping or sequence. Both read back as the same string.

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

// `indentSequences` matches the oracle's sequence layout; it does not touch quoting.
const auto = YamlStringifyOptions.make({ indentSequences: true, quoteStyle: "auto" });

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
]);

const Chars = S.Array(QuotingChar).check(S.isMinLength(1), S.isMaxLength(7));

const startsWithDocumentMarker = (value: string): boolean =>
  Str.startsWith("---")(value) || Str.startsWith("...")(value);

describe('quoteStyle "auto"', () => {
  it.effect.prop(
    "renders a mapping value and a sequence item exactly as the yaml writer does",
    [Arbitrary.schema(Chars)],
    ([chars]) =>
      Effect.gen(function* () {
        const value = A.join(chars, "");
        if (startsWithDocumentMarker(value)) return;
        const document = { k: value, l: [value] };
        const emitted = yield* Yaml.stringify(document, auto);
        strictEqual(emitted, stringify(document, { lineWidth: 0 }));
        assertSuccess(Yaml.parseResult(emitted), parse(emitted));
      }),
    runs
  );

  it.effect.prop(
    "renders a mapping key exactly as the yaml writer does",
    [Arbitrary.schema(Chars)],
    ([chars]) =>
      Effect.gen(function* () {
        const key = A.join(chars, "");
        if (startsWithDocumentMarker(key)) return;
        const document = { [key]: 1 };
        strictEqual(yield* Yaml.stringify(document, auto), stringify(document, { lineWidth: 0 }));
      }),
    runs
  );
});
