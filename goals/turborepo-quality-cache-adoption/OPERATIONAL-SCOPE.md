# Operational shared-cache finish line

Adopted by the operator on 2026-11-08. Both Turbo packets are paused after
preserving the work already in progress. This amendment takes precedence over
the earlier exhaustive program requirements wherever they imply a larger finish
line. It grants no new cache eligibility, credential access or deployment.

## Outcome

Reduce developer and agent waiting and CI compute cost with a reliable,
affordable shared Turbo cache: private Cloudflare R2, a pinned adapter per
host, and tracked Alchemy Effect/Cloudflare infrastructure. Lower recurring
cost with comparable speed counts as success. A custom cache platform is not
an objective.

## Operational acceptance gates

All six gates remain unchecked pending a source-bound acceptance audit. Earlier
successful observations can count only where their source and configuration
bindings still apply. Neither this amendment nor a merged repair proves them.

- [ ] **Managed cost and setup.** Tracked Alchemy configuration, pinned adapter,
  durable scoped secret references, startup and retention instructions, and a
  usage-based monthly cost estimate with explicit assumptions.
- [ ] **Approved surfaces.** Intended reads and writes work across workstation
  Beep clones, newly created agent worktrees, beep-worker, dankserver and
  protected AWS CI. New worktrees inherit the configuration. Tom-PC remains
  skipped; TBK remains under its protective hold.
- [ ] **Actual remote reuse.** Demonstrate workstation-to-CI and
  CI-to-workstation writes and restores with exact task hashes and explicit
  local-versus-remote attribution. Do not substitute a local hit or synthetic
  fixture for cross-host proof.
- [ ] **Baseline safety and correctness.** Protect credentials; forks remain
  local-only; protected CI and named trusted hosts follow the agreed writer
  policy. Review inputs, environment, outputs and tool dependencies of enabled
  task families and run bounded representative invalidation and restore
  checks. Mutators, persistent services and live security verdicts stay fresh.
  Cache reuse never replaces the required hosted checks or review gates.
- [ ] **Measured value.** Report matched cold/warm whole-command timings,
  cache-sensitive CI steps, whole CI elapsed time, queue time and estimated
  resource costs separately. Record measurement gaps and uncertainty; a hit
  rate alone does not establish time or money saved.
- [ ] **Ordinary operation and handoff.** Review 48 hours of representative
  ordinary use; applicable existing evidence may count. Resolve cache
  correctness/authentication faults, bound error/fallback reporting, document
  disable and rollback procedures, and land required changes with hosted
  checks and reviews handled. Provide one concise operating/results guide.

Trust owns the baseline safety/result-attribution evidence; adoption owns the
surface, task-family and value audit. They share these gates rather than
requiring two independent exhaustive certification programs. Resume by auditing
the existing receipts against these gates before authoring more implementation.

## Deferred assurance program

Preserve the original SPEC sections, unchecked criteria, source inventories,
qualification ledgers, code and receipts as unfinished assurance work:

- exhaustive certification of every manifest entrypoint and environment tuple;
- independently attested protected-producer identity and all capability negatives;
- full signing-key/epoch rotation and warm-process certification;
- exhaustive protocol and tenant-isolation negative cases;
- staged hardened-backend 7/7/14-day rollout observations and broad warming.

These requirements do not gate the operational finish line. They are deferred,
not passed, deleted or silently waived. Existing safeguards stay in place.
No signing activation, trust-boundary relaxation, new spending, grant, runner
burst or infrastructure change follows from this amendment. A later expansion
requires an explicit recorded decision and new effort budget.

## Lifecycle and resume

The current task is to retain in-flight work in mergeable PRs, amend the goals,
and archive the owned worktrees. Neither packet is completed-retained.
Future operational completion still needs final evidence, a reflection and
proposedCloseout with the implementation; after merge, completion refresh and
a separate merged status-adoption PR with matching origin/main statuses.

Read [PAUSED-HANDOFF.md](PAUSED-HANDOFF.md) before resuming. Recheck live PRs,
accepted source, deployment and credentials; old observations are historical,
not a claim about the current fleet. Do not automatically restart the old
qualification pilots or long observation program.
