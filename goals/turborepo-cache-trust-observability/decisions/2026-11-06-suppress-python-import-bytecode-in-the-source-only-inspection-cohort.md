---
title: "Suppress Python import bytecode in the source-only inspection cohort"
date: 2026-11-06
lane: "codex/cache-import-bytecode-20261106"
reversal: "Remove the source-only job environment guard and its regression assertions; retain immutable observations, failed comparisons and the canonical digest policy."
---

The two actual observations at accepted source e68e1d1e06 each pass internal consistency, but their raw canonical digests differ. All ten differing file content hashes are classified Python bytecode in node-gyp; source files, names, sizes and package metadata match. Retain the failed pair and all actual report hashes in research/file-level-dependency-drift-2026-11-06.json. The exact generation mechanism is not yet proven.

Set PYTHONDONTWRITEBYTECODE=1 only for the credential-free source-inspection job, before its existing dependency install. Leave ordinary verification, candidate builds and signed execution unchanged. This is a controlled prevention experiment: every original archive byte remains hashed, with no bytecode filter, normalization or post-install cleanup.

Add hosted controls for identical import output and preserved source bytes with the guard, ordinary import cache creation and raw digest invalidation without it, and workflow scope isolation. Keep the existing resource caps. After primary acceptance and hosted proof, require two fresh serial real observations before claiming repeatability. No producer approval, production trust, signing activation, task qualification or observation-window completion follows from this preparation.
