---
title: "Bind direct-stage fixtures to installed constants and observe the real invocation budget"
date: 2026-11-13
reversal: "Restore the standalone stage fixtures and their captured-budget assertions."
---

Direct-stage tests use one shared fixture helper that opens an invocation per standalone method call with that fixture policy and installed Clock. The enclosing test scaffold is untimed; method invocations retain their real configured deadlines. A test-only observation service points legacy diagnostic snapshots and callback reservations at the actual budget constructed by openCitationInvocation, rather than the discarded install-time budget. Obsolete EnclosingRefusal assertions and install guards are removed. No production deadline or limit value changes.
