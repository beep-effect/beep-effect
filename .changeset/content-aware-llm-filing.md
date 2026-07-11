---
"@beep/doc-text": minor
"@beep/documents-domain": minor
"@beep/documents-use-cases": minor
"@beep/documents-server": minor
---

Content-aware LLM document filing (legal-document-intake P2, D8-S1).

The FilingDecision port accepts an optional bounded text excerpt and returns
a FilingOutcome union: filed under a taxonomy concept with confidence and
rationale, or inboxed (llm-unavailable / low-confidence / no-match) into
`00-inbox/{batch}/` — never a silently guessed folder. A new JS-native
`@beep/doc-text` driver (unpdf PDF text layer + mammoth DOCX, no JVM, no OCR)
feeds extraction through a never-failing seam behind the file-processing
capability, and `FilingDecisionLlmLayer` classifies with a single-shot
schema-validated Anthropic call under a typed config contract. The
deterministic heuristic remains the fixture-mode layer.
