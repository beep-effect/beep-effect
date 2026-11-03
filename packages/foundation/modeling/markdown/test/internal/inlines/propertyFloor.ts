import { identity } from "effect/Function";
// The property floors the inline construct suites share. Two shapes:
//
// - `describePropertyFloor`: for each source template, with `{w}` replaced by
//   a generated word, surgical heading edits leave the untouched source
//   byte-identical, canonical formatting is idempotent, and a stringify round
//   trip preserves every semantic mdast field.
// - `describeConstructFloor`: over a generated source, the round trip and
//   canonical formatting preserve inline meaning, marker normalization is
//   idempotent, and the README surgical-edit guarantee holds.
//
// The constructs differ only in the sources that exercise them.

import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Markdown, MarkdownDialect, MarkdownParseOptions } from "@beep/markdown/Markdown";
import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import { MarkdownEdit } from "@beep/markdown/MarkdownEdit";
import { MarkdownFormat, MarkdownFormattingOptions } from "@beep/markdown/MarkdownFormat";
import { Heading, Text } from "@beep/markdown/MarkdownNode";
import { Mdast } from "@beep/markdown/Mdast";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { MarkdownParseError } from "@beep/markdown/Markdown";
import type { Root } from "@beep/markdown/MarkdownNode";

/**
 * How a floor parses one source under one dialect.
 *
 * @category testing
 * @since 0.0.0
 */
export type FloorParse = (source: string, dialect: MarkdownDialect) => Effect.Effect<Root, MarkdownParseError>;

/**
 * The run count every floor property uses.
 *
 * @category testing
 * @since 0.0.0
 */
export const floorRuns = { arbitrary: fcRuns(100) };

/**
 * A generated word mixing ASCII, a combining-free accented letter, an astral
 * emoji and a digit, always starting with `x` so it is never empty.
 *
 * @category testing
 * @since 0.0.0
 */
const floorWord = S.Literals(["a", "b", "é", "😀", "9"]).pipe(
  S.Array,
  Arbitrary.schema,
  Arbitrary.map((letters) => `x${A.join(letters, "")}`)
);

/**
 * A generated word of `prefix` plus the hex code points of an arbitrary
 * string: arbitrary input spelled in characters no construct claims.
 *
 * @category testing
 * @since 0.0.0
 */
export const codePointWord = (prefix: string) =>
  Arbitrary.schema(S.String).pipe(
    Arbitrary.map(
      (value) =>
        `${prefix}${A.join(
          A.map(A.fromIterable(value), (char) => O.getOrThrow(Str.codePointAt(char, 0)).toString(16)),
          ""
        )}`
    )
  );

const isArray = S.is(S.Array(S.Unknown));
const isRecord = S.is(S.Record(S.String, S.Unknown));

/**
 * `value` with every `position` field removed, recursively: positions refer
 * to different source spellings after canonical serialization, so a round
 * trip compares every other mdast field.
 *
 * @category testing
 * @since 0.0.0
 */
const withoutPositions = (value: unknown): unknown => {
  if (isArray(value)) return A.map(value, withoutPositions);
  if (isRecord(value)) return R.map(R.remove(value, "position"), withoutPositions);
  return value;
};

const parseDocument: FloorParse = (source, dialect) => Markdown.parse(source, MarkdownParseOptions.make({ dialect }));

/**
 * Declare the floor for one construct: `templates` spell its sources, with
 * `{w}` standing for the generated word, and `parse` defaults to a full
 * document parse.
 *
 * @category testing
 * @since 0.0.0
 */
export const describePropertyFloor = ({
  name,
  templates,
  parse = parseDocument,
}: {
  readonly name: string;
  readonly templates: ReadonlyArray<string>;
  readonly parse?: FloorParse;
}): void => {
  const sources = (word: string): ReadonlyArray<string> => A.map(templates, Str.replaceAll("{w}", word));
  const dialects = Arbitrary.schema(MarkdownDialect);

  describe(`${name} parser property floor`, () => {
    it.effect.prop(
      "surgical heading edits keep unrelated inline spelling and whitespace byte-identical",
      [floorWord, dialects],
      ([word, dialect]) =>
        Effect.gen(function* () {
          for (const fragment of sources(word)) {
            const suffix = `\n\n<!-- untouched -->\n\n${fragment}\n`;
            const doc = yield* MarkdownDocument.parse(`# Original${suffix}`, MarkdownParseOptions.make({ dialect }));
            const target = doc.root.children[0];
            if (target === undefined) assert.fail("expected heading");
            const changed = yield* MarkdownFormat.modifyToString(
              doc,
              target,
              Heading.make({ depth: 1, children: [Text.make({ value: "Changed" })] })
            );
            assert.strictEqual(changed, `# Changed${suffix}`);
          }
        }),
      floorRuns
    );
    it.effect.prop(
      "canonical formatting is idempotent",
      [floorWord, dialects],
      ([word, dialect]) =>
        Effect.gen(function* () {
          for (const source of sources(word)) {
            const parsed1 = yield* parse(source, dialect);
            const formatted = yield* Markdown.stringify(parsed1);
            const parsed6 = yield* parse(formatted, dialect);
            const stringify2 = yield* Markdown.stringify(parsed6);
            assert.strictEqual(stringify2, formatted);
          }
        }),
      floorRuns
    );
    it.effect.prop(
      "parse(stringify(parse(x))) preserves every semantic mdast field",
      [floorWord, dialects],
      ([word, dialect]) =>
        Effect.gen(function* () {
          for (const source of sources(word)) {
            const parsed = yield* parse(source, dialect);
            const rendered = yield* Markdown.stringify(parsed);
            const reparsed = yield* parse(rendered, dialect);
            assert.deepStrictEqual(withoutPositions(Mdast.toMdast(reparsed)), withoutPositions(Mdast.toMdast(parsed)));
          }
        }),
      floorRuns
    );
  });
};

/**
 * The fields the canonical renderer may respell — positions and concrete
 * marker spelling — which inline meaning ignores.
 */
const RESPELLED_FIELDS: ReadonlyArray<string> = [
  "position",
  "headingStyle",
  "markerChar",
  "fenceChar",
  "fenceLength",
  "bulletChar",
  "delimiter",
  "breakStyle",
];

/**
 * A tree's inline meaning: its JSON with every respelled field dropped.
 *
 * @category testing
 * @since 0.0.0
 */
const inlineMeaning = (root: unknown): string =>
  Result.getOrThrowWith(
    S.encodeUnknownResult(
      S.fromJsonString(S.Unknown, {
        replacer: (key, value: unknown) => (A.contains(RESPELLED_FIELDS, key) ? undefined : value),
      })
    )(root),
    identity
  );

/**
 * Declare the meaning-preservation floor for one construct over `sources`.
 *
 * @category testing
 * @since 0.0.0
 */
export const describeConstructFloor = ({
  name,
  sources,
}: {
  readonly name: string;
  readonly sources: Arbitrary.Arbitrary<string>;
}): void => {
  describe(`${name} parser property floor`, () => {
    it.effect.prop(
      "parse(stringify(parse(x))) preserves inline meaning",
      [sources],
      ([source]) =>
        Effect.gen(function* () {
          const parsed = yield* Markdown.parse(source);
          const canonical = yield* Markdown.stringify(parsed);
          const reparsed = yield* Markdown.parse(canonical);
          assert.deepStrictEqual(inlineMeaning(reparsed), inlineMeaning(parsed));
        }),
      floorRuns
    );

    it.effect.prop(
      "canonical inline formatting is idempotent",
      [sources],
      ([source]) =>
        Effect.gen(function* () {
          const parsed3 = yield* Markdown.parse(source);
          const once = yield* Markdown.stringify(parsed3);
          const parsed4 = yield* Markdown.parse(once);
          const twice = yield* Markdown.stringify(parsed4);
          assert.strictEqual(twice, once);
        }),
      floorRuns
    );

    it.effect.prop(
      "marker normalization is idempotent and preserves inline meaning",
      [sources],
      ([source]) =>
        Effect.gen(function* () {
          const options = MarkdownFormattingOptions.make({ emphasisChar: "_" });
          const once = MarkdownFormat.formatToString(source, undefined, options);
          assert.strictEqual(MarkdownFormat.formatToString(once, undefined, options), once);
          const parsed5 = yield* Markdown.parse(once);
          const argument = inlineMeaning(parsed5);
          const parsed2 = yield* Markdown.parse(source);
          assert.deepStrictEqual(argument, inlineMeaning(parsed2));
        }),
      floorRuns
    );

    it.effect.prop(
      "README surgical-edit guarantee preserves surrounding bytes",
      [sources, Arbitrary.schema(S.String)],
      ([inline, replacement]) =>
        Effect.gen(function* () {
          const source = `<!-- keep  spacing -->\n\n# Target\n\n${inline}\n\n<!-- keep tail -->\n`;
          const doc = yield* MarkdownDocument.parse(source);
          const target = doc.find("text");
          if (target === undefined) return assert.fail("expected heading text");
          const edits = yield* MarkdownFormat.modify(doc, target, replacement);
          const edit = edits[0];
          if (edit === undefined) return assert.fail("expected replacement edit");
          const changed = MarkdownEdit.applyAll(source, edits);
          assert.strictEqual(Str.slice(0, edit.offset)(changed), Str.slice(0, edit.offset)(source));
          assert.strictEqual(
            Str.slice(edit.offset + edit.content.length)(changed),
            Str.slice(edit.offset + edit.length)(source)
          );
          yield* Markdown.parse(changed);
        }),
      floorRuns
    );
  });
};
