---
title: "The Markdown partition is total and coarsens on unusable parser positions"
date: 2026-11-10
lane: "agent-memory-store-p1"
reversal: "Replace the fallback ladder by decision file citing a file where a coarse node blocks an AC-2 or AC-3 merge that a finer recovery would admit"
---

The partition in packages/tooling/library/agent-memory-store/src/MarkdownPartition.parser.ts is total: it never fails and never drops a byte, whatever @beep/markdown yields. Positions are checked, not trusted, and each failure coarsens only as far as it must. A top-level block whose child spans overlap, run backwards, leave the block or split a surrogate pair becomes one node of the block kind (a list becomes one listItem node, a table one tableRow node), and the partition reports fallback block. Top-level positions that overlap, run backwards, leave the file or split a surrogate pair make the whole file one paragraph node, fallback file. A file the parser rejects outright (a hardening guard such as the 256-level nesting cap) is one paragraph node, fallback unparsed. Zero-width spans are dropped because they hold no bytes. MarkdownPartition carries the fallback level so the importer and the projector can report coarse files instead of hiding them. On the 3,579 tracked goals Markdown files every file partitions at fallback none. Rejected: failing the import on a parse anomaly (AC-8 needs every nonempty folder importable) and repairing overlapping positions by clipping (a guess about which node owns the bytes).
