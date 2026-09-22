---
"@beep/repo-cli": patch
---

Replace the fixed 18-context assertion in `beep ci lane-timings --window` with a ratified
population table keyed by ruleset history version: version 48600030 expects 18 contexts and
version 49479116 (Coverage Regression removed 2026-09-12) expects 17. An unratified version
fails closed by name, and a live report without a version accepts any ratified count.
