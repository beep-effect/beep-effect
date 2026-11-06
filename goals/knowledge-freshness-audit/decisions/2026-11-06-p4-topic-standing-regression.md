---
title: "Protect both documented TopicName examples with source-bound tests"
date: 2026-11-06
kind: checkpoint
lane: "codex/knowledge-audit-p4-enforcement-context"
pullRequest: 2817
reversal: "Remove only the new source-bound test and this checkpoint; preserve the repaired examples and private counterfactual evidence."
---

Reuse the existing collectMarkdownFences API and scoped platform test pattern to execute the actual TopicName fence in each of the two public guidance files. Three valid forms and five empty-segment forms are asserted per copy; no second TopicName implementation or parser is introduced. A fresh main-only control fails the standards copy on true versus false while its already-repaired skill copy passes; the repaired branch passes both tests. Package lint/typecheck and the real file detector pass. This adds standing protection for the demonstrated duplicate-example omission; five other guidance facets still lack established dedicated protection in the bounded review, and broader acceptance remains unproven. The next PR2817 push includes a repo-cli test and must carry ready-for-heavy admission plus current code proof; the old docs-only coverage skip belongs only to its earlier published head. PM, ADHD, private evidence and source-owner holds remain separate. No paid work, lifecycle flip or S11.
