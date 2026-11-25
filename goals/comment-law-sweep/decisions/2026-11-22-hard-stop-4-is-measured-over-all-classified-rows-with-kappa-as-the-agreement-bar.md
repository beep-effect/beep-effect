---
title: "Hard stop 4 is measured over all classified rows, with kappa as the agreement bar"
date: 2026-11-22
lane: "goals/comment-law-sweep-p0"
reversal: "Measure the 5% over T/G-union rows only and stop every wave above it until a brief reaches it."
---

The strip gate is agreement on the T/G split, since only T and G are deleted on two votes alone: S, X and D deletions also need opened evidence, an issue or pull request, or a committed decision file that passes the admission test, so those rows are checked one by one.

A wave is discarded and reclassified when either bar fails: T/G disagreements exceed 5% of all classified rows, or Cohen's kappa on the T/G-versus-rest split falls below 0.65. Rows without two agreeing deletable votes go to the absorption pass, where an implementer judges each against the code.

Evidence. Wave 1 (semver, npm-spec, csv, spdx, managed-section; 1,199 rows) round 1 disagreed on 18-51% of the rows either classifier called T or G; both vote sets were discarded. Round 2, with a sharper brief (a T vote names what restates it, blank paragraph lines take the paragraph's code, G only for labels): T/G disagreements 2.8% of all rows, T/G kappa 0.84, all-code kappa 0.78. Wave 2 (tsconfig, md, jsonc, toml, jsonl, glob; 2,909 rows): T/G disagreements 2.5%, T/G kappa 0.72; all-code kappa 0.59, lowered by H-versus-N splits that no longer route anything once absorption is in scope.

Rejected: reading 5% over the T/G-union rows, which no brief reached because shrinking T to the obvious cases shrinks the denominator faster than the disagreements; and an all-code kappa gate, which would discard waves over H-versus-N labels that decide no deletion.
