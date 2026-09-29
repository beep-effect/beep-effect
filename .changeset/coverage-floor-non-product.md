---
"@beep/api-transport": patch
"@beep/architecture-lab-config": patch
"@beep/architecture-lab-server": patch
"@beep/lint-rules": patch
"@beep/nlp-processing": patch
"@beep/observability": patch
---

Add test coverage for paths that had none: the shared transport client applying
each auth strategy and recording the rate-limit snapshot, the oxlint rules that
only ran out of process, the NLP service facade and its layer accessors, the
remaining log-banner kinds, the WorkItem config visibility entries and live
provider overrides, and the architecture-lab server's lifecycle errors, HTTP
error mapping, and Drizzle repository adapters. Test-only; no runtime change.
