---
title: "PERIH-01 slice 1 post-merge review fixes"
date: 2026-11-12
kind: checkpoint
lane: "docs/perih-01-review-fixes"
reversal: "Revert this PR's squash commit; it changes only prose, citations and one test assertion."
---

The post-merge review of #3116 found four residues, all fixed here. (1) The PLAN slice 1 gate claimed both required names on a docs head; on a docs head the skipped coverage-regression job shows its unevaluated name expression, so the gate now says Test Integration is proven on both heads and the docs-head half of Coverage Regression waits on COVE-08 (route-soundness-repair). (2) docs/runbooks/ci-coverage-artifacts.md still described the deleted resolved-SHA lookup; it now says heavy.yml@main declares no Coverage Regression job and legacy_coverage is the constant 'false' until COVE-08. (3) ci-runner-security.test.ts exempted check.yml:Test Integration Partitions, a job name #3116 removed; the entry is gone and the descriptor census now fails on any exemption that matches no live job context. (4) SPEC.md and research/SOURCES.md cited check.yml by line numbers that moved; they now cite jobs and steps by name.
