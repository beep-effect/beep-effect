# Decisions

<!-- Stage 2 grilling log. Dated entries, newest round last. Question / Answer / Rationale, rejected options named. -->

## 2026-11-07 — Align round 1

### D1 — Profile source of truth

**Question.** Live cgroup probe, provisioning env, or both?
**Answer.** Live probe is primary: `process.constrainedMemory()` (Bun returns the slice's
`memory.high`, Node its `memory.max`; measured in RESEARCH.md) compared with the scheduler
envelope. A typed override read through `effect/Config` (`BEEP_COMPUTE_PROFILE`, never a raw
`process.env` read) may only tighten to `worker`; it can never loosen a capped host.
**Rationale.** The slice cap is the fact that caused the incident; provisioning values drift and a
missing value must not silently restore today's behavior. Rejected: env-only (drift), probe-only
(no way to treat an uncapped small host as a worker).

### D2 — Hook posture on worker hosts

**Question.** Skip the catalog hooks, make the writer incremental, or both?
**Answer.** Both, sequenced: add a `skip: - run: <profile test>` condition to the
`schema-catalog` and `instrumentation-catalog` lefthook commands now (`LEFTHOOK_EXCLUDE` in the
worker accounts' environment as the interim until the repo change lands), and open a separate
bounded slice for a per-file incremental shard update so the hooks can return everywhere.
**Rationale.** Measurements show the cost is per-package ts-morph loading (1 GB floor + ~1.7 GB per
1000 files); no flag fixes it, and a repo-cli touch is 5 GB. Rejected: writer-only (worker hosts
stay exposed until it lands), skip-only (leaves the hook permanently uneven).

### D3 — Shard regeneration for worker lanes

**Question.** Who regenerates shards when a worker lane skips the hooks?
**Answer.** A hosted step runs the scoped writers against the PR diff and pushes the shards onto
the PR head, only when the PR declares skipped hooks and only while the PR is still draft, so a
bot push never moves the review window after `yeet ready`. Needs a push-capable token (round 2).
**Rationale.** Worker lanes must stay self-sufficient; hosted Repo Sanity catching stale shards
late is exactly #2522/#2526/#2540. Rejected: hosted red + orchestrator repair (couples every worker
PR to a workstation session), remote ask over T3 (new cross-session protocol, slowest).

### D4 — Scheduler on sub-envelope hosts

**Question.** Refuse, warn, or keep the bypass?
**Answer.** Replace the `bypassAdmission` branch: on `worker` profile the scheduler refuses gates
the routing table marks hosted-only, prints the `yeet open` route, and only `--force-local`
(recorded in the receipt) runs them anyway.
**Rationale.** Today the smallest host is the one with no admission control (inversion found in
`QualityScheduler.ts`). Rejected: warn-and-proceed (relies on an agent reading a log line), keep
bypass (status quo that produced the incident).

## 2026-11-07 — Align round 2

### D5 — Vocabulary: ComputeProfile is a separate axis

**Question.** Relation to the existing `ProofEnvProfile` (`local | pr-posture | hosted`)?
**Answer.** `ComputeProfile = LiteralKit(["workstation", "worker"])` describes the host's memory
ceiling; `ProofEnvProfile` keeps describing the posture a lane executed under. Hosted runners are
posture `hosted`, never a compute profile. Attempt and admission facts carry both.
**Rationale.** Where a lane ran and how much memory it had are different questions; conflating
them would make `hosted` mean two things. Rejected: extend `ProofEnvProfile` with `worker`; a
three-valued profile duplicating `hosted`.

### D6 — Default gate routing table

**Question.** Which gates may a worker host run locally?
**Answer.** Local-allowed on `worker`: package-scoped `lint` (Biome/GritQL of touched packages),
`expectation-rewrite` (diff-only), `repo-sanity` changeset status. Hosted-only on `worker`:
`cheap-gates` (schema catalog), `lint-policy` (`deprecated-apis --full`), `check`, `docgen`,
`fallow`, `coverage`, and both lefthook catalog writers. One typed table in repo-run, keyed by gate
id and profile, read by the scheduler, `yeet final-check`/`ready`, and the lefthook skip test.
**Rationale.** Everything that builds a ts-morph `Project` or a full Turbo graph exceeds a 7 GiB
slice; the allowed gates are diff-scoped and fit in about 1 GB. Rejected: lint-only (loses cheap
diff checks for no memory win); measure-first (defers a table the incident already justifies —
the goal's first slice still records each gate's RSS on dankserver as evidence).

### D7 — Two goal packets

**Question.** One goal or two?
**Answer.** Two: `catalog-writer-incremental` (per-file shard splice so the hooks can return
everywhere; bounded, lands first, about one week) and `compute-profile-gate-routing` (profile
service, scheduler refusal, `yeet open`/`ready` posture, lefthook skip, hosted regeneration step,
docs; two to three weeks). The routing goal does not depend on the writer goal.
**Rationale.** The writer change is a self-contained performance fix with its own parity proof;
the routing change spans scheduler, yeet, lefthook, CI and three docs. Rejected: one goal in two
phases (one long PR train); routing-only (workstation commits touching repo-cli still cost 5 GB).

### D8 — dankserver: `t3 serve` gets its own slice (out of repo)

**Question.** What should the dankserver ansible role change?
**Answer.** Move the T3 service into its own slice with a small guaranteed `MemoryMin`, keeping
the 7 GiB job cap on the worker slice. Recorded in MAP.md as a gated re-entry converged through
the YubiKey route; not a beep-effect goal.
**Rationale.** A runaway non-beep job must not stall the control plane. Rejected: raise the cap
(leaves about 4 GB for grafana, docker and the proxy on a 15 GiB box); leave as is.

### D9 — Push identity for the hosted regeneration step (answered from the repo)

**Question.** Which credential pushes the regenerated shards?
**Answer.** Reuse the `skills-update-train.yml` relock pattern: checkout the judged head SHA with
`persist-credentials: false`, `contents: write`, push with `secrets.<TOKEN> || github.token` to
`HEAD:refs/heads/<head ref>`, guarded by `head.repo.full_name == github.repository`. Add the
packet's own guards: PR is draft, PR body or label declares `compute-profile=worker` skips.
**Rationale.** The pattern already exists and keeps no token in git config. Not asked of the
operator; logged for provenance.
