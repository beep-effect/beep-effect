# Ten-Minute Certainty — Sources & Provenance

- **Cluster / origin:** the operator's 2026-11-09 audit request (`../CAPTURE.md`) and the same-day phase 1
  surface inventory produced by eleven Claude Opus 5.5 readers plus a completeness critic (one native
  Workflow run) and one blinded GPT-6 Astra (high) seat (one T3 delegate), all read-only against `main`
  `7a31078ddd3`. Filed under [`phase1/`](./phase1/) with absolute home paths rewritten to `~` and session
  identifiers removed.
- **Provenance:** orchestrator synthesis [`phase1/SURFACE-INVENTORY.md`](./phase1/SURFACE-INVENTORY.md);
  stage-1 distillation [`../RESEARCH.md`](../RESEARCH.md). No external code was mined; every source is this
  repository, its hosted CI, or its local receipts. No upstream licenses apply.
- **Models and effort (launch evidence):** readers and critic `claude-opus-5-5` medium; the independent
  seat `gpt-6-astra` with `reasoningEffort: high`; orchestrator `claude-fable-5-1`. Phase 2 uses the same
  pair per area.

## 1. In-repo bricks

| Brick | Location | Role in this packet |
| --- | --- | --- |
| Yeet proof planner and tiers | `packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts`, `commands/Quality/Quality.plan.ts`, `commands/Yeet/internal/Planner.ts`, `WaveOrder.ts` | the lane set and order every scoping lever changes |
| Proof ledger | `commands/Yeet/internal/ProofLedger.ts`, `ProofFact.ts`, `ProofShadow.ts`, `ProofDigest.ts` | reuse layer whose C4.2 flip is a parked lever |
| Final-check and ready gate | `commands/Yeet/internal/FinalCheck.ts`, `FinalCheck.schemas.ts`, `ReadyGate.ts` | the local replay of hosted gates |
| Coverage ratchet and artifacts | `commands/Quality/internal/CoverageScope.ts`, `CoverageRegression.ts`, `CoverageArtifacts.ts`, `commands/Ci/CiCoverage.ts`, `standards/coverage.regression-baseline.jsonc` | the publish-time coverage gap and its fix |
| Hosted lanes, partitions, admission | `commands/Ci/CiLane.ts`, `CiLanePartitions.ts`, `HeavyAdmission.ts`, `CiAdmission.ts`, `LaneTimings.ts`, `.github/workflows/check.yml`, `heavy.yml`, `heavy-admit.yml` | the hosted critical path and required contexts |
| Verification route | `commands/Ci/RouteClassify.ts`, `RouteFootprints.ts`, `Route.service.ts`, `RouteCensus.ts`, `RouteCorpus.ts`, `standards/verification-route.sentinel.json` | the kind-aware selector to make package-aware |
| Change profile | `commands/Ci/CiOperational.schemas.ts`, `CiOperational.service.ts`, `CiOperational.patterns.json` | the regex docs-only selector to reconcile with the route |
| Admission scheduler | `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts` and siblings | the authority to extend (ruling D3) |
| Lint policy, laws, seals | `commands/Lint/*`, `commands/Laws/*`, `commands/Quality/internal/LintPolicyScope.ts`, `JSDocDocumentationInventory.ts`, `standards/policy-tools.fingerprint.json` | the whole-repo scanners and their escalation |
| Turbo graph and cache policy | `turbo.json`, package `turbo.json` overlays, `commands/Quality/internal/TurboConfigProof.ts`, `commands/Cache/*`, `standards/cache-qualification-baseline.json` | invalidation and reuse |
| Economics and journals | `commands/Yeet/internal/Economics.ts`, `AttemptJournal.ts`, `.beep/yeet/runs/*/attempts.ndjson`, `.beep/yeet/final-check/*.json`, `.turbo/runs/*.json` | local measurement |

## 2. Evidence sources

| Source | Identity | Used for |
| --- | --- | --- |
| Hosted Check run (main) | `42634939284` (head `5cd896d6e8`) | per-job walls, critical path |
| Hosted Check run (PR, #3007 layout) | `42637312401` (head `9f30182f`) | per-job walls, queue waits, Unit layout comparison |
| Hosted Check run (main, pre-#3009) | `42619213744` (head `d1170ab46a`) | the 89-minute Test Integration baseline |
| `bun run beep yeet economics` | `yeet-economics/v2`, generated 2026-11-09T16:32Z and 16:37Z, window 2026-08-08 to 2026-11-09, 476 attempts | local lane p50/p95, M1, M2, M4, M5 |
| `bun run beep quality scheduler status` | 2026-11-09 16:30Z and 16:38Z | capacity, leases, quarantine residue |
| Admission journal | `~/.beep/runtime/beep-admit-uid-1000/journal.ndjson` (200-admission ring, 2026-11-06 to 09) | wait, hold, weights vs measured peaks |
| Final-check receipts | `.beep/yeet/final-check/*.json` in the primary clone and sibling worktrees (162 to 175 receipts) | coverage gate skip rate and durations |
| Turbo run summaries | `.turbo/runs/*.json` (last 400 in the primary clone) | local cache hit rates |
| Repo docs | `THE_AGENTIC_YOYO.md`, `docs/runbooks/repository-performance.md`, `docs/runbooks/performance-audit-loop.md`, `docs/runbooks/turbo-cache-inputs.md`, `docs/runbooks/ci-coverage-artifacts.md`, `docs/runbooks/ci-runner-reliability.md`, `docs/runbooks/ci-hosted-settings.md` | constraints, dispositions, mechanisms |

## 3. Prior packets (decisions and rejections inherited)

`goals/time-to-certainty` (paused; KPI law, C4.2, rulings 20, 22, 35, 57, 76-79, 83),
`goals/verification-route` (completed-retained; replay gate, one enforced refinement, 2026-11-07 rejections),
`goals/ci-lane-economics` (active; 20-minute charter, repair decisions 2 and 3, 2026-11-08/09 decisions),
`goals/ci-fleet-endgame`, `goals/ci-fleet-residue`, `goals/runner-trust-boundary`, `goals/push-first-publish`
(D1-D12), `goals/yeet-publish-preflight`, `goals/yeet-agent-ergonomics`, `goals/quality-gate-ratchets`,
`goals/compute-profile-gate-routing` (D1-D9), `goals/catalog-writer-incremental`,
`goals/turborepo-task-qualification`, `goals/turborepo-cache-conformance`,
`goals/turborepo-quality-cache-adoption` and `goals/turborepo-cache-trust-observability` (paused 2026-11-08
under an operational finish line), `goals/speed-loop`, `goals/ship-velocity`, `goals/quality-speedup`,
`goals/repo-quality-throughput`, `goals/agent-pipeline-velocity`, `goals/one-round-loop`,
`goals/honest-repo-signal`, `goals/lint-policy-single-digit`, `goals/box-typecheck-cost`, `goals/tsrs-gates`;
`explorations/beep-ci-operational-ontology`, `explorations/turborepo-quality-cache`,
`explorations/verification-route` (archived), `explorations/compute-profile-gate-routing` (archived),
`explorations/github-merge-queue` (captured, E8 flip condition), `explorations/stacked-pr-adoption` (parked),
`explorations/build-pipeline-simplification` (research). Two out-of-repo plans from earlier sessions
(lint efficiency, 2026-11-09; test and coverage efficiency, 2026-11-09) were read for their killed and
contested sections; their surviving content is summarised in `phase1/rejected-questions-gaps.md`.

## 4. Agent outputs filed here

| File | Producer | Notes |
| --- | --- | --- |
| `phase1/SURFACE-INVENTORY.md` | orchestrator synthesis over the 11 maps, the critic and the Astra map | sections 1-5, 4b = Astra diff |
| `phase1/components-compact.md` | 11 Opus readers (147 components) | name, grain, cache posture, cost evidence, in flight |
| `phase1/levers-compact.md` | 11 Opus readers (111 levers) | hypotheses with evidence needed; not yet refuted |
| `phase1/rejected-questions-gaps.md` | 11 Opus readers | 120 rejections on record, 83 open questions, 78 gaps |
| `phase1/astra-surface-map.md` | GPT-6 Astra (high), blinded | 32 components, 28-row rejected ledger, 12 constraints, pushbacks, per-job ledger for runs A/B/C |
| `phase1/baseline-2026-11-09.md` | orchestrator | scouted numbers before the fan-out |

Completion note: every GPT-6 Astra seat (the phase 1 map and the twelve phase 2 auditors) wrote its report
in full, then its closing reply failed on the Codex usage limit (reset 2026-11-14). The phase 1 map was
checked for its 32 component sections, its rejected-mechanism ledger, its operator questions and the
closing reproducible hosted job ledger; each phase 2 report was checked for its verdict section and
trailing JSON lever block. No seat was re-run and no substitute model was used.

## 5. External sources

None yet. Add each with its URL and access date when phase 2 cites one.
