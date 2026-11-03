/**
 * Token position-fidelity conformance (#129).
 *
 * The invariant the whole lint layer rests on: every diagnostic position and
 * every autofix span is a token position. The public `text` field is the raw
 * source slice BY CONSTRUCTION (see YamlToken.ts), so the falsifiable
 * invariant pinned here is the COVERAGE contract: across every
 * yaml-test-suite fixture — valid AND invalid alike, since the tokenizer is
 * total — the tokens must be in order and non-overlapping, every gap between
 * consecutive tokens must be horizontal-whitespace-only (the lexer consumes
 * some insignificant whitespace without emitting a token, e.g. the run
 * before a `:` indicator), every non-whitespace source unit must be covered,
 * and each token's `line`/`character` must agree with a direct scan.
 */

import { YamlTokens } from "@beep/yaml";
import { parseCSTAll } from "@beep/yaml/internal/cst-parser";
import { assert, describe, it } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import { identity } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { loadAllTestCases } from "./support/suite.ts";
import type { YamlToken } from "@beep/yaml";

const UnknownJson = S.fromJsonString(S.Unknown);

const allCases = loadAllTestCases();

/** Zero-based line/character of `offset` by direct scan. */
function positionOf(text: string, offset: number): { line: number; character: number } {
  let line = 0;
  let lineStart = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, character: offset - lineStart };
}

type CorpusCase = (typeof allCases)[number];

// Ordered and non-overlapping; any gap must be horizontal
// whitespace only. (Synthetic zero-length structural markers
// sit AT the cursor.)
function checkTokenTiling(tc: CorpusCase, token: YamlToken, cursor: number): void {
  if (token.offset < cursor) {
    assert.fail(`[${tc.id}] ${token.kind}@${token.offset}: overlaps previous token ending at ${cursor}`);
  }
  if (token.offset > cursor && !/^[ \t\r]*$/.test(Str.slice(cursor, token.offset)(tc.yaml))) {
    assert.fail(
      `[${tc.id}] ${token.kind}@${token.offset}: non-whitespace gap ${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(Str.slice(cursor, token.offset)(tc.yaml)), identity)}`
    );
  }
}

function checkTokenText(tc: CorpusCase, token: YamlToken): void {
  if (token.text !== Str.slice(token.offset, token.offset + token.length)(tc.yaml)) {
    assert.fail(`[${tc.id}] ${token.kind}@${token.offset}: text disagrees with its slice`);
  }
}

function checkTokenPosition(tc: CorpusCase, token: YamlToken): void {
  const pos = positionOf(tc.yaml, token.offset);
  if (pos.line !== token.line || pos.character !== token.character) {
    assert.fail(
      `[${tc.id}] ${token.kind}@${token.offset}: claimed ${token.line}:${token.character}, actual ${pos.line}:${pos.character}`
    );
  }
}

/** Check one fixture's token stream; returns the number of tokens checked. */
function checkCaseTokens(tc: CorpusCase): number {
  const result = YamlTokens.tokenize(tc.yaml);
  // The tokenizer is total: error-kind tokens, never a failure.
  assertSuccess(result, Result.getOrThrow(result));
  let cursor = 0;
  for (const token of result.success) {
    checkTokenTiling(tc, token, cursor);
    checkTokenText(tc, token);
    checkTokenPosition(tc, token);
    cursor = token.offset + token.length;
  }
  // Full coverage: nothing but horizontal whitespace may follow the
  // last token.
  if (cursor < tc.yaml.length && !/^[ \t\r\n]*$/.test(Str.slice(cursor)(tc.yaml))) {
    assert.fail(`[${tc.id}] tokens cover ${cursor} of ${tc.yaml.length} source units`);
  }
  return result.success.length;
}

describe("token position fidelity (yaml-test-suite corpus)", () => {
  it("tokens cover every fixture: ordered, non-overlapping, whitespace-only gaps", () => {
    let tokensChecked = 0;
    for (const tc of allCases) {
      tokensChecked += checkCaseTokens(tc);
    }
    // The corpus is large; a vacuous walk would be a false green. (The
    // full suite yields ~6.4k tokens today; the floor only guards against
    // an accidentally-empty walk, not an exact count.)
    assert.isAbove(tokensChecked, 5_000, "corpus walk must actually check tokens");
  });
});

describe("EOF source fidelity regressions", () => {
  for (const source of ["hello  ", "a: hello \t", "- hello  ", "hello  # comment", "a: hello  \r\nb: world  "]) {
    it(`tiles token and CST spans through EOF for ${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(source), identity)}`, () => {
      const tokens = Result.getOrThrow(YamlTokens.tokenize(source));
      let cursor = 0;
      for (const token of tokens) {
        assert.strictEqual(token.offset, cursor);
        assert.strictEqual(token.text, Str.slice(token.offset, token.offset + token.length)(source));
        cursor += token.length;
      }
      assert.strictEqual(cursor, source.length);
      assert.strictEqual(
        A.join(
          A.map(tokens, (token) => token.text),
          ""
        ),
        source
      );
      const documents = parseCSTAll(source);
      assert.strictEqual(
        A.join(
          A.map(documents, (document) => document.source),
          ""
        ),
        source
      );
      assert.strictEqual(documents[0]?.offset, 0);
      assert.strictEqual(documents[0]?.length, source.length);
    });
  }
});
