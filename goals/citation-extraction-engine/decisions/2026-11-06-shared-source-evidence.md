---
title: "Share canonical source evidence and capture operation ownership"
date: 2026-11-06
kind: checkpoint
lane: "feat/citation-diff-kernel"
pullRequest: 2737
reversal: "Revert the shared helper extraction and operation routing together while preserving canonical verification, source corpora and every unfinished acceptance requirement."
---

Canonical resolver/verifier behavior now has one shared helper, reused by single/paired extraction and independently qualified under annotation timing without extraction shortcuts. Shared metadata ownership captures the operation reference for admission and children. Fifteen source/routing tests pass in 8.00s and two actual Bun/Node paired tests pass in 53.33s. Root/nested resolver mutation controls passed before the refactor; no verification vulnerability is claimed. Server checks, named-capability declarations, blocking laws and scoped Fallow pass with zero introduced findings. Admitted annotation/raw-source/public engine composition, general host/nested callbacks, builtin difflib and every open law/fidelity/proof obligation remain required. See history/evidence/2026-11-06-shared-source-evidence.md.
