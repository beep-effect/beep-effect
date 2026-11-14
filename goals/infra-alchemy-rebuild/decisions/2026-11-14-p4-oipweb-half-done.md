---
title: "P4 OipWeb half done: oip.law served from Alchemy, opip-web Pulumi stacks removed"
date: 2026-11-14
kind: checkpoint
lane: "goals/infra-alchemy-rebuild-p4-oip-web-cutover"
reversal: "Rollback per decision 2026-11-14-oipweb-pulumi-cutover-done-both-stacks-removed"
---

The OipWeb half of P4 is complete: #3323 and #3339 merged, run 43591525409 deployed staging and prod, and the gate removed both `opip-web` Pulumi stacks and the two empty old buckets on 2026-11-14. This PR deletes the Pulumi program. The hosts half (AI metrics, OpenClaw) runs in its own lane; the P4 phase row stays pending until both halves land.
