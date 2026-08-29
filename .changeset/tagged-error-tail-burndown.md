---
"@beep/acp": patch
"@beep/agents-use-cases": patch
"@beep/api-transport": patch
"@beep/architecture-lab-domain": patch
"@beep/architecture-lab-use-cases": patch
"@beep/chalk": patch
"@beep/db-admin": patch
"@beep/dock": patch
"@beep/documents-domain": patch
"@beep/documents-use-cases": patch
"@beep/editor": patch
"@beep/effect-drizzle": patch
"@beep/epistemic-domain": patch
"@beep/epistemic-use-cases": patch
"@beep/file-processing": patch
"@beep/html": patch
"@beep/identity": patch
"@beep/langextract": patch
"@beep/law-practice-server": patch
"@beep/law-practice-use-cases": patch
"@beep/lexical-schema": patch
"@beep/md": patch
"@beep/nlp-processing": patch
"@beep/observability": patch
"@beep/oip-web": patch
"@beep/ontology": patch
"@beep/ontology-client": patch
"@beep/ontology-domain": patch
"@beep/ontology-use-cases": patch
"@beep/pandoc-ast": patch
"@beep/practice-kg-mcp": patch
"@beep/professional-desktop": patch
"@beep/provenance": patch
"@beep/qa-capture": patch
"@beep/rdf": patch
"@beep/repo-ai-metrics": patch
"@beep/repo-cli": patch
"@beep/repo-docgen": patch
"@beep/repo-utils": patch
"@beep/schema": patch
"@beep/semantic-web": patch
"@beep/shared-domain": patch
"@beep/test-utils": patch
"@beep/ui": patch
"@beep/utils": patch
"@beep/workspace-use-cases": patch
---

Complete the tagged-error declared-equivalence burn-down outside the drivers
family: every remaining `S.TaggedError` declaration (317 across 46 workspaces)
now carries a fields-only `toEquivalence` annotation, opaque `S.Defect`
payloads are excluded from diagnostic identity, and each package gains an
equivalence regression test. The `SFV4-tagged-error-equivalence` exceptions
leave `standards/schema-first.inventory.jsonc`; new declarations are gated by
the detector directly. Doctrine: `standards/architecture/DECISIONS.md`
(2026-08-24: Tagged Errors Declare Diagnostic Equivalence).
