---
title: "An unconfigured principal gets the empty authority"
date: 2026-11-24
lane: "p6"
reversal: "Make BEEP_LAW_PRACTICE_PRINCIPAL required and fail host startup without it."
---

`MatterWallLive` (server `MatterAuthority`) reads `BEEP_LAW_PRACTICE_PRINCIPAL` as an optional principal. With a principal it builds the authority from `BEEP_LAW_PRACTICE_MATTER_AUTHORITY`; without one it builds the empty authority whatever grants are configured and provides an unused sentinel principal, so a host that forgot its principal denies every walled path instead of failing to start or running as a guessed user. `apps/practice-kg-mcp/src/claims.ts` provides it to `LawPracticeServerLive`.
