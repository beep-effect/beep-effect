---
title: "Update the existing draft without starting a readiness monitor"
date: 2026-11-13
reversal: "Use the default Yeet PR tail to submit a readiness monitor"
---

Publish this review wave through Yeet publish --staged-only --no-pr. PR #3265 already exists, so the push still raises its normal synchronize event and keeps its draft state. The no-pr option skips the PR tail (creation, label changes, provenance restamping and the automatic readiness monitor); cheap gates and the head-install preflight remain mandatory. The existing provenance footer describes the same branch, workspace and agent and has no head-SHA field. Replace the existing body separately through Yeet gh pr body, preserving its provenance footer. This honors the task's explicit no-watch instruction without launching and then interrupting a monitor.
