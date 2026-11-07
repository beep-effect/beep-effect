---
title: "Retain bounded failure footers for repo-run captures"
date: 2026-11-07
lane: "codex/cache-ci-failure-tail-20261107"
reversal: "Restore repoRunOutputBound to head retention; other callers already default to head."
---

Repeated hosted unit-d captures end before the final failure summary. Keep repo-run captures within their existing 524288-character budget while retaining both initial context and the final diagnostic footer. Extend the existing OutputBound schema and fold with explicit retention, defaulting legacy constructors and encoded inputs to head-only behavior. Opt only repoRunOutputBound into head-tail retention. Other consumers, process exit codes, deadlines and required proof gates retain their contracts. Hosted controls cover the legacy default, chunk partitioning, empty and small budgets, and actual stream footer retention. No local test, compiler or quality suite runs; syntax/source inspection and ordinary hooks only. This is a diagnostic prerequisite, not evidence that the inherited law-practice-server failure is fixed or that either Turbo goal is complete.
