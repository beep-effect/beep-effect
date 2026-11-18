# Python removed from this packet (2026-11-13)

The `python-free-repo` goal bans tracked Python
([SPEC](../../../goals/python-free-repo/SPEC.md)). Nothing in a workflow, hook,
package script, skill, systemd unit or `opsScripts` entry still runs the
25 file(s) below, so they were deleted rather than ported. Their outputs and
the conclusions drawn from them stay in this packet, in the files listed under
"Recorded in".

Recover any script with
`git show 05ed8bc6b6cc50f2a284ed02caaab16f216bb9c3:<path>`. A resumed packet that needs to run one again
ports it to TypeScript first; tracked Python is no longer admitted.

| Deleted file | Recorded in (non-Python files that name it) |
| --- | --- |
| `research/actual-ignored-input-control.py` | `goals/turborepo-cache-trust-observability/research/producer-packet-review-checkpoint.json`, `goals/turborepo-quality-cache-adoption/PLAN.md`, `goals/turborepo-quality-cache-adoption/research/actual-ignored-input-observation.json` (+2 more) |
| `research/native-base-ref-controls.py` | `goals/turborepo-quality-cache-adoption/research/native-source-family-controls.json`, `goals/turborepo-quality-cache-adoption/research/native-source-family-repair.json`, `goals/turborepo-quality-cache-adoption/research/native-source-family-replay-2026-11-03.json` (+3 more) |
| `research/native-boundaries-controls.py` | `goals/turborepo-quality-cache-adoption/research/boundaries-native-checkpoint-2026-11-03.json`, `goals/turborepo-quality-cache-adoption/research/guarded-native-replay-checkpoint-2026-11-03.json`, `goals/turborepo-quality-cache-adoption/research/native-boundaries-controls-2026-11-03-guarded.json` (+2 more) |
| `research/native-cargo-applicability.py` | `goals/turborepo-quality-cache-adoption/research/cargo-workspace-feature-review.json`, `goals/turborepo-quality-cache-adoption/research/selection-sibling-driver-compatibility.json`, `goals/turborepo-quality-cache-adoption/research/SOURCES.md` |
| `research/native-cargo-controls.py` | `goals/turborepo-quality-cache-adoption/research/cargo-workspace-feature-review.json`, `goals/turborepo-quality-cache-adoption/research/selection-sibling-driver-compatibility.json`, `goals/turborepo-quality-cache-adoption/research/SOURCES.md` |
| `research/native-filter-composition-controls.py` | `goals/turborepo-quality-cache-adoption/research/filter-composition-source-review.json`, `goals/turborepo-quality-cache-adoption/research/native-filter-composition-controls.json`, `goals/turborepo-quality-cache-adoption/research/native-selector-flag-isolation-controls-2026-11-04.json` (+6 more) |
| `research/native-future-flag-availability.py` | `goals/turborepo-quality-cache-adoption/research/codegen-readonly-drift-checkpoint-2026-11-02.json`, `goals/turborepo-quality-cache-adoption/research/current-completion-audit.json`, `goals/turborepo-quality-cache-adoption/research/current-feature-client-refresh-2026-11-03.json` (+41 more) |
| `research/native-global-configuration-controls.py` | `goals/turborepo-quality-cache-adoption/research/native-global-configuration-controls.json`, `goals/turborepo-quality-cache-adoption/research/native-source-family-controls.json`, `goals/turborepo-quality-cache-adoption/research/native-source-family-repair.json` (+2 more) |
| `research/native-input-controls.py` | `goals/turborepo-cache-trust-observability/research/producer-packet-review-checkpoint.json`, `goals/turborepo-quality-cache-adoption/PLAN.md`, `goals/turborepo-quality-cache-adoption/research/native-input-controls.json` (+2 more) |
| `research/native-log-cache-controls.py` | `goals/turborepo-quality-cache-adoption/research/errors-only-feature-review.json`, `goals/turborepo-quality-cache-adoption/research/native-log-controls-before-pin-default-fix.json`, `goals/turborepo-quality-cache-adoption/research/native-log-controls.json` (+5 more) |
| `research/native-log-presentation-controls.py` | `goals/turborepo-quality-cache-adoption/research/errors-only-feature-review.json`, `goals/turborepo-quality-cache-adoption/research/native-log-controls-before-pin-default-fix.json`, `goals/turborepo-quality-cache-adoption/research/native-log-controls.json` (+5 more) |
| `research/native-observability-default-controls.py` | `goals/turborepo-quality-cache-adoption/research/native-observability-default-controls.json`, `goals/turborepo-quality-cache-adoption/research/native-source-family-controls.json`, `goals/turborepo-quality-cache-adoption/research/native-source-family-repair.json` (+3 more) |
| `research/native-permission-flag-availability.py` | `goals/turborepo-quality-cache-adoption/research/current-feature-client-refresh-2026-11-03.json`, `goals/turborepo-quality-cache-adoption/research/native-permission-flag-availability-2026-11-03.json`, `goals/turborepo-quality-cache-adoption/research/native-source-family-repair.json` (+7 more) |
| `research/native-permission-mode-controls.py` | `goals/turborepo-quality-cache-adoption/research/native-permission-mode-controls-2026-11-03.json`, `goals/turborepo-quality-cache-adoption/research/native-source-family-repair.json`, `goals/turborepo-quality-cache-adoption/research/native-source-family-replay-2026-11-03.json` (+7 more) |
| `research/native-prune-global-controls.py` | `goals/turborepo-quality-cache-adoption/research/native-prune-global-controls.json`, `goals/turborepo-quality-cache-adoption/research/native-source-family-controls.json`, `goals/turborepo-quality-cache-adoption/research/native-source-family-repair.json` (+4 more) |
| `research/native-selection-controls.py` | `goals/turborepo-quality-cache-adoption/PLAN.md`, `goals/turborepo-quality-cache-adoption/research/native-cargo-controls.json`, `goals/turborepo-quality-cache-adoption/research/native-prune-global-controls.json` (+14 more) |
| `research/native-setup-controls.py` | `goals/turborepo-quality-cache-adoption/PLAN.md`, `goals/turborepo-quality-cache-adoption/research/native-source-family-controls.json`, `goals/turborepo-quality-cache-adoption/research/native-source-family-repair.json` (+2 more) |
| `research/native-signature-key-controls.py` | `goals/turborepo-quality-cache-adoption/PLAN.md`, `goals/turborepo-quality-cache-adoption/research/native-signature-key-controls.json`, `goals/turborepo-quality-cache-adoption/research/native-signature-key-sourcebound-controls-2026-11-03.json` (+6 more) |
| `research/native-source-family-controls.py` | `goals/turborepo-quality-cache-adoption/research/native-source-family-repair.json` |
| `research/native-worktree-controls.py` | `goals/turborepo-quality-cache-adoption/research/guarded-native-replay-checkpoint-2026-11-03.json`, `goals/turborepo-quality-cache-adoption/research/native-startup-refusals-2026-11-03.json`, `goals/turborepo-quality-cache-adoption/research/native-worktree-controls-2026-11-03-guarded.json` (+2 more) |
| `research/refresh-current-population.py` | `goals/turborepo-quality-cache-adoption/research/population-current-source-checkpoint-2026-11-03.json`, `goals/turborepo-quality-cache-adoption/research/population-refresh-checkpoint-2026-11-02.json`, `goals/turborepo-quality-cache-adoption/research/population-source-refresh-checkpoint.json` |
| `research/signature-key-source-binding-controls.py` | `goals/turborepo-quality-cache-adoption/research/native-source-family-repair.json`, `goals/turborepo-quality-cache-adoption/research/signature-key-source-binding-repair.json` |
| `research/test_cargo_review_integrity.py` | `goals/turborepo-quality-cache-adoption/research/OPPORTUNITIES.md` |
| `research/test_selection_invoke_compatibility.py` | `goals/turborepo-quality-cache-adoption/research/selection-current-canary-checkpoint.json`, `goals/turborepo-quality-cache-adoption/research/selection-sibling-driver-compatibility.json` |
| `research/watch-source-review.py` | `goals/turborepo-quality-cache-adoption/research/SOURCES.md` |
