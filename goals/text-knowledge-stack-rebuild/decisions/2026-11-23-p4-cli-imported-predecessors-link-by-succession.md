---
title: "P4: CLI native cores link imported predecessors through a separate succession record"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Drop the Succession event kind and read native cores without imported predecessors; old v1 lines and v2 cores are unchanged."
---

ClaimCore.supersedes names only a content-addressed ClaimId, and an imported legacy row has no ClaimId. A Holds renewal (or Kb revision) of an imported claim therefore appends a native v2 core with no supersedes field plus a separate Succession record from ClaimReference Imported{ledger, oldId} to the new ClaimId. The history reader closes the imported knowledge interval at the successor's knowledge start, refuses a second successor (fork), an unknown target or a logical-key mismatch with ClaimHistoryRefused, and never relabels the old id as a hash. Review changes are separate Review events, never new cores. Renewal facts (activity, generation end, knowledge start, agent, scope) are supplied by the effectful program, not a hidden clock.
