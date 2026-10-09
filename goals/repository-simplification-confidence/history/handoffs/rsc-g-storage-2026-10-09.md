# G retention wave — in progress, 2026-10-09

```text
lane: rsc-g-storage
head: 4decfe96d35fdd2802db7d7567449af2408da99b + review corrections   pr: none
package-verify: @beep/repo-cli pending heavy admission
hosted-parity: test-tsgo pending | docgen local pending | jsdoc-ratchet pending | knowledge refs pending | fallow audit/health pending | coverage (ResidueReap rows) pending
cache claims: remote-hit 0d8ccf62fa69d324/7d05d61faf1b47a2 unsupported external condition | local-hit 3ca643e559fb1d3a/f8b314d6bfaf4138 LOCAL HIT | cross-checkout fixtures prepared, execution pending | changed-input pending
storage: dry-run rows 2475 | applied 0 | reclaimed apparent/exclusive 0/0 MiB | deferred 2475, owner-unverified and census-failed
handoff: goals/repository-simplification-confidence/history/handoffs/rsc-g-storage-2026-10-09.md
open items: queued gates and independent review; cache fixtures; v3 apply acknowledgement and live-clone owner notices; source qualification/publication; read-only token and home-writer/shared-script dependencies
```

Resume ruling 1 reconciles the prior fixture scope blocker. The default
service-account read-only reference retry failed with `"BEEP_CI" isn't a
vault in this account.` `op-doctor` ran once. No write token or secret value
was used. Remote-hit evidence remains unavailable under that ruling.

The implementation now includes checkout QA, qualification, generated output,
terminal job, legacy ledger, stale PID and owner-required material classes;
explicit owner/terminal/evidence/regeneration rulings; protected-state,
citation, dirty-tree, recent-write, PID and held-descriptor gates; persisted
v3 dry runs; inode-bound archive moves with intents; and resume/restore.
Seven days is the recorded recent-write floor. Archive moves count zero
physically reclaimed blocks while the archive remains. Regression tests
include both SIGKILL boundaries, occupied restores, citations, dirty state,
active/paused owners, recent writes, live PIDs and held descriptors. These
are implementation statements, not passing-gate claims.

A complete fleet dry-run report was published privately and its sanitized
largest rows are in `history/receipts/stage-5-storage-cleanup.md`. All rows
remain deferred; there is no real cleanup apply to acknowledge yet. Once
owner rulings make rows eligible, regenerate and publish that dry run before
requesting the orchestrator's apply acknowledgement and owner notifications.

Two heavy commands are queued through `beep-heavy`: the retention fixture
suite and full `@beep/repo-cli` package verification. No workload has reported
a terminal result yet. A separate `claude-opus-5-5` medium, read-only review
is running; review closure is not claimed. The direct package tsgo probe
failed with missing built dependency outputs and cascading errors, so it
is not source parity evidence.

Cache fixtures have recorded cold MISS and warm LOCAL HIT summaries; the
`fc-runs` output tree restored after removal. Detached linked and fresh-clone
fixtures are prepared at the same source revision, owned by this lane, under
the approved sibling root and private cache. They have not executed tasks yet.
The actual `types/dist` tree still needs its restoration fixture.

Home configuration is deferred. Operator-run proposal:
`history/receipts/stage-5-cache-environment.sh` (syntax validated; not applied).
It owns only `~/.config/environment.d/90-beep-turbo-cache.conf`, defaults to
dry run, preserves explicit overrides, refuses symlinks/unowned fields,
backs up under `~/.config-backups/`, and prints rollback. F owns the Codex
writable-root field; shared owns root bare-Turbo routing; E owns remote
writer posture, durable summary upload and prior 413 attribution.

No PR is final or ready. No merge or lane retirement is requested. This
handoff will be replaced with the terminal report after the queued work ends.

## Live correction status

The first source package gate completed red with introduced compiler diagnostics;
those were repaired in `4decfe96d3`, and its two inbox rows were acknowledged
with that fix SHA. Acknowledgement is not a passing rerun. The full package
rerun remains admitted/queued. The package-relative residue suite executed
39 tests: 36 passed; three fixture errors were attributed and corrected.
The corrected suite is admitted/queued. Independent Opus 5.5 medium rounds
1–3 found actionable issues and triggered corrective waves; round 4 is running.
No terminal zero-findings review is claimed.

Latest source preserves immutable plans and initial reports and appends recovery
receipts. Foreign fleet owners are observation-only, including locks. It treats
embedded/dependency trees as opaque, uses canonical literal evidence paths and
checks linked nested clones. Regression fixtures now cover sibling movement,
archive census pruning, Unicode citations, nonexistent recovery, nested dirty/
linked worktrees, rollback refusal after a writer fence, sync failure, symlinked
checkout ancestors, file-shaped stale PIDs, and recovery past a failing row.
Real cleanup remains zero. The home writer also passed synthetic idempotence,
backup and refusal tests; actual home configuration remains unchanged.
