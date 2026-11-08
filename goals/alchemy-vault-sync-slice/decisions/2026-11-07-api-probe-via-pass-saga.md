---
title: "Probe requests reuse the pass saga with a probe-only flag"
date: 2026-11-07
lane: "goals/vault-sync-api"
reversal: "Split a dedicated probe saga keyed by request id"
---

RequestVaultSync and ProbeDestination are public destination commands with Session. Their events route through the VaultSyncRequests policy to VaultSyncPass under the key destination/event/requestId, so repeated delivery resumes one run. The probe run executes only the BoxMirror probe activity. A paused destination refuses RequestVaultSync; probing stays allowed.
