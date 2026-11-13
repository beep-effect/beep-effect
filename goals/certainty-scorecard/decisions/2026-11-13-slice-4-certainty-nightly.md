---
title: "Slice 4 (MEAS-01 slice 2) in review: the certainty nightly workflow"
date: 2026-11-13
kind: checkpoint
lane: "ci/certainty-nightly-workflow"
reversal: "Delete this checkpoint so the slice-6 checkpoint is the latest PLAN status note, and revert the slice-4 PR."
---

Slice 11 (ROUT-05 slice 2) merged as #3257. Slice 4 (MEAS-01 slice 2) adds `.github/workflows/certainty-nightly.yml`: each night it scores the previous UTC day with `bun run beep ci certainty` from main's code, under the workflow token's `actions: read` and `contents: read`, with a request bound of the token bucket's remaining reads less the 15% reserve, and the run turns red when the report is not certified (decision `certainty-nightly-workflow`). The CLI gains `--summary-out`, an aggregates-only Markdown rendering used as the job summary. The record of each night goes to `history/certainty-nightly.md`, written by the driver from the run's artifact. A workflow change cannot be merged with the orchestrator App token, so the operator merges slice 4 by hand; P2's seven nights start at 2026-11-14, the first whole UTC day after both baseline breaks. Slices 10 (MEAS-03, #3262) and 7 (PERIL-11 slice 1, #3263) are in review.
