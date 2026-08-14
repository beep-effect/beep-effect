# Lane C7 — opportunities and packet mining

Date: 2026-08-13. Scope: all 18 tracked `OPPORTUNITIES.md` ledgers (4,533
lines), plus the GOAL/PLAN/README/SPEC/manifest surfaces for
`ci-lane-economics`, `speed-loop`, `repo-quality-throughput`,
`quality-speedup`, `ci-fleet-residue`, `lint-policy-single-digit`, and
`honest-repo-signal`. Freshness check: `git log --all` for 2026-08-09 through
2026-08-13, followed by current-source checks for proposals whose commit
subjects were not conclusive. No root `research/OPPORTUNITIES.md` exists in
this checkout.

## Concrete findings

1. **The largest remaining CI wall-clock breach is already implemented on an
   in-flight branch, so it is not a new recommendation.** The cache-warm census
   puts Coverage Regression at p95 29.5 minutes and says cache cannot fix the
   cache-bypassed work (`goals/ci-lane-economics/research/cache-warm-lane-census.md:47-52`).
   The signed placement decision calls for directly changed coverage owners on
   PRs and stable weighted shards on full runs, with no extra fleet jobs
   (`goals/ci-lane-economics/research/placement-decision.md:8-11,34`). That
   design is implemented on `origin/feat/ci-lane-economics-p2`: commit
   `30983fd26d` (“ci(coverage): scope PRs and shard full runs”) plus fixes
   `7afae03034`, `afaf83e9cf`, `d895b8c0b8`, and `b863620cfc`. It is not in
   `origin/main` at this snapshot. Treat as **DONE / IN FLIGHT (#698)**, not as
   open design work.

2. **Local proof reuse is still all-or-nothing even though its state already
   contains the raw material for lane-level reuse.** The evidence-loop ledger
   says `--reuse-verified` keys on the whole worktree while persisted lane
   entries already carry `commandHash` values that nothing reads
   (`goals/coding-agent-effectiveness-evidence-loop/research/OPPORTUNITIES.md:124-142`).
   Current code still rejects reuse when the aggregate diff fingerprint changes
   and insists on a full-tier proof
   (`packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts:733-757`).
   A byte-identical stage transition has therefore forced another full proof in
   live work (`goals/ai-metrics-stack/research/OPPORTUNITIES.md:200-212`). No
   candidate implementation appeared in the four-day all-ref log.

3. **The fastest backpressure surface is still fragmented and can confidently
   point at a lane that passed.** Two independent 2026-08-13 receipts show the
   terminal repair hint contradicting the structured failed sublane
   (`goals/ci-lane-economics/research/OPPORTUNITIES.md:52-62`) and an earlier
   composite selecting passed Security instead of failed semantic-delta
   (`explorations/document-structure-ontologies/research/OPPORTUNITIES.md:29-38`).
   The retained speed ledger separately proposes immediate failure excerpts in
   `GITHUB_STEP_SUMMARY` and a schema-valid `ci-failure-capsule/v1`
   (`goals/speed-loop/research/OPPORTUNITIES.md:151-156,243-250`). Current
   workflow summaries exist only on selected steps, not as a universal
   nonzero-exit contract (`.github/workflows/check.yml:494,559`).

4. **Rerun automation can delay or destroy current-head feedback.** A failed
   matrix job cannot be targeted until the entire workflow is terminal
   (`goals/ci-lane-economics/research/OPPORTUNITIES.md:93-106`), and retrying an
   obsolete run cancelled the newer current-head matrix two seconds later
   (`goals/ci-lane-economics/research/OPPORTUNITIES.md:110-122`). The needed
   constraints are independently rerunnable required-lane boundaries and a hard
   current-head-SHA check before any rerun. The generic known-flake rerun loop is
   already shipped; this narrower workflow/concurrency hazard is not.

5. **The existing Yeet proof lock does not solve cross-checkout workstation
   contention.** The KSA ledger records three packages moving through
   no-location TS2589 failures while sibling worktrees compiled concurrently,
   costing a full proof cycle, and calls for a machine-wide lock or load-aware
   refusal (`goals/knowledge-surface-automation/research/OPPORTUNITIES.md:58-77`).
   Current `proofLockPathForContext` places `quality-lock` under the run artifact
   directory, i.e. per run context rather than host-wide
   (`packages/tooling/tool/cli/src/commands/Yeet/internal/ProofState.ts:93-124`).
   On the 32c/64t workstation this should be a scheduler/advisory lock, not a
   permanent single-thread policy.

6. **TS2589 quarantine is still per-attempt, not per failure class.** The live
   receipt shows `@beep/ui` clearing standalone before the lane rerun moved the
   same no-location TS2589 to `@beep/box`; the rerun was hardened despite a
   subsequent 131/131 build (`explorations/fleet-coordination/research/OPPORTUNITIES.md:23-38`).
   The corrected proposal is bounded re-entry when the same signature moves to
   a distinct package (`explorations/fleet-coordination/research/OPPORTUNITIES.md:42-56`).
   Current `attemptFlakeQuarantine` still performs one standalone pass and one
   lane rerun, with any lane-rerun nonzero exit hard
   (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:790-798,852-861`).
   The only four-day edit to this area was Effect-v4 API adaptation in
   `4cb63ad058`, not this policy.

7. **Publish monitoring has a registration race after a successful push.** A
   real publish returned “no checks reported” before GitHub registered 26
   checks and Yeet classified the monitor phase as failed
   (`explorations/document-structure-ontologies/research/OPPORTUNITIES.md:3-13`).
   No four-day Yeet commit addresses check-suite propagation; #685 is public
   provenance restriction and #686 is closeout encoding. A short bounded
   registration/backoff state is still fresh.

8. **Proof execution is vulnerable to concurrent worktree writes and chat
   interruption.** Any new path during publish can trip
   `proof-changed-worktree`; the ledger rejects a naive baseline path-set
   exception and identifies detached committed-HEAD isolation or an explicit
   “worktree sealed” advisory as honest options
   (`goals/ci-fleet-residue/research/OPPORTUNITIES.md:16-34`). A separate live
   run lost its proof process when conversational steering interrupted the
   wait (`goals/ai-metrics-stack/research/OPPORTUNITIES.md:286-304`). The
   strongest combined design is a durable proof process in an isolated
   committed-HEAD worktree, with its attempt id/status persisted.

9. **Package-local green still does not prove a package's tests typecheck.** A
   law-practice package check and Vitest run were both green while its tests
   carried two stale Effect API names; only the root test-file sweep caught
   them (`goals/legal-position-relator-runtime/research/OPPORTUNITIES.md:351-370`).
   KSA records the same scope trap and recommends `quality test-tsgo` before
   verify for `test/**` changes
   (`goals/knowledge-surface-automation/research/OPPORTUNITIES.md:32-43`). This
   is a direct explanation for “local checks green, hosted Check red,” not a
   request to run the whole monorepo early.

10. **The CI economics instrument remains ad hoc exactly where ongoing P3
    proof needs it.** `ci lane-timings` cannot filter by workflow/event/date/SHA
    or include run metadata/Turbo hit counts, so P0 required manual API joins
    (`goals/ci-lane-economics/research/OPPORTUNITIES.md:14-28`). The packet is
    still active with P2 in progress and P3 pending
    (`goals/ci-lane-economics/ops/manifest.json:63-70`). No functional
    LaneTimings change exists in the four-day log; `4cb63ad058` only converted
    helpers to Effect-v4 dual forms.

11. **Generated artifacts remain collision and enrollment hotspots.** One
    generated runner SDK required nine separate quality-tool exclusions, which
    motivates a single generated-path registry
    (`goals/ci-fleet-endgame/research/OPPORTUNITIES.md:63-75`). Separately,
    generated aggregate conflicts should regenerate rather than accept either
    side; the retained speed packet explicitly parks a generated-path → command
    map as precedent (`goals/speed-loop/PLAN.md:9-11` and
    `goals/speed-loop/research/OPPORTUNITIES.md:631-645`). This is both general
    QoL and a merge-treadmill reducer.

12. **Packet and dependency porcelain are still incomplete.** Goal authors can
    enter an invalid phase token and discover it five minutes later
    (`goals/ci-lane-economics/research/OPPORTUNITIES.md:40-50`), while
    `beep goals bootstrap` is specified but absent and explicitly routed to KSA
    Workstream E (`goals/honest-repo-signal/research/OPPORTUNITIES.md:5-19`).
    A newly revised transitive advisory also required hand-patching `bun.lock`
    because Bun's update commands either added a wrong direct dependency or
    left the vulnerable edge untouched
    (`goals/ci-fleet-residue/research/OPPORTUNITIES.md:36-54`). The one-time
    Nano ID repair merged as #689; it did not add reusable porcelain.

## DONE / superseded candidates (excluded from rankings)

| Candidate mined from ledgers | Freshness result |
| --- | --- |
| Asymmetric Turbo remote cache | **DONE on main:** #673 activated the service and #674 wired CI. **Policy superseded on 2026-08-13 by #696:** PR jobs are now local-cache-only; `.github/workflows/check.yml:121-124` supplies remote credentials/write mode only on `push`. Do not revive old “PR read-only remote cache” prose without reopening CSF-014. |
| Lint Policy concurrency/shards/LPT/empty include | **DONE on main:** #678 cut the lane to about 10.5 minutes; #683 raised outer concurrency to 3 and recorded 9m24s, single-digit full scope (`goals/lint-policy-single-digit/PLAN.md:5,12-15`). The oxlint cutover is **NO-GO/superseded**, not an open shortcut. |
| Coverage PR scoping + weighted full-run shards (#698) | **DONE / IN FLIGHT, not on main:** implemented through `b863620cfc` on `origin/feat/ci-lane-economics-p2`; exclude from duplicate design work. Hosted/merge closeout remains external to this read-only lane. |
| Lockfile-keyed `beep runners bake` | **DONE / IN FLIGHT, not on main:** `b2baa62507` plus `a6753cd257`, `ea9cc71a21`, `0b10579528` on `origin/feat/runners-bake`. Main's residue manifest still says P0 pending (`goals/ci-fleet-residue/ops/manifest.json:50-52`) because that branch has not landed here. |
| Declaration-mode typecheck blow-up | **DONE on main:** #668 introduced flat source-mode checks; the ledger explicitly says the in-repo mitigation shipped (`goals/ci-fleet-endgame/research/OPPORTUNITIES.md:405-419`). |
| Yeet closeout Option encoding | **DONE on main:** #686; residue P3 is complete (`goals/ci-fleet-residue/ops/manifest.json:65-67`). |
| Fleet Docgen/Lint success-exit hang | **DONE on main as part of #673:** explicit success exit and daemonless docgen; ledger marks the fix shipped (`goals/ci-fleet-endgame/research/OPPORTUNITIES.md:442-469`). |
| JSDoc ACP/apps/inheritDoc/fleet-cap follow-ups | **DONE on main:** #627; the carrier ledger labels all four follow-ups closed (`goals/jsdoc-carrier-migration/research/OPPORTUNITIES.md:177-195`). |
| Merged-tree staleness, gate-result staleness, known-flake rerun basics, lane timings attempt provenance | **DONE before this four-day window:** speed-loop #84/#88/#89/#90 shipped together (`goals/speed-loop/README.md:41-51`). Do not re-propose them wholesale; only the narrower gaps ranked below remain. |
| `monitor --until-merged` and `mergeReady` | **DONE in current source:** the command is registered at `packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts:62-70,369-370`, and Status renders a named merge-ready blocker at `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1173-1188`. |

## Ranked SPEED / THROUGHPUT recommendations

Items above marked DONE are intentionally absent.

| Rank | Recommendation and packet | Impact | Effort | Risk | Freshness |
| ---: | --- | --- | --- | --- | --- |
| 1 | **Consume the persisted per-lane proof keys:** replace whole-worktree-only `--reuse-verified` with input/tree/base/toolchain-keyed lane reuse and keep full fallback. Packet: `coding-agent-effectiveness-evidence-loop` P3 (“Yeet mistrial doctrine and proof durability,” `ops/manifest.json:70-72`). | Very high: removes repeated multi-minute/full-proof waves after small review fixes, staging, and clean base synchronization. | High | High: undeclared inputs could false-green; shadow parity and conservative invalidation are mandatory. | **Fresh/open.** Current code still gates on the aggregate fingerprint; no implementation in four-day all-ref log. |
| 2 | **Emit one structured failure capsule per nonzero lane and derive all hints/summaries from it.** Include current SHA, lane/sublane, failure class, bounded excerpt, repro command, infra-vs-source attribution, and retry eligibility; write a concise step summary immediately. Packet: transfer parked speed-loop #13/#26 into active `coding-agent-effectiveness-evidence-loop` P3/P4. | Very high: collapses log archaeology and prevents wrong-lane repair loops; backpressure arrives as soon as the lane fails. | Medium-high | Medium: redaction and classifier false positives; the capsule must report unknown rather than guess. | **Fresh/open.** Two new 2026-08-13 misroutes; no matching implementation. |
| 3 | **Make reruns current-head-safe and independently schedulable.** Refuse stale-run reruns; after workflow terminality, retry only the failed required lane once for an approved infra signature. Prefer per-required-lane workflow boundaries if GitHub matrix semantics cannot support this safely. Packet: `ci-lane-economics`. | High: removes waits for unrelated matrix tails and prevents obsolete retries from cancelling exact-head proof. | Medium-high | Medium-high: required context names/concurrency groups must remain stable. | **Fresh/open (2026-08-13).** Generic `--until-merged` rerun exists; these two hazards remain. |
| 4 | **Add a host-wide heavy-proof scheduler:** advisory machine lock plus load/RSS preflight, queue visibility, owner/checkout metadata, and stale-owner recovery. Allow cheap/read-only lanes concurrently; serialize only the destructive high-RSS waves. Packet: `knowledge-surface-automation` receipt, with fleet-coordination semantics. | High locally: avoids 15–50 minute false-red proofs and attribution work across many checkouts. | Medium | Medium: over-serialization could waste the Threadripper; use measured load and explicit lane weights. | **Fresh/open.** Existing Yeet lock is run-context-local. |
| 5 | **Make TS2589 arbitration class-aware across the lane rerun.** If rerun failure is the same no-location signature in a distinct package, enter bounded standalone arbitration again (for example, max two re-entries/distinct packages), then hard-fail. Packet: successor `ci-lane-economics` (original receipt routed from fleet-coordination to retired `ci-fleet-endgame`). | High: prevents one environmental flake from consuming a whole verify cycle while retaining hard failure for reproducible source errors. | Medium | Medium-high: an overly broad signature can hide a real compiler ceiling; keep the existing strict detector and tight bound. | **Fresh/open.** Current source hard-fails any lane-rerun nonzero. |
| 6 | **Run proofs durably in an isolated committed-HEAD worktree.** Persist attempt id/PID/status; stream progress back to the session; reject only mutations inside the proof tree. Until built, print “worktree sealed until push” at publish start. Packet: `coding-agent-effectiveness-evidence-loop` P3; receipt currently lives in `ci-fleet-residue`. | High: prevents proof loss from side writes or conversational steering and removes cross-agent worktree coupling. | High | Medium: install/cache/temp lifecycle and cleanup must be leak-free. | **Fresh/open.** #686 only changed the closeout writer. |
| 7 | **Add bounded post-push check-suite registration backoff.** Distinguish “zero checks registered yet” from a terminal empty/failed check set; preserve exact-head identity through retries. Packet: Yeet surface under `coding-agent-effectiveness-evidence-loop`. | Medium-high: removes immediate false publish failures and manual monitor re-arming. | Low | Low-medium: must remain bounded and fail if the expected suite never appears. | **Fresh/open since 2026-08-11.** |
| 8 | **Give touched packages a canonical src+test typecheck entrypoint and include it in the cheap preflight.** Generate the correct overlay or package `check:test`; do not direct agents to raw package test tsconfigs that produce `rootDir` noise. Packet: `coding-agent-effectiveness-evidence-loop` / repo-cli quality surface. | Medium-high: catches a repeated hosted-only failure class before publish at touched-package cost. | Medium | Low-medium: overlay ownership and package participation must be generated, not hand-maintained. | **Fresh/open.** #668 fixed source-mode RSS, not test-file participation. |
| 9 | **Finish `ci lane-timings` as the standing economics instrument.** Add workflow/event/SHA/since-until/job filters, attempt and conclusion classes, Turbo hit totals, and separate duration vs flake populations. Packet: `ci-lane-economics` P3. | Medium: makes the 20-minute p95 gate cheap to monitor and keeps placement decisions evidence-based. | Medium | Low | **Fresh/open.** Required for the active P3 close, not implemented by the Effect-v4 refactor. |
| 10 | **Move format/affected lint ahead of expensive review-fix typecheck.** Collect all changed-file formatting errors in one preflight before the isolated test-source sweep. Packet: `coding-agent-effectiveness-evidence-loop` P3. | Medium: a live review round repeated 380s and 426s sweeps for two one-line format fixes (`goals/ai-metrics-stack/research/OPPORTUNITIES.md:420-429`). | Low | Low: ordering only; no proof removed. | **Fresh/open.** |
| 11 | **Generate/regenerate conflict-prone aggregates from a registry during reconcile.** One source maps generated paths to commands; merge/reconcile refuses hand resolution and regenerates on the merged tree. Packet: active KSA Workstream E or a successor to parked speed-loop #60. | Medium: directly attacks `goals/INDEX.md`, ratchet, catalog, and inventory conflict churn. | Medium-high | Medium: generator order and dirty-tree isolation must be deterministic. | **Fresh but parked:** requires an active owner; do not edit the completed speed-loop packet. |

## Ranked GENERAL QoL recommendations

| Rank | Recommendation and packet | Impact | Effort | Risk | Freshness |
| ---: | --- | --- | --- | --- | --- |
| 1 | **One generated/vendored-path registry consumed by every quality tool.** Packet: `ci-fleet-residue`/repo-quality tooling successor; source receipt in `ci-fleet-endgame`. | High: turns nine-tool enrollment into one reviewed entry and prevents missed exclusions. | High | Medium: each consumer's semantics differ; migration needs parity tests. | Fresh/open; no registry commit in four-day log. |
| 2 | **Complete KSA goal porcelain:** `beep goals bootstrap --plan`, schema-aware phase transitions, index regeneration/freshness, and allowed-value errors. Packet: `knowledge-surface-automation` Workstream E. | High for agent setup: removes manual scaffold copying and delayed manifest/index failures. | Medium-high | Low-medium: writers must remain plan-first and schema-driven. | Fresh/open; explicitly routed to KSA, whose P4 remains pending (`goals/knowledge-surface-automation/ops/manifest.json:90-92`). |
| 3 | **Add safe transitive-resolution refresh porcelain.** Exact package/version, registry-integrity verification, frozen-install proof, audit lanes, and no accidental root edge. Packet: repo-cli dependency/security tooling; receipt in `ci-fleet-residue`. | Medium-high: converts recurring advisory interrupts from lockfile surgery into one bounded ritual. | Medium | Medium: lockfile format/integrity changes are sensitive and Bun-specific. | Fresh/open. #689 repaired Nano ID once but added no reusable command. |
| 4 | **Harden staged-only residue restore.** Exclude entries already committed, restore parked residue unstaged, and auto-resolve formatter-only overlap while preserving the stash. Packet: `coding-agent-effectiveness-evidence-loop` P3 / Yeet. | Medium-high: avoids conflict recovery on dirty multi-agent worktrees. | Medium | Medium-high: never auto-resolve semantic overlap. | Fresh/open since 2026-08-11 (`explorations/document-structure-ontologies/research/OPPORTUNITIES.md:15-27`). |
| 5 | **Make required-context metadata generated or periodically verified against the live ruleset with a dated offline snapshot.** Packet: `ci-lane-economics`. | Medium: prevents agents and monitor code reasoning from a false required-check set. | Low-medium | Low: network unavailability needs an explicit unknown/offline state. | Fresh/open; current receipt found 16 live vs 17 modeled contexts (`goals/ci-lane-economics/research/OPPORTUNITIES.md:30-38`). |
| 6 | **Rank worktree contention by live overlap, not dirty-tree volume.** Exclude/flag pathological dirty checkouts or weight by live-checkout count/recency. Packet: fleet-coordination successor. | Medium: restores useful collision signal when one 5,133-file checkout dominates 75.5% of rows. | Low-medium | Low: presentation change only; retain raw honest counts. | Fresh/open (`explorations/fleet-coordination/research/OPPORTUNITIES.md:62-88`). |
| 7 | **Create packet ledgers at scaffold time and keep exact-path on-disk fan-out contracts in templates.** Packet: KSA Workstream E / agent-effectiveness. | Medium: preserves friction and agent results through session limits/structured-output failures. | Low | Low | Fresh/open. Missing ledgers repeatedly delayed capture (`goals/ai-metrics-stack/research/OPPORTUNITIES.md:3-13`; `goals/coding-agent-effectiveness-evidence-loop/research/OPPORTUNITIES.md:292-303`). |
| 8 | **Expose cheap file-scoped documentation-shape checking.** `beep quality jsdoc-check <path>...` should invoke the canonical rule rather than spawning throwaway parsers. Packet: JSDoc tooling successor. | Medium for agent edit loops; avoids full ratchet/inventory runs for a few exports. | Low-medium | Low | Fresh/open (`goals/jsdoc-carrier-migration/research/OPPORTUNITIES.md:143-151`). |

## Explicit conflicts and decision boundaries

1. **Remote cache:** do not recommend PR remote reads or writes from the older
   asymmetric-cache design. #696 is newer and current main injects remote
   credentials only for trusted `push`; PRs use `local:rw`
   (`.github/workflows/check.yml:121-124,445-448`). Any reversal is a security
   decision, not a speed tweak.

2. **Coverage:** do not start another coverage-scoping/sharding implementation.
   The signed design is exact—changed owners on PR, weighted shards on full
   runs, no added fleet jobs—and #698's branch already implements it
   (`goals/ci-lane-economics/research/placement-decision.md:34,45-49`). Review
   or close that branch instead.

3. **Fleet placement:** proposals to move every slow lane to EC2 conflict with
   the 2026-08-13 zero-expansion decision. Test Unit stays hosted, Coverage
   stays one fleet placement, and no lane moves onto the fleet
   (`goals/ci-lane-economics/research/placement-decision.md:8-11,26-45`).

4. **Lint semantics:** PR changed-scope Lint Policy conflicts with a locked
   decision to preserve full-scope command identity on every event. It may be
   revisited only if timings regress; the current single-digit lane does not
   justify the semantic split
   (`goals/lint-policy-single-digit/ops/manifest.json:75-76`). Also do not retry
   the oxlint engine swap without satisfying the recorded re-spike
   preconditions; P3 is superseded (`goals/lint-policy-single-digit/PLAN.md:13-15`).

5. **Monitor design:** `mergeReady`, unresolved-thread gating, known-flake
   rerun, and `monitor --until-merged` already exist. Other lanes should extend
   the narrow registration/current-head gaps above, not build a second monitor.
   Monitoring still stops at “awaiting the operator's merge”; auto-merge would
   violate the operator boundary
   (`packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts:755-758`).

6. **Packet ownership:** `speed-loop`, `quality-speedup`, and
   `repo-quality-throughput` are completed-retained. Speed-loop explicitly
   parked earlier unshipped widgets as precedent
   (`goals/speed-loop/README.md:29-38`; `goals/speed-loop/PLAN.md:9-11`). Any
   revived item needs an active successor (usually
   `coding-agent-effectiveness-evidence-loop`, `ci-lane-economics`, KSA, or
   `ci-fleet-residue`) rather than reopening the historical packet.

7. **Baked AMI:** main's residue manifest says pending, but the implementation
   exists on `origin/feat/runners-bake`. Do not produce a second bake command;
   inspect/finish that branch and separately prove deployment/rollback.

## Recommended execution order

1. Land/close the already-built #698 coverage branch and runners-bake branch.
2. Ship the structured failure capsule + correct hint/summary derivation; it
   shortens every later red loop.
3. Add current-head-safe independent reruns and the check-registration backoff.
4. Add host-wide heavy-proof scheduling and bounded TS2589 class arbitration.
5. Build conservative per-lane proof reuse in shadow mode, then activate only
   after parity evidence.
6. Finish the economics collector and use it to prove the representative-week
   p95 closeout.
