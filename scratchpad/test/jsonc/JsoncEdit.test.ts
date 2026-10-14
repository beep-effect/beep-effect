import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import {
  JsoncEdit,
  JsoncEditOverlapError,
  JsoncFormattingOptions,
  JsoncFormattingOptionsLike,
  JsoncRange,
} from "../../effected/jsonc/index.ts";

describe("JsoncEdit", () => {
  describe("schemas", () => {
    it("JsoncRange and JsoncEdit validate non-negative spans", () => {
      assert.strictEqual(JsoncRange.make({ offset: 0, length: 4 }).length, 4);
      assert.isTrue(S.is(JsoncEdit)(JsoncEdit.make({ offset: 10, length: 0, content: ", true" })));
      assert.isFalse(S.is(JsoncEdit)({ offset: Number.NEGATIVE_INFINITY, length: 0, content: "" }));
    });

    it("constructs and decodes finite spans and overlap offsets, rejecting non-finite fields", () => {
      for (const value of [-1, 0.5, -0.5, Number.MAX_SAFE_INTEGER + 1]) {
        const span = { offset: value, length: value };
        const edit = { ...span, content: "" };
        const overlap = { lower: value, upper: value };
        assert.deepStrictEqual({ ...JsoncRange.make(span) }, span);
        assert.deepStrictEqual({ ...JsoncEdit.make(edit) }, edit);
        assert.strictEqual(JsoncEditOverlapError.make(overlap).lower, value);
        assertSuccess(Result.map(S.decodeResult(JsoncRange)(span), (decoded) => ({ ...decoded })), span);
        assertSuccess(Result.map(S.decodeResult(JsoncEdit)(edit), (decoded) => ({ ...decoded })), edit);
        assertSuccess(Result.map(S.decodeResult(JsoncEditOverlapError)({ _tag: "JsoncEditOverlapError", ...overlap }), (decoded) => [decoded.lower, decoded.upper]), [value, value]);
      }
      for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        for (const field of ["offset", "length"] as const) {
          const span = { offset: 0, length: 0, [field]: value };
          assert.throws(() => JsoncRange.make(span));
          assert.throws(() => JsoncEdit.make({ ...span, content: "" }));
          assertFailure(Result.mapError(S.decodeResult(JsoncRange)(span), (error) => error._tag), "SchemaError");
          assertFailure(Result.mapError(S.decodeResult(JsoncEdit)({ ...span, content: "" }), (error) => error._tag), "SchemaError");
        }
        for (const field of ["lower", "upper"] as const) {
          const overlap = { lower: 0, upper: 0, [field]: value };
          assert.throws(() => JsoncEditOverlapError.make(overlap));
          assertFailure(Result.mapError(S.decodeResult(JsoncEditOverlapError)({ _tag: "JsoncEditOverlapError", ...overlap }), (error) => error._tag), "SchemaError");
        }
      }
    });

    it("JsoncFormattingOptions defaults every field and accepts a literal through its Like schema", () => {
      assert.deepStrictEqual({ ...JsoncFormattingOptions.make({}) }, {
        tabSize: 2,
        insertSpaces: true,
        eol: "\n",
        insertFinalNewline: false,
        keepLines: false,
      });
      const like: JsoncFormattingOptionsLike = { eol: "\r\n" };
      assert.isTrue(S.is(JsoncFormattingOptionsLike)(like));
      assert.strictEqual(JsoncFormattingOptions.make(like).eol, "\r\n");
      assert.strictEqual(JsoncFormattingOptions.make(like).tabSize, 2);
    });

    it("JsoncEditOverlapError names both offsets", () => {
      const error = JsoncEditOverlapError.make({ lower: 0, upper: 2 });
      assert.strictEqual(error._tag, "JsoncEditOverlapError");
      assert.strictEqual(error.message, "JsoncEdit.applyAll received overlapping edits at offsets 0 and 2");
    });
  });

  describe("applyAllResult", () => {
    it("applies edits in reverse-offset order regardless of input order", () => {
      const edits = [
        JsoncEdit.make({ offset: 0, length: 1, content: "X" }),
        JsoncEdit.make({ offset: 4, length: 2, content: "YZ" }),
        JsoncEdit.make({ offset: 2, length: 0, content: "-" }),
      ];
      assertSuccess(JsoncEdit.applyAllResult("abcdef", edits), "Xb-cdYZ");
    });

    it("fails on overlapping edits with both offsets", () => {
      const result = JsoncEdit.applyAllResult("abcdef", [
        JsoncEdit.make({ offset: 0, length: 4, content: "x" }),
        JsoncEdit.make({ offset: 2, length: 3, content: "y" }),
      ]);
      assertFailure(result, JsoncEditOverlapError.make({ lower: 0, upper: 2 }));
    });

    it("reports negative and fractional overlapping offsets as a typed failure", () => {
      assertFailure(JsoncEdit.applyAllResult("abcdef", [
        JsoncEdit.make({ offset: -1, length: 3, content: "x" }),
        JsoncEdit.make({ offset: 0.5, length: 1, content: "y" }),
      ]), JsoncEditOverlapError.make({ lower: -1, upper: 0.5 }));
    });

    it("applies no edits as the identity", () => {
      assertSuccess(JsoncEdit.applyAllResult("abc", []), "abc");
    });
  });

  describe("applyAll", () => {
    it("applies a single replacement", () => {
      assert.strictEqual(
        JsoncEdit.applyAll('{ "a": 1 }', [JsoncEdit.make({ offset: 7, length: 1, content: "2" })]),
        '{ "a": 2 }'
      );
    });

    it("inserts with length 0 and deletes with empty content", () => {
      assert.strictEqual(JsoncEdit.applyAll("[]", [JsoncEdit.make({ offset: 1, length: 0, content: "1" })]), "[1]");
      assert.strictEqual(JsoncEdit.applyAll("[1,2]", [JsoncEdit.make({ offset: 2, length: 2, content: "" })]), "[1]");
    });

    it("touching (adjacent, non-overlapping) edits both apply", () => {
      assert.strictEqual(
        JsoncEdit.applyAll("abcdef", [
          JsoncEdit.make({ offset: 0, length: 3, content: "X" }),
          JsoncEdit.make({ offset: 3, length: 3, content: "Y" }),
        ]),
        "XY"
      );
    });

    it("overlapping edits throw the typed overlap error", () => {
      assert.throws(
        () =>
          JsoncEdit.applyAll("abcdef", [
            JsoncEdit.make({ offset: 0, length: 4, content: "x" }),
            JsoncEdit.make({ offset: 2, length: 3, content: "y" }),
          ]),
        JsoncEditOverlapError
      );
    });

    it("does not mutate the input array", () => {
      const edits = [JsoncEdit.make({ offset: 0, length: 0, content: "!" })];
      const snapshot = [...edits];
      JsoncEdit.applyAll("x", edits);
      assert.deepStrictEqual(edits, snapshot);
    });
  });
});
