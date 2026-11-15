---
title: "monitor --until-ready --detach matches a live job by branch and takes no submit lock"
date: 2026-11-14
lane: "fix/local-proof-monitor-reuse"
reversal: "Pass a lock-held signal from publish's submit step and wrap the CLI lookup and submit in withReadyMonitorSubmitLock, or read the pull request number before matching."
---

The CLI submit knows its branch but not its pull request number, and reading the number would spend a GitHub call on every submit. A detached monitor resolves its pull request from the branch it was submitted from, so `submitProofJobReusingReadyMonitor` (`ProofJobLauncher.ts`) matches a live job submitted from the same branch in the same checkout. Publish knows the number and still matches on it once the job has bound one. The lookup does not run under `withReadyMonitorSubmitLock`: publish runs this same command as its child while it holds that lock, so taking the lock here would make every publish wait out the lock's one-minute retry and then run unlocked anyway. Publish has already looked for a monitor to reuse before it runs the child. The cost is that two `monitor --until-ready --detach` commands started in one checkout at the same moment can both submit; the sequential repeat PERIL-02 targets is reused. Rejected: a GitHub read of the pull request number on every submit; an environment flag from publish telling its child that the lock is held (a new cross-process contract, which the job unit would also inherit through the `BEEP_` forwarding prefix).
