# Cloud task admission review — 2026-11-01 credit window

Read-only planning review run in a Claude cloud session on 2026-11-02 UTC
against `main` at `cfdddd1d` (#2484). Its purpose is to pick bounded,
genuinely ready cloud implementation tasks from active goals while the
operator's expiring cloud credits last (through 2026-11-05). This note is
planning evidence only. It records no readiness result, flips no packet state,
and completes none of P2–P6.

Scope rules applied: exclude paused goals, goals awaiting an operator
decision, live data, desktop QA, external credentials, hardware, unmet
upstream prerequisites and major topology changes. Known owners excluded:
`citation-extraction-engine`, the two Turborepo cache packets,
`agent-observability-foundation`, and the separate cloud task that owns
`docs/runbooks/cloud-environments.md` and the 2026-11-01 Claude smoke (#2486).

## Ground state

- Only two PRs were open: #2485 (instrumentation catalog) and #2486 (cloud
  runbook and smoke). Several packet READMEs still name already-merged PRs
  as current (#2324, #2357, #2411, #2416, #2453, #2476), so every packet
  status line was checked against GitHub before use.
- Fan-out cap: repair decision 3 caps open PRs repo-wide at six
  (`goals/repository-simplification-residue/PLAN.md`, "Admission and wave
  order"). With two open, at most four new cloud PRs fit concurrently.
- The VM is 4 vCPU / about 15 GiB; `BEEP_AGENT_HOST=cloud` and
  `CLAUDE_CODE_REMOTE=true` are set.

Common end state for every brief (D4, `SPEC.md` Decisions): run the
package-scoped checks named in the brief, quote them in the PR body, push the
assigned branch, open a draft PR through the GitHub integration with
`ready-for-heavy`, and list skipped gates. `yeet final-check`, `ready` and
`monitor` stay operator-side.

## Candidates

### T1 — skill-contract-gate-certificates P0+P1

- Acceptance: `goals/skill-contract-gate-certificates/SPEC.md` Acceptance
  Criteria — certificate schemas (in-toto-shaped unsigned envelope, five
  EARL/ACT outcomes, reach, aggregate) with codec and property tests; QA
  judge parity; aggregate never `passed` with any in-reach inconclusive
  check; apply-by-id refuses a stale digest or unknown id.
- Prerequisites: met. `skill-contract-kernel` is completed-retained; MAP
  Amendment J was ruled 2026-10-14 (SPEC Constraints); kernel files exist
  (`packages/foundation/modeling/skill-contract/src/{Gate,EvidenceReceipt}.ts`),
  as do the producer files
  (`packages/tooling/tool/cli/src/commands/Qa/{JudgeContract,JudgeLint,QaJudgeGateId,JudgeCheck}.ts`)
  and `packages/tooling/tool/cli/test/qa-judge-contract-parity.test.ts`. No
  open PR.
- Owns: `packages/foundation/modeling/skill-contract/**` plus a changeset,
  the `Qa/Judge*` files and qa-judge tests, the packet.
- Consumer: the browser-qa-loop judge settlement.
- Checks: `bun run beep quality package-verify @beep/skill-contract`;
  targeted qa-judge vitest; `package-verify @beep/repo-cli --quick`;
  `bun run beep lint reflection-artifacts`.
- Effort 4–6 h. Conflict risk low (beep-cli-composition W2 moves QA schemas
  only after W1).
- Brief: "Implement goals/skill-contract-gate-certificates P0+P1 per its
  GOAL/SPEC. Record P0 source confirmation in the packet. Add the certificate
  modules to @beep/skill-contract (schemas-only, modeling dependencies only,
  changeset). Make the QA judge settlement in
  packages/tooling/tool/cli/src/commands/Qa emit one certificate per run, with
  a parity test against current JudgeCheck results on existing fixtures. Add
  property tests that an aggregate is never `passed` with any in-reach
  cantTell/untested check, and tests for apply-by-id refusing stale and
  unknown ids. Do not touch other gate consumers, signing or the closed kernel
  goal. Proof: package-verify @beep/skill-contract; package-verify
  @beep/repo-cli --quick; targeted qa tests. Update packet phases and the
  Decision Log. End per D4."

### T2 — verification-route P1, census refinement 1 (taxonomy)

- Acceptance: `goals/verification-route/PLAN.md` "P1 — Slice 2" and
  refinement 1 in `goals/verification-route/research/census-2026-10-31.md`
  ("Ranked refinements for slice 2"): non-markdown files under `goals/` and
  `explorations/` become `packet`, `standards/*` baselines a baseline kind,
  `scratchpad/**` its own kind. No footprint claim; it shrinks the 33.55%
  `unknown` share.
- Prerequisites: met. Slice 1 merged in #2414 and #2449. The current rule
  requires markdown for `packet`
  (`packages/tooling/tool/cli/src/commands/Ci/RouteClassify.ts`).
- Owns: `packages/tooling/tool/cli/src/commands/Ci/{RouteClassify,Route.schemas,RouteFootprints}.ts`,
  `packages/tooling/tool/cli/test/ci-route-*.test.ts`,
  `packages/tooling/tool/cli/test/fixtures/ci-route/**`, the packet.
- Consumer: slice 2 refinements 2 and 3.
- Checks: extend `CHANGE_ATOM_KIND_VALUES`; `ROUTE_FOOTPRINTS` has one row
  per lane whose `kinds` already default to the full kind list, so add a
  test that every new kind still selects every lane (routing stays sound)
  rather than adding rows; mutation fixtures per new kind; targeted ci-route
  vitest; `package-verify @beep/repo-cli --quick`; a re-measured `unknown`
  share (if the corpus fetch cannot run in the VM, measure over local history
  and label it so).
- Effort 2–4 h. Conflict risk low–medium (repo-cli is a hotspot; these files
  belong only to this goal).
- Brief: "Implement census refinement 1 only from
  goals/verification-route/research/census-2026-10-31.md. Add the kinds in
  Route.schemas.ts/RouteClassify.ts, test that every lane's ROUTE_FOOTPRINTS
  row still selects each new kind (no footprint claim), add fixtures, re-measure
  the unknown share and append it to the packet. Do not implement refinements
  2–3, layer 1 or final-check. Proof: ci-route tests; package-verify
  @beep/repo-cli --quick. End per D4."

### T3 — ontology-sidecar-stateless-identity PR 1

- Acceptance: `goals/ontology-sidecar-stateless-identity/SPEC.md`
  Acceptance Criteria — `[McpProtocol.v2026_07_28]` only; `runIdOf` returns
  `launch:<digest>` with the `mcp-session-id` read deleted; grant freeze,
  hash-chain continuity, grant-expired permanence and never-evict tests;
  `OntologyChangeActor` on the anchor; Origin allow-list with `OPTIONS` 403;
  conformance.
- Prerequisites: met, although the packet `PLAN.md` status still says
  blocked. `goals/mcp-stateless-kit-and-drivers` PR 1 (#1192) merged
  2026-09-22; `@beep/mcp-kit/client` and `McpDispatchAnchor`
  (`packages/foundation/capability/mcp-kit/src/McpCaller.ts`) exist.
  `docs/ROADMAP.md` Lane 3 queue item 4 says it can start.
- Owns: the GOAL.md scope list (desktop
  `server/{OntologyMcpTransport,RpcSessionAuth}.ts`, `test/integration/**`,
  `GovernedTierGate/**`, `OntologyChangeActor`, `McpConfig.ts`, the
  `SanitizedSpan.ts` read, `live-mcp-client.ts`).
- Consumer: the desktop ontology sidecar.
- Checks: `package-verify` for `@beep/epistemic-server`,
  `@beep/ontology-config` and `@beep/ontology-server`; the local PGlite
  integration test `apps/professional-desktop/test/integration/ontology-mcp-http.test.ts`.
  Hosted Heavy / Test Integration is the exit proof (PLAN Execution Notes).
- Effort 6–10 h. Conflict risk medium: new gate spans may need an
  instrumentation-catalog regeneration while #2485 is open on that catalog.
- Brief: "Execute goals/ontology-sidecar-stateless-identity PR 1 exactly per
  its PLAN 'PR train' item 1. Correct the stale 'blocked' status first (the
  precondition is #1192). Raw bearer never in a span, log or assertion;
  compare digests. Regenerate catalogs with the owning commands. Proof: the
  three package-verify runs and the local integration test; state in the PR
  that hosted Heavy / Test Integration is the exit proof. End per D4."

### T4 — party-slice P1 steps 2–3 (domain package only)

- Acceptance: `goals/party-slice/PLAN.md` P1 and "P1 Settlement Checklist":
  create `@beep/party-domain`; PartyKey v1 canonicalizer with pinned
  bytes/digest fixtures; identifier normalizers (header `Dana@example.test`
  equals card `dana@example.test`; Exchange DN, Username and E.164 fixtures).
- Prerequisites: step 1 is already done, though the README "Next" line still
  names the PartyId kit PR: `PartyId` lives at
  `packages/shared/domain/src/identity/Party/PartyId.ts` and law-practice
  imports it (`packages/law-practice/domain/src/entities/Party/Party.model.ts`).
  The scratchpad source exists (`scratchpad/party/*`); P0 was grilled with
  the operator.
- Owns: the new `packages/party/domain` (only via
  `bun run beep create-package` and `bun run beep architecture`), its tests,
  the packet. Not use-cases, server or the `LegalPartyReference` rename.
- Checks: `package-verify @beep/party-domain`; `bun run beep lint
  package-scripts`; architecture audit.
- Effort 5–8 h. Conflict risk low for code; create-package touches
  generated registries.
- Brief: "Advance goals/party-slice P1 steps 2–3 for the domain package only.
  Create @beep/party-domain via create-package; port Ids/PartyKey/normalizers
  from scratchpad/party with the SPEC's pinned fixtures and pure tests. Mark
  step 1 done (cite PartyId.ts). Leave use-cases, server, the law-practice
  rename and scratchpad removal for later. Proof: package-verify
  @beep/party-domain. End per D4."

### T5 — agent-rating-critique-fixes P2a (`passWithNoTests` silent-green)

- Acceptance: `goals/agent-rating-critique-fixes/SPEC.md` "P2 —
  silent-green and gate honesty", first box: remove the flag from every
  package with `test/**/*.test.*`, enumerate the remainder with a reason, and
  prove a deleted-suite canary fails.
- Prerequisites: met. The P0 rating is on `main`
  (`goals/agent-rating-critique-fixes/research/repository-rating.md`; the
  README's "in progress" is stale). The flag comes from the generator
  (`packages/tooling/tool/cli/src/internal/package-scripts/PackageScripts.schemas.ts`,
  ten sites); about 139 of 147 flagged manifests have test files.
  `vitest.shared.ts` sets the flag only for coverage and deep-sweep runs;
  justify keeping it.
- Owns: `packages/tooling/tool/cli/src/internal/package-scripts/**` and its
  tests, the migrated manifest `scripts` blocks, the packet.
- Gotcha: `bun run beep lint package-scripts --write` alone does not update
  existing manifests. `seedImplementation` in `PackageScriptsPolicy.ts` keeps
  an existing implementation entry, and `diffBlock` reports only missing
  implementations, so changed defaults never reach a manifest that already
  has the flag. The task needs an explicit migration step: either a narrowly
  scoped writer change that rewrites the flag where test files exist, plus a
  drift check that compares implementation text for it, or a one-time
  migration recorded in the PR.
- Checks: `bun run beep lint package-scripts`; package-scripts tests;
  `package-verify @beep/repo-cli --quick`; the canary.
- Effort 3–5 h. Conflict risk medium–high (about 140 manifests; regenerate on
  every rebase). Risk: hosted red where a package's unit run finds nothing
  (for example only integration tests); identify those first.
- Brief: "Implement only the passWithNoTests box of
  goals/agent-rating-critique-fixes P2. Change the generator to emit the flag
  only when the package has no matching test files, per run variant. Because
  `lint package-scripts --write` preserves existing implementation entries,
  add an explicit, tested migration (scoped writer change plus drift check, or
  a recorded one-time rewrite) for existing manifests; enumerate the remaining
  packages with reasons; add a
  deleted-suite canary test. No coverage-floor or lint-promotion work. End
  per D4."

### T6 — wake-service P0 + acceptance row 1 (pure core only)

- Acceptance: `goals/wake-service/SPEC.md` Acceptance Criteria, first box:
  `Condition` and `Watch` schemas plus engine tests for check
  classification, the creation check, one wake and the limits.
- Prerequisites: the first producer, hold-ledger, merged (#2404, #2450,
  #2453); `agent-message-router` is completed. Not verified: whether
  upstream `kitlangton/skulk` (MIT) is reachable from the VM.
- Owns: one new library under `packages/tooling/library/` via create-package,
  the packet. The repo-cli `Wake` command group, systemd unit, dispatcher and
  dead-man workflow are out of scope (they need workstation services, launches
  or quota, and the command group would collide with beep-cli-composition).
- Checks: `package-verify` on the new package.
- Effort 4–6 h. Conflict risk low.
- Brief: "Run goals/wake-service P0 (record sources and skulk attribution) and
  deliver acceptance row 1 only, as a new tooling library via create-package:
  pure engine, schemas and tests; no CLI group, daemon, dispatcher or
  launches. If skulk cannot be fetched, port from the exploration's recorded
  semantics and say so. End per D4."

### T7 — agent-rating-critique-fixes P3a: split `repo-utils` `JSDoc.ts`

- Acceptance: SPEC "P3 — maintainability": no named handwritten `src` file
  over 2,500 lines, public subpaths stable.
  `packages/tooling/library/repo-utils/src/JSDoc/JSDoc.ts` is 5,223 lines.
- Prerequisites: met; not touched in the last 50 commits on `main`.
- Owns: `packages/tooling/library/repo-utils/src/JSDoc/**` and its tests.
- Checks: full `package-verify @beep/repo-utils`; `package-verify
  @beep/repo-cli --quick`.
- Effort 3–5 h. Conflict risk medium. Weaker consumer (the re-rating).
  `Html.model.ts` is excluded (overlaps doc-hub-spokes-inversion) and
  `Quality.command.ts` is excluded (overlaps beep-cli-composition W11).

### T8 (conditional) — cloud-agent-readiness P2 host guard

- `BEEP_AGENT_HOST=cloud` is now set in the cloud environment.
  `.claude/hooks/hook-pulse.sh` launches the `desktop-ntfy-1` notifier
  (`sequence-break-notifier.sh`) with no host guard, and
  `.claude/hooks/packet-projections.sh` has no missing-`node_modules/effect`
  skip. The graft step is moot (retired 2026-10-28, SPEC Target Surfaces).
- Effort 2–3 h. Needs coordination: `hook-pulse.sh` may fall under the
  agent-observability owner, and the separate cloud task is editing this
  packet's history and `research/OPPORTUNITIES.md`. Do not launch without
  both owners agreeing.

## Rejected

- Owned: citation-extraction-engine; both Turborepo cache packets;
  agent-observability-foundation; the cloud runbook and smoke (#2486);
  effect-vitest-canon and residue #1875 (waves w15–w21 merged 2026-11-01).
- Only completion receipts remain (operator-side Yeet verdicts or external
  alert closure, no code): effect-string-migration, exact-optional-keys,
  tsrs-gates, epistemics-foundation-extraction, hold-ledger,
  public-origin-beep-effect-com, epistemic-retention-policy-calibration,
  codex-security-findings 2026-10-20 and 2026-10-28, effected-promotion,
  claim-element-antecedent-check P4.
- Too broad or colliding: doc-hub-spokes-inversion (repo-wide package rename
  with a major changeset; collides with oracle-loop-poc and the `Html.model.ts`
  split); beep-cli-composition W1 and later (gated on effected-promotion's
  formal close; package topology).
- Prerequisites not met: oracle-loop-poc (imports `@beep/md` before the
  rename; repair and regenerate arms likely need model credentials; PEDANTIC
  licence unconfirmed); folio-lynx-taxonomy-browse (blocked on the Lynx
  licence proof).
- Workstation, systemd, live data, attorney, hardware or UI QA:
  fleet-root-registry, lane-bootstrap, legacy-drain, ops-seat-timers, the
  telemetry packets, coding-agent-effectiveness-evidence-loop, the law-,
  uspto-, practice- and design-figure packets, thread-virtualization, the
  ci-* packets and runner-trust-boundary, agent-pool-doctrine.
- Parked by `docs/ROADMAP.md` or awaiting prioritization:
  hybrid-retrieval-fusion-core, projection-dispatch-core,
  effect-v4-workflow-engine-spike, slice-topology-audit,
  canonical-proof-reconciliation, agentic-governance-laws, semantica-*.

## Ranking

1. T1 skill-contract-gate-certificates — every prerequisite met,
   schemas-only plus one producer, full package proof fits the VM, low
   conflict.
2. T2 verification-route refinement 1 — small, census-ranked, files owned
   only by this goal, directly unblocks slice 2.
3. T3 ontology-sidecar PR 1 — startable per the roadmap queue and its
   precondition met since 2026-09-22; largest of the three, hosted exit
   proof.

The operator selected T1–T3 for launch. None was launched by this review
session.

## cloud-agent-readiness P2–P6 status

P0 and P1 are complete, but the P1 acceptance rows in `SPEC.md` name the
retired `scripts/cloud-session-setup.sh`; current bootstrap is
`scripts/cloud/bootstrap.sh`, so those rows are stale as written. The packet
is not complete.

| Phase | State | Evidence |
| --- | --- | --- |
| P2 Harness host awareness | Missing as specified | No `BEEP_AGENT_HOST` read in `.claude/hooks/*` or `scripts/`. Detection uses vendor markers in `scripts/cloud/bootstrap.sh` (vendor detection block), called by the SessionStart hook in `.claude/settings.json`. Desktop delivery degrades gracefully (`sequence-break-notifier.sh` checks for `notify-send`). The graft piece is moot. Acceptance row 4 is unproven; D3 needs a Decision Log amendment. |
| P3 Publish handoff | In flight, separately owned | #2486 adds `history/2026-11-01-claude-cloud-smoke.md` (setup, `package-verify @beep/types --quick`, push, draft PR through the integration); that would satisfy acceptance row 6 once merged. |
| P4 Doctrine | Partial, under different names | `AGENTS.md` has "Cloud Environments", not "Cloud sessions", without the host variable, the can/cannot rubric or the D4 end state. The runbook is `docs/runbooks/cloud-environments.md`, not `cloud-sessions.md`; `docs/README.md` links it but `docs/runbooks/agent-pools.md` does not, and that runbook has no cloud meter section (D6; only a credits mention in the Opus meter). `docs/ROADMAP.md` mentions the accelerator in prose but has no row. The `rg cloud-sessions.md` verification command is stale. |
| P5 Yeet to mergeable | Missing | No packet PR. |
| P6 Close | Missing | `history/reflections/` is empty. |

## Open coordination questions

- Confirm that nobody already holds verification-route slice 2; the slice-1
  lane merged on 2026-11-01.
- Whether the agent-observability owner covers `.claude/hooks/hook-pulse.sh`
  (decides T8).
- Whether #2476 counts as effected-promotion closing for beep-cli-composition
  W1, and where composition wants new tooling libraries to live (T6).
- T5 may produce hosted reds in packages whose suites are excluded from unit
  runs: decide exception or fix.
- T3 and T4 should correct the stale packet lines (ontology "blocked", party
  "Next: PartyId kit PR") in the same PR.
- `goals/INDEX.md` is an ignored local projection; its counts may lag the
  tracked manifests.
