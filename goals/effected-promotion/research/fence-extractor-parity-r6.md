# Fence-extractor parity: roadmap PR R6

Recorded 2026-10-31 for roadmap PR R6 of `goals/effected-promotion` (map site
#282, SPEC W4-q). Lane cut from `origin/main` `adedee335a`; the JSON record
(`fence-extractor-parity-r6.json`) was first written by
`ops/fence-extractor-parity.ts` at `d247e0e12a` and is now the review-round-1
record, written at `e5ca79c80b` (the lane merged with `origin/main`
`d4e134f672`) with a clean tree. Review round 1 added the `jsdoc-sections` and
`doctest` legs below and changed `scriptFences` to hand EffectImports the
CommonMark value.

## The W4-q gate

W4-q keeps R6 in the packet only if the `@beep/markdown` code-node-span
extension stays under about 400 lines. As built (commits `92a85ef710`, the
class example added at content-final, and the fenced-node guard and
constructed-fence test that bring `MarkdownFence.ts` to 100% branch coverage):

| Part | Lines |
| --- | --- |
| `src/MarkdownFence.ts` (`CodeFence` schema, `MarkdownFence.fences`, JSDoc) | 185 |
| `Code.unterminated` (schema key, encoded type, docs) in `src/internal/nodes.ts` | 9 |
| the parser flag (`internal/blocks/code.ts`, `internal/blockTypes.ts`) | 5 |
| `src/index.ts` barrel export and module note | 3 |
| `test/MarkdownFence.test.ts` | 164 |
| total | 366 |

The gate passes, so R6 adopts rather than defers.

## Fence sets, old extractor against new owner

Each old extractor is frozen verbatim in the ops script and runs beside its
replacement on two corpora: the 8,848 git-tracked Markdown files, and the
30,999 JSDoc blocks (of 55,136 in 8,698 tracked TypeScript files) that hold a
backtick or tilde run, unwrapped the way docgen, the JSDoc inventory and the
laws hand them to the extractors. Fences pair by opening fence; a pair is
identical only when every compared field (code, info string, offsets or lines,
extension) is byte-identical.

| Corpus | Extractor | Old fences | Identical | Classified differences | Unclassified |
| --- | --- | --- | --- | --- | --- |
| JSDoc | docgen | 31,070 | 31,062 | 8 `closer-differs` | 0 |
| JSDoc | typescript-fences | 31,070 | 31,070 | 0 | 0 |
| JSDoc | effect-imports-markdown | 31,070 | 31,070 | 0 | 0 |
| JSDoc | jsdoc-sections (comments) | 30,999 | 30,999 | 0 | 0 |
| Markdown | docgen | 2,428 | 2,363 | 53 `long-marker-run`, 31 `closing-line-indent`, 24 `closer-differs`, 9 `inside-other-fence`, 8 `marker-mid-line`, 5 `inside-container` | 0 |
| Markdown | typescript-fences | 2,490 | 2,443 | 32 `value-normalized`, 15 `inside-other-fence`, 5 `inside-container` | 0 |
| Markdown | effect-imports-markdown | 2,519 | 2,470 | 34 `value-normalized`, 15 `inside-other-fence`, 5 `inside-container`, 1 `closer-differs` | 0 |
| Source | doctest (scanned fences) | 27,661 | 202 | 27,451 `frame-indent-removed`, 8 `marker-mid-line` | 0 |
| Source | doctest (analyzer findings per fence) | 27,661 | 27,656 | 5 changed, all on `marker-mid-line` fences | 0 |

The new extractors report 0 parse failures (warnings) on both corpora.

docgen's unterminated-fence warnings fall from 27 to 9 on the Markdown corpus
(the old pattern called a fence unterminated whenever no later run of three
backticks or tildes followed it anywhere, so the count tracked marker runs, not
fences) and stay at 0 on the JSDoc corpus.

Every class is a place where the old pattern disagreed with CommonMark, the
reading GitHub renders and `@beep/markdown` implements:

- `closer-differs`: the old docgen pattern closed a fence at the first run of
  three backticks or tildes anywhere, including inside a body line (a string literal holding a
  fence, as in the JSDoc examples of docgen `Core.ts`, repo-cli
  `JSDocMigrateRewrite.ts`, `JSDocSections.ts`, `Provenance.ts` and
  `Quality.rubric.ts`) or a run of the other fence character. The new owner
  closes only on a line of the same character at least as long as the opening
  run, so those examples now carry their whole code. The one Markdown
  `effect-imports-markdown` case is the reverse: a fence the old pattern never
  closed (its closing run was longer than the opening run) and the new owner
  does.
- `long-marker-run`: a fence opened by four or more markers. The old docgen
  pattern consumed three and read the fourth as the start of the info string,
  so a four-backtick `ts` fence was never TypeScript to it.
- `closing-line-indent`: the same fence and code; the old `codeEnd` stopped at
  the closing marker, the new span stops at the start of the closing line, so
  an indented closing fence's indentation is no longer part of the body span.
- `marker-mid-line`: a three-backtick run inside prose or inline code that the
  old docgen pattern opened a fence on.
- `inside-other-fence`: a fence quoted inside another fence's body (a
  four-backtick `md` example holding a three-backtick `ts` block). The old
  line-anchored patterns read the quoted block as code; CommonMark reads it as
  the outer block's text.
- `inside-container`: a fence in a blockquote or list item the old patterns
  could not see (more than three columns in, or behind `>`), now found.
- `value-normalized`: `typescriptFences` and `scriptFences` hand the laws the
  code CommonMark reads, without the fence's indentation or container prefix
  (and with CRLF read as LF); the old pattern kept the raw lines. Spans and the
  opening line are unchanged. For EffectImports such a fence is also not
  `inPlace`, so a rewrite of it is reported for a hand edit instead of being
  spliced; none of the 34 holds a root Effect import.

### The jsdoc-sections and doctest legs (review round 1)

`jsdoc-sections` freezes the old `parseJSDocSections` (comment framing strip,
every fence line rewritten to `ts`, extraction through the old `fencePattern`,
each block's code regex-replaced with blank lines) and compares its section
list (name, title, line offset, body lines) with the live one for every
fence-bearing JSDoc comment: 30,999 of 30,999 identical. A differing comment
would be classified `old-mask-misread` only when the old mask demonstrably
misread a fence line or blanked a block's text outside its fence.

`doctest` freezes the old `scanSourceFences` (the in-place `maskJSDocStars`
mask, the old docgen pattern, the old section titles and the old line
arithmetic) over every tracked `packages/**/src` and `apps/**/src` file with a
marker run (3,789 files) and pairs its fences with
`scanDoctestFencesForTesting` by opening line, comparing code, first code line,
info string, closing line and Example title. Each paired fence then runs
through the live analyzer twice (`doctestFenceFindingsForTesting`, the old
fence with the new fence's owner symbol, an unchanged lookup keyed by the JSDoc
span), comparing each finding's kind, message, verdict and plan (expected info
string, marker and name edits, console rewrites).

- `frame-indent-removed` (27,451): the old mask replaced the `*` frame with
  spaces in place, so body lines 2 and later kept the frame's indentation; the
  new unwrap removes it per line. Everything else is equal and so are the
  findings of all 27,451. The record tallies this class without listing
  each fence.
- `marker-mid-line` (8): the old pattern closed the fence at a marker run inside
  a code line (a string literal holding a fence) in the examples of docgen
  `Core.ts` (2), repo-cli `JSDocMigrateRewrite.ts` (3), `JSDocSections.ts`,
  `Provenance.ts` and `Quality.rubric.ts`. The new code carries the whole
  example, so five of them gain their console rewrite plans, and docgen
  `Core.ts` "Preserve a TSX fence extension" now classifies as impure: its full
  code holds `<div />` in a string, which the analyzer's conservative JSX text
  heuristic reads as JSX (an impure fence is left out of runtime doctests).
  A finding change on any fence outside this class would count as unclassified.

## Cost (review round 1)

Every extractor now skips the parse when the text has no run of three
backticks or tildes (a fence needs one), which removes the parse for the
JSDoc blocks and Markdown files without one (24,137 of the 55,136 JSDoc
blocks). Whole-repository wall time on this workstation (load average 35 to
55 throughout, so single runs; `before` is the primary clone at `origin/main`
`d4e134f672`, `after` the lane):

| Command | Before | After |
| --- | --- | --- |
| `beep laws markdown-fences` | 12.0 s | 6.5 s |
| `beep laws schema-tag-idioms` | 9.0 s | 9.8 s |
| `beep laws effect-imports --mode markdown` | 3.7 s | 9.6 s |
| `beep quality jsdoc-inventory` (to scratch outputs) | 421.2 s | 399.9 s |

The CommonMark parse costs the Markdown-mode import law about 6 s per run; the
other three are within run-to-run noise, and the inventory, which reads each
JSDoc block's fences up to four times, is dominated by its ts-morph pass, so
parsing each block once per pass would not move it measurably. The lane's
Markdown-mode scan also reads its own ignored docgen output (8,957 files and
3,258 fences against 8,713 and 2,520 on the clean clone); the tracked-file
record above is the parity proof, and every law reported 0 findings,
0 failures, 0 rewrites and 0 unreadable files in both runs.

## The adopted tools, before and after

Each tool ran over the whole repository on the unmodified lane and again
after the switch (counts from the JSON outputs; the two new files and the two
new `TypeScriptFences.ts` examples of this PR account for the +2 file and
fence shifts).

| Tool | Before | After | Attribution |
| --- | --- | --- | --- |
| `beep quality jsdoc-inventory` | the inventory's findings | the same findings; only the line and anchor of 19 symbols in three edited source files (`MarkdownFence.ts`, docgen `Core.ts`, `EffectImports.ts`) move. Against main the committed inventory gains the new `MarkdownFence` module and its exports, all resolved, and `jsdoc-ratchet --regenerate` reports `increased=0` | zero JSDoc-ratchet drift |
| `beep laws effect-imports --mode jsdoc` | 31,047 fences, 0 rewrites, 0 warnings | 31,049, 0, 0 | +2 new examples |
| `beep laws effect-imports --mode markdown` | 2,518 fences, 0 rewrites | 2,509, 0 | −15 `inside-other-fence`, +5 `inside-container`, +1 `closer-differs` |
| `beep laws schema-tag-idioms` | 5,456 Schema fences, 0 findings | 5,446, 0 | the Markdown `inside-other-fence` and `inside-container` shifts |
| `beep laws markdown-fences` | 1,151 fences, 546 checked, 0 failures | 1,138, 533, 0 | quoted `inside-other-fence` blocks in guidance files no longer typechecked |
| `beep docgen doctest verify` (every `packages/**/src` and `apps/**/src` file) | 27,635 fences, 22,688 findings | 27,637, 22,688 | +2 new examples; the five `closer-differs` examples gain their console rewrite plans; docgen `Core.ts` "Preserve a TSX fence extension" now classifies as impure (its full code is a TSX fence) |
