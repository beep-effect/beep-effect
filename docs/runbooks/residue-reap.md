# Residue retention and archive recovery

`bun run beep quality residue-reap` defaults to a dry run. Its
`residue-reap/v3` report is persisted under the invoking checkout's
`.beep/residue-reap/<run-id>/plan.json` before any apply operation; dry runs also
publish `report.json`. The
report names the source, owner, observed terminal state, apparent bytes,
btrfs exclusive bytes when available, retention reason, and proposed archive
address for checkout residue. Missing exclusive-byte measurements are unknown.

The existing Codex/Turbo/cache classes retain their removal policies.
Checkout QA, qualification, generated output, terminal jobs, legacy worktree
ledgers and stale PID records use recoverable archives. Research, corpus and
unclassified runtime material remain owner-required and cannot be archived by
those derivative classes. Clone proof identity and linked-worktree sharing
are retained.

## Owner rulings

Age never establishes ownership or completion. Place an array of owner rulings
in `.beep/retention/<class>.json`, where `<class>` is, for example,
`checkout-generated`. Each eligible ruling must have an identical decoded
tracked JSON receipt at its `evidence` path. Creating a sidecar that points to
an arbitrary tracked file does not authorize archival.

```json
{
  "schemaVersion": "residue-retention/v1",
  "path": ".beep/ci/obsolete-scanner-run",
  "owner": "quality",
  "state": "completed",
  "disposition": "regenerable",
  "evidence": "goals/example/history/retention/obsolete-scanner-run.json",
  "regeneration": "bun run beep quality audit",
  "reason": "obsolete generated derivative; durable receipt retained"
}
```

Allowed terminal states are `completed`, `failed` and `cancelled`. Active,
paused, unknown, unverified, missing and malformed rulings are retained. A
`retain` disposition is retained. The tracked ruling is metadata describing
the source address; all other replay citations remain protection evidence.

The command checks citations across tracked goals, explorations, research,
harness-ledger, standards, docs, patterns and the agent guide. It also retains
protected inboxes, drafts, packets and proof ledgers, dirty outer or nested
checkouts, registered nested worktrees, live cwd/PID references, held files,
and checkouts with operational `.beep` writes in the last seven days. The
invoking process ancestry is excluded from the cwd observation; other writers
remain protected. Retention and archive bookkeeping does not renew operational
activity. Eligibility is rechecked immediately before each move.

## Apply and recover

Publish and review the dry-run report first. This program additionally requires
orchestrator acknowledgement before real cleanup and owner notices for live
clones. Then explicit `--apply` runs the same ownership and liveness checks:

```sh
bun run beep quality residue-reap --classes checkout-generated --json
bun run beep quality residue-reap --classes checkout-generated --apply --json
bun run beep quality residue-reap --resume <run-id> --json
bun run beep quality residue-reap --restore <run-id> --json
```

Archive operations acquire the repository's process-generation journal locks
in the invoking owner checkout. They persist and sync the complete dry-run report,
then a device/inode-bound intent before renaming into the same-filesystem
archive. Both parent directories are synced. The Worktree retirement attachment
scanner checks the fenced inode for writers; a failed rollback retains a
`fenced-live` journal and data for recovery.

The immutable `plan.json` is synced before the first source move. `report.json`
records the initial dry run or completed apply and is preserved. Recovery reads
the original plan plus intent journals and writes a new `recovery-<uuid>.json`
after row processing begins, including row failures. Missing, malformed or
owner-mismatched plans are refused before a recovery receipt is created. It processes every row and persists
errors as warnings before reporting a failure. It reconciles an intent whose inode has already moved, rechecks an
unmoved row before resuming, and never rearchives a row marked `restored`.
Restore refuses an occupied source, a changed inode, or an invalid boundary.
A refusal preserves the source/archive and its intent for manual inspection;
it does not remove either side to force restoration.

Moving bytes to an archive reclaims zero filesystem blocks. Keep moved bytes
and physical reclamation separate. Purging archives requires a separate owner
retention decision and is not part of this archive operation.

Fleet discovery reports other checkout owners but checkout archive classes apply
only from their owning checkout. Run the reviewed report and apply from that
checkout so retiring the invoking lane cannot take another owner's archive.
Reports persist on dry runs by design. Unknown recovery ids create no run.
Run reports and archives are durable proof; automatic pruning requires a
separate owner retention decision and is deferred by this program.

The operational liveness walk treats embedded Git checkouts and `node_modules`
as opaque leaves, checking their root activity rather than interpreting vendored
lock/PID names as Beep state. It counts symlinks without following them. A bounded
mutable traversal stack avoids quadratic copies at the configured census cap.
Nested dirty or linked worktrees remain protected by the candidate's Git gates.

A `fenced-live` intent is preserved on resume and requires explicit restore;
resume never ratifies new writer output by an attachment scan alone. Opacity
applies only to sibling trees: a candidate's own descendants are fully checked
for protected state and PID records under the census cap.

Report `mode` distinguishes `dry-run`, `apply`, `resume` and `restore`; recovery
requests are mutation operations even when a row is retained. Git status and
worktree-list probes disable optional locks so observation cannot refresh the
index and make the janitor's own activity delay cleanup. A candidate inside an
embedded checkout ancestor is protected rather than archived as a partial clone.
