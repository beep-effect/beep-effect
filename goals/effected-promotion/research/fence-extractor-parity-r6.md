# Fence-extractor parity: roadmap PR R6

Recorded 2026-10-31 for roadmap PR R6 of `goals/effected-promotion` (map site
#282, SPEC W4-q). Lane cut from `origin/main` `adedee335a`; the JSON record
(`fence-extractor-parity-r6.json`) was written by
`ops/fence-extractor-parity.ts` at `d247e0e12a` with a clean tree.

## The W4-q gate

W4-q keeps R6 in the packet only if the `@beep/markdown` code-node-span
extension stays under about 400 lines. As built (commits `92a85ef710` and the
class example added at content-final):

| Part | Lines |
| --- | --- |
| `src/MarkdownFence.ts` (`CodeFence` schema, `MarkdownFence.fences`, JSDoc) | 184 |
| `Code.unterminated` (schema key, encoded type, docs) in `src/internal/nodes.ts` | 9 |
| the parser flag (`internal/blocks/code.ts`, `internal/blockTypes.ts`) | 5 |
| `src/index.ts` barrel export and module note | 3 |
| `test/MarkdownFence.test.ts` | 143 |
| total | 344 |

The gate passes, so R6 adopts rather than defers.

## Fence sets, old extractor against new owner

Each old extractor is frozen verbatim in the ops script and runs beside its
replacement on two corpora: the 8,835 git-tracked Markdown files, and the
30,979 JSDoc blocks (of 55,112 in 8,696 tracked TypeScript files) that hold a
backtick or tilde run, unwrapped the way docgen, the JSDoc inventory and the
laws hand them to the extractors. Fences pair by opening fence; a pair is
identical only when every compared field (code, info string, offsets or lines,
extension) is byte-identical.

| Corpus | Extractor | Old fences | Identical | Classified differences | Unclassified |
| --- | --- | --- | --- | --- | --- |
| JSDoc | docgen | 31,050 | 31,042 | 8 `closer-differs` | 0 |
| JSDoc | typescript-fences | 31,050 | 31,050 | 0 | 0 |
| JSDoc | effect-imports-markdown | 31,050 | 31,050 | 0 | 0 |
| Markdown | docgen | 2,428 | 2,363 | 53 `long-marker-run`, 31 `closing-line-indent`, 24 `closer-differs`, 9 `inside-other-fence`, 8 `marker-mid-line`, 5 `inside-container` | 0 |
| Markdown | typescript-fences | 2,490 | 2,443 | 32 `value-normalized`, 15 `inside-other-fence`, 5 `inside-container` | 0 |
| Markdown | effect-imports-markdown | 2,519 | 2,504 | 15 `inside-other-fence`, 5 `inside-container`, 1 `closer-differs` | 0 |

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
- `value-normalized`: `typescriptFences` hands the laws the code CommonMark
  reads, without the fence's indentation or container prefix; the old pattern
  kept the raw lines. Spans and the opening line are unchanged.

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
