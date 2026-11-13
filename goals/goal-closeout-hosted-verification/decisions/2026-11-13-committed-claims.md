---
title: "Attribution and ruling claims count only when committed"
date: 2026-11-13
lane: "feat/goal-closeout-hosted-verification"
reversal: "Count working-tree claims again and drop the claim source field."
---

Agent decision DN-6 (`research/design-pr-a.md`), amended by orchestrator ruling 2026-11-12.

A `redAttribution` or `operatorRuling` claim counts only when its decision file is committed. Committed means present in `origin/main`'s tree, or in the checkout's `HEAD` commit, which is the head of the PR that carries it. A file that exists only in the working tree is shown as a preview (`would verify once committed: <files>`). It never contributes to a stored receipt, to `goals doctor`, or to the `yeet sweep --retire` check.

Each claim carries its `source` (`origin-main`, `head` or `working-tree`). When a counted claim exists only at `HEAD`, refresh prints `verified (claims at HEAD only: <files>; not done until they merge)`. The receipt, the observation and the evaluator input all carry a single field, `redAttributions`, that holds the committed claims. Stored rows therefore re-resolve without the files, and attributed reds survive re-resolution.

Why: a working-tree claim would otherwise write a sticky verified receipt into the store that every clone shares. That receipt would satisfy the done exit without the attribution ever reaching `main`. Counting the PR head lets a decisions-only PR, or PR A's own migration, verify inside its lane. The online checks that run from `main` ignore claims that have not merged.

Reverse: count working-tree claims again and drop the `source` field.
