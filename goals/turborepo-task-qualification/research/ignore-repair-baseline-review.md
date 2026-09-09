# Root-ignore repair and dependency exclusion

Reviewed 2026-09-09 for `local-linux-x64-bun1.4.2` / `qualification-v2`.
This review replaces the main-integration baseline after an observed unsafe
reuse case. It grants no candidate, shadow or qualified status.

The [native findings](./ignore-invalidation-findings.json) reproduce false
successes on Turbo 2.10.12 and 2.10.13-canary.1 for both identity lint and its
types lint dependency. Each producer contains a tracked syntax error excluded
by a root `.gitignore` rule. Removing the rule preserves the old task hash and
returns a successful local hit, while cache-disabled execution fails. The
Biome process reads `.gitignore`; the original native task and global input
maps omit it. Every experiment restores its owned worktree and records exact
runtime/client pins and bounded private evidence references.

The identity-only repair retains inherited inputs with `$TURBO_EXTENDS$` and
adds the root ignore file plus the three possible ancestor ignore files under
`packages`, `packages/foundation` and `packages/foundation/modeling`. The
existing root-ignore case now changes the hash and produces a fresh failure
on both clients. The three currently absent ancestor paths are conservative
input declarations; those additional negative cases remain to be executed.
The package's cache flag stays false and its tuple remains excluded.

The types dependency gains a child configuration that disables only lint
reuse. Its verbose command and all other task settings remain unchanged.
The review adds `@beep/types#lint` to the governed scope solely to record its
explicit exclusion after the observed unsafe replay. It authorizes no cache
promotion for that dependency. Required fresh dependency execution remains
available; later qualification or adoption must supply its own complete
input and capture evidence before reuse can be considered.

The [projection delta](./ignore-repair-baseline-delta.json) has exactly two
changed task definitions: identity lint adds four input declarations and types
lint changes cache from true to false. Root global configuration, commands,
complete-script digests, dependency edges and the executable population are
unchanged: 142 workspaces, 2,840 graph nodes and 1,480 executable nodes. The
new types child file becomes an explicit configuration source. This is no
whole-family rollout or qualification of inherited cache settings.

The canonical baseline writer must compare the original baseline digest and
verify this review's original bytes. The subsequent transition adds one
excluded types tuple while preserving every existing entry and history record.
Identity and types are both in the owned package-verification list for this
repair. Full pilot comparisons, signed receipts and final Yeet acceptance
remain outstanding.

The input inheritance syntax follows the official
[package configuration reference](https://turborepo.dev/docs/reference/package-configurations).
The exact client experiments provide the runtime evidence for this repair.
