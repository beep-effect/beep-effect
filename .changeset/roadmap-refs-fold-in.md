---
"@beep/repo-cli": patch
---

Fold `lint roadmap-refs` into the shared knowledge link parser (ratified decision A7,
goals/knowledge-surface-automation). The census's Markdown link-destination extraction is now the
exported `knowledgeLinkDestinations` reader, consumed by both the census link bus and the roadmap
lint, so one grammar decides what counts as a link everywhere. The roadmap lint gains
fence-awareness from `knowledgeDocumentLines` (links inside code fences are no longer linted) and
keeps only its roadmap-specific concerns: the goals/explorations domain filter, trailing phase
snapshots — now with a bounded one-line lookahead pinning the live roadmap's wrapped-entry style
instead of an unbounded newline-spanning regex — and reference-style link definitions. Command
name, CI step id, finding schemas, output lines, and exit semantics are unchanged.
