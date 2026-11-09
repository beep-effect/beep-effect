// Oracle-differential semantic expectations for block-structure boundaries.
//
// WHY THIS FILE EXISTS: kit-round-trip tests (parse → format → parse with our
// own engine) are structurally blind to parse bugs the formatter is faithful
// to — when the parser mis-nests a document, the formatter faithfully re-emits
// the mis-nesting and the round-trip matches. The shipped P0 (a trailing
// comment on the LAST key of a nested block mapping swallowed the following
// dedent, silently absorbing the next sibling key) survived every fixed-point
// fixture for exactly that reason. These expectations were authored against an
// INDEPENDENT reference parser, so a shared-defect round-trip cannot go green.
//
// Provenance (ORACLE.md convention, parity with fixtures/explicit-key):
// - Oracle: `yaml@2.9.0` (`YAML.parse` defaults; `parseAllDocuments` for the
//   multi-document case)
// - Authored: 2026-08-12, offline, in a scratch script outside the test run
// - Plain-scalar continuation group: authored 2026-10-23 against `yaml@2.9.1`
//   the same way (effected-promotion wave 3, W3-d)
// - Compact-sequence and block-scalar-item groups: authored 2026-10-23
//   against `yaml@2.9.1` the same way (#2131)
// - Value-less flow mapping key group: authored 2026-10-23 against
//   `yaml@2.9.1` the same way (#2142); the `!!set` row expects this parser's
//   plain-object projection of the oracle's two-member `Set`
// - Compact explicit key group: authored 2026-11-08 against `yaml@2.9.1` the
//   same way. Its deeper-`:` rows are invalid under the spec's s-indent(n) rule
//   and pin the oracle's tolerance. A collection key has no comparable
//   plain-object projection, so those shapes are pinned at the AST level in
//   composer-regressions.test.ts.
// - Case matrix extended from the savvy-web-systems dogfood sweep of the same
//   date (51 cases, double-oracle: yaml@2.9.0 + js-yaml@4.3.1, a case counted
//   only where both agreed)
// - The oracles are NOT dependencies of this suite — the committed expected
//   literals are the contract. Never regenerate them with our own parser.
//
// Coverage: a trailing comment in every structural position where a block
// boundary follows — last key of a nested map before dedent-to-key, before
// dedent-to-scalar, before EOF (with and without a final newline), before
// `---`, before `...`, last item of a nested sequence before dedent, last key
// before a deeper sibling, inside flow before `}` / `]`, around a
// block-scalar body before dedent — plus the control rows that isolated the
// P0 and hardening variants (CRLF, 4-space indent, quoted values, comment
// text containing `:` / `#` / tab, blank line before the dedent).

import { Yaml, YamlFormat } from "@beep/yaml";
import { assert, describe, it } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";

interface OracleCase {
  /** Expected parsed value, authored from `yaml@2.9.0` — see file header. */
  readonly expected: unknown;
  readonly input: string;
  readonly name: string;
}

const controlCases: ReadonlyArray<OracleCase> = [
  {
    name: "no comment (control)",
    input: "outer:\n  a: 1\n  b: 2\nsibling:\n  c: 3\n",
    expected: { outer: { a: 1, b: 2 }, sibling: { c: 3 } },
  },
  {
    name: "trailing comment on a NON-last key (control)",
    input: "outer:\n  a: 1 # note\n  b: 2\nsibling:\n  c: 3\n",
    expected: { outer: { a: 1, b: 2 }, sibling: { c: 3 } },
  },
  {
    name: "comment on its own line (control)",
    input: "outer:\n  a: 1\n  b: 2\n  # note\nsibling:\n  c: 3\n",
    expected: { outer: { a: 1, b: 2 }, sibling: { c: 3 } },
  },
];

const dedentCases: ReadonlyArray<OracleCase> = [
  {
    name: "last key of a nested map, dedent to a mapping sibling (the P0 repro)",
    input: "outer:\n  a: 1\n  b: 2 # note\nsibling:\n  c: 3\n",
    expected: { outer: { a: 1, b: 2 }, sibling: { c: 3 } },
  },
  {
    name: "last key of a nested map, dedent to a scalar sibling",
    input: "outer:\n  a: 1\n  b: 2 # note\nsibling: 3\n",
    expected: { outer: { a: 1, b: 2 }, sibling: 3 },
  },
  {
    name: "three levels deep, dedent one level then to top",
    input: "l1:\n  l2:\n    a: 1\n    b: 2 # note\n  s2: 9\ntop: 0\n",
    expected: { l1: { l2: { a: 1, b: 2 }, s2: 9 }, top: 0 },
  },
  {
    name: "two levels of dedent in one step",
    input: "a:\n  b:\n    c: 1 # note\nd: 2\n",
    expected: { a: { b: { c: 1 } }, d: 2 },
  },
  {
    name: "three levels of dedent in one step",
    input: "a:\n  b:\n    c:\n      d: 1 # note\ne: 2\n",
    expected: { a: { b: { c: { d: 1 } } }, e: 2 },
  },
  {
    name: "last key before a DEEPER sibling",
    input: "a:\n  b: 1 # note\n  c:\n    d: 2\ne: 3\n",
    expected: { a: { b: 1, c: { d: 2 } }, e: 3 },
  },
  {
    name: "last item of a nested sequence before dedent",
    input: "outer:\n  items:\n    - a\n    - b # note\nsibling: 1\n",
    expected: { outer: { items: ["a", "b"] }, sibling: 1 },
  },
];

const streamBoundaryCases: ReadonlyArray<OracleCase> = [
  {
    name: "trailing comment before EOF",
    input: "outer:\n  b: 2 # note\n",
    expected: { outer: { b: 2 } },
  },
  {
    name: "trailing comment before EOF without a final newline",
    input: "outer:\n  b: 2 # note",
    expected: { outer: { b: 2 } },
  },
  {
    name: "trailing comment before a document-end marker (...)",
    input: "outer:\n  b: 2 # note\n...\n",
    expected: { outer: { b: 2 } },
  },
];

const hardeningCases: ReadonlyArray<OracleCase> = [
  {
    name: "double-quoted value with trailing comment before dedent",
    input: 'outer:\n  b: "2" # note\nsibling: 3\n',
    expected: { outer: { b: "2" }, sibling: 3 },
  },
  {
    name: "single-quoted value with trailing comment before dedent",
    input: "outer:\n  b: '2' # note\nsibling: 3\n",
    expected: { outer: { b: "2" }, sibling: 3 },
  },
  {
    name: "comment text containing a colon",
    input: "outer:\n  b: 2 # a: b\nsibling: 3\n",
    expected: { outer: { b: 2 }, sibling: 3 },
  },
  {
    name: "comment text containing a second #",
    input: "outer:\n  b: 2 # a # b\nsibling: 3\n",
    expected: { outer: { b: 2 }, sibling: 3 },
  },
  {
    name: "bare # comment",
    input: "outer:\n  b: 2 #\nsibling: 3\n",
    expected: { outer: { b: 2 }, sibling: 3 },
  },
  {
    name: "comment then a blank line then dedent",
    input: "outer:\n  b: 2 # note\n\nsibling: 3\n",
    expected: { outer: { b: 2 }, sibling: 3 },
  },
  {
    name: "4-space indentation",
    input: "outer:\n    a: 1\n    b: 2 # note\nsibling: 3\n",
    expected: { outer: { a: 1, b: 2 }, sibling: 3 },
  },
  {
    name: "CRLF line endings",
    input: "outer:\r\n  b: 2 # note\r\nsibling: 3\r\n",
    expected: { outer: { b: 2 }, sibling: 3 },
  },
  {
    name: "tab inside the comment text",
    input: "outer:\n  b: 2 # \tnote\nsibling: 3\n",
    expected: { outer: { b: 2 }, sibling: 3 },
  },
];

const flowAndBlockScalarCases: ReadonlyArray<OracleCase> = [
  {
    name: "trailing comment after an inline flow map, sibling follows",
    input: "m: { a: 1 } # note\nsibling: 2\n",
    expected: { m: { a: 1 }, sibling: 2 },
  },
  {
    name: "trailing comment after an inline flow seq, sibling follows",
    input: "s: [1, 2] # note\nsibling: 2\n",
    expected: { s: [1, 2], sibling: 2 },
  },
  // The closing bracket sits INDENTED (YAML 1.2 §7.4 requires flow content
  // in a block value to be indented past the block level). A `}`/`]` at
  // column 0 in this position is a KNOWN pre-existing strictness divergence:
  // our engine rejects it with a typed InvalidIndentation while yaml@2.9.0
  // accepts it leniently. That divergence is comment-independent (the
  // no-comment control fails identically) and is tracked as issue #340.
  {
    name: "comment inside a multi-line flow map before }",
    input: "m: {\n  a: 1 # note\n  }\nsibling: 2\n",
    expected: { m: { a: 1 }, sibling: 2 },
  },
  {
    name: "comment inside a multi-line flow seq before ]",
    input: "s: [\n  1 # note\n  ]\nsibling: 2\n",
    expected: { s: [1], sibling: 2 },
  },
  {
    name: "block-scalar body before dedent (no comment — boundary control)",
    input: "outer:\n  text: |\n    line1\n    line2\nsibling: 3\n",
    expected: { outer: { text: "line1\nline2\n" }, sibling: 3 },
  },
  {
    name: "block-scalar header comment, body, then dedent",
    input: "outer:\n  text: | # note\n    line1\nsibling: 3\n",
    expected: { outer: { text: "line1\n" }, sibling: 3 },
  },
  {
    name: "# inside a block-scalar body is content, not a comment",
    input: "outer:\n  text: |\n    body # not a comment\nsibling: 3\n",
    expected: { outer: { text: "body # not a comment\n" }, sibling: 3 },
  },
];

// The #339 family: an empty value whose pair ends at the line boundary. The
// next line's key was composed as the VALUE of the empty pair, and the
// orphaned `:` then paired with an empty-string key — the same shred
// signature as the trailing-comment defect but a distinct mechanism (the
// composer's consumeValueNode, not the CST parser's value loop; these fail
// identically with and without a comment).
const emptyValueCases: ReadonlyArray<OracleCase> = [
  {
    name: "empty value then a sibling key",
    input: "key:\nother: 1\n",
    expected: { key: null, other: 1 },
  },
  {
    name: "empty value with a trailing comment then a sibling key",
    input: "key: # c\nother: 1\n",
    expected: { key: null, other: 1 },
  },
  {
    name: "two empty values then a sibling key",
    input: "a:\nb:\nc: 1\n",
    expected: { a: null, b: null, c: 1 },
  },
  {
    name: "empty value then a sibling with a nested mapping value",
    input: "key:\nother:\n  x: 1\n",
    expected: { key: null, other: { x: 1 } },
  },
  {
    // The GitHub-workflow trigger pattern: a nested empty value, then a
    // dedent to the next top-level key.
    name: "nested empty value then dedent (workflow trigger shape)",
    input: "on:\n  workflow_dispatch:\njobs:\n  build: 1\n",
    expected: { on: { workflow_dispatch: null }, jobs: { build: 1 } },
  },
  {
    name: "empty value at deeper nesting then a multi-level dedent",
    input: "a:\n  b:\n    c:\nd: 1\n",
    expected: { a: { b: { c: null } }, d: 1 },
  },
  {
    name: "empty value as the last key before EOF",
    input: "a:\n  b:\n",
    expected: { a: { b: null } },
  },
  {
    // The over-correction guard: a MORE-indented next line is this pair's
    // legitimate nested value, not a sibling — must keep parsing as before.
    name: "empty-looking value whose next line is more indented (nested value)",
    input: "key:\n  nested: 1\n",
    expected: { key: { nested: 1 } },
  },
];

const realWorldCases: ReadonlyArray<OracleCase> = [
  {
    // The claude.yml workflow excerpt from the downstream P0 report:
    // a trailing comment on the last key of a 5-entry nested map, then a
    // dedent to a sibling key. The corrupted parse put `steps` INSIDE
    // `permissions` and shredded its value; GitHub Actions, yaml@2.9.0 and
    // js-yaml all agree on this structure.
    name: "workflow permissions/steps excerpt",
    input:
      "permissions:\n" +
      "  contents: read\n" +
      "  pull-requests: read\n" +
      "  issues: read\n" +
      "  id-token: write\n" +
      "  actions: read # Required for Claude to read CI results on PRs\n" +
      "steps:\n" +
      "  - name: Checkout repository\n",
    expected: {
      permissions: {
        contents: "read",
        "pull-requests": "read",
        issues: "read",
        "id-token": "write",
        actions: "read",
      },
      steps: [{ name: "Checkout repository" }],
    },
  },
];

// YAML 1.2 s-ns-plain-next-line admits any ns-plain-char at the start of a
// continuation line, so a quote or another indicator there is scalar text.
// The engine used to lex such a line as a new quoted scalar, block scalar or
// flow collection, which split the value into stray keys or swallowed the
// following siblings, with no diagnostic.
const plainContinuationCases: ReadonlyArray<OracleCase> = [
  { name: "double-quote-led continuation", input: 'a: x\n  "y"\n', expected: { a: 'x "y"' } },
  { name: "single-quote-led continuation", input: "a: x\n  'y'\n", expected: { a: "x 'y'" } },
  {
    name: "quote-led continuation with flow indicators, then a sibling",
    input: 'a: x,\n  "y"];\nb: 1\n',
    expected: { a: 'x, "y"];', b: 1 },
  },
  { name: "sequence entry continuation", input: '- x\n  "y"\n', expected: ['x "y"'] },
  { name: "compact mapping continuation", input: '- a: x\n    "b"\n', expected: [{ a: 'x "b"' }] },
  { name: "unclosed quote spanning two continuation lines", input: 'a: x\n  "y\n  z"\n', expected: { a: 'x "y z"' } },
  { name: "blank line before the continuation", input: 'a: x\n\n  "y"\n', expected: { a: 'x\n"y"' } },
  { name: "document-root continuation", input: 'x\n"y"\n', expected: 'x "y"' },
  { name: "explicit key continuation", input: '? x\n  "y"\n: z\n', expected: { 'x "y"': "z" } },
  { name: "block-scalar indicator continuation", input: "a: x\n  | y\nb: 1\n", expected: { a: "x | y", b: 1 } },
  { name: "bare block-scalar indicator continuation", input: "a: x\n  |\nb: 1\n", expected: { a: "x |", b: 1 } },
  { name: "flow-opening continuation keeps the sibling", input: "a: x\n  [y\nb: 1\n", expected: { a: "x [y", b: 1 } },
  { name: "explicit-key indicator continuation", input: "a: x\n  ? y\nb: 1\n", expected: { a: "x ? y", b: 1 } },
  { name: "flow sequence continuation", input: "[x\n 'y', z]\n", expected: ["x 'y'", "z"] },
  { name: "flow mapping continuation", input: '{a: x\n "b"}\n', expected: { a: 'x "b"' } },
  { name: "CRLF continuation", input: 'a: x\r\n  "y"\r\nb: 1\r\n', expected: { a: 'x "y"', b: 1 } },
  {
    name: "tab separation after the indentation",
    input: 'a: x\n  \t"y"\nb: 1\n',
    expected: { a: 'x "y"', b: 1 },
  },
  { name: "tab separation after a one-space indentation", input: "a: x\n \t'y'\n", expected: { a: "x 'y'" } },
  {
    name: "tab separation before a block-scalar indicator",
    input: "a: x\n  \t|y\nb: 1\n",
    expected: { a: "x |y", b: 1 },
  },
  { name: "tab separation in a compact mapping", input: '- a: x\n   \t"b"\n', expected: [{ a: 'x "b"' }] },
  { name: "tab separation in a flow sequence", input: '[x\n \t"y"]\n', expected: ['x "y"'] },
  { name: "tab-led document-root continuation", input: 'x\n\t"y"\n', expected: 'x "y"' },
  {
    name: "flow mapping key spanning a quote-led line",
    input: '{x\n "y"\n : 1}\n',
    expected: { 'x "y"': 1 },
  },
  {
    name: "flow mapping key spanning a quote-led line with trailing text",
    input: '{x\n "y" z\n : 1}\n',
    expected: { 'x "y" z': 1 },
  },
  { name: "quoted key at the mapping indent (control)", input: 'a: x\n"y": 1\n', expected: { a: "x", y: 1 } },
  {
    name: "quoted key in a compact mapping (control)",
    input: '- a: x\n  "b": 1\n',
    expected: [{ a: "x", b: 1 }],
  },
  {
    name: "quoted key in a nested mapping (control)",
    input: 'a:\n  b: x\n  "c": 1\n',
    expected: { a: { b: "x", c: 1 } },
  },
];

// YAML 1.2 lets a block mapping value be a block sequence at the mapping's
// own indent (l+block-sequence(n-1), "compact" indentation). Inside a
// sequence item the mapping's keys sit past the dash, and the lexer opens the
// scope only for the first such sequence, so a second key with a compact
// sequence value failed with InvalidIndentation (#2131).
const compactSequenceInItemCases: ReadonlyArray<OracleCase> = [
  { name: "the #2131 repro", input: "- a:\n  - 0\n  b:\n  - false\n", expected: [{ a: [0], b: [false] }] },
  {
    name: "a third key with a compact sequence",
    input: "- a:\n  - 0\n  b:\n  - false\n  c:\n  - x\n  - y\n",
    expected: [{ a: [0], b: [false], c: ["x", "y"] }],
  },
  {
    name: "a comment between the keys",
    input: "- a:\n  - 0\n  # note\n  b:\n  - false\n",
    expected: [{ a: [0], b: [false] }],
  },
  {
    name: "flow values beside compact sequences",
    input: "- a:\n  - 0\n  b: [1, 2]\n  c:\n  - {x: 1}\n",
    expected: [{ a: [0], b: [1, 2], c: [{ x: 1 }] }],
  },
  { name: "under a top-level mapping", input: "p:\n  - a:\n    - 0\n    b: 1\n", expected: { p: [{ a: [0], b: 1 }] } },
  {
    name: "under a top-level mapping, two compact sequences",
    input: "p:\n  - a:\n    - 0\n    b:\n    - 1\n",
    expected: { p: [{ a: [0], b: [1] }] },
  },
  { name: "inside a nested sequence", input: "- - a:\n    - 0\n    b:\n    - 1\n", expected: [[{ a: [0], b: [1] }]] },
  {
    name: "mapping items inside the compact sequence",
    input: "- a:\n  - x: 1\n    y: 2\n  b:\n  - 3\n",
    expected: [{ a: [{ x: 1, y: 2 }], b: [3] }],
  },
  {
    name: "a deeper sequence after a compact one",
    input: "- a:\n  - 0\n  b:\n   - 1\n",
    expected: [{ a: [0], b: [1] }],
  },
  {
    name: "two sequence items",
    input: "- a:\n  - 0\n  b:\n  - 1\n- c:\n  - 2\n  d:\n  - 3\n",
    expected: [
      { a: [0], b: [1] },
      { c: [2], d: [3] },
    ],
  },
  { name: "wide entry indentation", input: "-   a:\n    - 0\n    b:\n    - 1\n", expected: [{ a: [0], b: [1] }] },
];

// A block scalar's token swallows the line breaks of its body, so the
// implicit-mapping lookahead for a sequence item ran past it and took the
// next line's `key:` for the item's own value indicator: `a:\n- >-\n  x\nb: 1`
// parsed as `{a: [{x: null, b: 1}]}` with no diagnostic, and the indented
// spelling failed (found by the #2131 corpus differential).
const blockScalarItemCases: ReadonlyArray<OracleCase> = [
  { name: "folded strip item before a sibling", input: "a:\n- >-\n  x\nb: 1\n", expected: { a: ["x"], b: 1 } },
  { name: "literal item before a flow sibling", input: "a:\n- |\n  x\nb: []\n", expected: { a: ["x\n"], b: [] } },
  {
    name: "two folded items before a sibling",
    input: "a:\n- >-\n  x\n- >-\n  y\nb: 1\n",
    expected: { a: ["x", "y"], b: 1 },
  },
  { name: "indented sequence before a sibling", input: "a:\n  - >-\n    x\nb: 1\n", expected: { a: ["x"], b: 1 } },
  { name: "tagged item before a sibling", input: "a:\n- !!str >-\n  x\nb: 1\n", expected: { a: ["x"], b: 1 } },
  { name: "anchored item before a sibling", input: "a:\n- &k |\n  x\nb: 1\n", expected: { a: ["x\n"], b: 1 } },
  { name: "key-shaped body line stays scalar text", input: "- |\n  x\n  y: 1\n", expected: ["x\ny: 1\n"] },
  {
    name: "keep-chomp item in an indented sequence",
    input: "m:\n  - |+\n    text\n\nb: 1\n",
    expected: { m: ["text\n\n"], b: 1 },
  },
];

// YAML 1.2 ns-flow-map-implicit-entry: a `,` or `}` after a plain implicit
// key ends the entry with an empty value. The plain-scalar collector ran on
// across the comma, so `{a, b}` parsed as `{"a b": null}` and `{a: 1, b}` as
// `{a: "1 b"}`; a `:` directly before the comma let the next key become its
// value, so `{a: , b}` parsed as `{a: "b"}` (#2142).
const flowValuelessKeyCases: ReadonlyArray<OracleCase> = [
  { name: "two value-less keys (the #2142 repro)", input: "{a, b}\n", expected: { a: null, b: null } },
  { name: "a value-less key after a pair", input: "{a: 1, b}\n", expected: { a: 1, b: null } },
  { name: "three value-less keys", input: "{a, b, c}\n", expected: { a: null, b: null, c: null } },
  { name: "quoted then plain key (control)", input: '{"a", b}\n', expected: { a: null, b: null } },
  { name: "a value-less key before a pair (control)", input: "{a, b: 1}\n", expected: { a: null, b: 1 } },
  { name: "a value-less key between pairs", input: "{a: 1, b, c: 2}\n", expected: { a: 1, b: null, c: 2 } },
  { name: "no space after the comma", input: "{a,b}\n", expected: { a: null, b: null } },
  { name: "space before the comma", input: "{a , b}\n", expected: { a: null, b: null } },
  { name: "trailing comma", input: "{a, b,}\n", expected: { a: null, b: null } },
  { name: "mixed quoting", input: "{\"a\": 1, b, 'c'}\n", expected: { a: 1, b: null, c: null } },
  { name: "tagged key", input: "{!!str a, b}\n", expected: { a: null, b: null } },
  { name: "explicit keys", input: "{? a, b}\n", expected: { a: null, b: null } },
  { name: "the !!set spelling keeps both members", input: "!!set {a, b}\n", expected: { a: null, b: null } },
  {
    name: "nested flow map value",
    input: "{a, b: {c, d}, e}\n",
    expected: { a: null, b: { c: null, d: null }, e: null },
  },
  {
    name: "flow sequence value before a value-less key",
    input: "{a: [b, c], d}\n",
    expected: { a: ["b", "c"], d: null },
  },
  { name: "flow maps inside a flow sequence", input: "[{a, b}, {c}]\n", expected: [{ a: null, b: null }, { c: null }] },
  { name: "flow map as a block mapping value", input: "k: {a, b}\n", expected: { k: { a: null, b: null } } },
  { name: "flow map as a block sequence item", input: "- {a, b}\n- c\n", expected: [{ a: null, b: null }, "c"] },
  { name: "comma at the end of a line", input: "{a,\n b}\n", expected: { a: null, b: null } },
  { name: "multi-line flow map", input: "{\n  a,\n  b: 1,\n  c\n}\n", expected: { a: null, b: 1, c: null } },
  { name: "comment after the comma", input: "{a, # note\n b}\n", expected: { a: null, b: null } },
  { name: "multi-line plain key (control)", input: "{a\n b, c}\n", expected: { "a b": null, c: null } },
  { name: "multi-line plain value before a key", input: "{a: x\n  y, b}\n", expected: { a: "x y", b: null } },
  { name: "empty value before a plain key", input: "{a: , b}\n", expected: { a: null, b: null } },
  { name: "empty value before a pair", input: "{a:, b: 1}\n", expected: { a: null, b: 1 } },
  { name: "empty value before a quoted key", input: '{a: , "b"}\n', expected: { a: null, b: null } },
  { name: "empty value on its own line", input: "{a:\n, b}\n", expected: { a: null, b: null } },
  { name: "two empty values", input: "{a: , b: , c}\n", expected: { a: null, b: null, c: null } },
  { name: "empty key and empty value", input: "{: , b}\n", expected: { "": null, b: null } },
  { name: "tagged empty value (control)", input: "{a: !!str , b}\n", expected: { a: "", b: null } },
];

// A `?` that opens its mapping mid-line, after a sequence indicator, and the
// `:` that has to find it again from a later line.
const compactExplicitKeyCases: ReadonlyArray<OracleCase> = [
  { name: "in a sequence item", input: "- ? k\n  : v\n", expected: [{ k: "v" }] },
  { name: "two entries in a sequence item", input: "- ? k\n  : v\n  ? l\n  : w\n", expected: [{ k: "v", l: "w" }] },
  { name: "in a nested sequence item", input: "x:\n  - ? k\n    : v\n", expected: { x: [{ k: "v" }] } },
  {
    name: "after an implicit entry, with a compact sequence value",
    input: "- a: 1\n  ? b\n  : - 2\n",
    expected: [{ a: 1, b: [2] }],
  },
  { name: "value indicator deeper than the key", input: "? k\n : v\n", expected: { k: "v" } },
  { name: "value indicator deeper than a compact key", input: "- ? k\n   : v\n", expected: [{ k: "v" }] },
  {
    name: "value indicator deeper, after an implicit entry",
    input: "- a: 1\n  ? k\n    : v\n",
    expected: [{ a: 1, k: "v" }],
  },
  { name: "value-less key after a deeper value indicator", input: "? k\n  : v\n? l\n", expected: { k: "v", l: null } },
];

const groups: ReadonlyArray<readonly [string, ReadonlyArray<OracleCase>]> = [
  ["controls", controlCases],
  ["dedent after a trailing comment", dedentCases],
  ["stream boundaries", streamBoundaryCases],
  ["hardening variants", hardeningCases],
  ["flow and block-scalar boundaries", flowAndBlockScalarCases],
  ["empty values before a sibling key", emptyValueCases],
  ["real-world shapes", realWorldCases],
  ["plain-scalar continuation lines", plainContinuationCases],
  ["compact sequence values in sequence-item mappings", compactSequenceInItemCases],
  ["block scalar sequence items before a sibling", blockScalarItemCases],
  ["value-less flow mapping keys", flowValuelessKeyCases],
  ["compact explicit keys", compactExplicitKeyCases],
];

describe("oracle-differential (yaml@2.9.0 semantic expectations)", () => {
  for (const [groupName, cases] of groups) {
    describe(groupName, () => {
      for (const { name, input, expected } of cases) {
        it.effect(name, () =>
          Effect.gen(function* () {
            const value = yield* Yaml.parse(input);
            assert.deepStrictEqual(value, expected);
          })
        );
      }
    });
  }

  describe("multi-document boundaries", () => {
    it.effect("trailing comment before a document-start marker (---)", () =>
      Effect.gen(function* () {
        const docs = yield* Yaml.parseAll("outer:\n  b: 2 # note\n---\nnext: 1\n");
        assert.deepStrictEqual(docs, [{ outer: { b: 2 } }, { next: 1 }]);
      })
    );
  });

  // ── Format properties over the whole battery ────────────────────────────
  //
  // A parse-only differential is structurally blind to format-round-trip
  // defects (the keep-chomp growth shipped past this file untouched), so the
  // two properties that WOULD have caught it — and the original P0's write
  // side, and the %TAG orphaning — run here over every input above:
  //
  //   1. IDEMPOTENCE: format(format(x)) === format(x). A formatter that
  //      moves on the second pass is rewriting content, not style.
  //   2. MEANING-PRESERVATION: parse(format(x)) deep-equals parse(x). When
  //      format refuses an input it returns it byte-identical, so the
  //      property holds trivially — asserted, not skipped.
  describe("format properties", () => {
    const allInputs: ReadonlyArray<readonly [string, string]> = [
      ...A.flatMap(groups, ([groupName, cases]) => A.map(cases, (c) => [`${groupName}: ${c.name}`, c.input] as const)),
      ["multi-document boundaries: trailing comment before ---", "outer:\n  b: 2 # note\n---\nnext: 1\n"],
    ];

    for (const [name, input] of allInputs) {
      it(`idempotence — ${name}`, () => {
        const once = YamlFormat.formatToString(input);
        const twice = YamlFormat.formatToString(once);
        assert.strictEqual(twice, once);
      });

      it(`meaning preservation — ${name}`, () => {
        const before = Yaml.parseAllResult(input);
        const after = Yaml.parseAllResult(YamlFormat.formatToString(input));
        assertSuccess(before, Result.getOrThrow(before));
        assertSuccess(after, Result.getOrThrow(before));
        assert.deepStrictEqual(Result.getOrThrow(after), Result.getOrThrow(before));
      });
    }
  });
});
