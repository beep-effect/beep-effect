---
title: "P7: delete-package writer outputs keep only the retired package's removals"
date: 2026-11-25
lane: "goals/text-knowledge-stack-rebuild-p7-retirement"
reversal: "Re-run the fallow health and dead-code baseline writers and commit their full output; restore a pruned comment-law shard from the parent commit."
---

The schema-org apply on the merged P6 head left two outputs outside the design's gate shape. First, the retired schema-org package's comment-law pending shard was residue: the comment law reached the lane after the design. `bun run beep laws comments --write` pruned that one stale scope (`--check` named only it) and `--check` then read findings=0; the nlp row prunes its shard the same way. Second, the fallow health baseline writer rewrote the whole file: it added 36 and dropped 4 `target_keys` entries for other packages and dropped 5 improved `finding_counts`, while schema-org had no entry in it. The dead-code baseline changed only its timestamp and sha. Both are S31 or regression inventories, so the rows restore them to the parent commit; `fallow:health:baseline:check` and `fallow:dead-code:check` (BEEP_PROOF_BASE=origin/main) stay green against the restored files, so P7's net delta in them is 0. The schema-first inventory keeps the writer's output: it removes the `Person.email` entry and refreshes line numbers of carried entries, adding none.
