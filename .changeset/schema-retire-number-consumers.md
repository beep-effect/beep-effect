---
"@beep/agents-client": patch
"@beep/agents-server": patch
"@beep/agents-use-cases": minor
"@beep/box": minor
"@beep/ciops": patch
"@beep/dock": minor
"@beep/dock-react": minor
"@beep/doc-text": patch
"@beep/documents-domain": minor
"@beep/documents-server": minor
"@beep/documents-use-cases": minor
"@beep/ecfr": minor
"@beep/epistemic-client": minor
"@beep/epistemic-domain": minor
"@beep/epistemic-server": minor
"@beep/epistemic-tables": minor
"@beep/epistemic-ui": minor
"@beep/epistemic-use-cases": minor
"@beep/file-processing": minor
"@beep/firecrawl": minor
"@beep/govinfo": minor
"@beep/langextract": minor
"@beep/law-practice-domain": minor
"@beep/law-practice-server": minor
"@beep/law-practice-use-cases": minor
"@beep/lejeune-bolt-workbench": patch
"@beep/lexical-schema": minor
"@beep/libpff": minor
"@beep/m365": minor
"@beep/mcp-kit": minor
"@beep/md": minor
"@beep/nlp": minor
"@beep/nlp-processing": minor
"@beep/observability": minor
"@beep/oip-web": patch
"@beep/onepassword-cli": minor
"@beep/ontology-client": patch
"@beep/ontology-server": minor
"@beep/ontology-use-cases": minor
"@beep/openai-compat": minor
"@beep/openclaw": minor
"@beep/pacer": minor
"@beep/practice-kg-mcp": patch
"@beep/pretext": patch
"@beep/professional-desktop": patch
"@beep/provenance": minor
"@beep/rdf": minor
"@beep/repo-ai-metrics": minor
"@beep/repo-configs": minor
"@beep/repo-docgen": minor
"@beep/semantica": patch
"@beep/semantic-web": minor
"@beep/shared-domain": minor
"@beep/skill-contract": minor
"@beep/tika": minor
"@beep/ui": minor
"@beep/uspto-mcp": minor
"@beep/uspto": minor
"@beep/venice-ai": minor
"@beep/wink": minor
"@beep/workspace-domain": minor
"@beep/workspace-server": minor
"@beep/workspace-use-cases": minor
---

Replace the retired `@beep/schema` `Number` concept, `Int64`, and fixed-width integer schemas
under the "Upstream-First Foundation/Modeling" decision (`standards/architecture/DECISIONS.md`,
2026-09-29). `NonNegativeInt` becomes `S.Natural` and `number` in type positions, `NonNegNum`
becomes `S.Finite.check(S.isGreaterThanOrEqualTo(0))`, the sign checks become
`S.isGreaterThan(0)` and its siblings, and `FiniteFromString` becomes `S.FiniteFromString`;
`@beep/govinfo` bounds its GovInfo counts with `S.BigInt.check(S.isBetweenBigInt(...))`. Packages
that export schemas built on these members take a minor bump because their decoded types lose the
`Int`, `NonNegativeInt`, and `Int64` brands; accepted values and encoded bytes are unchanged, and
validation messages now come from the upstream checks.
