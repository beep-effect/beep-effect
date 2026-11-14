---
title: "Slice 16: PSI samples joined"
date: 2026-11-14
kind: checkpoint
lane: "feat/certainty-join-psi-samples"
reversal: "Delete this checkpoint so the previous checkpoint is the latest PLAN status note, and revert the slice-16 PR."
---

Slice 16 (MEAS-08) adds a `pressure` section to `yeet economics` (decision `psi-join-onto-attempts`). It joins the PSI recorder samples (`safe-pressure.jsonl`) onto each local attempt by time window, and the SCHE-09 slice 2 stamps on admitted and released rows by attempt id, grouped into leases by nonce. Nothing new is sampled, stamped or written, and the closeout summary reads neither source. Each joined field is present or absent with its reason (remote host, source unread, untimed, outside the recorder span, no samples in the window, no admission row, no row for the transition, unstamped). The `psi-recorder` and `admission-journal` source rows read `present` only when every line or row was decoded, the cost ledger's rule, now shared as `ciLedgerSourceStatus`. Fleet-host attempts count as `remote-host` and are never listed. The ledger's `psi` row stays `absent`, with the reason that hosted runners are not the sampled host. Proof: `packages/tooling/tool/cli/test/yeet-economics-pressure.test.ts`, fixtures only, on Node and Bun. MEAS-08 is built.
