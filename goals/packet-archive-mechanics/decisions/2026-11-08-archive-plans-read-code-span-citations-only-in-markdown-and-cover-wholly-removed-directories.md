---
title: "Archive plans read code-span citations only in Markdown and cover wholly removed directories"
date: 2026-11-08
lane: "fix/archive-inbound-citations"
reversal: "Revert this PR; plans return to scanning code spans in every inbound extension and to exact removed-file matches."
---

Layered on #2979, which added code-span citations to the archive plan. Run against the 50 batch 2 packets, that plan missed two real findings, both citations of directories the tombstone keeps nothing under, because it matched only exact removed files. It also planned 15 rows outside Markdown: 12 comments, 2 JSON strings and 1 generator string in EffectSchemaInventoryPrompt.ts, whose rewrite would change generated prompt output. The knowledge doctor reads code spans only in Markdown, so those rewrites clear no finding. Plans now take code spans from Markdown only and include wholly removed directories.
