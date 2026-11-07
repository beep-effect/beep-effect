---
title: "Pre-admission backup retains SQL rows and sequence positions"
date: 2026-11-07
reversal: "Restore the verified offline snapshot before admitting commands; retain backup tables for diagnosis."
---

Part 2 lands backupSyncTables and restoreSyncTables before any writer deletion. The first snapshot is immutable per import id, copies every table column, and retains serial last_value and is_called. Repeated restoration is a no-op. This is exclusively a pre-admission reversal; it must not restore a stale snapshot after new commands have been accepted.
