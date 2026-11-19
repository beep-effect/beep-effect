---
title: "An empty run renders ERRORED and the task exit code stays the tool's"
date: 2026-11-19
lane: "feat/gate-report-core"
reversal: "Make the task path exit non-zero when a record's reason is errored."
---

Of 210 workspace manifests with a `beep:test` script, one has no test files: the Storybook app, whose Vitest config does not extend the shared config, so the adapter never runs there. 161 scripts pass `--passWithNoTests`. The report rule stands (nothing collected is `ERRORED`, law 4), and the exit code is not changed by this goal: it stays what the tool returned. No package changes behaviour today, and a gate that starts failing because its report says so is a policy change for `goals/gate-report-rollout` to make with the census in hand.
