---
"@beep/repo-cli": patch
---

`beep models check --offline` no longer records its snapshot as the ledger baseline. An offline
snapshot omits the upstream layer, so recording it made the next online run report every
upstream-only model as `added` and a later offline run report them as `removed`. Only online
snapshots are recorded now.
