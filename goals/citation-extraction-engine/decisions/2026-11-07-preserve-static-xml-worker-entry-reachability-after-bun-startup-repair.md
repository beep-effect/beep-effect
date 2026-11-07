---
title: "Preserve static XML worker entry reachability after Bun startup repair"
date: 2026-11-07
kind: checkpoint
reversal: "Revisit when the scanner can follow conditional URL arguments without explicit literal constructors."
---

Fix the three source-backed unused-file findings from hosted Fallow run 42353625579 by selecting literal URL constructors. Preserve actual worker paths, limits, redaction and assertions. All six callback/XML tests and both original resolution assertion tests pass; hosted unit-d and exhaustive acceptance remain open. Evidence: history/evidence/2026-11-07-xml-worker-entry-reachability.md.
