---
title: "Fixtures are read from the archive at a pinned commit"
date: 2026-11-10
reversal: "Restore the fixtures into this packet with lint excludes if archive access proves unworkable in P0."
---

The fixtures contain planted law violations. Reading them from the goals archive at commit 94b8d15cd23bd07a95f6f1ab0680d24b94c5103b keeps that TypeScript off this repository's lint surface and adds no excludes.
