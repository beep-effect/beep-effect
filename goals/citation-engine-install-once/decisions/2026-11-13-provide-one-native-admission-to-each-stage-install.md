---
title: "Provide one native admission to each stage install"
date: 2026-11-13
lane: "perf/citation-hoist-installs"
pullRequest: 3282
reversal: "Let each nested install capture its own fallback native admission."
---

Review round 1: helpers and child stages installed in a stage's own body ran before makeCitationMetadataOperation captured its fallback native admission, so a standalone stage (tests, direct callers) got one admission per evaluator instead of the stage's one. provideCitationStageAdmission captures the host admission, or creates one fallback, right after the stage decodes its limits, and provides it to the whole install: makeCitationMetadataStage, the publication metadata operation, post-case, law, journal, case metadata, reference tokens and the extraction loop. makeCitationMetadataOperation now requires the admission and no longer has its own fallback, which only that path could reach. The engine is unaffected; it always supplies the host admission.
