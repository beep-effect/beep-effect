---
title: "MemoryFilePath carries the memory-file rule, so no event can name a path outside the folder"
date: 2026-11-10
lane: "agent-memory-store-p1"
reversal: "Return MemoryFilePath to a non-empty PosixPath and filter at the scan, by decision file citing a memory path the schema rule refuses wrongly"
---

Review finding on PR 3058: MemoryFilePath was only a non-empty PosixPath, so an agent-written NodeCreated could open ../escape.md, .git/x.md or notes.txt and exportFolder would write it. The rule of decision memory-files-are-md-files-outside-dot-segments now lives in the schema as one pattern check: a relative path ending in .md whose segments are non-empty and do not start with a dot (PosixPath already refuses backslashes). isMemoryFilePath is the derived guard S.is(MemoryFilePath). Every payload, store row and projection that carries a file path decodes through it, so the append fails before the journal writes anything (a MemoryLogError whose cause is the schema error naming filePath, and the batch appends nothing), and the projection refuses such an entry at decode, so export fails with ProjectionError before any write even when a damaged database or a writer that skipped the schema holds one. Tests: the memory-file-rule append case in test/MemoryLog.test.ts and the damaged-entry export case in test/MarkdownProjector.test.ts. Rejected: a separate path check in the NodeCreated handler (the schema already refuses at encode, and a second rule could drift from the scan's).
