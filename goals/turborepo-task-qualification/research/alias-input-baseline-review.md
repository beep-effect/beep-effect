# Identity root-alias input declaration

Reviewed 2026-09-09 after the v2 generated-alias control preserved the old
task hash and reused its successful result. The
[control receipt](./pilot-controls-alias-observation.json) records the
changed root `tsconfig.json` bytes and stable task/input hashes. It establishes
an unfulfilled invalidation expectation, not a proven semantic divergence.

A direct wrapper trace contains
[successful read-only opens](./alias-input-open-presence.json) of that file
by both Bun wrappers and a Biome worker. The broad trace hit its 8 MiB bound
and was rejected as a complete-execution or full-read-set proof. Its positive
open records remain evidence that the pinned computation accesses the file.
Semantic irrelevance has not been established, so the conservative correction
is to hash it rather than waive the failed control.

The [single-computation delta](./alias-input-baseline-delta.json) changes only
identity lint's input declaration. Its explicit task inputs preserve the
current root lint defaults, Biome configuration, Grit rules/configurations,
four ignore-file inputs and the `.beep` exclusion. They omit the inherited
root `tsconfig*.json` exclusion. The existing global inputs therefore include
root `tsconfig.json`, `tsconfig.base.json` and `tsconfig.packages.json`; the
native selected input count increases from 43 to 46. No duplicate root input
is needed. Cache stays false, and no command or dependency edge changes.

The explicit child list replaces `$TURBO_EXTENDS$` because that form also
inherits the exclusion being repaired. Future root lint input changes require
reviewing this list. The qualification configuration digest already binds root
and child Turbo source bytes, so that review cannot be skipped by preserving
only the child file. This is one pilot computation, not a task-family change.

The reviewed baseline keeps the same two-computation scope, profile and epoch.
The writer must compare the prior baseline digest and this review's bytes;
the qualification ledger and its history must remain byte-identical. No tuple
promotion follows. Fresh native controls and full comparison/shadow evidence
must validate the v4 activation fragments before this configuration can be
considered for qualification. Complete read/write/capture and signed-remote
evidence remain required.
