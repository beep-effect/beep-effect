---
title: "Align the manifest completion statement with two-PR adoption"
date: 2026-11-08
kind: checkpoint
reversal: "Revert this wording alignment if the canonical lifecycle changes; never claim completion from an unmerged adoption."
---

The authored completionGate.statement retained same-PR lifecycle wording after PR2926 corrected the launcher and acceptance audit. Follow the existing SPEC and Agent Guide: final evidence, reflection and proposedCloseout land with implementation while status stays active or paused; after merge, completion refresh verifies the proposal and a separate packet-state PR adopts completed-retained. That PR must merge and origin/main must show matching closeout and initiative statuses. Preserve all behavioral, hosted-proof and observation requirements; this records no completion or runtime activation.
