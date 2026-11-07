---
title: "Keep index-sensitive law discovery outside affected selection"
date: 2026-11-07
pullRequest: 2826
reversal: "Restore affected selection only after complete tracked-discovery invalidation qualification passes."
---

Hosted PR #2826 exposed three introduced defects: root cache/env assertions retained the previous policy, a Git fixture attempted index removal while its staged content differed from both HEAD and the working tree, and five tracked-discovery checks remained affected-filtered despite their cache hold. Move those five checks into the existing unfiltered one-slot state graph; preserve all input probes and total concurrency. Align the fixture index before removal and include sanitized Git argv in fixture failures. Author corrected exact planner/cache contracts; push to hosted CI without local quality execution. Coverage aggregation on the failed head refused UNIT_RESULT=failure; it is not an independent measured coverage regression. These corrections grant no cache qualification or final adoption.
