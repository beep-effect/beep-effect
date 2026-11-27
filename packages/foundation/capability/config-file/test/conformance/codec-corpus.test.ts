import { JsoncCodec } from "@beep/config-file/JsoncCodec";
import { TomlCodec } from "@beep/config-file/TomlCodec";
import { YamlCodec } from "@beep/config-file/YamlCodec";
import { TomlLocalDate, TomlLocalDateTime, TomlLocalTime, TomlOffsetDateTime } from "@beep/toml/TomlDateTime";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as jsoncParser from "jsonc-parser";
import { parse as parseToml } from "smol-toml";
import { parseDocument } from "yaml";
import { corpusFixtures, corpusText } from "../support/codec-corpus.ts";
import type { ConfigCodec } from "@beep/config-file/ConfigCodec";

const isTomlTemporal = P.or(
  P.or(S.is(TomlLocalDate), S.is(TomlLocalTime)),
  P.or(S.is(TomlLocalDateTime), S.is(TomlOffsetDateTime))
);

const dropFractionalSeconds = Str.replace(/\.\d+(?=Z|[+-]\d{2}:\d{2}|$)/, "");

const normalize = (value: unknown): unknown => {
  if (isTomlTemporal(value)) return dropFractionalSeconds(String(value));
  if (P.isDate(value)) return dropFractionalSeconds(value.toISOString());
  if (A.isArray(value)) return A.map(value, normalize);
  return P.isReadonlyObject(value) ? R.map(value, normalize) : value;
};

const jsoncOracle = (text: string): unknown => {
  const errors: Array<jsoncParser.ParseError> = [];
  const value = jsoncParser.parse(text, errors, { allowTrailingComma: true });
  expect(errors).toEqual([]);
  return value;
};

const yamlOracle = (text: string): unknown => {
  const document = parseDocument(text);
  expect(document.errors).toEqual([]);
  return document.toJS();
};

interface Lane {
  readonly codec: ConfigCodec;
  readonly oracle: (text: string) => unknown;
}

const lanes: Readonly<Record<string, Lane>> = {
  jsonc: { codec: JsoncCodec, oracle: jsoncOracle },
  yaml: { codec: YamlCodec, oracle: yamlOracle },
  toml: { codec: TomlCodec, oracle: parseToml },
};

const laneOf = (lane: string): Lane => O.getOrThrow(R.get(lanes, lane));

describe("codec corpus: real repo config files parsed by each codec and compared with its npm reference parser", () => {
  it("holds the frozen corpus for every codec", () => {
    const counts = R.map(lanes, (_, lane) => A.length(A.filter(corpusFixtures, (fixture) => fixture.lane === lane)));
    expect(counts).toEqual({ jsonc: 4, yaml: 5, toml: 3 });
  });

  describe.each(corpusFixtures)("$lane/$name", ({ lane, text }) => {
    it.effect("parses to the oracle's document", () =>
      Effect.gen(function* () {
        const { codec, oracle } = laneOf(lane);
        const parsed = yield* codec.parse(text);
        expect(
          normalize(parsed),
          "temporals compare without fractional seconds: smol-toml keeps milliseconds, the package nanoseconds"
        ).toEqual(normalize(oracle(text)));
      })
    );

    it.effect("round-trips through stringify", () =>
      Effect.gen(function* () {
        const { codec } = laneOf(lane);
        const parsed = yield* codec.parse(text);
        const stringify1 = yield* codec.stringify(parsed);
        const reparsed = yield* codec.parse(stringify1);
        expect(normalize(reparsed)).toEqual(normalize(parsed));
      })
    );
  });

  it.effect("keeps a plain multi-line scalar whose continuation line starts with a quote", () =>
    Effect.gen(function* () {
      const parsed = yield* YamlCodec.parse(corpusText("yaml/quote-led-continuation.yaml"));
      expect(parsed).toEqual({ a: 'x "y"', b: "x 'y'", c: 'x, "y"];', d: 1 });
    })
  );
});
