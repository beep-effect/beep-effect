---
title: "Online closeout classification blocks only on settled failures, and yeet sweep --retire runs it"
date: 2026-11-13
lane: "feat/goal-closeout-hosted-verification"
reversal: "Block on every unverified committed closeout; drop the sweep hook or add a hosted online job; drop the operatorRuling key."
---

Agent decision (`research/design-pr-a.md` DN-13, DN-14, DN-15). DN-13 and DN-14 are amended by orchestrator ruling 2026-11-12.

- DN-13 (ruling: the critic's split is accepted): online, every committed closeout is classified by `Goals/CloseoutCheck.ts`. These are blocking `closeout-unverified #N`: a final merged within the last 28 days that is `unsatisfied`, or `unknown` for a structural reason (`rule-suite-unavailable` inside the window, `inventory-mismatch`, `deleted-ruleset-unrecoverable`, `unsupported-rule-source`, or a required context with no run and no claim); and a final closed without merging, at any age. Transient reasons stay advisory as `completion-gate-unknown`: failed GitHub reads, partial ruleset reads, an unobserved inventory, a failed thread or fix-PR read, and a required run that is still `pending`. An open final gets no finding. A final merged more than 28 days ago that does not verify gets a note. Offline mode never blocks.
- DN-14 (ruling): PR A adds no hosted workflow, and the hosted `goals:doctor` lane stays offline. The automatic trigger is `yeet sweep --retire`. After the retirement and the clone sweep (which fetches `origin`), it classifies every packet the merged branch touched whose `origin/main` manifest has a committed closeout. A blocking outcome appends a P0 `local-shard-failed` row (shard `goal-closeout:<slug>#<N>`) to the owning clone's inbox and prints `[yeet] P0 closeout-unverified ...`. A verified outcome clears that row, and so does `goals completion refresh` printing verified in that clone. The exit status stays 0, because the lane is already gone and the documented `... && cd "$CLONE"` recipe must still run.
- DN-15: the operator-ruling exit is machine-readable, as `operatorRuling: { finalPullRequest }` in decision frontmatter. A committed ruling turns `closeout-unverified` for that final into a note that names the file.

Reverse: block on every unverified committed closeout, transient reasons included; drop the sweep hook, add a main-push workflow step that runs `goals doctor --online` under the App identity, or make the sweep exit 1; drop the `operatorRuling` key.
