---
title: "Generated blocks are regenerate-driver candidates; .gitattributes handoff to the manifest-research lane"
date: 2026-11-05
lane: "feat/goal-packet-decision-files"
reversal: "Leave the two paths out of the regenerate allowlist; merges then conflict inside the block and are resolved by running decisions write after the merge, which is already the documented repair."
---

The SPEC.md and PLAN.md blocks are pure projections of `decisions/*.md`, so they qualify for the `regenerate` merge driver (`scripts/regenerate-merge-driver.sh`, `.gitattributes`). This lane does not edit those two files: the sibling lane feat/goal-manifest-research-projection is making `ops/manifest.json` `research[]` a directory projection and owns both edits. Handoff: that lane adds `goals/*/SPEC.md` and `goals/*/PLAN.md` to the allowlist only if the driver learns to regenerate a marker block inside an otherwise authored file; until then the documented repair is to merge main and run `bun run beep goals decisions write --slug <slug>`. The doctor keeps both honest either way.
