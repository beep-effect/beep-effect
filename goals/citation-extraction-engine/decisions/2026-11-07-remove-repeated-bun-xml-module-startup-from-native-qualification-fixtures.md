---
title: "Remove repeated Bun XML module startup from native qualification fixtures"
date: 2026-11-07
kind: checkpoint
reversal: "Retain the actual Bun entrypoint and all source outcomes, byte limits and physical-exit assertions if startup packaging changes."
---

Reuse the existing scoped worker bundler for the Bun XML test entry, matching the established regex/HTML and Node fixture strategy. All eight selected callback/XML/default-resolution tests pass; Bun markup callback time is 9.30 seconds versus the earlier 90.35-second diagnostic sample, with unchanged 120-second limits. The samples are not a controlled benchmark and hosted acceptance remains required. No production worker or callback algorithm changes. See history/evidence/2026-11-07-bun-xml-startup.md.
