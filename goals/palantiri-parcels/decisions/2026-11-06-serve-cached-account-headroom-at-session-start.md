---
title: "Serve cached account headroom at session start"
date: 2026-11-06
reversal: "Restore live-refresh account source for session start and remove completed-report staging from accounts presentation."
---

Session start reads the existing private account snapshot without starting usage polls. It preserves independent configured-provider inventory and original report and row timestamps: expired data stays Unknown stale, and missing attribution stays Unknown attribution-incomplete. Explicit Palantiri reads remain live. Completed accounts status, non-TTY board and TTY polls stage a retained-last-good copy atomically; raw command output is unchanged and NeedsLogin remains definitive. Synthetic delayed-source controls reproduce interruption before snapshot publication under the two-second hot limit.
