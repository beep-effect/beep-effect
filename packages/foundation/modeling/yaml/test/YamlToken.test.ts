import { identity } from "effect/Function";
// YamlToken / YamlTokens (#129): the public positioned token stream — the
// sync Result primitive, the derived Stream form, the field reconciliation
// (internal value/column → public text/character), and the total-tokenizer
// contract (error-kind tokens in the success array, never a failure).

import { YamlToken, YamlTokens } from "@beep/yaml";
import { assert, describe, it } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const tokensOf = (text: string): ReadonlyArray<YamlToken> => {
  const result = YamlTokens.tokenize(text);
  assertSuccess(result, Result.getOrThrow(result));
  return result.success;
};

describe("YamlTokens", () => {
  describe("tokenize (sync Result primitive)", () => {
    it("produces positioned tokens with the public field vocabulary", () => {
      const tokens = tokensOf("a: 1 # note\n");
      assert.isAbove(tokens.length, 0);
      for (const token of tokens) {
        assert.isTrue(S.is(YamlToken)(token));
        // The reconciled spelling: text/character, never value/column.
        assert.isString(token.text);
        assert.isNumber(token.character);
        assert.notProperty(token, "value");
        assert.notProperty(token, "column");
        assert.strictEqual(Str.slice(token.offset, token.offset + token.length)("a: 1 # note\n"), token.text);
      }
    });

    it("covers the source: ordered spans, whitespace-only gaps, byte-faithful slices", () => {
      const source = "name: deploy\non:\n  push: # only main\n    branches:\n      - main\n";
      let cursor = 0;
      for (const token of tokensOf(source)) {
        assert.isAtLeast(token.offset, cursor, "tokens must not overlap");
        assert.match(Str.slice(cursor, token.offset)(source), /^[ \t\r]*$/, "gaps must be whitespace-only");
        cursor = token.offset + token.length;
      }
      assert.strictEqual(cursor, source.length);
    });

    it("reports line/character zero-based, matching the diagnostic vocabulary", () => {
      const tokens = tokensOf("a: 1\nb: 2\n");
      const b = O.getOrUndefined(A.findFirst(tokens, (t) => t.text === "b"));
      assert.isDefined(b);
      assert.strictEqual(b?.line, 1);
      assert.strictEqual(b?.character, 0);
    });

    it("tokenizes comments as comment-kind tokens carrying the raw # slice", () => {
      const comment = O.getOrUndefined(A.findFirst(tokensOf("a: 1 # note\n"), (t) => t.kind === "comment"));
      assert.isDefined(comment);
      assert.strictEqual(comment?.text, "# note");
    });

    it("is TOTAL: malformed input succeeds with error-kind tokens, never a failure", () => {
      // The reserved failure channel must not fire — linting has to run on
      // documents that do not parse (parse-validity exists for exactly that).
      const result = YamlTokens.tokenize("a: [unclosed\n\tb:\t:");
      assertSuccess(result, Result.getOrThrow(result));
    });

    it("tokenizes the empty string to an empty array", () => {
      assert.deepStrictEqual(tokensOf(""), []);
    });
  });

  describe("stream (derived form)", () => {
    it.effect("yields exactly the primitive's tokens in order", () =>
      Effect.gen(function* () {
        const source = "steps:\n  - build\n  - test\n";
        const streamed = yield* Stream.runCollect(YamlTokens.stream(source));
        assert.deepStrictEqual([...streamed], [...tokensOf(source)]);
      })
    );

    it.effect("supports partial consumption via Stream.take", () =>
      Effect.gen(function* () {
        const first = yield* Stream.runCollect(Stream.take(YamlTokens.stream("a: 1\nb: 2\n"), 2));
        assert.strictEqual([...first].length, 2);
      })
    );
  });

  describe("YamlToken schema", () => {
    it("decodes and re-encodes through the class codec", () => {
      const token = YamlToken.make({ kind: "scalar", text: "a", offset: 0, length: 1, line: 0, character: 0 });
      const encoded = Result.getOrThrow(S.encodeResult(YamlToken)(token));
      const decoded = Result.getOrThrow(S.decodeResult(YamlToken)(encoded));
      assert.deepStrictEqual(decoded, token);
    });
  });
});

describe("public token CR positions", () => {
  for (const newline of ["\r", "\r\n", "\n"]) {
    it(`uses one line break for ${Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(newline), identity)}`, () => {
      const source = `a: 1${newline}  b: 2${newline}c: 3${newline}`;
      const keys = A.filter(tokensOf(source), (token) => ["a", "b", "c"].includes(token.text));
      assert.deepStrictEqual(
        A.map(keys, (token) => [token.text, token.line, token.character]),
        [
          ["a", 0, 0],
          ["b", 1, 2],
          ["c", 2, 0],
        ]
      );
      assert.strictEqual(A.filter(tokensOf(source), (token) => token.kind === "newline").length, 3);
    });
  }
  it("indexes adjacent lone CR and CRLF breaks separately", () => {
    const key = O.getOrUndefined(A.findFirst(tokensOf("a: 1\r\r\nb: 2"), (token) => token.text === "b"));
    assert.strictEqual(key?.line, 2);
    assert.strictEqual(key?.character, 0);
  });
});
