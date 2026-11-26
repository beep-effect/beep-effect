---
title: Task-list items reproduce cmark-gfm's raw-line scan and whole-line checked search
date: 2026-11-26
reversal: Scan for the marker after the container prefixes and read checked from the matched bracket only, and update gfm-tasklist.test.ts to the new behaviour.
governs:
  - src/internal/blocks/taskListItem.ts#reTaskListMarker
  - src/internal/blocks/taskListItem.ts#isChecked
  - src/internal/blocks/taskListItem.ts#taskListItemStart
enforcedBy: []
---

The semantics authority is cmark-gfm 0.29.0.gfm.13: `extensions/tasklist.c` and the generated `_scan_tasklist` in `extensions/ext_scanners.c`. The three `extensions.txt` examples sample only the happy path, so `gfm-tasklist.test.ts` pins the rules behind them, upstream quirks included, because the reference implementation is the contract.

`_scan_tasklist` runs over the raw line from column zero, so a `>` prefix or a second list marker on the same line (`- - [x] foo`) keeps the line from ever looking like a task item. `tasklist.c` sets `checked` with `strstr(input, "[x]")` over the entire line rather than the bytes the scanner matched, so a later `[x]` in the item's text checks the box. The generated scanner accepts ` `, `x` and `X` between the brackets although the `ext_scanners.re` rule lists only the first two, and `tasklist.c` tests both cases.

Rejected: matching a marker inside a blockquote or a same-line nested item, and reading `checked` from the matched marker alone, both of which a spec reading suggests but cmark-gfm does not do.
