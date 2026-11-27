---
title: Publish immutable telemetry keys by epoch
date: 2026-11-26
reversal: Overwrite the current key file or publish a new epoch by a replacing rename.
governs:
  - src/runtime/TelemetryKey.ts#keyFilePattern
  - src/runtime/TelemetryKey.ts#publishKey
  - src/runtime/TelemetryKey.ts#resolveKey
enforcedBy: []
---

Key files are key.<epoch>.dpapi and are published once. Read the highest epoch, reuse it if it unwraps, otherwise draw a new root key for the next epoch.
Write wrapped material owner-only to a pending name and hard-link it into place; the link fails on an existing target and None means another process won. Remove the pending file and retry resolution to use the winner.
Rejected: overwriting an epoch or replacing it by rename, which lets racing hosts retain different material under one epoch. Highest epoch is current because prior files are immutable.
