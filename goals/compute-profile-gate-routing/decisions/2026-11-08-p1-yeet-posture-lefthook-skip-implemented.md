---
title: "P1 yeet posture + lefthook skip implemented"
date: 2026-11-08
kind: checkpoint
lane: "goals/compute-profile-gate-routing-p1"
reversal: "Revert the P1 commit; P0's probe, routing table and scheduler refusal stand alone."
---

final-check auto-skips hosted-only gates on worker with reason compute-profile=worker (--force-local opts out, receipt records computeProfile and forceLocal). yeet ready accepts hosted green for those gates through gateHostedContextTable. yeet publish takes the open posture on worker and yeet open adds the compute-profile-worker label. Both catalog hooks skip on worker. Evidence: research/2026-11-08-p1-yeet-lefthook-evidence.md. Next: P2 hosted regeneration job and docs.
