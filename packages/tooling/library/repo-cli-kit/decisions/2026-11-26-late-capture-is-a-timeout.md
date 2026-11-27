---
title: A capture that ends after its deadline is a timeout whatever the child's exit code
date: 2026-11-26
reversal: Classify a capture by its exit code alone in settleCapturedStep.
governs:
  - src/process/StepExec.ts#settleCapturedStep
enforcedBy: []
---

The deadline race interrupts the capture and kills the child, but a child that handles the signal by flushing a summary and exiting zero inside the kill grace still delivers a complete capture through the interrupted fiber. settleCapturedStep therefore fails with CaptureCommandTimedOutError whenever the elapsed time reached the timeout, keeping a tail of at most CAPTURE_TIMEOUT_TAIL_CHARS characters.
Rejected: trusting the exit code, under which Turbo exited 0 with 52 of 141 tasks after exactly the 15-minute cap and the step passed.
