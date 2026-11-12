---
title: "A10 Cross-process writers: one O_APPEND write per line, no lock"
date: 2026-11-10
reversal: "Move to a SQLite store, per the exploration's rabbit hole."
---

Each row is one `O_APPEND` write of one line to a local regular file, with no lock and a 4 KiB line cap as a sanity bound; the reader skips torn lines. The sampler lease is an exclusive create, a stale lease (120 s) is reclaimed by rename, and the due check is repeated after acquiring it.

Resolves SPEC ambiguity A10 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").
