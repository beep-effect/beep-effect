---
title: "Failed and unsettled async merges hold; the poll waits about two minutes"
date: 2026-11-10
lane: "claude/trusting-hamilton-1ad7d1"
reversal: "Raise or drop the poll budget in AsyncMerge.ts, or read Unsettled as a refusal instead of a hold."
---

The P0 probes (research/merge-async-p0-probes-2026-11.md) settled the 409 body (same shape as the 202, carrying the in-flight uuid), a head that moves before the request (400, failed) or after it (failed, 'Head branch is out of date'), and an unknown or expired uuid (404). The client decodes 400 and 409 bodies from the octokit error's response.data and keeps every other status a GitHubError. A 409 attaches to the in-flight request instead of sending another. The gate polls every 2 s for up to 60 more reads: `failed` holds as `merge-failed` with GitHub's sentence; still pending, queued or expired holds as `merge-unsettled`. Neither is read as merged. The owner checkpoint keeps its rule that anything but a confirmed merge is uncertain and reconciled by readback.
