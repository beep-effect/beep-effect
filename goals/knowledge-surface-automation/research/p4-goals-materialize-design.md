# P4 design: Workstream E executor (`goals bootstrap|adopt --write`)

Status: design (2026-10-13), agent-decided under the 2026-10-06 autonomy charter. The
P1 contract (`research/p1-bootstrap-adopt-plan-design.md`) and E1–E7
(`research/p1-t2-mini-grill-decisions.md`) are not reopened. The phase-0 report was
approved 2026-10-13 (`research/p1-fp-eyeball-verdicts.md`, Workstream E).

## Scope of this slice (E-2)

The first writer. It replays a reviewed `MaterializationPlan` and nothing else. It does
not ship graduation, `ops/materialization.json`, rematerialization/capsules, the
`set-status` bypass funnel, or new doctor classes. Those are E-3+.

## Decided contract

1. **Write replays a plan; it never compiles a different one.** `--write` requires
   `--expect <planId>`. The command recompiles the plan from the same inputs, and
   refuses unless the recompiled `planId` equals the expected one. A reviewed plan is
   the only thing that can be written. If the tree moved, the id moves and the write
   refuses (P1 contract 5).
2. **Conflicted plans never write.** A plan with any `conflicts` row refuses before
   touching the filesystem (P1: a conflicted plan carries no entries).
3. **Bootstrap publishes atomically.** All `create` payloads are written into a
   staging directory on the same filesystem (`goals/.staging-<planId>/`). Validations
   run against the staged tree (manifest decodes; doctor over a prospective overlay;
   GOAL.md budget; README lifecycle line). Publish then:
   1. claims `goals/<slug>` with a non-recursive `makeDirectory`, which fails if the
      slug exists (the no-replace guard; a concurrent creator loses here);
   2. `rename`s the staged directory onto the claimed empty directory (POSIX replaces
      an empty directory atomically).

   On any failure the staging directory is removed, and the claimed directory too
   if it is still empty. A crash between the claim and the rename can still leave an
   empty `goals/<slug>`. An empty directory carries no data, so it is an abandoned
   claim, never a packet: publish removes an existing empty `goals/<slug>` with an
   empty-only `rmdir` (which fails on any content) before claiming, and the inventory
   scan skips empty slug directories, so a stale claim neither blocks a retry nor shows
   up as a manifest-less packet (E11). A stale `goals/.staging-*` directory is swept the
   same way at publish start. `goals/INDEX.md` is a disposable projection regenerated after
   publish (its `report` row is executed as `goals index --write`).
4. **Adopt never overwrites.** Adoption `create` entries are written with exclusive-
   create (`flag: "wx"`): a file that appeared since planning fails the write, never
   clobbers. `retain`/`preserve`/`report` rows perform no I/O. `preserve` is a
   byte-identity assertion: the write refuses if the file's digest differs from the
   plan's `preImageDigest`. The first adoption target is this packet (self-hosting
   test case #1); its plan creates exactly `research/.gitkeep`.
5. **Write output is a receipt, not a log.** A successful write prints a
   `goal-materialization-receipt/v1` JSON (planId, mode, written paths with digests,
   validations run). A later slice persists it as `ops/materialization.json` (SPEC E
   capsules) rather than inventing a second format.

## Test plan

- Bootstrap write into a temp repo: the published tree is byte-identical to the
  plan's payloads, `goals index --check` passes, and the staging directory is gone.
- `--expect` mismatch, conflicted plan, and existing slug each refuse with zero writes
  (porcelain equality).
- An injected failure between staging and publish leaves no staging directory and no
  claimed slug.
- Adopt write on a fixture packet creates only generated files; an exclusive-create
  race (file appears after planning) refuses; a changed preserve pre-image refuses.
- Self-hosting: adopt write of `knowledge-surface-automation` creates
  `research/.gitkeep` and nothing else.

## Decisions (E8–E11)

- **E8 — `--expect <planId>` is mandatory for `--write`.** Reason: plan/apply
  separation is the E design's core; a write without a reviewed id is the dry-run-
  flag leak the P1 contract warned about. Reverse: none planned.
- **E9 — claim-then-rename for no-replace publish.** Reason: Effect's `FileSystem` has
  no `RENAME_NOREPLACE`. A non-recursive `makeDirectory` claim plus rename onto the
  empty claim gives the same guarantee for concurrent creators. Reverse: switch to
  `renameat2(RENAME_NOREPLACE)` if a platform member appears.
- **E11 — empty slug directories are abandoned claims.** Reason: a crash between claim
  and rename otherwise leaves an empty `goals/<slug>` that the inventory scan counts as a
  packet and that blocks every retry (review on #1626). An empty-only `rmdir` cannot
  destroy data. Implementation rides the next E PR (the executor merged in #1632 without
  it). Reverse: replace with a claim marker file if a platform no-replace rename appears.
- **E10 — receipts printed, not yet persisted.** Reason: `ops/materialization.json`
  belongs with rematerialization/capsules (E-3), which needs per-region hashes the
  receipt does not have yet. Reverse: persist the receipt as-is in E-3.
