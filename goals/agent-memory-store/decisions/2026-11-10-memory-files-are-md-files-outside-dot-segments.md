---
title: "Memory files are .md files outside dot segments"
date: 2026-11-10
lane: "agent-memory-store-p1"
reversal: "Widen or narrow isMemoryFilePath by decision file citing a memory folder file the rule misclassifies"
---

The projector reads and writes only the regular files under the folder whose relative path ends in .md (lowercase, case-sensitive) and has no path segment starting with a dot. The rule matches the Claude Code memory folder (MEMORY.md plus note files) and the goals fixture, keeps version-control folders, editor swap files and the projector's own temporary files (.name.agent-memory-store-tmp, written then renamed) out of the log, and leaves every other file in the folder untouched: never read into the log, never written, never deleted. Upper-case .MD and other Markdown extensions are not memory files. Code: isMemoryFilePath in packages/tooling/library/agent-memory-store/src/MarkdownProjector.layer.ts; test: the memory-file rule case in test/MarkdownProjector.test.ts. Rejected: every file in the folder (binary attachments cannot be partitioned) and a configurable glob (no second consumer asks for one).
