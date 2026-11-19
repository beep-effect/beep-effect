---
title: "A failed record or log write is an omission, never an error"
date: 2026-11-19
lane: "feat/gate-report-services"
reversal: "Make the recorder fail on a write error and catch it in the run entry."
---

The recorder returns what it could not write as omissions beside the report. The console prints one line naming them before the closing verdict, and the exit code stays the tool's. The raw stream is read once: if the log write fails partway, the in-memory excerpt holds what was read before the failure.
