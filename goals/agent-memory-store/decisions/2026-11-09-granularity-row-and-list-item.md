---
title: "Node granularity is row and list-item nodes"
date: 2026-11-09
lane: "goals/agent-memory-store-p0"
reversal: "Re-baseline by decision file citing a new S1 or S14 replay on a different node model"
---

Confirmed from the spikes: S1 found top-level block spans about 33 times the real change, and S14 found list markers in trivia make the leaf model unsafe under merge. Nodes are table rows and list items inside the @beep/markdown positioned mdast (MarkdownRange carries 0-based offsets); paragraphs and headings are single nodes; fenced code is one node. The L0 raw-slice projection preserves every byte outside the touched node span (AC-1).
