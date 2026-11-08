---
title: "P1 implemented, P2 measured"
date: 2026-11-08
kind: checkpoint
reversal: "n/a"
---

The scoped schema-catalog writer now splices per file: it drops each in-scope owner's committed entries for the staged paths, parses only the staged files the full scan would read, and merges the result, with the full run unchanged and sharing the same entry-collection helper. Exports are read syntactically instead of through ts-morph isExported(), which built the type checker. The five-fixture scoped run fell from 5.31 GB / 15.3 s to 0.63 GB / 2.1 s with byte-identical shards; the full check stays current and the full writer leaves the tree clean. Tests added in catalog-shard-scope.test.ts cover add, modify, delete, move, an unstaged sibling that is never parsed, a malformed shard, and an instrumentation-writer move.
