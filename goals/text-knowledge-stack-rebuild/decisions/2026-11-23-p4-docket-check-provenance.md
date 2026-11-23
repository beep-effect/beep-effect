---
title: "P4: historical docket checks carry provenance and never pass the gate"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Drop the provenance field and read v1 Booleans as current results."
---

DeterministicCheck gains provenance (current or docket-check/v1) instead of a fourth result case. Stored v1 Boolean checks read through a private frozen projection as Passed or Failed tagged docket-check/v1. Only a current Passed check passes the review gate, and resumed rounds re-run their checks, so a historical true is never a fresh verification.
