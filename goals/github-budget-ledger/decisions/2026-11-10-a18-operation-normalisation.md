---
title: "A18 Operation labels are normalised at record time"
date: 2026-11-10
reversal: "Change those callers to route templates and drop normalisation."
---

`normalizeOperation` runs at record time: owner/repo, user, org, numeric, SHA and named segments become placeholders, with depth 8 and 120 characters. Callers that interpolate parameters are left unchanged.

Resolves SPEC ambiguity A18 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").
