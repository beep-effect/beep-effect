# R28 addendum: JSDoc migration fence companion

Native P2 data-only correction linked to existing
`designs/jsdoc-fence-state.md`. Frozen HEAD
`93217d998f851e2e93d9864e2b5315552eaa58a7`, origin/main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`. Propose retiring
`r3-tooling-jsdoc-migrate-rewrite-fence-gates` as a covered migration companion,
not retaining its false D1 and not creating a duplicate qualified owner. The
current design and canonical rows are untouched.

## Current shape

`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocMigrateRewrite.ts:73-91`
has actual loop locals: incoming `openFence: string | undefined`,
`wasOpen = openFence !== undefined`, and the produced pair
`[nextOpenFence, isFenced]`. It appends one existing `FenceLineClass` literal
(`outside`, `open`, `inside`, `close`, declared at71) and advances openFence.
The completion footer correctly identifies locals but wrongly calls their
Boolean relation independent.

The shared producer is `internal/jsdoc/JSDocSections.ts:41-54`, exposed through
dual `fencedLineState` at71-74. The current design already owns this producer,
its three production callers, and deletion of the rewriter's combined guards.

## Cardinality gap

The pair `wasOpen,isFenced` represents4 combinations but supports only3:
false/false outside, false/true opening, true/true inside or closing. Every
input with an existing marker returns isFenced=true. true/false has no writer.

For full iteration accounting, include produced next-marker presence:

| wasOpen | next marker present | isFenced | Existing line class |
| --- | --- | --- | --- |
| false | false | false | outside |
| false | true | true | open |
| true | true | true | inside |
| true | false | true | close |

Those produced local dimensions are8/4. Counting the co-carried incoming marker
presence as well gives16/4, because its presence equals wasOpen. Both markers
carry their complete string payload. These contextual iteration counts must
not replace the shared callee-output record's4/3 count: that output alone is
optional next marker × Boolean, and its fenced case intentionally covers both
opening and interior lines.

## Target schema

Keep the existing shared design's three output cases: outside, fenced with
the exact active `S.String` marker, and closing. At the rewriter, match that
disposition and use the existing prior marker state only to distinguish open
from inside for a fenced result. Produce the existing four `FenceLineClass`
literals. Do not add an independently stored four-case iteration model or a
second qualified migration with the same deletion claim.

The exported input contract accepts any string or undefined, not only the
markers emitted by the production regex. Preserve arbitrary input strings,
including an empty string. A string is payload, not a two-literal backtick/tilde
domain. Production openers are runs of at least three matching characters;
wrong-character, shorter or annotated closers retain the original marker.

## Migration inventory

The parent should append this exact cardinality/companion correction to the
existing design upon adjudication, preserving its source/code migration map.
Refresh its source pin and the Quality test-kit export citation to79.

- `JSDocSections.ts:41-74`: retain regex, same-character/length/empty-tail
  checks, full marker and both dual calling conventions.
- `JSDocSections.ts:76-95`: a closing line remains fenced for its own line;
  it cannot terminate the JSDoc block through embedded `*/`.
- `QualityArtifactSupport.ts:13,17,656-671`: preserve re-export and skip tags
  on opener, interior and closing lines.
- `JSDocMigrateRewrite.ts:71-91`: derive the four classes as described above.
  Its six consumers remain `fenceBodies` at94-117,
  `tokenizeLinesMaskingFences` at121-131, `splitBodyAndTags` at155-167,
  `splitTagSegments` at169-184, `parseBodySections` at222-247 and
  `splitParagraphs` at249-267. Preserve ordering, masking, exact source bytes,
  content-conservation checks and quarantine outcomes downstream.
- `src/test/Docgen.test-kit.ts:32` and `src/test/Quality.test-kit.ts:79`:
  preserve the exported function name and migrate tuple consumers in one PR.

## Guard-deletion accounting

All deletion credit belongs to `jsdoc-fence-state`: remove the three tuple
destructures, the rewriter's `wasOpen` cache, `!isFenced` at79 and the pairwise
wasOpen/next-marker branches at81 and83. Exhaustive disposition matching plus
the incoming marker presence supplies the four existing line classes. Keep
the mutable incoming marker and the genuine closer-validation logic. This
companion adds zero independent guard-deletion credit and zero separate PRs.

## Encoded-side impact

There is no wire or persisted loop state. Keep the source-only test-kit return
type migration described by the existing design. Preserve all emitted source,
documentation inventory, migration manifests and diffs: no operation tag or
marker normalization may appear in those artifacts. No compatibility alias or
codec for this private loop is needed.

## Test impact

Use `text`, a backtick opener, body text and matching closer in sequence to
prove all four rows. Cover tilde and longer runs, nonempty opener info strings,
wrong/short/annotated closers, unterminated fences and arbitrary input marker
strings through the dual API. Verify tag suppression, closing-line behavior,
source offsets and exact fence bytes. Existing
`test/jsdoc-migrate.test.ts:45,104,357` exercises fenced conversion, unfenced
quarantine and changed-fence conservation; retain the quality-artifact parser
fixtures in `test/quality-artifact-generators.test.ts`.

Run focused parser/migration tests and repo-CLI package verification only in
implementation. P2 ran no product tests.

## Risk

Do not conflate4/3 shared outputs with8/4 produced locals or16/4 complete
iteration context. Do not interpret marker absence on a closer as outside, or
narrow the public string input to regex-produced markers. The existing design
already covers the rewriter; treating its D1 seed as another implementation
would duplicate scope. Native source correction supplies no new independent
P3 credit.
