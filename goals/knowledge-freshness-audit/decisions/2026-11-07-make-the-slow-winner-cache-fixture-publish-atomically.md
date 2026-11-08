---
title: "Make the slow-winner cache fixture publish atomically"
date: 2026-11-07
kind: checkpoint
lane: "codex/audit-semantica-winner"
reversal: "Revert the fixture-only commit; production cache behavior is unchanged."
---

A local final-check coverage run exposed ProviderCacheCorrupt in the Semantica healthy slow-winner fixture. The same source passed in a parallel run. The fixture wrote JSON directly to its published path, while the production writer stages and atomically renames. A controlled pause in that direct-write window reproduced the same schema decode failure. The fixture now stages its bytes and renames after the write; the retained observer asserts that lookup sees no entry during the incomplete staging write. All 22 provider-cache tests pass, while the direct-write negative control fails. Production cache code, corruption handling, retry schedule, 30-second test deadline and four-second watchdog are unchanged. The original failing run did not capture the partial bytes, so this validates and repairs the fixture race without claiming it is the exclusive cause of every historical failure. The touched fixture now builds its runtime through it.layer and uses the explicitly provided test clock that the bounded retry driver advances. Native test-policy analysis resolves two existing findings (14 to 12) with zero introduced findings and no baseline changes. Full package verification passes after that harness change (lint and audit; app docgen is not applicable), and package coverage passes all 140 tests across 16 files. Hosted proof remains pending. PM and ADHD holds are separate; no cloud admission or spending.
