# Opportunities & friction ledger

Receipts recorded at the moment of friction, per the repo friction-capture law.

## 2026-08-06 — P1 codemod build

### `A.makeBy` silently clamps its size to 1

- **What happened:** the synthetic-title generator used `A.makeBy(record.exampleTagCount, ...)`
  to build one placeholder per `@example` tag. For remarks-only blocks (`exampleTagCount = 0`)
  effect's `makeBy` returned a 1-element array — its `NonEmptyArray` contract clamps `n < 1`
  to 1 — so every remarks-only block failed the title-count check.
- **Evidence:** first full-corpus dry run of `beep quality jsdoc-migrate apply --dry-run
  --synthetic-titles` aborted with dozens of
  `title-count-mismatch: block has 0 @example tag(s), record has 1 title(s)` errors
  (e.g. `packages/drivers/duckdb/src/index.ts#<fileoverview>#0`), costing one corpus-scale
  run (~1 min) plus a repro cycle to attribute.
- **Prevention:** a lint or tsgo diagnostic flagging `A.makeBy` calls whose size argument is
  not provably ≥ 1 would surface the clamp at write time; alternatively an `A.makeBy0`-style
  wrapper in `@beep/utils` with a plain-`Array` return for possibly-zero sizes.

### Census figures were regex-derived and diverged from the gate's scanner

- **What happened:** three P1 measurements disagreed with `research/corpus-census.md`:
  affected blocks 11,674 vs 13,265 (the census's `/\*\*[\s\S]*?\*\//` block regex is not
  fence-aware and over-splits blocks whose examples contain `/**`), unfenced examples 31 vs
  114 (the census counted any `@example` not *immediately* followed by a fence, which
  includes caption-then-fence blocks the codemod converts cleanly), and the "zero collision"
  claim missed 188 bare untitled `**Example**` markers sitting directly above a legacy
  `@example` tag (its query grepped for `**Example** (` with the paren).
- **Evidence:** `beep quality jsdoc-migrate extract` summary line
  (`files=1899 blocks=11674 multiExample=19 remarks=495 unfencedExamples=31`) and the first
  dry-run manifest showing 188 `mixed-example-carriers` quarantines, later resolved by the
  stray-marker consumption rule.
- **Prevention:** the census itself predicted this ("`beep quality jsdoc-migrate extract`
  supersedes this document in P1") — the durable fix is to regenerate census numbers from
  `extract.jsonl` and never quote the ad-hoc regex figures once an extract exists. The two
  stable-tail figures (19 multi-example, 114 unfenced) were load-bearing in planning; only
  the 19 survived contact with the gate-consistent scanner.

### Schema-first inventory entries are line-pinned and go stale on unrelated edits

- **What happened:** the four documented schema-first exceptions for the P1 codemod carry a
  `"line"` field. Adding `@param`/`@returns` doc lines to the same files shifted every pinned
  line by two, which made the exceptions "stale inventory entry" errors and failed the next
  full `yeet verify` lint lane — a whole verify cycle (~8 min) to learn a doc edit moved a line.
- **Evidence:** round-5 verify log: `Stale schema-first inventory entry is no longer present in
  the live scan` for `computeJSDocMigrateBinding` (line 176 → 178) and three siblings.
- **Prevention:** key advisory exceptions by `file#symbol#ruleId` alone, or treat `line` as
  display metadata rather than part of the match key; `--write` refreshing lines without
  resetting a reviewed `status: "exception"` would also close the loop.
