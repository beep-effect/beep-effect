---
title: "CTRF and SARIF stay lossless through an extension bag"
date: 2026-11-19
lane: "feat/gate-report-core"
reversal: "Change the interchange mapping module."
---

Fields neither format has a native slot for travel in CTRF `extra` and SARIF `properties`. A warned item maps to CTRF `other` and SARIF `review`; a skipped item maps to SARIF `notApplicable`. The mapping functions exist for the round-trip test only; the emitters stay deferred.
