---
"@beep/anthropic": minor
"@beep/ciops": patch
"@beep/documents-domain": patch
"@beep/documents-server": minor
"@beep/epistemic-client": patch
"@beep/epistemic-domain": minor
"@beep/epistemic-server": minor
"@beep/epistemic-tables": patch
"@beep/epistemic-ui": patch
"@beep/epistemic-use-cases": minor
"@beep/file-processing": minor
"@beep/govinfo": minor
"@beep/langextract": patch
"@beep/law-practice-domain": minor
"@beep/law-practice-server": minor
"@beep/law-practice-use-cases": minor
"@beep/lejeune-bolt-workbench": patch
"@beep/lexical-schema": minor
"@beep/libpff": minor
"@beep/m365": minor
"@beep/md": minor
"@beep/nlp-processing": minor
"@beep/openai-compat": minor
"@beep/openai": minor
"@beep/pandoc-ast": minor
"@beep/practice-kg-mcp": patch
"@beep/professional-desktop": patch
"@beep/repo-ai-metrics": minor
"@beep/repo-configs": minor
"@beep/repo-docgen": minor
"@beep/semantica": patch
"@beep/shared-domain": minor
"@beep/skill-contract": minor
"@beep/tika": minor
"@beep/uspto-mcp": minor
"@beep/wink": minor
"@beep/workspace-server": minor
---

Replace the retired `@beep/schema` `Int` concept under the "Upstream-First Foundation/Modeling"
decision (`standards/architecture/DECISIONS.md`, 2026-09-29). `PosInt` is now a consumer-local
`S.Int.check(S.isGreaterThan(0))`: each package with two or more production consumers owns one
`PosInt` module (`src/internal/PosInt.ts` or the package's schema folder), and single-consumer
files, tests, and JSDoc examples declare it in place. `NonNegativeInt` imports move from
`@beep/schema/Int` to `@beep/schema/Number`. Packages that export schemas built on `PosInt` take
a minor bump because their decoded types lose the `Int` and `PosInt` brands and become `number`;
accepted values and encoded bytes are unchanged, and validation messages now come from the
upstream checks.
