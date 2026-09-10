# Root-ignore invalidation repair

The real pilot exposed a false-success cache hit on both exact clients. The
[failure receipts](./ignore-invalidation-findings.json) reproduce it for
`@beep/identity#lint` and its `@beep/types#lint` dependency under Bun 1.4.2.

The producer contains a tracked syntax error but excludes that file through
the root `.gitignore`. Lint succeeds and creates a local cache entry. Removing
the ignore rule returns that same successful entry and task hash, although a
cache-disabled run now fails. The trace shows Biome opening the root ignore
file, which was missing from both the native task and global input maps.

Identity now preserves its inherited inputs and adds the root ignore file
plus each possible ancestor ignore file under `packages`,
`packages/foundation` and `packages/foundation/modeling`. Its cache stays
disabled. The types dependency also has its lint cache disabled and is
explicitly excluded at ledger revision three. Every previous ledger entry
and history record is preserved. Types remains a fresh dependency; its
verbose script and other task settings are unchanged.

The [combined verification](./ignore-repair-local-verification.json) tests all
four ignore-file paths against the repaired identity configuration and the
fresh-only types dependency. All 24 observations and 32 checks pass across
Turbo 2.10.12 and 2.10.13-canary.1. Each ignored syntax-error producer succeeds;
removing its rule changes the identity hash and produces a fresh failure.
The separate types control passes six observations and eight checks: its
disabled cache never conceals the now-unignored syntax error. These are
negative invalidation controls, not successful shadow decisions.

Before the input repair, the merged wrapper also passed disabled-execution,
producer and local-replay log comparisons on both clients. Its selected
capture and replay artifact were the same 53 bytes. Enabling caching changed
the hash because the child `turbo.json` is a task input. Original native
summaries attribute the difference to that one file; global inputs were
unchanged and producer/replay inputs matched. An activation comparison must
bind the approved input delta instead of requiring equal hashes across it.
The exploratory prefix-based capture extraction still needs a durable,
adversarially tested implementation before it supplies qualification evidence.

The [reviewed baseline](./ignore-repair-baseline-review.md) and
[projection delta](./ignore-repair-baseline-delta.json) retain 142 workspaces,
2,840 graph nodes and 1,480 executable nodes. Only two task definitions
change. The cache audit has zero findings and reports 928 inherited cached
computations as unassessed. Identity and types both pass full package audit
and docgen. The [fresh activation preview](./ignore-repair-activation-preview.json)
binds the repaired disabled source and an isolated proposed cache-flag change;
it performs no activation.

The [refreshed entrypoint review](./ignore-repair-entrypoint-review.md) reuses
the unchanged planner/workflow documents and regenerates command groups from
the repaired census. Earlier main-integration fingerprints and attachments
are historical after these task configuration changes.

Raw summaries, bounded captures and traces remain in the ignored local
preflight directory under the existing seven-day retention convention.
The checks restore their owned worktrees. They establish no signed-remote
verdict, complete syscall interpretation or full pilot qualification. The
durable runner, remaining semantic cases, complete fresh/shadow matrix,
signed sibling receipts, adoption handoff and final Yeet proof remain required.
