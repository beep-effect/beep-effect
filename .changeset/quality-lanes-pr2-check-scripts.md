---
"@beep/architecture-lab-proof": patch
"@beep/duckdb": patch
"@beep/effect-drizzle": patch
"@beep/graph-3d": patch
"@beep/observability": patch
"@beep/oip-web": patch
"@beep/practice-kg-mcp": patch
"@beep/professional-desktop": patch
"@beep/storybook": patch
"@beep/todox": patch
---

Quality-lane hosted/overlay cleanup (PR-2): the apps and labs drop the duplicate `tsc -p tsconfig.json --noEmit` pass from `beep:check` (the `tsc` binary is the same patched Effect compiler `tsgo` runs); observability and graph-3d wire their examples and stories projects into `beep:check`; duckdb and effect-drizzle move overlay-only compiler settings back into their canonical tsconfig. Script and tsconfig changes only; no runtime behaviour changes.
