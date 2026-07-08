---
"@beep/repo-ai-metrics": patch
---

Additive extensions to @beep/repo-ai-metrics from the repo-cli modularization
campaign: `withAiMetricsDuckDb` scoped DuckDB provider plus data-root
constants, extracted so the repo-cli AIMetrics command group consumes a shared,
owner-local helper instead of an in-CLI copy. Behavior-preserving.
Campaign packet: `goals/repo-cli-modularization/`.
