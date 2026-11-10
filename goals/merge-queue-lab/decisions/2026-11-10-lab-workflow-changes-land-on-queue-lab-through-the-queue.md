---
title: "Lab workflow changes land on queue-lab through the queue"
date: 2026-11-10
lane: "docs/merge-queue-lab-findings"
reversal: "Add an admin bypass to ruleset 26917133 and push to queue-lab directly."
---

A direct push to queue-lab is refused by the lab ruleset for an org admin who is not a bypass actor (finding 5e). Every lab workflow change is therefore a synthetic pull request enqueued like any other, which doubles as evidence for workflow-touching enqueues (10c).
