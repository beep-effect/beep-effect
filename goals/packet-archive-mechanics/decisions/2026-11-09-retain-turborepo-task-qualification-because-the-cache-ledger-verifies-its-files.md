---
title: "Retain turborepo-task-qualification because the cache ledger verifies its files"
date: 2026-11-09
lane: "feat/packet-archive-batch-4"
reversal: "Remove the retentionReason and archive the packet after moving the four reviews and rewriting the ledger paths"
---

standards/cache-qualification.json verifies four research reviews in this packet by path and SHA-256, including in its history entries. Rewriting those paths would alter an append-only ledger, so the packet stays on main with a retentionReason, as citation-extraction-engine and catalog-writer-incremental already do. Live inputs of five other batch 4 packets moved to standards/, scripts/, .semgrep/ and a test fixture.
