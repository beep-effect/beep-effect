---
"@beep/langextract": minor
"@beep/law-practice-server": patch
---

Add the optional `LangExtractGenerationTimeout` context service so callers can
set the deadline for one language-model generation. The package default stays
thirty seconds, which suits short passages; full-document extraction through a
hosted model routinely needs minutes, and the previous hard-coded deadline
interrupted those generations into `model-generation-timeout` degradations.
The batch aligner now also prepares its case-folded source once, skips source
preparation for an empty capped batch, rejects ambiguous exact or case-folded
occurrences, and skips fuzzy window scans at the exact-only threshold.
Refresh the law-practice server's synthetic office-action fixture so its model
entity has one uniquely groundable source occurrence under that contract.
