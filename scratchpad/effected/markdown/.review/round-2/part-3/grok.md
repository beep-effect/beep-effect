I'll review this markdown slice against the round-1 inventory, the port ledger, and the pinned upstream oracle, and report only new findings.Round 1 already recorded the known defects in this slice. I'll read the binding decisions and compare these files with the pinned oracle for anything that inventory missed.Round-1 defects are recorded as deviations. I'll inspect the repaired algorithms and the block parsers for new divergences the gates would miss.The remaining slice is the table tail, frontmatter, preprocess, and the ledger’s later deviation rows. I’ll compare those against the pinned oracle and only report a new divergence.### grok-2-1
- file: scratchpad/effected/markdown/internal/blocks/fencedCode.ts:42
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md §11.3   evidence: Upstream `fenceCharOf` returns `undefined` for any char other than `` ` `` or `~`, and the trigger returns 0. The port maps every other char to `"~"` and drops that return. `reCodeFence` only matches those two characters, so the branch is unreachable and opening behaviour is unchanged. `w2-markdown.deviations` records the same class of simplification for `list.ts`, `table.ts`, `thematicBreak.ts`, `lineIndex.ts`, and `phrasing.ts`, and has no `fencedCode.ts` row.
- failure: The unreachable fence-character refusal was removed and not recorded, so the ledger does not show that this control-flow deletion preserves behaviour.
- fix: Add one ledger coverage row for the removed `fenceChar === undefined` return.

### grok-2-2
- file: scratchpad/effected/markdown/internal/blocks/code.ts:72
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md §11.3   evidence: Upstream sets `meta` only when `meta.length > 0`. The port always assigns `unescapeString(meta)`. `firstLine` is already `trim`med, and `wordEnd` is the first `[ \t]`, so the suffix cannot be only whitespace. No `code.ts` coverage row exists in `w2-markdown.deviations`.
- failure: The empty-meta guard was removed and not recorded. An empty `meta` key is not emitted for any reachable info string, but the ledger does not say so.
- fix: Add one ledger coverage row for the removed `meta.length > 0` guard.

### grok-2-3
- file: scratchpad/effected/markdown/internal/references.ts:266
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md §11.3   evidence: Upstream advances one, then advances again only when `peek() !== -1`. The port always does `this.pos += 2`. The branch is entered only after `reEscapable.test(charAt(pos + 1))`, and `ESCAPABLE` is a one-character class, so a following BMP punctuation character exists and the second advance always happens. No `references.ts` coverage row exists in `w2-markdown.deviations`.
- failure: The unreachable end-of-subject check was collapsed and not recorded, so the ledger does not show that destination scanning is unchanged.
- fix: Add one ledger coverage row for the removed `peek() !== -1` check.

REQUIRED: 0
BACKLOG: 3
