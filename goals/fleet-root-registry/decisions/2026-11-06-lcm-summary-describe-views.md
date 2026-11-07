---
title: "Borrow LCM's summary, pointer and expand split for the fleet views"
date: 2026-11-06
lane: "@chore/deps-update-11-6-26 (grill session)"
reversal: "Drop fleet describe and print the full joined record per row."
---

LCM (Ehrlich and Blackman, arXiv 2605.04050) keeps an immutable store, a compact active context holding summaries with stable IDs, and expands detail only in sub-agents. The fleet analogue: fleet --join prints one compact row per checkout keyed by path; fleet describe <checkout> expands mirror, registry and the latest ledger rows on demand. No new daemon or store. Rejected for this packet: a summary DAG over the session ledger (context tooling, captured in explorations/INBOX.md); borrowing nothing.
