---
title: "PR 4: offline intents in the desktop renderer, recorded QA green"
date: 2026-11-07
kind: checkpoint
lane: "feat/vault-sync-offline-intents"
reversal: "Revert the PR 4 squash commit; the intent queue lives only in renderer localStorage and the intentId payload key is optional"
---

The desktop vault-sync panel records every command as an intent before sending it, predicts it at once (pass queued, conflict reads reviewed), persists the queue in localStorage, replays it every two seconds once the sidecar answers, and reverts a prediction the server rejects with its message on the conflict row. `TriggerVaultSync` carries an optional `intentId` the Api adapter uses as request and command id, so a replay requests one pass (server test). Recorded browser QA (`bun run beep qa`, playwright lane, 5 rounds) ended with rounds 4 and 5 at zero required findings; the final inventory, capture harness and panel screenshots are in `history/qa/2026-11-07-pr4-offline-intents/`. The harness stubs only the vault-sync RPCs on a real renderer and sidecar to switch the sidecar offline, online and rejecting. Observability catalog, PII audit, genesis/cutover remain.
