---
title: "P4: new review hub items.jsonl lines use a review-item/v2 envelope"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "No stored-data reversal is needed: v1 bytes are untouched; switching writes back means re-pointing the writer at the untagged v1 shape."
---

New items.jsonl lines are written as {format: review-item/v2, item}. Untagged v1 rows are read only through the frozen private ReviewItemLine reader, which projects nonempty quotes to QuoteSelector and empty ones to LegacyQuoteUnresolved; v1 bytes are never rewritten.
