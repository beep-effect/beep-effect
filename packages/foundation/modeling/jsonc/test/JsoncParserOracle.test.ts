// `jsonc-parser` oracle for the formatter and the formatted modifier.
//
// WHY THIS FILE EXISTS: `JsoncFormatter.format` and
// `JsoncModifier.modifyWithFormatting` are ports of Microsoft's `jsonc-parser`
// 3.3.1 `format` and `modify` (README deviation 15 and "Added exports"). The
// repo-cli JSONC editing facade and its pretty JSON renderer moved onto them
// when `jsonc-parser` left `@beep/repo-cli` (effected-promotion R3b), so every
// edit they compute must match the npm package byte for byte. `jsonc-parser`
// is a devDependency of this suite only. The repository-wide run of the same
// comparison (every tracked `*.json` and `*.jsonc` file) is
// `goals/effected-promotion/ops/jsonc-parser-drop-differential.ts`.

import {
  Jsonc,
  JsoncEdit,
  JsoncFormatter,
  JsoncModifier,
  JsoncPlacementError,
  JsoncRange,
  JsoncStringifyOptions,
} from "@beep/jsonc";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as jsoncParser from "jsonc-parser";

const formatting = { tabSize: 2, insertSpaces: true } as const;

const commented = A.join(
  [
    "{",
    "  // lead",
    '  "a" : 1 , // trailing',
    '  "b": [ ], "c": { },',
    '  /* own line */ "d": [1,2,{ "e": null }],',
    "",
    "",
    '  "f": "x" /* tail */',
    "}",
    "",
  ],
  "\n"
);

const corpus = [
  commented,
  '{"a":1,"b":[1,2,{"c":null}],"d":{},"e":[]}',
  '{\n  "a": 1,\n  "b": 2\n}\n',
  "[1, [2, [3]], {}]",
  '{\r\n  "a": 1\r\n}',
  "{}",
  "",
  "1  2",
  "] [1]",
  '{"a":1}}',
  '{\n\t"a": {\n\t\t"b": [1,\n\t\t2]\n\t}\n}',
  '{"a":\n1,\n"b"\n:2}',
  "[1\n// own line\n,2 /* tail */\n]",
  '{"a":1,\n/* c */\n"b":2 /* d */ , "c": 3}',
  "[1,\n\n\n2]",
  '{\r"a":1\r}',
  "[1, @, 2]",
  "/* a */ // b",
  '{"a": // c\n1}',
  '{"a":"\\q", "b":1}',
];

const triples = (edits: ReadonlyArray<{ offset: number; length: number; content: string }>) =>
  A.map(edits, (edit) => [edit.offset, edit.length, edit.content] as const);

const triplesToEdits = (edits: ReadonlyArray<JsoncEdit>): Array<jsoncParser.Edit> =>
  A.map(edits, (edit) => ({ offset: edit.offset, length: edit.length, content: edit.content }));

const oracleFormat = (text: string, options: jsoncParser.FormattingOptions, range?: jsoncParser.Range) =>
  triples(jsoncParser.format(text, range, options));

const kitFormat = (text: string, options: jsoncParser.FormattingOptions, range?: jsoncParser.Range) =>
  triples(JsoncFormatter.format(text, range === undefined ? undefined : JsoncRange.make(range), options));

const oracleModify = (
  text: string,
  path: ReadonlyArray<string | number>,
  value: unknown,
  options: jsoncParser.ModificationOptions
): Result.Result<string, string> =>
  Result.try({
    try: () => jsoncParser.applyEdits(text, jsoncParser.modify(text, [...path], value, options)),
    catch: String,
  });

const kitModify = (
  text: string,
  path: ReadonlyArray<string | number>,
  value: unknown,
  options: { readonly isArrayInsertion?: boolean; readonly insertionIndex?: number }
): Result.Result<string, string> =>
  JsoncModifier.modifyWithFormattingResult(text, path, value, { formattingOptions: formatting, ...options }).pipe(
    Result.map((edits) => JsoncEdit.applyAll(text, edits)),
    Result.mapError((error) => error._tag)
  );

describe("jsonc-parser oracle", () => {
  describe("JsoncFormatter.format", () => {
    it("matches jsonc-parser on the fixed corpus, whole and ranged, under every option set", () => {
      const optionSets: ReadonlyArray<jsoncParser.FormattingOptions> = [
        formatting,
        { tabSize: 4, insertSpaces: false, keepLines: true, insertFinalNewline: true },
        { tabSize: 2, insertSpaces: true, eol: "\r\n", insertFinalNewline: true },
        { tabSize: 0, insertSpaces: false },
      ];
      for (const text of corpus) {
        for (const options of optionSets) {
          assert.deepStrictEqual(kitFormat(text, options), oracleFormat(text, options));
          for (let offset = 0; offset < text.length; offset += 7) {
            const range = { offset, length: Math.min(5, text.length - offset) };
            assert.deepStrictEqual(kitFormat(text, options, range), oracleFormat(text, options, range));
          }
        }
      }
    });

    it.effect.prop("matches jsonc-parser on compact JSON", [Arbitrary.schema(S.Json)], ([value]) =>
      Effect.gen(function* () {
        const compact = yield* Jsonc.stringify(value, JsoncStringifyOptions.make({ tabSize: 0 }));
        assert.deepStrictEqual(kitFormat(compact, formatting), oracleFormat(compact, formatting));
      })
    );
  });

  describe("JsoncEdit.applyAll", () => {
    it("applies an insertion before a replacement at the same offset, as jsonc-parser does", () => {
      const text = "  {}";
      const edits = [
        JsoncEdit.make({ offset: 0, length: 0, content: "\n" }),
        JsoncEdit.make({ offset: 0, length: 2, content: "" }),
      ];
      assert.strictEqual(JsoncEdit.applyAll(text, edits), jsoncParser.applyEdits(text, triplesToEdits(edits)));
      assert.strictEqual(JsoncEdit.applyAll(text, A.reverse(edits)), "\n{}");
    });
  });

  describe("JsoncModifier.modifyWithFormatting", () => {
    const document =
      '{\n  "a": 1, // keep\n  "b": [1, 2],\n  "c": { "d": true },\n  "e": [],\n  "f": [9],\n  "o": {}\n}\n';
    const cases: ReadonlyArray<
      readonly [
        string,
        ReadonlyArray<string | number>,
        unknown,
        { readonly isArrayInsertion?: boolean; readonly insertionIndex?: number },
      ]
    > = [
      ["replace with a nested value", ["a"], { x: [1, {}], y: "z" }, {}],
      ["delete the first property", ["a"], undefined, {}],
      ["delete a middle property", ["b"], undefined, {}],
      ["delete the last property", ["e"], undefined, {}],
      ["append a property", ["z"], { n: null }, {}],
      ["insert a property first", ["z"], 0, { insertionIndex: 0 }],
      ["insert a property in the middle", ["z"], 0, { insertionIndex: 2 }],
      ["create missing parents", ["c", "p", "q"], [1], {}],
      ["delete a missing property", ["c", "nope"], undefined, {}],
      ["append an element", ["b", 2], "x", { isArrayInsertion: true }],
      ["insert an element first", ["b", 0], "x", { isArrayInsertion: true }],
      ["replace an element", ["b", 1], { k: [] }, {}],
      ["delete the first element", ["b", 0], undefined, {}],
      ["insert into an empty array", ["e", 0], 7, { isArrayInsertion: true }],
      ["delete the only element", ["f", 0], undefined, {}],
      ["insert into an empty object", ["o", "k"], "v", {}],
      ["create a key under an element", ["b", 0, "k"], 1, {}],
      ["create a key under a scalar", ["a", "x", "y"], 1, {}],
      ["create an array under a missing key", ["zz", 0], "x", {}],
      ["replace the whole document", [], { r: 1 }, {}],
    ];

    it("matches jsonc-parser on every edit shape", () => {
      for (const [, path, value, options] of cases) {
        const oracle = oracleModify(document, path, value, {
          formattingOptions: formatting,
          ...(options.isArrayInsertion === true ? { isArrayInsertion: true } : {}),
          ...(options.insertionIndex === undefined ? {} : { getInsertionIndex: () => options.insertionIndex ?? 0 }),
        });
        const throws = Result.mapError(() => "throws");
        assert.deepStrictEqual(throws(kitModify(document, path, value, options)), throws(oracle));
      }
    });

    it("deletes the last element without the character jsonc-parser cuts from it", () => {
      // jsonc-parser ends the removal two characters before the parent's end,
      // so a compact array joins its last two elements; the kit ends it at the element.
      for (const [text, upstream, kit] of [
        ["[1,2]", "[12]", "[1]"],
        ['["x","y"]', '["x""]', '["x"]'],
        ["[1, 2 // c\n]", "[1\n]", "[1 // c\n]"],
      ] as const) {
        assert.deepStrictEqual(oracleModify(text, [1], undefined, {}), Result.succeed(upstream));
        assert.deepStrictEqual(
          Result.map(JsoncModifier.modifyWithFormattingResult(text, [1], undefined), (edits) =>
            JsoncEdit.applyAll(text, edits)
          ),
          Result.succeed(kit)
        );
      }
    });

    it("fails typed where jsonc-parser throws", () => {
      assert.deepStrictEqual(kitModify(document, ["a", "x"], 1, {}), Result.fail("JsoncModificationError"));
      assert.deepStrictEqual(kitModify(document, ["nope", "x"], undefined, {}), Result.fail("JsoncPlacementError"));
      assert.deepStrictEqual(kitModify(document, ["b", 5], undefined, {}), Result.fail("JsoncPlacementError"));
      assert.deepStrictEqual(kitModify(document, ["z"], 1, { insertionIndex: 9 }), Result.fail("JsoncPlacementError"));
      assert.deepStrictEqual(kitModify(document, ["e", 0], undefined, {}), Result.fail("JsoncPlacementError"));
      assert.deepStrictEqual(kitModify(document, ["b", "x", "y"], 1, {}), Result.fail("JsoncModificationError"));
      assert.deepStrictEqual(kitModify(document, ["c", 0, "y"], 1, {}), Result.fail("JsoncModificationError"));
      assert.deepStrictEqual(kitModify("", ["a"], undefined, {}), Result.fail("JsoncPlacementError"));
      for (const path of [
        ["a", "x"],
        ["nope", "x"],
        ["b", 5],
      ]) {
        const outcome = oracleModify(document, path, path[0] === "a" ? 1 : undefined, {});
        assert.strictEqual(Result.match(outcome, { onFailure: () => "throws", onSuccess: () => "edits" }), "throws");
      }
    });

    it("skips a property without a value, as jsonc-parser does", () => {
      for (const text of ['{"a":, "b": 1}', '{"a", "b": 1}']) {
        assert.deepStrictEqual(
          kitModify(text, ["b"], 2, {}),
          oracleModify(text, ["b"], 2, { formattingOptions: formatting })
        );
      }
    });

    it("creates the document when the text is empty", () => {
      for (const text of ["", "  \n"]) {
        assert.deepStrictEqual(
          kitModify(text, ["a", "b"], [1], {}),
          oracleModify(text, ["a", "b"], [1], { formattingOptions: formatting })
        );
      }
    });

    it("renders a placement failure with its path and reason", () => {
      assert.strictEqual(
        JsoncPlacementError.make({ path: ["a", 3], reason: "IndexOutOfRange" }).message,
        "Modification failed at path [a, 3]: IndexOutOfRange"
      );
    });

    it("returns the raw compact edit without formatting options", () => {
      const edits = Result.getOrThrow(JsoncModifier.modifyWithFormattingResult('{"a":1}', ["a"], { b: [1] }));
      assert.deepStrictEqual(triples(edits), triples(jsoncParser.modify('{"a":1}', ["a"], { b: [1] }, {})));
      assert.deepStrictEqual(triples(edits), [[5, 1, '{"b":[1]}']]);
    });

    it.effect("runs as an Effect with the same edits", () =>
      Effect.gen(function* () {
        const edits = yield* JsoncModifier.modifyWithFormatting(document, ["b"], undefined, {
          formattingOptions: formatting,
        });
        assert.deepStrictEqual(
          triples(yield* JsoncModifier.modifyWithFormatting('{"a":1}', ["a"], 2)),
          triples(jsoncParser.modify('{"a":1}', ["a"], 2, {}))
        );
        assert.strictEqual(
          JsoncEdit.applyAll(document, edits),
          Result.getOrThrow(oracleModify(document, ["b"], undefined, { formattingOptions: formatting }))
        );
      })
    );
  });
});
