---
title: "P4: require explicit native creation facts at party projection boundaries"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Version the party creation request and migrate callers without changing existing core identities or source assertion ids."
---

Party projection entry points receive an explicit native ActivityStart, generation end, knowledge start, asserting agent and scope. Existing source activity ids and assertion timestamps remain source provenance; they are never relabeled as content-addressed generation facts. The projection mints text occurrences only from TextOccurrence receipts, and retains non-text assertion references separately with empty text support. Ledger writes store cores, generation receipts, evidence links, review records and signal records separately; reads join them at an explicit asOf time.
