---
title: "B1 locally verified with policy v2 and cleaner-boundary yield"
date: 2026-11-14
kind: checkpoint
reversal: "Return B1 to in progress if owner review finds an ownership, refusal or counting regression."
---

Both owner-ruling stops are resolved. B1 is in review locally; no push or PR.
Policy v2 and its major changeset are in df7dbe7f5dc. Invocation lanes route
regex v2, Diff and Xml; the closed HTML cleaner uses the named standalone starter
only after lane.yieldTo returns capacity. The public cleaner contracts and the
physical SIGKILL/isRunning/Scope-close sequence are unchanged.

Two full-span runs pass 12/12. The ten Bun calls remain 291 evaluations and 291
children, with zero per-call installs/detaches/tokenizer/evaluator installs.
Construction remains 16 metadata installs, 1 detach, 1 tokenizer, 26 evaluators,
1 physical owner and zero children. New lane-unit counts are zero at construction
and ten across the calls. File wall times are 61.72 s and 64.59 s; the latter's
launch-adjacent load is 20.27 / 22.31 / 18.30. File timings include the Node parity
leg and do not claim a latency improvement over the historical A4 cohort timing.

All new real-process proofs pass under Bun and Node parent runners, each testing
Bun and Node children. Markup completes under 1/1 and concurrently under 2/2 with
max-alive 1 and 2. Cleaner proofs cover engine HTML clean, a direct host call,
regex before HTML, acquisition/start quarantine, interrupted transfer, terminal
unconfirmed yield and late acknowledgement, and nested/concurrent yields within
caller transactions. Exact process and release assertions remain.

Both quick package checks/typechecks, both law checks, root Oxlint, local docgen,
Biome and whitespace pass. Fallow against origin/main has zero introduced
findings. Effect Vitest passes with explicit resource-hook deadlines; generated
inventory churn is restored. No full suite, coverage, hosted CI or remote timing
was run. Full file-by-file receipts and proof details are in
history/evidence/2026-11-14-b1-native-lane.md. Owner publishes after the predecessor
merges and directs the base update; this lane was not rebased.
