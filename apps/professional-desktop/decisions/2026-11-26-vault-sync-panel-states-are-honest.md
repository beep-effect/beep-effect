---
title: The vault-sync panel shows the state it actually knows, keyed copy for each failure, and always a way out
date: 2026-11-26
reversal: Render failed queries as empty, show one generic disconnected note, and drop the retry buttons and last-known markers.
governs:
  - src/sync/VaultSyncPanel.tsx#ConnectionBadge
  - src/sync/VaultSyncPanel.tsx#VaultSyncStatusView
  - src/sync/VaultSyncPanel.tsx#DisconnectedNote
  - src/sync/VaultSyncPanel.tsx#VaultSyncRefusals
  - src/sync/VaultSyncPanel.tsx#VaultSyncConflictsList
  - src/sync/VaultSyncPanel.tsx#VaultSyncPanel
enforcedBy: []
---

The panel never presents an unknown as healthy or empty. While the sidecar is unreachable, its last status stays authoritative for Box connectivity, intents queue, and the badge and destination row say "last known" without the live colour.
A failed status or conflict query renders its own failure with a retry: a status query that nothing invalidates otherwise read "unavailable" for the rest of the session after one dropped request, and a failed conflict listing read as "no conflicts". A pending flag and the probe timestamp make a retry visibly do something even when the outcome is unchanged.
Disconnected copy is keyed on the sidecar's disconnect reason. A status with no reason comes from an older sidecar and gets the probe-failed copy, the one guess that does not claim the token is unset. The renderer cannot see the sidecar's auth mode, so the auth-failed copy names the fix for both: developer tokens expire, CCG self-refreshes. A refusal notice names the action that did not happen and why; its prediction is already reverted.
Rejected: one generic note for every probe failure (it told QA to set CLOUD_BOX_TOKEN when the token was set, and hid whether the fix was a fresh token, the mirror root folder, or waiting Box out); `null` for a failed listing; no retry on the status query.
