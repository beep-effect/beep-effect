---
title: Keep interactive Microsoft sign-in in setup
date: 2026-11-26
reversal: Start a browser authorization flow from ordinary Microsoft 365 tool calls.
governs:
  - src/M365Provider.ts#signInThroughSetup
enforcedBy: []
---

Ordinary tool calls fail auth when the saved sign-in has expired. Setup status and repair guide the lawyer through a fresh sign-in.
Rejected: start interactive browser authorization inside a tool call, which surprises a caller and couples ordinary work to a separate human setup flow.
