---
title: "Create the archive repo and add its beep refs member in the P0 PR"
date: 2026-11-06
lane: "feat/packet-archive-mechanics"
pullRequest: 2801
reversal: "Remove the goals-archive member from scripts/references.json and its two refs test rows; archive or delete beep-effect/beep-effect-goals-archive only if no tombstone links into it"
---

The earlier decision deferred the goals-archive member until the repo existed, because provisioning a member with no remote breaks every checkout. The agent created beep-effect/beep-effect-goals-archive (public, wiki and issues off) and seeded main with the projection README that ArchiveStore writes, so the member is safe now and rides #2801. The SSH URL is used because the archive checkout must push. bun run beep refs provision linked .repos/goals-archive at 4ca1a37. The ledger is still regenerated at a main SHA in its own PR before batch 1.
