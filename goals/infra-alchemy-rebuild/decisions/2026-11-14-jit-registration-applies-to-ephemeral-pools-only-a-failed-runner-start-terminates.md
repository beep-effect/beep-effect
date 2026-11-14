---
title: "JIT registration applies to ephemeral pools only; a failed runner start terminates"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p2-github-runners-fleet"
pullRequest: 3314
reversal: "Refuse jitConfig true on a non-ephemeral pool in the RunnerPool schema, with the default following ephemeral, and drop the user-data guard."
---

beep-reviewer (#3313, P2) found that a non-ephemeral pool with the default `jitConfig: true` booted a runner that could not start: scale-up writes a JIT config only when `pool.ephemeral && pool.jitConfig`, but the user data keyed on `jitConfig` alone. Of the two ways out (refuse the combination in the pool schema, or make user data and scale-up agree), the port takes the second because it is what upstream does: v7.10.1 `start-runner.sh` runs `config.sh` whenever JIT is disabled or the runner is not ephemeral, so `jitConfig` is ignored for non-ephemeral runners rather than rejected. `renderRunnerUserData` now uses `ephemeral && jitConfig`, the same condition as scale-up, and its exit trap terminates the instance when the runner exits non-zero (upstream also terminates on a failed start), so a misconfigured non-ephemeral runner no longer stays up. Tests cover `ephemeral: false` with the default `jitConfig`.
