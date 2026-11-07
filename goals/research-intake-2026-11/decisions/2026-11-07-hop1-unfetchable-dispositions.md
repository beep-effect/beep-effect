---
title: "Unfetchable hop-1 identities get rule-classified reviewed dispositions, one rule per evidence class"
date: 2026-11-07
lane: "feat/research-intake-2026-11"
reversal: "Delete the 891 reviewed-disposition captures by their review ids and re-run the generator with different rules; the sources and occurrences are untouched"
---

891 November hop-1 identities were not fetchable: 449 internal and 423 unresolved kinds (mostly paths and tokens inside the private archive's repo snapshot) and 19 X posts. Each got a reviewed disposition whose evidence binds every inventoried occurrence (document snapshot hash, position, context hash). Rules: relative and repository paths, Effect/@beep module specifiers and in-bundle document anchors are internal when the source is internally owned and non-reference otherwise (the importer admits internal only for internal ownership); slash tokens with no scheme or host and truncated URLs are non-reference; X posts are incomplete (SPEC non-goal); two Hugging Face dataset ids cited without a host are tool-blocked because reference resolution admits only GitHub proofs. 90 owner/name-shaped tokens were read individually before the rule applied. Rejected: leaving them missing (fails the readable-or-disposed criterion) and resolving them through web search (no authentic proof object).
