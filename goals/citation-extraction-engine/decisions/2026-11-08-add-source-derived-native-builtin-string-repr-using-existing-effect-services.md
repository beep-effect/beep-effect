---
title: "Add source-derived native builtin string repr using existing Effect services"
date: 2026-11-08
kind: checkpoint
reversal: "Reopen the primitive proof if frozen printability, source quote/escape rules, native storage, reservation or captured timing behavior changes."
---

A private CPython 3.11.15 builtin string repr primitive now reuses existing Unicode, text-budget, timing and clock adapters. The producer scans all Unicode points and seals 700 printability intervals; 3,113 independent native cases and corruption, expansion, budget-capture and clock-capture controls pass. Package lint/types and Fallow new-only pass. Main 1f682563312 is integrated. Full debug/token/extractor integration and general object repr remain open; no canonical assertion is promoted.
