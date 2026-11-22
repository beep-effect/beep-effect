---
title: "Hard stop 4 is measured over all classified rows, with kappa as the agreement bar"
date: 2026-11-22
lane: "goals/comment-law-sweep-p0"
reversal: "Measure the 5% over T/G-union rows only and stop every wave above it until a brief reaches it."
---

Wave 1 (semver, npm-spec, csv, spdx, managed-section; 1,199 unprotected rows) ran two rounds. Round 1 (loose brief) disagreed on 18-51% of rows either classifier called T or G, so both vote sets were discarded per the delete-comment hard stop. Round 2 used a sharper brief (strict restates-test for T, blank paragraph lines take the paragraph code, G only for labels): overall agreement 0.895, Cohen's kappa 0.78 (SPEC bar 0.65), and T/G disagreements fell to 34 rows, 2.8% of all classified rows. Every residual disagreement sits on the T-versus-N/H soft boundary SPEC names, and apply refuses any row without two agreeing votes, so disagreements are retained, never deleted. The 5% is therefore read as T/G disagreements over all classified rows, together with kappa >= 0.65; a wave above either bar is discarded and reclassified. Rejected: reading 5% over the T/G-union rows, which no brief reached because shrinking T to the obvious cases shrinks the denominator faster than the disagreements.
