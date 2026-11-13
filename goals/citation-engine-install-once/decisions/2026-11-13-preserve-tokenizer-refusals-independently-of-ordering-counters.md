---
title: "Preserve tokenizer refusals independently of ordering counters"
date: 2026-11-13
lane: "feat/citation-invocation-binding"
pullRequest: 3265
reversal: "Restore the tokenizer guard deletion and missing-ID defect conversion from 76b441e82d4."
---

Restore the selected-count patternEvaluations safety refusal and typed missing-ID invalid-configuration mapping. A2 preserves these refusals independently of the ordering implementation; no coverage floor changes. Reuse one invalidConfiguration factory at the existing policy, configuration and missing-ID boundaries rather than repeating equivalent error callbacks. The real control has two unfiltered members, a limit of three and four loose-policy selections. Both bounded ordering alone and the tokenizer refuse with extract/patternEvaluations before any worker starts. In this checkout RuntimeSet copies charge the new counter for each source bucket at line 147, or through copyBuckets at lines 137-141 when capacity changes; the control therefore refuses in ordering before the restored tokenizer guard. Leave that guard alternative and the missing-ID path unforced and uncovered.
