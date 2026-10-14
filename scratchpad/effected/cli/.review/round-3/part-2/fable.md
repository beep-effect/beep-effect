<!-- seat: grok-4.7 medium (third seat; Fable and cursor Opus quota exhausted, 2026-10-09) -->
I'll review this CLI slice read-only against the port decisions, the round-2 inventory, and the pinned upstream oracle. First I'll load the binding rules and the files in scope.Round-2 schema and counts fixes are in the tree. I'll read the render path next and compare it with the pinned oracle for anything those fixes left open.I'll confirm the four open findings against the current line numbers before writing the review.The stored link target and the round-2 dispositions still need a direct check before I treat them as open.### fable-3-1
- file: scratchpad/effected/cli/internal/layout.ts:154
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and §14 verified upstream-bug. Unfixed cli-r2-10 (round-2 inventory; required.json group g4). Not in scratchpad/effected/cli/README.md Deviations.
- evidence: `cellsOf` (line 154) runs `graphemes` on each span alone, and `widthOf` (line 144) sums those widths. The pinned oracle `packages/cli/src/internal/layout.ts:102-119` does the same and calls it deliberate. `scratchpad/test/cli/layout.test.ts:227-241` asserts the split: a regional-indicator flag and a ZWJ sequence measure as the sum of their pieces. Round-2 evidence, still true of this commit: `Doc.text("👩")`, `Doc.text("\u200d")`, `Doc.text("💻")` is width 4 and truncates or wraps as a broken joiner sequence, while one `Doc.text("👩‍💻")` is width 2.
- failure: A span boundary is a grapheme boundary. A two-column emoji that fits is truncated or split across lines, so the displayed cluster changes.
- fix: Segment the concatenated visible text of adjacent spans, keep span offsets so one grapheme stays atomic and still carries its style and link fragments. Retarget `layout.test.ts:227`. Record the upstream-bug deviation.

### fable-3-2
- file: scratchpad/effected/cli/Doc.ts:943
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9 and D11. Residual of cli-r2-8; the README upstream-bug line claims the stored target drops the invalid `url` key. New evidence is the stored node and the remaining presence checks. `S.is` ignores excess keys, so `{ url: undefined, file, line, col }` fails `LinkTarget.members[0]` (`url: S.String`) and passes the file member.
- evidence: `Doc.link` (line 940) chooses the default label with `S.is(LinkTarget.members[0])`, then stores `target: { ...target }` (line 943). `Doc.test.ts:417-422` checks only that label. `layout.test.ts:496-511` checks the flattened span, which `safeTarget` (`internal/layout.ts:57-63`) rebuilds without `url`. The stored node still has an own `url` key, so `"url" in target` stays true. `CliLinks.ts:127` then calls `cleanUrl(target.url)`; `sanitize` (`Fmt.ts:59`) calls `stripAnsi` (`displayWidth.ts:29`), and `undefined.replace` throws `TypeError`. The same presence check is `renderDoc.ts:60` (`targetText`) and `renderMarkdown.ts:99` (`linkUrl` calls `target.url.trim()`). Those two are safe after flatten because they receive the rebuilt span link (`renderAnsi.ts:33-34`). `links.target` (`CliLinks.ts:352`) still receives a raw `LinkTarget`.
- failure: `Doc.link({ url: undefined, file: "src/a.ts" }).target` keeps `url: undefined`. Passing that node target, or the original schema-valid value, to `links.target`, `targetText`, or `linkUrl` throws. `Render.plain`, `Render.ansi`, and `Render.markdown` of that `Doc.link` no longer throw.
- fix: Store `{ url }` or `{ file, line?, col? }` from the same member test as the label. Select those three consumers with `S.is(LinkTarget.members[0])` so a hand-built schema-valid value cannot enter `cleanUrl`. Extend `Doc.test.ts:417` to assert the stored target has no `url` key.

### fable-3-3
- file: scratchpad/effected/cli/internal/fileSink.ts:80
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and §14 verified upstream-bug. Effect `ignore` (`packages/effect/src/internal/effect.ts:3474`, via `matchEffect` at 3681-3686) recovers `Fail` and re-dies on a cause with no `Fail`. `Cause.squash` (`causeSquash`, same file lines 261-268) returns `die.defect`. Same pattern as the recorded CliRuntime upstream-bug (`CliRuntime.ts:743` uses `Result.try`).
- evidence: After `Effect.exit(append)` (lines 74-76), line 80 reads `error.message` or calls `String(error)` outside any capture. The pinned oracle `packages/cli/src/internal/fileSink.ts:57-60` is the same. `String(Symbol())` throws `TypeError`; a throwing `toString` or `message` getter does too. That throw is a Die of the drain, and `Effect.ignore` (line 85) does not contain it. `disabled = true` (line 78) runs first, so the loop cannot continue. `Logger.make` (lines 95-98) still calls `Queue.offerUnsafe` on the unbounded queue. No runtime probe was run.
- failure: A filesystem defect whose squashed value is not a stringifiable `Error` kills the drain fiber. Later log lines accumulate until scope close. The comment at lines 74-75 says `Effect.exit` exists so a filesystem defect does not do that.
- fix: Read the message with `Result.try`, as `CliRuntime.reported` does, and use a fixed fallback such as `"[unprintable failure]"`. Keep `disabled = true` and stay on the failure branch. Add a regression whose non-Error defect throws from `toString`. Record the upstream-bug deviation.

### fable-3-4
- file: scratchpad/effected/cli/Doc.ts:531
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D11. Unfixed cli-b2-1. Docgen checks example execution, not this prose.
- evidence: Line 531 says "Nodes are plain data and nothing decodes them". Line 835 says "nothing decodes or encodes one" and that a document is not meant to be serialised. `Doc.coverage.test.ts:24` and `:68` encode and decode `Block`. `Doc.property.test.ts:49` round-trips `AnnotationOptions`. The example at lines 533-539 is `S.is(Block)(Doc.paragraph("Ready"))`.
- failure: The public `Block` and `Doc` contracts say documents are neither decoded nor encoded, while those schemas and tests do both. A later edit can drop the codecs on that instruction.
- fix: Rewrite both sentences so constructors still return plain objects and do not decode, and the schemas remain the decode and encode contract. Leave `overflow` and `total` as function fields.

REQUIRED: 3
BACKLOG: 1
