---
title: "A20 Error shape: one GithubLedgerError with a reason"
date: 2026-11-10
reversal: "Split into per-reason error classes."
---

Ledger failures are one `GithubLedgerError { reason, detail, cause, message }` using the shared `optionalDefect` helpers. The reasons are `state-dir`, `read`, `write`, `decode` and `config`, with a fixed mapping from each failure source.

Resolves SPEC ambiguity A20 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").
