---
title: "Decisions are lane-owned files, not SPEC.md tail edits"
date: 2026-11-05
lane: "feat/goal-packet-decision-files"
reversal: "Delete goals/*/decisions/, remove the marker blocks, drop the decision-* doctor kinds from Doctor.ts and restore the Decision Log table in the bootstrap template."
---

On 2026-11-04 three merges on the turborepo-* packets put all eleven sibling PRs (#2683-#2695) into CONFLICTING at once; every conflict was a dated `###` section appended to the tail of `## Decision log` in SPEC.md (and current-preparation notes at the tail of PLAN.md). Two lanes appending to one tail is an unresolvable content conflict, and `.gitattributes` rightly keeps SPEC.md out of `merge=union` because its tables edit and delete rows. Each decision is now its own file, `goals/<slug>/decisions/<YYYY-MM-DD>-<topic>.md`, with schema-validated YAML frontmatter (`GoalDecisionFrontmatter`: title, date, reversal, optional kind/lane/pullRequest). New files never conflict. `bun run beep goals decisions write` renders the directory oldest-first into a marker-delimited block; `bun run beep goals doctor` blocks on `decision-log-drift` and `decision-file-invalid`.
