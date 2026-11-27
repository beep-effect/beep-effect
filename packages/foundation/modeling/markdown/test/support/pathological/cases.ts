// Ported from cmark-gfm@0.29.0.gfm.13 (https://github.com/github/cmark-gfm)
// Source: test/pathological_tests.py
// Copyright: John MacFarlane
// License: BSD-2-Clause (https://github.com/github/cmark-gfm/blob/master/COPYING)
// Port notes: every case in upstream's `pathological` dict is carried over
// AS DATA except the already-disabled "many references" entry (commented out
// upstream itself, never active). The "tables" case — upstream's one
// GFM-extension case — joined in P2 and runs under the `gfm` dialect. Construction (repeat counts,
// nesting shapes) and expected-output regexes are preserved faithfully,
// translated from Python `re` syntax to JS `RegExp` syntax 1:1 — no pattern
// was loosened or tightened. "reference collisions" replicates upstream's
// `hash_collisions()` helper exactly: a bad hash function operating over
// BigInt with Python's infinite-precision two's-complement masking semantics
// (verified against a live `python3` run of the same algorithm — identical
// bad_key and document for COUNT=50000, REFMAP_SIZE=16). Upstream's 5-second
// per-case TIMEOUT is widened to the house-standard 8000ms per case (see the
// plan's Task 2 step 2).

import * as A from "effect/Array";
import * as Str from "effect/String";

interface PathologicalCase {
  readonly dialect?: "gfm";
  readonly expectedPattern: RegExp;
  readonly input: string;
  readonly name: string;
  readonly timeoutMs: number;
}

const TIMEOUT_MS = 8000;

const quadraticTableScanInput = Str.repeat(30000)("aaa\rbbb\n-\u000b\n");

const hashCollisions = (): { readonly document: string; readonly badKey: string } => {
  const REFMAP_SIZE = 16n;
  const MASK32 = 0xffffffffn;
  const COUNT = 50000;

  const keyCodePoints = (i: number): ReadonlyArray<number> =>
    A.prepend(
      A.map(Str.split(String(i), ""), (digit) => 0x30 + Number(digit)),
      0x78
    );

  const hashesToBucketZero = (codePoints: ReadonlyArray<number>): boolean => {
    let h = 0n;
    for (const codePoint of codePoints) {
      const code = BigInt(codePoint);
      const a = (h << 6n) & MASK32;
      const b = (h << 16n) & MASK32;
      h = code + a + b - h;
      h = h & MASK32;
    }
    return h % REFMAP_SIZE === 0n;
  };

  const collisions: Array<string> = [];
  let i = 0;
  while (collisions.length < COUNT) {
    if (hashesToBucketZero(keyCodePoints(i))) {
      collisions.push(`x${i}`);
    }
    i++;
  }

  const [badKey, ...rest] = collisions;
  if (badKey === undefined) {
    throw new Error("hashCollisions: no collisions found (unreachable for COUNT=50000)");
  }

  const document = A.join(
    A.map(rest, (key) => `[${key}]: /url\n\n[${badKey}]\n\n`),
    ""
  );
  return { document, badKey };
};

const { document: hashCollisionsDocument, badKey: hashCollisionsBadKey } = hashCollisions();

/**
 * The cmark-gfm pathological-input suite, carried over as data (CommonMark
 * cases only — GFM-extension-dependent cases join in P2). Every case is a
 * linear-time guarantee: a correct implementation produces output matching
 * `expectedPattern` well within `timeoutMs`; a quadratic-or-worse
 * implementation times out or produces mismatched output.
 */
export const PATHOLOGICAL_CASES: ReadonlyArray<PathologicalCase> = [
  {
    name: "nested strong emph",
    input: `${Str.repeat(65000)("*a **a ")}b${Str.repeat(65000)(" a** a*")}`,
    expectedPattern: /(<em>a <strong>a ){65000}b( a<\/strong> a<\/em>){65000}/,
    timeoutMs: TIMEOUT_MS,
  },
  {
    name: "many emph closers with no openers",
    input: Str.repeat(65000)("a_ "),
    expectedPattern: /(a[_] ){64999}a_/,
    timeoutMs: TIMEOUT_MS,
  },
  {
    name: "many emph openers with no closers",
    input: Str.repeat(65000)("_a "),
    expectedPattern: /(_a ){64999}_a/,
    timeoutMs: TIMEOUT_MS,
  },
  {
    name: "many link closers with no openers",
    input: Str.repeat(65000)("a]"),
    expectedPattern: /(a\]){65000}/,
    timeoutMs: TIMEOUT_MS,
  },
  {
    name: "many link openers with no closers",
    input: Str.repeat(65000)("[a"),
    expectedPattern: /(\[a){65000}/,
    timeoutMs: TIMEOUT_MS,
  },
  {
    name: "mismatched openers and closers",
    input: Str.repeat(50000)("*a_ "),
    expectedPattern: /([*]a[_] ){49999}[*]a_/,
    timeoutMs: TIMEOUT_MS,
  },
  {
    name: "openers and closers multiple of 3",
    input: `a**b${Str.repeat(50000)("c* ")}`,
    expectedPattern: /a[*][*]b(c[*] ){49999}c[*]/,
    timeoutMs: TIMEOUT_MS,
  },
  {
    name: "link openers and emph closers",
    input: Str.repeat(50000)("[ a_"),
    expectedPattern: /(\[ a_){50000}/,
    timeoutMs: TIMEOUT_MS,
  },
  {
    name: "pattern [ (]( repeated",
    input: Str.repeat(80000)("[ (]("),
    expectedPattern: /(\[ \(\]\(){80000}/,
    timeoutMs: TIMEOUT_MS,
  },
  {
    name: "pattern ![[]() repeated",
    input: Str.repeat(160000)("![[]()"),
    expectedPattern: /(!\[<a href=""><\/a>){160000}/,
    timeoutMs: TIMEOUT_MS,
  },
  {
    name: "hard link/emph case",
    input: "**x [a*b**c*](d)",
    expectedPattern: /\*\*x <a href="d">a<em>b\*\*c<\/em><\/a>/,
    timeoutMs: TIMEOUT_MS,
  },
  {
    name: "nested brackets",
    input: `${Str.repeat(50000)("[")}a${Str.repeat(50000)("]")}`,
    expectedPattern: /\[{50000}a\]{50000}/,
    timeoutMs: TIMEOUT_MS,
  },
  {
    name: "nested block quotes",
    input: `${Str.repeat(50000)("> ")}a`,
    expectedPattern: /(<blockquote>\n){50000}/,
    timeoutMs: TIMEOUT_MS,
  },
  {
    name: "deeply nested lists",
    input: A.join(
      A.makeBy(1000, (x) => `${Str.repeat(x)("  ")}* a\n`),
      ""
    ),
    expectedPattern: /<ul>\n(<li>a\n<ul>\n){999}<li>a<\/li>\n<\/ul>\n(<\/li>\n<\/ul>\n){999}/,
    timeoutMs: TIMEOUT_MS,
  },
  {
    name: "U+0000 in input",
    input: "abc\u0000de\u0000",
    expectedPattern: /abc\uFFFD?de\uFFFD?/,
    timeoutMs: TIMEOUT_MS,
  },
  {
    name: "backticks",
    input: A.join(
      A.makeBy(4999, (x) => `e${Str.repeat(x + 1)("`")}`),
      ""
    ),
    expectedPattern: /^<p>[e`]*<\/p>\n$/,
    timeoutMs: TIMEOUT_MS,
  },
  {
    name: "unclosed links A",
    input: Str.repeat(30000)("[a](<b"),
    expectedPattern: /(\[a\]\(&lt;b){30000}/,
    timeoutMs: TIMEOUT_MS,
  },
  {
    name: "unclosed links B",
    input: Str.repeat(30000)("[a](b"),
    expectedPattern: /(\[a\]\(b){30000}/,
    timeoutMs: TIMEOUT_MS,
  },
  {
    name: "unclosed <!--",
    input: `</${Str.repeat(300000)("<!--")}`,
    expectedPattern: /&lt;\/(&lt;!--){300000}/,
    timeoutMs: TIMEOUT_MS,
  },
  {
    name: "reference collisions",
    input: hashCollisionsDocument,
    expectedPattern: new RegExp(`(<p>\\[${hashCollisionsBadKey}\\]<\\/p>\\n){49999}`),
    timeoutMs: TIMEOUT_MS,
  },
  {
    name: "tables",
    input: quadraticTableScanInput,
    expectedPattern: new RegExp(
      "^<p>aaa</p>\\n<table>\\n<thead>\\n<tr>\\n<th>bbb</th>\\n</tr>\\n</thead>\\n<tbody>\\n" +
        "(<tr>\\n<td>aaa</td>\\n</tr>\\n<tr>\\n<td>bbb</td>\\n</tr>\\n<tr>\\n<td>-\\u000b</td>\\n</tr>\\n){29999}" +
        "</tbody>\\n</table>\\n$"
    ),
    timeoutMs: TIMEOUT_MS,
    dialect: "gfm",
  },
];
