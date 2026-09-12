---
"@beep/api-transport": patch
"@beep/box-provisioning": patch
"@beep/chalk": patch
"@beep/colors": patch
"@beep/data": patch
"@beep/dock": patch
"@beep/duckdb": patch
"@beep/editor": patch
"@beep/file-processing": patch
"@beep/freshbooks": patch
"@beep/html": patch
"@beep/identity": patch
"@beep/infra": patch
"@beep/langextract": patch
"@beep/lexical-schema": patch
"@beep/mcp-kit": patch
"@beep/md": patch
"@beep/nlp": patch
"@beep/nlp-processing": patch
"@beep/observability": patch
"@beep/oip-web": patch
"@beep/ontology": patch
"@beep/pandoc-ast": patch
"@beep/practice-kg-mcp": patch
"@beep/professional-desktop": patch
"@beep/provenance": patch
"@beep/rdf": patch
"@beep/schema": patch
"@beep/semantic-web": patch
"@beep/skill-contract": patch
"@beep/todox": patch
"@beep/types": patch
"@beep/ui": patch
"@beep/utils": patch
---

Turbo tasks for the remaining lint-policy sublanes: doctests run as the `doctest` package task on Node (package configs keep their ordinary include outside doctest mode), `lint policy` and `beep:preflight` run the registered root tasks, and `beep:policy` retires from the two manifests that still carried it.
