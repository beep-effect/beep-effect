---
title: "Renewal is a one-shot reminder at 180 days, with no automatic renewal"
date: 2026-11-08
lane: "t3code-goals-closeout"
reversal: "Disable t3code-fleet-renewal-reminder.timer and delete its two units"
---

The fork raised MCP_CLIENT_SESSION_TTL to 180 days (beep-effect/t3code#2), so tokens and links expire 2027-05-07, and the operator declined auto-renew timers on 2026-11-08. A reminder is what the spec requires and renews nothing by itself: a one-shot DankStation timer notifies on 2027-04-23. The authorize script sits at a durable local path because tracked Python is banned.
