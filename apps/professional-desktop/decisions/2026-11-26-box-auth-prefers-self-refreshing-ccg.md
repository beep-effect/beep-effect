---
title: The live vault-sync Box driver prefers Client Credentials Grant over the developer token
date: 2026-11-26
reversal: Select the CLOUD_BOX_TOKEN developer token whenever it is set, ahead of CCG.
governs:
  - src/runtime/Layer.ts#boxAuthLayer
enforcedBy: []
---

The Box auth layer picks Client Credentials Grant when `DMS_BOX_CLIENT_ID` and `DMS_BOX_CLIENT_SECRET` are set with a `DMS_BOX_ENTERPRISE_ID` or `DMS_BOX_USER_ID` subject; the SDK refreshes CCG tokens itself, so a long-lived sidecar does not decay into 401s. Otherwise it falls back to the developer token, and with neither it selects the app-local disconnected mirror layers. Only the selected auth mode is logged, never secret values.
`Box.makeCcgLayer` is `Layer.succeed` underneath: its declared `BoxError` channel never fires, so `Layer.orDie` there only aligns the layer types.
Rejected: preferring the static developer token, which expires after about 60 minutes and leaves the running sidecar unauthenticated.
