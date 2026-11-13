---
title: "Text reservation is an explicit argument across the process boundary"
date: 2026-11-13
reversal: "Restore the optional budget lookup in RegexInput."
---

Operator ruling, 2026-11-13: constructors shared with isolated worker entrypoints take text reservation as an explicit generic Effect callback and propagate its requirements. Parent callers pass reserveCitationInvocationText, which reads CitationInvocation at call time. Worker callers and pattern preparation pass an explicit named no-op. Reservation ordering before allocation is unchanged. Worker entrypoints, wire protocols, processes, leases and limits stay unchanged. This resolves the historical stop in history/evidence/2026-11-13-a2-binding-stop.md; the stop rule remains active for any second incompatible site.
