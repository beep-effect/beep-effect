import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { RequoteScalarInput, requoteScalarText } from "@beep/yaml/internal/requote";
import { renderSingleQuoted } from "@beep/yaml/internal/stringifier";
import { Yaml } from "@beep/yaml/Yaml";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const printable = S.Literals(["a", " ", "'", '"', "\\", "é", "#", ":", "[", "]", "😀"]).pipe(
  S.Array,
  Arbitrary.schema,
  Arbitrary.map(A.join(""))
);

it.effect.prop(
  "escaping requote preserves the parsed value and is idempotent",
  [printable],
  ([value]) =>
    Effect.gen(function* () {
      const text = renderSingleQuoted(value);
      const converted = O.getOrUndefined(
        requoteScalarText(
          text,
          RequoteScalarInput.make({ value, style: "single-quoted", offset: 0, length: text.length }),
          '"',
          "escaping"
        )
      );
      assert.isDefined(converted);
      if (converted === undefined) return;
      const parsed = yield* Yaml.parse(converted);
      const parsed1 = yield* Yaml.parse(text);
      assert.deepStrictEqual(parsed, parsed1);
      assert.strictEqual(parsed, value);
      assert.strictEqual(
        O.getOrUndefined(
          requoteScalarText(
            converted,
            RequoteScalarInput.make({ value, style: "double-quoted", offset: 0, length: converted.length }),
            '"',
            "escaping"
          )
        ) ?? converted,
        converted
      );
      const restored = O.getOrUndefined(
        requoteScalarText(
          converted,
          RequoteScalarInput.make({ value, style: "double-quoted", offset: 0, length: converted.length }),
          "'",
          "escaping"
        )
      );
      assert.strictEqual(restored, text);
      const stringify5 = yield* Yaml.stringify(parsed);
      const parsed2 = yield* Yaml.parse(stringify5);
      assert.deepStrictEqual(parsed2, parsed);
    }),
  runs
);

it.effect.prop(
  "conservative quoting is byte-idempotent and preserves plain scalar values",
  [S.Literals(["a", "b", "c"]).pipe(S.Array, Arbitrary.schema)],
  ([chars]) =>
    Effect.gen(function* () {
      const value = `word${A.join(chars, "")}`;
      const converted = O.getOrUndefined(
        requoteScalarText(
          value,
          RequoteScalarInput.make({ value, style: "plain", offset: 0, length: value.length }),
          "'",
          "conservative"
        )
      );
      assert.isDefined(converted);
      if (converted === undefined) return;
      assert.strictEqual(
        O.getOrUndefined(
          requoteScalarText(
            converted,
            RequoteScalarInput.make({ value, style: "single-quoted", offset: 0, length: converted.length }),
            "'",
            "conservative"
          )
        ),
        converted
      );
      const parsed = yield* Yaml.parse(converted);
      const parsed3 = yield* Yaml.parse(value);
      assert.deepStrictEqual(parsed, parsed3);
      const stringify6 = yield* Yaml.stringify(parsed);
      const parsed4 = yield* Yaml.parse(stringify6);
      assert.deepStrictEqual(parsed4, parsed);
    }),
  runs
);

it.effect.prop(
  "escaping honours the README guarantee for plain, block, tagged, anchored and multiline scalars",
  [printable],
  ([value]) =>
    Effect.sync(() => {
      const quoted = renderSingleQuoted(value);
      const inputs: ReadonlyArray<readonly [string, RequoteScalarInput]> = [
        [
          quoted,
          RequoteScalarInput.make({
            value,
            style: "single-quoted",
            tag: "tag:yaml.org,2002:str",
            offset: 0,
            length: quoted.length,
          }),
        ],
        [
          quoted,
          RequoteScalarInput.make({ value, style: "single-quoted", anchor: "keep", offset: 0, length: quoted.length }),
        ],
        [value, RequoteScalarInput.make({ value, style: "plain", offset: 0, length: value.length })],
        [value, RequoteScalarInput.make({ value, style: "block-literal", offset: 0, length: value.length })],
        [
          `'${value}\nnext'`,
          RequoteScalarInput.make({ value, style: "single-quoted", offset: 0, length: quoted.length + 5 }),
        ],
      ];
      for (const [text, scalar] of inputs) {
        assert.strictEqual(O.getOrUndefined(requoteScalarText(text, scalar, '"', "escaping")), undefined);
      }
    }),
  runs
);
