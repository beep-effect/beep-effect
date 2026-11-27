---
title: A capture reaps the child's process group after a drain grace instead of waiting for pipe EOF
date: 2026-11-26
reversal: Drop capturePipeDeadline from the capture race and let the stream fold end only at pipe EOF.
governs:
  - src/process/StepExec.ts#capturePipeDeadline
  - src/process/StepExec.ts#CAPTURE_DRAIN_GRACE
  - src/process/StepExec.ts#CAPTURE_REAP_GRACE
  - src/process/StepExec.ts#CAPTURE_FORCE_KILL_REAP_GRACE
  - test/step-capture-lifecycle.test.ts#makeStuckSpawner
enforcedBy: []
---

A capture ends only at pipe EOF, which needs every inherited write end closed. A child that exits successfully gets no group cleanup from the spawner, and an orphaned grandchild can hold the write end forever; spawns are detached session leaders, so the runner's own setsid reap cannot reach them either.
After the child exits, stragglers get CAPTURE_DRAIN_GRACE (2 s); then the child's group is killed and the kernel gets CAPTURE_REAP_GRACE (3 s) to deliver EOF. A capture still open after that dies with CapturePipeWedgedError naming the command. A timed-out capture's forced kill gets CAPTURE_FORCE_KILL_REAP_GRACE (1 s) more before cleanup detaches from a child whose exit signal was lost.
On the normal path the deadline is interrupted the moment the stream ends, so it costs nothing.
Rejected: waiting for EOF alone, which left policy lanes silent for 29-40 minutes until job cleanup reaped the wedged wrapper chain.
