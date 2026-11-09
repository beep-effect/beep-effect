---
title: "Keep the 8 effect-vitest exceptions PR 2994 adds as reviewed PR 2966 debt"
date: 2026-11-09
lane: "@chore/deps-update-11-8-26"
pullRequest: 2994
reversal: "Delete the 8 rows from standards/effect-vitest.inventory.jsonc once EV004 and EV010 accept these tests or the tests are rewritten, then run bun run beep lint effect-vitest."
---

PR 2994, the `unblocks-main` PR for episode ep70, adds 8 rows to `standards/effect-vitest.inventory.jsonc` for findings that PR 2966 introduced. S31 counts that as inventory growth. The rows stay as reviewed exceptions because none of them is a defect in the test code:

- 3 EV004 rows in `CitationNativeSocket.test.ts`: the `Effect.scoped` closes only the RPC client before the surrounding operation retires the child and the test asserts its retirement. The rule keeps deliberate shorter lifetimes for judgment.
- 4 EV010 rows in `CitationExtractorControls`, `CitationNativeSocket`, `CitationRecognizerWorker` and `CitationSixFormProjection`: these tests spawn real worker children, which cannot see a `MemoryFileSystem`.
- 1 EV010 row in `eyecite/test/index.test.ts`: it authenticates a committed artifact on the real filesystem, which a `MemoryFileSystem` would not hold.

Clearing them from the test code would mean either changing what the tests prove or moving the calls into support files that the scanner does not report, which only hides them. The operator chose to record them here instead.
