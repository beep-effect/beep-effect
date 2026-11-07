# Map

## Candidate goal packets

### 1. `catalog-writer-incremental` — promised now

**Mission.** Make the lefthook catalog writers parse only the staged files and splice their entries
into the existing per-package shards, so a commit costs the ~1 GB bun + ts-morph floor on every host
and the hooks can run everywhere again.
**Depends on.** Nothing. **Unblocks.** Removing the worker-profile `skip` from `lefthook.yml` later
(a gated re-entry below), and the hosted regeneration job becoming an exception path.
**Capabilities cited.** `Lint/SchemaCatalog.ts` `generateSchemaCatalogDocument` + `runSchemaCatalog`
(B4); `@beep/repo-cli-kit/cli/ShardScope` (`resolveShardScope`, `shardScopeIncludes`,
`stageGeneratedFiles`); the instrumentation-catalog twin under `Lint/`; parity proof = the existing
"is current" verdict and entry counts in RESEARCH.md M1. NET-NEW: per-file entry splice (replace the
entries whose `filePath` matches a staged file, drop entries of deleted files, keep the rest).
**Acceptance.** Scoped run over the five RESEARCH.md fixture files ≤ 1.5 GB max RSS with byte-identical
shards; full run unchanged; deleted/moved file drops its entries (the `--no-renames` case the hook
comment documents).

### 2. `compute-profile-gate-routing` — promised now

**Mission.** Give every `beep` process a typed compute profile and route gates, hooks and publish
verbs by it, so worker-class hosts defer compute-heavy proof to hosted CI by construction.
**Depends on.** Nothing (D7). **Phases / PR lanes (max three concurrent).**
- P0 profile + scheduler: `ComputeProfile` service, `MemoryStats` ceiling, gate routing table,
  scheduler refusal + `--force-local`, facts carry the profile. Cites B1, B2 (`ProofEnvProfile`),
  `AdmissionConfig`. NET-NEW: `ComputeProfile`, `GateRoute` table, `beep compute profile` command.
- P1 yeet + lefthook: `publish`→`open` posture on worker, `final-check` auto-skips with
  `compute-profile=worker`, `ready` accepts hosted cheap-tier green for those gates, lefthook
  `skip: - run:` on both catalog commands. Cites B5, B6, `gates-and-proof.md` skip receipts.
- P2 hosted regen + docs: draft-only `check.yml` job regenerating scoped shards and pushing via the
  relock pattern (D9, `skills-update-train.yml`); AGENTS.md amendment; agent-pools per-host table
  (dankserver measured; beep-worker and tom-pc-1-wsl rows from a working route); remote skill and
  yeet skill sections; Palantiri host-pressure carries the profile (B7).
**First vertical slice.** P0 on dankserver: `beep compute profile` prints `worker` inside the
slice and `workstation` on DankStation; the scheduler refuses `yeet final-check` there and prints
the `yeet open` route; evidence = per-gate RSS table recorded in the goal's `research/`.
**Acceptance.** A worker-profile lane can go edit → commit → `yeet open` → hosted green → `yeet ready`
with no local process above 1.5 GB and no hook skipped on a workstation.

## Sequencing

Both start now; they touch different files (writer internals vs repo-run/yeet/lefthook/CI).
`compute-profile-gate-routing` P1 edits `lefthook.yml`; `catalog-writer-incremental` edits
`SchemaCatalog.ts` only. If both are open, the routing goal merges `main` after the writer lands.

## Gated re-entries (not goals yet)

- **Remove the worker `skip` from the catalog hooks** when `catalog-writer-incremental` reaches
  `completed-retained` and a dankserver commit measures ≤ 1.5 GB.
- **dankserver `t3 serve` own slice** (D8): dankserver repo `ansible/roles/development_worker`,
  YubiKey-gated converge; opens when the routing goal's first slice lands so the host facts are
  stable.
- **Measure the other ts-morph builders** (`IdentityRegistry`, `OpaqueRoundtrips`, Docgen quality,
  Knowledge command-surface) if any of them turns up in a worker lane's path.

## Inherited risks

- A bot push on a draft PR still resets the review window; the regen job must be the last push
  before `yeet ready` or the window restarts (acceptable, it is draft).
- Bun's `constrainedMemory()` returns `memory.high`, Node's returns `memory.max`; the profile
  threshold must treat both as the ceiling and never compare them to each other.
- Cursor/Junie sandboxes may hide the probe; unavailable ⇒ `workstation` (no refusal), which is
  the pre-incident behavior, not a regression.
