---
title: "The replay covers archived and history-only events through a tracked snapshot"
date: 2026-11-12
lane: "test/canonical-digest-census"
reversal: "Delete packages/tooling/tool/cli/test/fixtures/canonical-digest-owner/stored-packet-events.jsonl and the snapshot case in canonical-digest-owner-replay.test.ts; the live-tree case stands alone."
---

P0 count, 2026-11-12. Main has minted 76 packet event digests. Four are in the tree (four goals, one packet-created event each). The archive repository beep-effect/beep-effect-goals-archive holds 71 at commit 6187b837dc1b (61 packet-created, 9 status-set, 1 risk-tier-overridden). One exists only in history: goals/firecrawl-driver, deleted with its packet in pull request 1975 and never archived. The replay must cover the archive: it holds 71 of the 76, every parent link and every body type other than packet-created, so a tree-only replay would never exercise a chained event. The archive is a separate repository that hosted CI does not check out, so the 72 out-of-tree events are snapshotted into one JSONL fixture in the repo-cli test tree, each line naming its source commit, and the test also walks the live tree. Result: 76 of 76 recompute through JsoncFingerprint.hash; no legacy row. Refresh the snapshot with the command in research/stored-digest-replay.md when the archive grows.
