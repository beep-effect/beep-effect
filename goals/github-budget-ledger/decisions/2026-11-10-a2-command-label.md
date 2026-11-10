---
title: "A2 Command label: walk the loaded effect/cli command tree"
date: 2026-11-10
reversal: "Fall back to the leading-argv-word heuristic."
---

The COMMAND label is read from the loaded `effect/cli` command tree: only known group and subcommand names count, root flags are skipped as in `Dispatch.firstPositional`, at most three words are kept and the default is `beep`. Each record reads it from the requesting fiber's `GithubLedgerCommand` reference.

Resolves SPEC ambiguity A2 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").
