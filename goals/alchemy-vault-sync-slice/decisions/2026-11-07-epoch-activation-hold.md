---
title: "Keep activation fenced until writer epoch and both reversal cases are proven"
date: 2026-11-07
reversal: "Replace this hold only after the epoch guard, legacy writer deletion, and pre/post-admission reversal tests pass in the same cutover change."
---

The offline importer and pre-admission backup are implementation prerequisites. They do not activate a writer epoch. The existing executable predates any epoch-aware startup check, so adding only a new startup condition cannot prove that an older executable refuses the migrated store. Production cutover must include a database-level stale-writer refusal and the startup compatibility boundary, plus a tested post-admission reversal that retains accepted events. Until these exist, keep legacy application composition and do not claim D7 cutover acceptance.
