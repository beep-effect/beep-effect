---
title: "Persist, then render, under a deadline; the console is unconditional"
date: 2026-11-19
lane: "feat/gate-report-services"
reversal: "Render before the writes and print the path line from a second pass."
---

Upstream renders before it persists. Here the record step runs first, because the path line prints the log's written size, and it runs under a deadline the caller sets (10 seconds by default). Anything other than success becomes one omission line: a write error, a missed deadline, a defect, a log stream error or an incomplete event list. The run entry then settles the report itself, completing a missing start or end, so it cannot fail: the console always begins and ends with the verdict and the exit code is the tool's. The path line appears only when both files were confirmed written; otherwise the line says the record and log are unavailable, since a write may have landed without confirmation.
