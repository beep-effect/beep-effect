---
title: Corpus programs resolve every manifest-supplied path inside its allowed root before touching it
date: 2026-11-26
reversal: Read, hash, copy and extract the manifest destPath and organize target as given, without canonicalizing them.
governs:
  - src/commands/Corpus/internal/ServicePrograms.ts#resolveWithinRoot
enforcedBy: []
---

The provenance manifest is untrusted input. Every `destPath`, salvage run root and organize target goes through `resolveWithinRoot` first: it follows symlinks, rejects absolute escapes and `..` traversal, and returns the in-root canonical path that the filesystem operation then uses. Metadata reads, extraction and salvage verification use `<corpusRoot>/raw` as the root; organize checks its source against `raw` and its taxonomy-derived target against the organized root. Salvage verification resolves before `exists` or hashing, so an escaping path cannot become an existence or hash oracle for other readable files.

Rejected: trusting manifest paths written by the CLI's own provenance step (a hand-edited or hostile manifest then reads or overwrites files outside the corpus).
