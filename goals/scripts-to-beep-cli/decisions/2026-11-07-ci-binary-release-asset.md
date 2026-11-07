---
title: "Binary ships as a checksum-pinned GitHub release asset built from main"
date: 2026-11-07
lane: "goals/scripts-to-beep-cli"
reversal: "Delete the publish workflow and restore the shell steps from git history"
---

A workflow on `push` to `main` (paths: the CLI and its workspace deps, plus `workflow_dispatch`) compiles `bin-ci.ts` for linux-x64 and publishes release `beep-ci-<short sha>` with a `.sha256`. `setup-monorepo-ci` and the bare-runner steps fetch a pinned tag and verify the pinned sha256 before running it; a pin bump is its own PR. The PR's own head never builds the binary that gates it (SPEC constraint). Cut over in two PRs: PR 1 lands the commands and the publisher, PR 2 pins the first published asset and switches the workflows.
