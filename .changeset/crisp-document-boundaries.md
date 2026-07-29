---
"@beep/html": minor
"@beep/md": minor
"@beep/lexical-schema": minor
"@beep/pandoc-ast": minor
"@beep/editor": minor
"@beep/agents-client": patch
"@beep/agents-use-cases": patch
"@beep/ontology-client": patch
---

Harden the schema-first document stack across HTML, Markdown, Lexical, Pandoc,
and the editor. Add explicit strict/lossless and safe/conformant boundaries,
preserve compatibility wires where required, fix recursive URL-policy and
runtime editor defects, and validate user-authored Markdown at chat RPC edges.
