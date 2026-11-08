---
title: "ExecutionRecord lives under entities/; grants, grant sets and verdicts under values/"
date: 2026-11-07
lane: "feat/execution-authority-slice"
reversal: "Move entities/ExecutionRecord back under values/ in domain and tables and update the export maps"
---

SPEC Constraints classify decision and outcome records as entities. Domain and tables therefore export ./entities/ExecutionRecord and ./values/{ExecutionGrant,GrantSet,ExecutionVerdict}. Use-cases and server keep the epistemic concept folders (ExecutionLedger, GovernedTierGate, GovernedEgress), so the move stays a relocation. $I composer paths follow the new file paths. No test pins an execution identifier (RESEARCH section 6).
