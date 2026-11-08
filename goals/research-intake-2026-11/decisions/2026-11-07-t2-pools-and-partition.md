---
title: "T2 runs Junie on public artifacts and Codex gpt-6.1-sol on private ones; Claude children are rate limited"
date: 2026-11-07
lane: "feat/research-intake-2026-11"
reversal: "Re-run the private partition with --profile claude once the Claude limit resets; records are keyed per artifact so a re-read replaces nothing silently"
---

T1 selected 1187 of 1434 November artifacts (241 skip, 6 defer). The pool doctrine puts T2 on Junie claude-opus-5-5 while JetBrains credits remain, then claude-opus-5-5 children. Private artifacts may not go to Junie (enforced by the runner), and two Claude Opus children failed on 2026-11-07 with a confirmed API rate limit, so the private 400 run on the Claude chain's next step, Codex gpt-6.1-sol medium, through a new codex-sol profile. --only-private and --exclude-private keep the two runs disjoint, and the writer lock now serializes their catalog writes. Both routes were qualified by one live read each before the batch (Junie 6 findings, codex-sol 12).
