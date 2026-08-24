---
"@beep/nlp": minor
"@beep/langextract": patch
---

`AnnotatedDocument` now carries `mentions: ReadonlyArray<Mention>` and pins
`version: "nlp-ir/1.1"`. Entities always referred to mentions by id, but no
producer ever placed a `Mention` in the envelope, so every per-occurrence
character span was dropped at the handoff boundary. The `Span` annotation now
states its unit: zero-based UTF-16 code units, which is what alignment and
`String.length` produce.

`@beep/langextract` `toAnnotatedDocument` emits one `Mention` per aligned
extraction, carrying the aligned `span` and `matchedText` against the single
document chunk, alongside the entity that references it.
