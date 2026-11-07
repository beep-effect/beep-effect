---
title: "Taxonomy refinement: packet:data, cfg:baseline, scratchpad; src:test narrowed"
date: 2026-11-07
lane: "feat/verification-route-slice-2"
reversal: "Drop the three kinds and restore the directory-anywhere src:test rule"
---

Census rank 1. New kinds are on every footprint, so the change is sound by construction. src:test no longer matches a file under the owner's src/ (packages/foundation/modeling/schema/src/internal/test/Markdown.test-kit.ts compiles into dist), and packet roots win over the test rule (goals/**/test/items.json is packet data).
