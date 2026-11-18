---
title: "The GitHub-check report's durable file sits beside the inner-lane report"
date: 2026-11-18
lane: "fix/gate-output-quiet-surfaces"
reversal: "Print the envelope to stdout again and drop the file-name constant and its delete in the Yeet handler."
---

Settles the open P0 point for fix 4. The report is appended to `github-check-runs.ndjson` in the directory that `BEEP_YEET_INNER_LANE_REPORT_PATH` names: no new environment variable, the same append-only one-line-per-battery format as the lane report, and each line carries `parentLaneId` so the writing proof step is known. Yeet deletes it with the lane report at the start of each attempt. No production code read either envelope from stdout; the issue classifier only filtered them out. The helper that rebuilt the stdout lane envelope from the file had no remaining caller and was removed with its two tests.
