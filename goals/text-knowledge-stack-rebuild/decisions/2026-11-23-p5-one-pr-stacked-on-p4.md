---
title: "P5: one PR stacked on the P4 claims branch, commit rows as boundaries, two rows hold on external acquisition"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p5-taxonomy"
reversal: "Split P5 into an L6 PR and an L3 PR by a decision file, within the three-open-PR limit"
---

P5 lands as one PR stacked on the P4 claims branch, opened by its implementation lane at content-final through Yeet, never by the design lane. The packet stays within three concurrently open PRs (SPEC Delivery). The commit table in `research/2026-11-23-p5-design.md` section 10 is the boundary list. Each row compiles and passes its gate before the next starts. A consumer migration ships in the same commit as the surface it changes, and generated registrations ship with the commit that needs them. P3 and P4 used the same shape (decisions `2026-11-22-p3-one-pr-stacked-on-p2`, P4 design section 10). One commit needs network acquisition (the namespace pins), and one needs an operational semantica C1 run (the gold digest). Each holds its row and reports the blocker rather than inventing a value.
