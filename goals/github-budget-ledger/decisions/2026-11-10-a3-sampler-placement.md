---
title: "A3 Sampler: a 5-minute user timer plus opportunistic monitor samples"
date: 2026-11-10
reversal: "Sample Apps in the timer and record the mint and revoke as sampler self-cost."
---

With no daemon, a 5-minute systemd user timer samples non-App identities. Monitor polls sample their own client's identity opportunistically, forked into the loop scope with a 30 s cap, and the monitor's pause read is recorded too; `session open` never samples. The due check and the lease come before any client build. App identities are sampled only by long-lived processes that already hold an installation client. Each sample is two free reads.

Resolves SPEC ambiguity A3 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").
