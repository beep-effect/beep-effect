---
title: "Synthetic branches use the queue-lab- prefix, not queue-lab/"
date: 2026-11-10
lane: "docs/merge-queue-lab-findings"
reversal: "Rename the lab base branch (for example to lab/queue) and switch the synthetic prefix back to a slash form."
---

SPEC.md asked for synthetic branch names starting with queue-lab/. Git cannot hold refs/heads/queue-lab and refs/heads/queue-lab/<x> at once (a ref is a file or a directory, not both), so the first push failed with 'cannot lock ref'. Synthetic branches are named queue-lab-<slug>; cleanup matches that prefix.
