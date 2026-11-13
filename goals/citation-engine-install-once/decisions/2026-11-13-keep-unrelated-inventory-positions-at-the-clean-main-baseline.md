---
title: "Keep unrelated inventory positions at the clean main baseline"
date: 2026-11-13
reversal: "Regenerate and adopt the unrelated line-position rows"
---

The syntax-only effect-vitest check passes with zero introduced and resolved findings on a clean detached origin/main worktree at 8b405079b69466e27babc5dff27c06292a8cc4e2. Both named source files are byte-identical to the lane. The writer updates positional metadata even though check accepts the existing occurrence identities; restore all six changed rows in those two files to main, including the additional row beyond the review count. No inherited red needs routing. The check was repeated successfully on clean main at 49a2d768f64803883bcc9b64c9a54c97b1f26c40 after #3251: 3838 files, 516 findings, zero introduced/resolved. The writer also shifted fourteen other unrelated positional rows, all restored to main as well. A third clean audit at e7852920d2e975fa909b0574831ff30d828af35f also passes with the same counts. The throwaway sibling-root worktree was removed after every audit.
