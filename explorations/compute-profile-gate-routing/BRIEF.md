# Brief

## Problem

Agents working on worker-class hosts (dankserver: 15 GiB installed, 7 GiB `memory.high` on the
worker slice; beep-worker and tom-pc-1-wsl unmeasured) run the same local gates and pre-commit
hooks as the 125 GiB workstation. On 2026-11-07 a routine `git commit` from a T3 thread fired the
lefthook schema-catalog writer, which held 4 GB inside the slice, thrashed the loop-mounted home
on a spinning disk and stalled `t3 serve` until the job was killed by hand. The repo already says
"hosted CI is the proof" and has `yeet open`, `ready-for-heavy`, final-check skips and an
admission scheduler, but the switch between "prove locally" and "defer to CI" is a 10-minute
timer plus agent judgment, and the scheduler bypasses admission on exactly the hosts that need it.

## Appetite

Two goals. `catalog-writer-incremental`: about one week, one PR train, parity-proved.
`compute-profile-gate-routing`: two to three weeks, at most three concurrent PRs (profile +
scheduler; yeet + lefthook; CI step + docs). Neither waits on the other.

## Solution sketch

1. **ComputeProfile** (`LiteralKit(["workstation", "worker"])`), a `Context.Service` in
   `packages/tooling/tool/cli/src/internal/repo-run/` beside `MemoryStats`. Resolution:
   `process.constrainedMemory()` (Bun: slice `memory.high`; Node: `memory.max`; uncapped ⇒
   `os.totalmem()`/2^64 sentinel) against the admission envelope (`hardFloorGib + slotSizeGib`);
   a typed `effect/Config` override may only tighten to `worker`. `MemoryStats.availableGib`
   becomes `min(MemAvailable, constrained ceiling − current)`. Unavailable probe ⇒ `workstation`.
2. **Gate routing table**: one typed table `GateRoute = { gate, profile → local | hosted-only }`
   with the D6 defaults, exported from repo-run and consumed by three readers.
3. **Scheduler**: the `bypassAdmission` branch becomes a refusal for hosted-only gates on
   `worker`, printing the `yeet open` route; `--force-local` runs them and the receipt records it.
   Attempt and admission facts carry `computeProfile` beside `ProofEnvProfile`.
4. **Yeet posture**: on `worker`, `yeet publish` takes the `yeet open` path (push, draft,
   `ready-for-heavy`, monitor, no local proof); `yeet final-check` auto-skips hosted-only gates
   with reason `compute-profile=worker`; `yeet ready` accepts hosted cheap-tier green in place of
   the local receipt for those gates and prints them for the PR body.
5. **Hooks**: both catalog commands in `lefthook.yml` gain `skip: - run: <profile probe --is worker>` (a sub-second repo CLI subcommand, name fixed in P0; `LEFTHOOK_EXCLUDE` in the worker env until it
   lands). The incremental writer (other goal) parses only the staged files and splices their
   entries into the existing shard, targeting the ~1 GB floor.
6. **Hosted regeneration**: a `check.yml` job, draft-PRs-only, runs when the PR declares worker
   skips, regenerates the scoped shards for the PR diff and pushes them onto the head with the
   `skills-update-train` relock pattern (D9). It never runs after `yeet ready`.
7. **Docs**: AGENTS.md Quality Operator amendment (10-minute rule is for workstations; worker
   profile always defers); `docs/runbooks/agent-pools.md` per-host compute table;
   `remote-development-agents` skill "what a worker lane may run"; yeet `gates-and-proof.md`
   profile column; Palantiri host-pressure parcel carries the profile.

## Rabbit holes

- Reading `/sys/fs/cgroup` by hand: the runtimes already expose the ceiling; do not parse cgroup
  files unless `constrainedMemory()` is missing.
- Making the writer "cheap" with ts-morph flags: measured no-op; only the per-file splice helps.
- A bot push after `yeet ready`: moves the verdict head and the review window; the regen job is
  draft-only by construction.
- Measuring every gate before fixing the table: the table ships with D6 defaults; the first
  slice records RSS on dankserver as evidence, it does not gate the design.
- Treating hosted runners as a compute profile: they are posture `hosted` (D5).

## No-gos

- No raw `process.env` reads; the override is an `effect/Config` contract.
- No new memory service or external state; the profile is computed per process.
- No change to hosted heavy admission (`ready-for-heavy`, ruling 51).
- No dankserver provisioning change inside this repo (D8 lives in the dankserver repo).
- No weakening of commit hooks on workstation profile.
