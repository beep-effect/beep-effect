---
"@beep/repo-ai-metrics": minor
---

Move the AI metrics canonical store off the clone: resolve the data root as
`--data-root` -> `BEEP_AI_METRICS_DATA_ROOT` ->
`${XDG_STATE_HOME:-$HOME/.local/state}/beep/ai-metrics`, remove every
clone-relative default, record clone/repository/worktree/revision/source-instance
identity in a canonical-root registry inside the data root, and bound config
snapshots with a nested-git-root boundary, file/byte budgets, and per-stage
timings.

Breaking within the package's public surface: `DEFAULT_AI_METRICS_DATA_ROOT` is
removed; `AiMetricsRetentionSelector.dataRoot`,
`AiMetricsRetentionEnforcementPolicy.dataRoot`,
`AiMetricsMirrorBundleInput.dataRoot`, `AgentEffectivenessDoctorInput.dataRoot`,
and the `doctor`/`annotationPlan` keys nested above it lose their defaults and
are now required; `locateLatestAiMetricsMirrorBundle`,
`makeAgentEffectivenessDoctorReport`, `makeAgentEffectivenessAnnotationPlan`,
and `syncAgentEffectivenessPhoenix` lose their parameter defaults; and
`makeAiMetricsInstallSpec` fails with `AiMetricsInstallConfigurationError` when
neither `dataRoot` nor `homeDir`/`stateHome` can resolve a root.
`resolveAiMetricsDataRoot` and `aiMetricsStateHome` return `Option`, and
`AiMetricsDataRootInput.homeDir` is optional, so a blank `HOME` yields
`Option.none()` rather than a store anchored at `/.local/state/beep/ai-metrics`.
The identity registry hashes the home directory as its resolved path, matching
source discovery byte for byte so a trailing slash cannot fork the digest and
break the join. The whole read-merge-write now runs under an advisory lock at
`identity/registry.lock` and promotes through a per-writer temporary file, so
concurrent runs against one data root serialize rather than losing each other's
roots to the last rename; waiting on the lock is bounded, so a lock left behind
by a run that died fails the upsert with a message naming the file to remove
instead of hanging. Only a not-found error reads as "no registry" — an existing
but unreadable `identity/registry.json` now fails the upsert loudly instead of
being treated as absent and overwritten, which would have discarded every other
canonical root and its `firstSeen` history. Config snapshots enumerate the
repo-root agent docs before the config roots, so a bulky directory under a
config root can no longer spend the file budget and starve `AGENTS.md`/
`CLAUDE.md` out of the snapshot — a silent corruption of the session/baseline
`sessionHash` split rather than an honest truncation.
`runAiMetricsForwarder` now requires `repoRoot` to be a git root so the run's
provenance is recordable. The dankserver install plan's planned commands render
the spec's own resolved `--data-root` instead of a clone-relative literal, so
copy-pasting the plan's `forwarder timer` step survives the new absolute-path
gate.

In `@beep/repo-cli`, `--data-root` on `ai-metrics` and `agent-effectiveness`
gains a `BEEP_AI_METRICS_DATA_ROOT` fallback from one shared
`aiMetricsDataRootFlag` in `internal/cli/Flags.ts` rather than a per-group copy,
a blank `HOME` is rejected where a relative one already was,
`agent-effectiveness --data-root`
loses its `.beep/ai-metrics` default, and `ai-metrics forwarder timer` refuses
to render systemd units for a relative data root. A flagless, env-less
`--target dankserver` run on a workstation now resolves `/srv/data/ai-metrics`
and fails loudly instead of silently creating a store inside the clone.
