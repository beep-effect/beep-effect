---
"@beep/schema": minor
"@beep/rdf": minor
"@beep/html": minor
"@beep/md": minor
"@beep/lexical-schema": minor
"@beep/pandoc-ast": minor
"@beep/repo-configs": patch
"@beep/test-utils": minor
---

Add a shared, schema-first conformance vocabulary and apply it across the
document-modeling stack. HTML, Markdown, Lexical, and Pandoc now publish pinned
source ledgers, explicit invariant coverage, strict runtime inspection, and
tagged-union helpers for semantically significant variants. RDF projects the
same provenance into semantic metadata, while test utilities verify that code,
annotations, ledgers, and named test evidence stay aligned.

The new APIs preserve broad lossless ASTs where the specifications permit
nonconforming input, then expose profile-specific reports and strict branded
results for callers that require proven conformance.
