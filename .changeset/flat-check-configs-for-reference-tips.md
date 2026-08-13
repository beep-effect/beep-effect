---
"@beep/shared-domain": patch
"@beep/schema": patch
"@beep/epistemic-server": patch
"@beep/law-practice-server": patch
"@beep/practice-kg-mcp": patch
"@beep/professional-desktop": patch
---

Cut heavy-lane typecheck peaks by checking reference-tip packages in flat
source mode, and name the highest-multiplicity shared schema surfaces.

The CI-graph baseline (`goals/ci-fleet-endgame/research/ci-graph-check-baseline.md`)
measured that a package's `tsgo -b` check against dependency declaration files
costs up to 6x the RSS of checking the identical surface against dependency
source: epistemic-server peaks at 23-25 GiB in build mode versus 4.3 GiB flat,
professional-desktop 19.2 GiB versus 10.9 GiB. The cost concentrates in
relating serialized structural schema types that defeat the checker's
instantiation cache.

Four packages nothing else `-b`-references (`@beep/epistemic-server`,
`@beep/law-practice-server`, `@beep/practice-kg-mcp`,
`@beep/professional-desktop`) now run their `check` script against a generated
`tsconfig.check.json` — flat, reference-free, `noEmit` — instead of
`tsgo -b tsconfig.json`. Editor and solution builds keep the composite
`tsconfig.json` unchanged. This drops every CI check process under the 13 GiB
per-process fleet budget.

`Principal`, `SourceKind` (@beep/shared-domain) and `SemanticVersion`
(@beep/schema) additionally gain named interface surfaces
(`PrincipalSchema`, `SourceKindSchema`, `SemanticVersionSchema`) annotating
their exported consts, so declaration emit references the name instead of
serializing the derived schema structurally at every consumer position —
shrinking dependent declaration files by 27-65% (for example
`Contradiction.model.d.ts` 238K -> 83K bytes).
