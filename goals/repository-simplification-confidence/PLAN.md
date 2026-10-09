# Repository Simplification and Confidence Plan

## Status

Status: `in-progress` — stage 1 (ownership and recovery), packet phase P0.

Orchestrator: the program's Claude Fable session (program orchestrator and,
by operator ruling 2026-10-09, holder of the single fleet orchestrator role;
see the SPEC.md Decision Log). Packet lane: `rsc-packet`
(branch recorded in the baseline receipts), cut from `e62411d63f`. Baseline receipts:
[`research/baseline-2026-10-09.md`](./research/baseline-2026-10-09.md).

## Phases

The manifest keeps the archetype phases (validated by `goals doctor`); the six
program stages map onto them.

| Phase | Status | Program stages | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | 1 Ownership and recovery | Stage 1 exit condition met and recorded (`history/receipts/stage-1-ownership.md`, 2026-10-09). |
| P1 Implement | in-progress | 2 Shared decisions and retirements; 3 Parallel implementation; 4 Existing test work and tooling | Stage 2-4 exit conditions met. |
| P2 Verify | pending | 5 Operational acceptance | SPEC acceptance table satisfied with current revision/fingerprint evidence. |
| P3 Yeet: PR to mergeable | pending | 6 Review and closeout (publication half) | Every program PR mergeable and merged at the gate. |
| P4 Close | pending | 6 Review and closeout (receipts, retirement, reflection) | Completion receipts resolved, lanes retired, reflection landed, packet `completed-retained`. |

## Program Stages

Reproduced from brief section 5.

The coordinating orchestrator owns integration order and shared policy/manifests. Assign separate implementation owners and independent review owners. Workers must preserve each other's edits and report durable handoff files. Serialize shared manifest, lockfile, model-policy, and generated-inventory edits through one owner.

| Stage | Work | Dependency and exit condition |
|---|---|---|
| 1. Ownership and recovery | Establish revisions, jobs, existing work, model routes, backups, and evidence locations. Preserve the five Vitest lanes. | Proceed when active owners and recovery paths are recorded; no unrelated state adopted or discarded. |
| 2. Shared decisions and retirements | Land private release-note policy, accepted Knip detection reduction, approved retirements, and program review exception. Capture Knip's 41 known findings before removal. | Reviewed policy and known-finding transfer exist before removing the tools that expose them. |
| 3. Parallel implementation | Separate retirement/dependencies, script migration, standards, docs/release policy, GitHub, agent configuration, and storage lanes. | Each lane has explicit files/responsibility, dependencies, package gates, and durable handoff. Shared files remain serialized. |
| 4. Existing test work and tooling | Reconcile `effect-vitest-canon`; implement detector repairs, telemetry qualification, and completion receipts. | Existing systems reused; qualified work preserved; inventory reconciliation tied to final code. |
| 5. Operational acceptance | Verify retained workflows, global configuration, permission continuity, cleanup recovery, and actual cache sources. | Acceptance table satisfied with current revision/fingerprint evidence; unsupported external conditions explicitly recorded. |
| 6. Review and closeout | Publish, mark ready, monitor, answer reviews, merge at gate, resolve completion receipts, retire lanes, reflect. | Final-head hosted checks and zero actionable program findings; merged work and workstation proof reported separately. |

Run documentation/release-policy and source changes in reviewable PRs while preserving dependencies. Coordinate inherited red fixes with the fleet owner and integrate one shared repair. Changes to the agent configuration must precede that workstream's final three-model review; configuration mutations afterward require review of the changed final fingerprint.

## Lane Plan

Every lane is a linked worktree in the sibling `-worktrees` root of its clone
(`<clone>-worktrees/<lane>`), created through the repository workflow. Each
lane has an implementation owner and a separate independent review owner;
workers never commit to another lane and preserve each other's edits. Each
lane writes a durable handoff at
`goals/repository-simplification-confidence/history/handoffs/<lane>-<YYYY-MM-DD>.md`
before it hands back (files touched, commands run with results, open
findings, recovery notes); the orchestrator reads only those files.

Model routes follow the brief's table, `AGENTS.md` "Volume pools", and the
SPEC.md Decision Log routing rows (2026-10-09): every program lane (A through
H4 and V), including F and H4, runs its implementation on Codex `gpt-6.1-sol`
medium; every lane except F also runs its independent review on Codex
`gpt-6.1-sol` medium in a separate session, and F is reviewed by the
three-model panel; the direct Claude route is reserved for the orchestrator
(`claude-fable-5-1`, with `claude-opus-5-5` medium workers in its `rsc-packet`
and `rsc-shared` lanes) and for the independent workstream-F panel. Fallback is
the originating provider's chain (Codex: `gpt-6.1-sol` → Cursor
`claude-opus-5-5` → grok-build `grok-4.7` medium; Claude: `claude-opus-5-5` →
Cursor `claude-opus-5-5` → grok-build `grok-4.7` medium), only on confirmed
quota, availability, or unsupported-model failures. The xhigh panel is used
only for workstream F.

| Lane | Clone | Scope (explicit files and responsibility) | Implementation | Independent review | Depends on |
| --- | --- | --- | --- | --- | --- |
| `rsc-packet` | `beep-effect3` | This packet: brief, receipts, decisions, plan, staged checklist. | Orchestrator (`claude-fable-5-1` medium) with `claude-opus-5-5` worker | `claude-opus-5-5` (separate session) | — |
| `rsc-shared` | `beep-effect3` | Serialized shared files: root `package.json`, `bun.lock`, models manifest, `AGENTS.md` (the `CLAUDE.md` symlink follows it), shared policy, generated inventories, `turbo.json` task declarations. Integration order for every lane. | Orchestrator | `claude-opus-5-5` | Each lane's handoff requesting a shared edit; effected-port session notified (through the orchestrator) before publishing an edit to `scratchpad/package.json` or `bun.lock` |
| `rsc-a-retire` | `beep-effect3` | Workstream A: retirements (SST residue, `map.html`, Knip, `tools/skillopt`, plugin copies, `.serena` residue, Impeccable, `.ai/mcp/mcp.json`), dependency removals, retained-tool documentation; Knip finding remediation; `harness-ledger/` compact default presentation (reduced default context exposure) with append-only rows and decision chains untouched (brief 2.A). | Codex `gpt-6.1-sol` medium | Codex `gpt-6.1-sol` medium (separate session) | Start: the captured Knip finding list (`research/knip-findings-2026-10-09.md`); Knip removal: Stage 2 complete (every row of that list carries a final non-`pending` disposition with evidence) and policy reviewed; `rsc-c-scripts` (compiler-backup pruning port) before the compiler-provenance verification for 'Retained tools'; `rsc-shared` for root `package.json`, `bun.lock`, and `turbo.json` (Knip, Impeccable, and dependency removals); `rsc-shared` for `AGENTS.md` edits, batched per wave (the `quality:knip` example at `AGENTS.md:214`) |
| `rsc-b-standards` | `beep-effect3` | Workstream B: `standards`, `.patterns`, `docs` classification, scanner reproduction, detector repairs with paired fixtures, exception review; documentation obligations (brief 2.B, 7): replace stale copied guidance with current tested examples or short pointers to its authority, verify agent discovery after consolidation, resolve obsolete JSDoc tags, legacy error helpers, whole-repository formatting advice, and current-tense memory recommendations superseded by file-memory decisions, compact historical summaries and mark superseded guidance clearly, and review the other `.patterns` files against current reference source before retaining their advice; agent-loaded guidance in `.claude/skills/**` (excluding the Impeccable payload removed by `rsc-a-retire`), `.claude/agents/*.md`, `.codex/agents/*.toml`, `.grok/skills/**`, and `standards/git-worktrees.md`: replace Effect APIs absent from the installed version with verified current forms (`research/sweeps/2026-10-09/B-skills-stale-api.md`), recorded in `history/receipts/stage-4-standards-docs.md`; inline-directive and config-level exclusion review (B-inline-suppressions.md). | Codex `gpt-6.1-sol` medium | Codex `gpt-6.1-sol` medium (separate session) | Lane V before any `effect-vitest` inventory or cohort change; before publishing an edit to `standards/effect-laws.allowlist.jsonc` or `packages/tooling/policy-pack/repo-configs/src/internal/eslint/generated/EffectLawsAllowlistSnapshot.ts`, the effected-port session is notified through the orchestrator; `rsc-shared` for generated inventory refreshes (effect-vitest, JSDoc, schema-first) |
| `rsc-c-scripts` | `beep-effect3` | Workstream C: the 21-entry script routing checklist plus `scripts/graft/` classification; command-family ports; regenerated package scripts; account for the documented root-input verification gap (brief 7 Verified source index, `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts`): record how each root-script port and retained root adapter is verified despite that gap, in the lane handoff and `history/receipts/stage-5-acceptance.md#script-ports`; (i) repair or record the `knowledge-refs-rewrite` drift (rules #0-#2, #34) before parity tests, so the port's dry-run baseline exits 0 or carries a recorded expected failure; (ii) retiring `scripts/cloud-session-setup.sh` updates `goals/cloud-agent-readiness` verificationCommands, recorded as a Decision Log row naming that packet's owner; (iii) the surviving-capabilities row for `scripts/systemd` records the installed-vs-repo drift and the unowned `50-heavy-budget.conf` drop-in, with a re-sync or ownership decision. | Codex `gpt-6.1-sol` medium | Codex `gpt-6.1-sol` medium (separate session) | Lane E for workflow caller updates; `rsc-shared` for root scripts; `rsc-shared` for `AGENTS.md` edits, batched per wave (the `setup-effect-ref.sh` and `agent-runs.slice` references at `AGENTS.md:405`) |
| `rsc-d-release` | `beep-effect3` | Workstream D: private changeset retirement, pre-release baseline record, release-note policy and quality checks; (1) a census of every demonstrated published or externally consumed contract (registry publications, external consumers, desktop release artifacts), recorded before any changeset is retired, with the obligations of each one found preserved; the census lists GitHub Packages with a `read:packages`-scoped query result, or records it as an externally blocked check, before any changeset is retired; (2) verification that desktop release/versioning (`.github/workflows/release-desktop.yml`) stays separate, with behavior as intended after the `rsc-e-github` E-09 decision; (3) the dormant-publication activation note: activation must deliberately re-establish release/versioning policy and restore the appropriate changeset requirements (brief 2.D, 7); (4) the same PR updates every policy text in `research/sweeps/2026-10-09/D-changesets.md` item 8: `.claude/skills/yeet/SKILL.md:443,1008-1013`, `IssueClassification.ts:333-337` remediation text, `standards/architecture/15-lab-apps.md:54`, `standards/architecture/14-ecosystem-packages.md:118-129`, `docs/runbooks/lab-promotion.md:39,55,76`, a new `standards/architecture/DECISIONS.md` entry, and the `release-desktop.yml:10-11` comment; `AGENTS.md:177-180` goes through `rsc-shared`. | Codex `gpt-6.1-sol` medium | Codex `gpt-6.1-sol` medium (separate session) | Stage 2 (lands first among source changes); precondition: the external-contract census in `history/receipts/stage-2-policy.md#external-contracts` is recorded before any changeset is retired; `rsc-shared` for shared release-note policy and quality-check files; `rsc-e-github` E-09 decision before the Release policy verification; `rsc-shared` for `AGENTS.md` edits, batched per wave: the changeset policy text at `AGENTS.md:177-180` rides the same PR as the changeset gate change, through `rsc-shared`; its `.claude/skills/yeet/SKILL.md` edit lands before the final F panel |
| `rsc-e-github` | `beep-effect3` | Workstream E: `.github` and hosted settings audit and repairs; retired-tool jobs; lane declaration reconciliation; decide E-09 (sweep E-github; brief 2.E release environments): either create `professional-desktop-release` with the operator as required reviewer and a `professional-desktop-v*` policy, with signing secrets moved there (the secret values are operator-supplied; record as externally blocked if unavailable), or record the desktop release path as dormant with `gh workflow disable` and a reconsideration condition; record the decision in the Decision Log and `history/receipts/stage-2-policy.md#desktop-release`; any option that changes desktop release behavior (including `gh workflow disable`) is a SPEC Decision Log row with its reason and reversal (`gh workflow enable release-desktop.yml`), and the Release policy evidence cites it. | Codex `gpt-6.1-sol` medium | Codex `gpt-6.1-sol` medium (separate session) | Lane A for retired-tool jobs; shared inherited-red repair lands once; `rsc-shared` for generated task/lane declarations and `turbo.json`; for the Knip job and `Knip` ruleset-context removal: Stage 2 complete (every row of `research/knip-findings-2026-10-09.md` carries a non-`pending` disposition with evidence), landed in the same change window as `rsc-a-retire`'s Knip removal |
| `rsc-f-agents` | `beep-effect3` + workstation | Workstream F: resolved agent inventory, owned-field transformations with backup/rollback, duplicate removal, Docker MCP profiles, before/after measurement; restore ordinary global Codex (`gpt-6.1-sol` medium) and Claude (`claude-opus-5-5` medium) defaults through owned-field transformations; preserve lightweight and research routes; document ownership of Junie's `gemini-3-flash-preview` + Auto subagents and verify their behavior without inventing a fallback chain (starting reading: baseline "Model routes at take-over"); harness-ledger rows written only through the supported writer (CLI `packages/tooling/tool/cli/src/commands/HarnessLedger/HarnessLedger.command.ts`), linking the approved interview decisions to execution records; rows stay append-only and immutable (brief 2.F item 7); disposition of global Impeccable installations under the F evidence policy (2.F items 5-6; repository copy removed by `rsc-a-retire`). The before-measurement receipt lands before the first owned-field apply. The models-manifest edit goes through `rsc-shared`. The installed Docker MCP gateway/profile ownership and compatibility discrepancy, and the profile ownership of each client on a shared HTTP gateway, are resolved and recorded in `history/receipts/stage-3-f-inventory.md#docker-mcp` before any Docker MCP configuration change. Dynamic discovery is enabled only after a recorded bounded compatibility and workflow validation. Experimental code mode stays excluded (brief 2.F, 7). | Codex `gpt-6.1-sol` medium | Three-model panel: `gpt-6-astra` xhigh, independent `claude-fable-5-1` xhigh, `grok-4.7` xhigh (acceptance probed 2026-10-09, see `research/panel-acceptance-2026-10-09.md`) | H3 for any zero-use decision; all F config changes precede the final panel, and all agent-configuration mutations from any lane (`rsc-a-retire` Impeccable hooks/skills, `rsc-b-standards` skill and agent-definition edits, `rsc-d-release` changeset text in `.claude/skills/yeet/SKILL.md:443,1008-1013`, every `rsc-shared` `AGENTS.md` wave (A `:214`, C `:405`, D `:177-180`), `rsc-h3-telemetry` hooks, `rsc-h4-permissions` permission keys (home and project `.claude/settings.json`)) precede the final panel; `rsc-shared` for the models manifest; effected-port session notified (through the orchestrator) before publishing an edit to `standards/effect-laws.allowlist.jsonc` or its generated `EffectLawsAllowlistSnapshot.ts` |
| `rsc-g-storage` | `beep-effect3` + workstation | Workstream G: `.beep` census refresh, dry-run cleanup report, recoverable apply, Turbo cache fixtures. | Codex `gpt-6.1-sol` medium | Codex `gpt-6.1-sol` medium (separate session) | Stage 2; `rsc-e-github` E-02/E-03 writer boundary established before the read-only remote posture claim; cache acceptance uses the 10-06 trusted artifacts before 2026-11-05 (after the read-only token Decision Log row), otherwise `rsc-e-github` E-01 cleared (a completed trusted writer run) first |
| `rsc-h1-catalog` | `beep-effect3` | Status: OSV wave PR #1562 ready for review; Run 4 integrates #1564/#1565 and corrects cache-path/census review findings; saved terminal parity retained; local parity passes except inherited knowledge refs; remaining waves wait for A Knip and H1 prior-wave merges; no manifest or lockfile delta. H1: catalog reservations and compatibility holds; (1) remove the inert `@opentelemetry/propagator-jaeger` override and its `.fallowrc.jsonc` `ignoreDependencyOverrides` entry in the same PR as the catalog removals; (2) close the detection gap that `.fallowrc.jsonc` `unused-catalog-entries: off` leaves, either by enabling it with a per-entry allowlist for the `@effect/tsgo-*` pins or by adding a `beep lint` check that every catalog key has a manifest, root, or override consumer, and record the choice in the Decision Log; (3) add a hold-register row (consumer, failure evidence, owner, exit condition) for every retained override and patch, using `patches/onnxruntime-node@1.30.0.md` as the template (H1-catalog.md Proposed plan items 1-3). | Codex `gpt-6.1-sol` medium | Codex `gpt-6.1-sol` medium (separate session) | `rsc-shared` (root manifest); effected-port session notified (through the orchestrator) before publishing an edit to `scratchpad/package.json` or `bun.lock` |
| `rsc-h2-completion` | `beep-effect3` | H2: typed completion evidence, post-merge receipts, doctor outcomes, three advisories. Implementation and reconciliation in progress; evidence: `history/receipts/stage-4-completion-receipts.md`. | Codex `gpt-6.1-sol` medium | Codex `gpt-6.1-sol` medium (separate session) | None |
| `rsc-h3-telemetry` | `beep-effect3` | H3: attribution and stamping repair in the existing evidence pipeline. | Codex `gpt-6.1-sol` medium | Codex `gpt-6.1-sol` medium (separate session) | Feeds F; `.codex/hooks.json` and hook-script edits are serialized with `rsc-a-retire`'s Impeccable hook removal, re-trust Codex hooks (`[hooks.state]`, through `rsc-f-agents`), and land before the final F panel |
| `rsc-h4-permissions` | `beep-effect3` + disposable fixtures | H4: permission continuity fixtures and repairs. | Codex `gpt-6.1-sol` medium | Codex `gpt-6.1-sol` medium (separate session) | Home-config repairs (`~/.codex/config.toml` legacy `sandbox_mode`, any `~/.claude/settings.json` `permissions.defaultMode` change) go through `rsc-f-agents`' owned-field writer with its `$HOME/.config-backups/` backup and drift check. A change to the tracked project `.claude/settings.json` `permissions.defaultMode` (line 94, `default`) lands by PR with a SPEC Decision Log row (reason; reversal `git revert`). Both land before the final F panel; never another session's live work |
| V `effect-vitest-canon` | `beep-effect2` | Reconcile the five unpublished lanes and staged work; reuse qualified work; resume the paused goal; plus the gap-19 residue in other `effect-vitest-*` worktrees of `beep-effect2` (`rdf`, `wave-d-pacer` and `wave-d-cosmos` commits; uncommitted edits in `capability-leaves`, `coverage-followup`, `inventory-proof`, `rdf`): each is saved (patch or branch ref) and dispositioned as port, superseded with evidence, or discard with reason in `history/receipts/stage-4-vitest-reconciliation.md`. | Codex `gpt-6.1-sol` medium (existing lane owner route) | Codex `gpt-6.1-sol` medium (separate session) | Stage 1 preservation receipt; `rsc-shared` for generated inventory refreshes (effect-vitest, JSDoc, schema-first) |

Lane names are planned; each lane is recorded in
[`research/baseline-2026-10-09.md`](./research/baseline-2026-10-09.md) (or a
dated successor receipt) when it opens.

### Lane inputs

Each lane reads its sweep files and brief sections before editing. Paths
under `research/sweeps/2026-10-09/` are tracked in this packet; a "private receipt" is a
workstation-facing sweep kept in the orchestrator briefs directory (SPEC.md
Decision Log, sweep evidence placement) and handed to the lane owner by the
orchestrator. Brief sections refer to `research/BRIEF-2026-10-09.md`.

| Lane | Inputs (sweep files) | Brief sections |
| --- | --- | --- |
| `rsc-packet` | `research/sweeps/2026-10-09/README.md`, `research/sweeps/2026-10-09/INDEX.md` | 1, 5, 7 |
| `rsc-shared` | `research/sweeps/2026-10-09/A-retire.md` (root dependencies), `research/sweeps/2026-10-09/H1-catalog.md` (catalog and overrides), `research/sweeps/2026-10-09/E-github.md` (lane declarations) | 5 |
| `rsc-a-retire` | `research/sweeps/2026-10-09/A-retire.md`, `research/sweeps/2026-10-09/A-patches.md`, `research/sweeps/2026-10-09/A-retained-tools.md`, `research/sweeps/2026-10-09/A-knip-dispositions.md`, `research/knip-findings-2026-10-09.md` | 2.A; 4 (Removals, Retained tools, Retained patches); 7 Known detector, release, and patch facts |
| `rsc-b-standards` | `research/sweeps/2026-10-09/B-standards.md`, `research/sweeps/2026-10-09/B-detector-false-positives.md`, `research/sweeps/2026-10-09/B-inline-suppressions.md`, `research/sweeps/2026-10-09/B-skills-stale-api.md` | 2.B; 7 Canonical authorities |
| `rsc-c-scripts` | `research/sweeps/2026-10-09/C-scripts.md`, `research/sweeps/2026-10-09/C-ownership-facts.md` | 2.C; 7 Script-by-script routing checklist, Verified source index |
| `rsc-d-release` | `research/sweeps/2026-10-09/D-changesets.md` | 2.D; 7 Known detector, release, and patch facts |
| `rsc-e-github` | `research/sweeps/2026-10-09/E-github.md`; Knip ruleset fact in `research/sweeps/2026-10-09/A-retire.md` | 2.E |
| `rsc-f-agents` | private receipts `F-agent-config.md`, `F-measured-baseline.md`, `F-owned-fields-and-routes.md`, `F-junie-grok-other-clients.md`, `F-ledger-interview-link.md`; `research/panel-acceptance-2026-10-09.md` | 1 Model assignments; 2.F; 7 Agent evidence limits and operational starting points |
| `rsc-g-storage` | private receipts `G-storage.md`, `G-remote-artifact.md`, `G-harness-cache-env.md`, `G-retention-preconditions.md`; E-01 in `research/sweeps/2026-10-09/E-github.md` | 2.G; 3 Scripts, configuration, and retention |
| `rsc-h1-catalog` | `research/sweeps/2026-10-09/H1-catalog.md`, `research/sweeps/2026-10-09/H1-syncpack-held-back.md`, `research/sweeps/2026-10-09/H1-override-evidence.md` | 2.H1; 7 Four-addition starting list |
| `rsc-h2-completion` | `research/sweeps/2026-10-09/H2-goal-completion.md`, `research/sweeps/2026-10-09/H2-timeline-and-inherited-reds.md` | 2.H2; 3 Goal completion |
| `rsc-h3-telemetry` | private receipts `H3-telemetry.md`, `H3-codex-lane-trust-and-drops.md`, `H3-phoenix-read.md` | 2.H3 |
| `rsc-h4-permissions` | private receipts `H4-desktop-permissions.md`, `H4-codex-config-and-rollout.md` | 2.H4 |
| V `effect-vitest-canon` | `research/sweeps/2026-10-09/V-vitest-canon.md`, `research/sweeps/2026-10-09/V-other-worktrees-and-detector-delta.md` | 1 Existing work boundaries; 2.B item 6 |

### Sweep sequencing facts

Facts from the 2026-10-09 sweeps that change lane order or add required
work. SPEC.md "Sweep-derived constraints (2026-10-09)" states them as
constraints; the locked dispositions are unchanged.

| Fact | Sequencing consequence | Lanes | Source |
| --- | --- | --- | --- |
| `Knip` is a required status check on the `main` ruleset. | The `check.yml` Knip job and the ruleset context are removed in one change; `rsc-e-github` lands that change after the stage 2 Knip transfer and with or before `rsc-a-retire`'s Knip removal, recording prior settings first (`history/receipts/stage-3-github-settings.md`). | `rsc-e-github`, `rsc-a-retire` | `research/sweeps/2026-10-09/A-retire.md`, `research/sweeps/2026-10-09/E-github.md` |
| The `main` cache-writer Check run has waited on the `turbo-cache-write` deployment since 2026-10-06 and holds the main concurrency group (E-01, P0). | Cleared first in `rsc-e-github` (a hosted write, recorded in the settings receipt); `rsc-g-storage` cache acceptance uses the 10-06 trusted artifacts before 2026-11-05, otherwise a completed trusted writer run after E-01 clears. | `rsc-e-github`, `rsc-g-storage` | `research/sweeps/2026-10-09/E-github.md` |
| Trusted remote artifacts from Check run 37471280558 at `602e28d3ab` (2026-10-06, five candidate hashes) exist and expire around 2026-11-05 (S3 30-day lifecycle); the agent credential cannot resolve the workstation read-token reference (vault not visible to the agent account). | `rsc-g-storage` first records a Decision Log row that gives the agent a resolvable read-only token reference (never the write token), then runs the cold remote-read fixture against those artifacts before 2026-11-05; only after that date does it wait for a new trusted run once E-01 clears. | `rsc-g-storage`, `rsc-e-github` | private receipt `G-remote-artifact.md` |
| Three OSV exceptions in `osv-scanner.toml` expire on 2026-10-16. | `rsc-h1-catalog` renews or resolves them before that date so the required Security check stays green for every program PR. | `rsc-h1-catalog` | `research/sweeps/2026-10-09/H1-catalog.md` |
| Repository Impeccable is live via `.codex/hooks.json` hooks and the `.agents/skills` symlink; removal drops 4 root dependencies and the 4 repository `Models.seed` seats; the 4 home seats follow workstream F's evidence policy. | `rsc-a-retire` removes hooks, symlink target, and dependencies together through `rsc-shared`; the 4 home seats and the global Impeccable installs go to `rsc-f-agents`; the 4 repository `Models.seed.ts` Impeccable seats (lines 290-309) and the seat-count tests are removed through `rsc-shared` (model policy), and `bun run beep models check` agrees with the manifest projection afterward. | `rsc-a-retire`, `rsc-shared`, `rsc-f-agents` | `research/sweeps/2026-10-09/A-retire.md` |
| The SkillOpt scorer (`agent-effectiveness evals score`, `SkillOptTaskManifest`) is independently useful functionality, not pilot integration. | `rsc-a-retire` removes the training runner and all pilot integration (`tools/skillopt/**`, `docs/runbooks/skillopt-rerun.md`, SkillOpt `.gitignore`/`beep-effect.iml` entries, `flake.nix` comment, local `.venv` residue) and writes the compact results record. The scorer stays under brief 2.A (preserve independently useful functionality) and gets a surviving-capabilities row. | `rsc-a-retire` | `research/sweeps/2026-10-09/A-retire.md` |
| `map.html` exists only in the `beep-effect2` clone; `.serena/` is untracked in 13 clones with no unique records; SST residue is `.gitignore` 107-109, two ESLint `.sst/**` globs, and local `sst-env.d.ts` files. | Local-residue archiving covers every clone that holds residue, recorded in `history/receipts/stage-3-a-local-residue.md` before deletion. | `rsc-a-retire` | `research/sweeps/2026-10-09/A-retire.md` |
| The `effect`, `@xstate/effect`, and `drizzle-orm` patches have no focused regression test; the ONNX override and patch keys are exact-version. | `rsc-a-retire` adds one focused regression test per retained patch before the Retained patches row is claimed, and records the ONNX exact-version exit condition (a 1.30.x bump drops both silently) with `rsc-h1-catalog`; `rsc-a-retire` corrects `docs/runbooks/xstate-effect-statecharts.md` item 1 (alpha.6 patch has no import-rewrite hunk) and the `check.yml:1073` step wording (through `rsc-e-github`); moving `scripts/test-onnxruntime-installer-patch.mjs` into face-detection tests rewires `check.yml:1073-1076` and `runSecurityScan` (`Quality.command.ts`) in the same PR; each of the five focused regressions (including the existing platform-filesystem and ONNX tests) is shown to fail with its patch reverted and pass with it applied, recorded in `history/receipts/stage-5-acceptance.md#retained-patches`; the effect test constructs errors with `new` on different source lines; the drizzle test asserts `SqlError` is not `any` (tstyche, independent of `skipLibCheck`); the xstate test runs a declaration-emitting typecheck that fails with TS4023 unpatched (A-patches.md proposed plan item 2). | `rsc-a-retire`, `rsc-h1-catalog`, `rsc-e-github`, `rsc-c-scripts` | `research/sweeps/2026-10-09/A-patches.md` |
| Semgrep has no rule fixtures. | `rsc-a-retire` adds positive and negative regression fixtures for the first-party rules (brief 2.A `.semgrep/`). | `rsc-a-retire` | `research/sweeps/2026-10-09/A-retained-tools.md` |
| `_typos.toml` has 4 stale words and 3 stale excludes; CI pins typos 1.44.0, local runs 1.50.3. `beep-effect.iml` has 181 `excludeFolder` entries, 140 packet folders uncovered. | Corrected after the removals they depend on; the typos version split is reconciled with `rsc-e-github` (CI pin) through `rsc-shared`; the `turbo.json` `//#lint:typos` inputs are corrected in the same `rsc-shared` change as `_typos.toml` (including the 2 redundant excludes); the iml `.impeccable` and `.serena` entries are removed with their A removals; the `docs`/`.patterns`/`research` exclusions get a recorded reason or are dropped (surviving-capabilities row for `beep-effect.iml`); the 159 per-packet `excludeFolder` entries are replaced by whole `goals/` and `explorations/` exclusions or generated, as a recorded Decision Log choice, so that no packet folder at head is uncovered; the redundant `docs/generated` and `tools/skillopt/.venv` entries are removed (A-retained-tools.md item 4); `standards/policy-tools.fingerprint.json` is regenerated with `bun run beep lint policy-fingerprint --write` through `rsc-shared` in the same change as each edit to its inputs (`_typos.toml`, ESLint configs, `knip.jsonc` removal). | `rsc-a-retire`, `rsc-e-github`, `rsc-shared` | `research/sweeps/2026-10-09/A-retained-tools.md` |
| Reduced harness-ledger exposure means adding `harness-ledger/rows/` to `.rgignore`/`.aiignore`/`.graftignore` (never `.gitignore`), rows stay tracked; `biome.identity.jsonc` copies stale entries. | Ignore-file edits ride `rsc-a-retire`; `biome.jsonc` drops `!standards/repo-exports.catalog.jsonc`, `!specs` and the Impeccable entries first; then `biome.identity.jsonc` is regenerated with `beep cache profile --write` after the last removal. | `rsc-a-retire`, `rsc-shared` | `research/sweeps/2026-10-09/A-retained-tools.md` |
| The `effect-vitest` inventory holds 1,879 findings (741 open, 1,138 exceptions with templated reasons); the JSDoc snapshot (2026-10-05) predates PR #1552. | Lane V produces the regenerated inventory (`bun run beep lint effect-vitest --write`) and hands it to `rsc-shared`, which lands it as the serialized generated-inventory edit (brief 5) before `rsc-b-standards` reviews exceptions. The JSDoc and schema-first inventory refreshes likewise land through `rsc-shared` before any count is cited. | V, `rsc-b-standards`, `rsc-shared` | `research/sweeps/2026-10-09/B-standards.md`, `research/sweeps/2026-10-09/V-vitest-canon.md` |
| PR #1506 merged a separate head (`c921d9e11d`); the continuation lane carries 16 unpublished commits; the detector-resources lane has unstaged changes. | Lane V saves the unstaged changes as a patch, then three-way applies `git diff c921d9e11d e4c608f9c1` onto a fresh lane from `main`; no `git merge`. The continuation lane's staged diff (`git diff --cached`) and the delta are first exported as patches (read-only, no stash); the staged notes are then rewritten in the fresh lane as a post-#1506 integration record, and the continuation lane itself is left untouched until reconciled. | V | `research/sweeps/2026-10-09/V-vitest-canon.md`, `research/sweeps/2026-10-09/V-other-worktrees-and-detector-delta.md` |
| All 152 workspaces are `private: true` and return 404 on npm; GitHub Packages publication is unverified (token lacks `read:packages`); the changeset gate never reads `private`. | `rsc-d-release` lands the gate change (decoded `private`; the `changeset-graph` fail-versus-warn choice for private-package notes, recorded in the Decision Log by `rsc-d-release`) with the one-commit note retirement, after the external-contract census; `delete-package` stops emitting `{}` notes for private packages (`DeletionNotePolicy` `private-exempt` or a publish-enabled condition, plus `RegistrationGeometry.plan.ts` texts and fixtures), and the stale `@beep/ontology` entry in `standards/changesets.retired-packages.json` is resolved (D-changesets.md items 3 and 7). | `rsc-d-release` | `research/sweeps/2026-10-09/D-changesets.md` |
| Required-check declarations disagree between the live ruleset, `CI_LANE_DESCRIPTORS`, and its snapshot test. | `rsc-e-github` reconciles them through `rsc-shared` in the lane-declaration reconciliation. | `rsc-e-github`, `rsc-shared` | `research/sweeps/2026-10-09/E-github.md` |
| The completion gate matches substrings in commit subjects; the three advisory PRs' accepted heads are not ancestors of `main` (squash merges). | `rsc-h2-completion` builds receipts from GitHub observations plus a typed final-PR declaration; it never demands original-head ancestry for squash merges (brief 3), while merge and rebase workflows remain supported. | `rsc-h2-completion` | `research/sweeps/2026-10-09/H2-goal-completion.md`, `research/sweeps/2026-10-09/H2-timeline-and-inherited-reds.md` |
| The Docker gateway runs in legacy `--servers` mode, so no profile or tool allowlist applies; `beep models apply` does not exist. | `rsc-f-agents` records the `#docker-mcp` resolution and an owned-field writer design before any apply. | `rsc-f-agents` | private receipts `F-agent-config.md`, `F-owned-fields-and-routes.md` |
| Committed work in none of `main`, `e4c608f9c1`, or the #1307 head sits in other `effect-vitest-*` worktrees of `beep-effect2`: `rdf` (4 commits plus 5 WIP files, the largest unpublished canon residue outside the six lanes), `wave-d-pacer` (1 commit), `wave-d-cosmos` (1 post-merge commit); `capability-leaves`, `coverage-followup`, `inventory-proof`, and `rdf` hold uncommitted edits. | Lane V saves each (patch or branch ref) and records port, superseded with evidence, or discard with reason in `history/receipts/stage-4-vitest-reconciliation.md` before any sweep, inventory regeneration, or worktree removal touches them. | V | `research/sweeps/2026-10-09/V-other-worktrees-and-detector-delta.md` |
| The effected-port branch (clone `beep-effect`) also rewrites `scratchpad/package.json` and `bun.lock`; H1 plans to remove 8 declarations (Decision Log) from `scratchpad/package.json` (lines 52-63: 7 candidates plus the dependent `pdfjs-dist`; lines 49-51 are retained live consumers) and edits `bun.lock`. | Any lane editing either file on `main` notifies the effected-port session through the orchestrator before publishing. | `rsc-h1-catalog`, `rsc-shared` | `research/sweeps/2026-10-09/H1-catalog.md` |
| `ci-change-profile.sh` and `ci-job-env.mjs` callers run before `setup-monorepo-ci` (no bun/CLI); the Turbo-cache restore depends on the env export. | `rsc-c-scripts` ports the Ci group last, in one PR with its workflow callers, after the pre-runtime ordering (admission-job outputs vs pre-runtime shim, action step reorder) is decided and recorded in the Decision Log with `rsc-e-github`; keep the `heavy.yml` older-checkout fallback. | `rsc-c-scripts`, `rsc-e-github` | `research/sweeps/2026-10-09/C-scripts.md` |
| Root `package.json` scripts are hand-owned; `beep lint package-scripts` covers workspace members only. Adding or removing a root script changes the scripts digest of every `//#` Turbo task, so `quality:cache-policy` fails with configuration drift until a baseline review is recorded. | Each root-script add or remove is a direct edit through `rsc-shared`; the same PR records the `quality:cache-policy` baseline review (`standards/cache-qualification-baseline.json`) and drops or retargets the matching `//#` Turbo task. | `rsc-shared`, `rsc-a-retire`, `rsc-c-scripts` | `research/sweeps/2026-10-09/C-ownership-facts.md` |
| `knowledge-refs-rewrite.ts` dry-runs at head to 3 applied, 224 already-applied and exits 1 (rules #0-#2 re-apply to the portless and shadcn skills; rule #34 targets the missing, git-ignored `explorations/ATLAS.md`). Retiring `scripts/cloud-session-setup.sh` touches the active `goals/cloud-agent-readiness` verificationCommands. The installed `agent-runs.slice` was never re-synced with `scripts/systemd/`, and its effective limits come from an unowned `50-heavy-budget.conf` drop-in. | `rsc-c-scripts` repairs or records the rewrite drift before parity tests, records the cloud-agent-readiness update as a Decision Log row naming that packet's owner, and records the systemd drift with a re-sync or ownership decision in the surviving-capabilities row. | `rsc-c-scripts` | `research/sweeps/2026-10-09/C-scripts.md`, `research/sweeps/2026-10-09/C-ownership-facts.md` |

## Recovery Paths

| Recovery | Mechanism |
| --- | --- |
| Lanes | Retire with `bun run beep worktree remove <name> --archive [--delete-branch]` (archives residue) or `bun run beep yeet sweep --retire` after merge; the five unpublished `effect-vitest-canon` lanes and the staged work in `effect-vitest-canon-continuation` (see [`research/baseline-2026-10-09.md`](./research/baseline-2026-10-09.md)) are never removed, reset, or unstaged before lane V reconciles them. The other `effect-vitest-*` worktrees holding gap-19 residue (`rdf`, `wave-d-pacer`, `wave-d-cosmos`, `capability-leaves`, `coverage-followup`, `inventory-proof`) are likewise never removed, reset, or swept before lane V records their disposition. |
| Fleet hand-off | The fleet handoff is snapshotted as `HANDOFF.prev-<UTC>.md` beside `~/.cache/beep/orchestrator/HANDOFF.md` on every take-over (latest: `HANDOFF.prev-20261009T133842Z.md`). Program records never overwrite the fleet handoff: the program writes fleet `HANDOFF.md` only through the orchestrate skill (snapshot first) and never puts program state in it; program handoffs stay under `history/handoffs/`. |
| Repository changes | Each change lands in a reviewable PR; reverse with `git revert` of the PR. |
| Local residue (workstream A) | Archive before deletion, recorded in `history/receipts/stage-3-a-local-residue.md` (source, bytes, sha256, destination); restore by moving each archive back to its source path. Residue in a clone where another session is live (at take-over: `beep-effect` for the effected-port session, `beep-effect2` for the build-pipeline session and its #1558 proof) is archived and removed only after the orchestrator notifies that session and confirms no running job or lane uses the path; otherwise the row is recorded as deferred with its owner in `history/receipts/stage-3-a-local-residue.md`. |
| Release notes | `git checkout <retirement-PR merge commit>^ -- .changeset` restores every note and historical config/README, with that commit recorded in `history/receipts/stage-2-policy.md`; pair it with a revert of the reset policy PR, including the private-note graph guard. |
| Knip | `git revert <Knip removal PR merge commit>`, or `git show e62411d63f:standards/knip.regression-baseline.jsonc` and `git show e62411d63f:knip.jsonc` to restore the files; the transferred list keeps every finding. |
| Global configuration | Each owned-field apply writes a timestamped copy of every touched home file to `$HOME/.config-backups/` and records its name in the lane handoff; rollback = `cp` the backup over the file, then rerun the transform's drift check (`bun run beep models check` for model fields). |
| `.beep` storage | Dry-run report first, written to `history/receipts/stage-5-storage-cleanup.md` (bytes, owner, state, recovery destination, retention reason per row); apply moves to the recorded recovery destination and is recoverable after interruption. Restore: move each row's recovery destination back to its source path as listed in that file. |
| Baseline | `research/baseline-2026-10-09.md` records the revisions, tool versions, and lane heads to compare against. |

## Publication Mechanics

- Use the Yeet skill and commands: `bun run beep yeet repair`,
  `bun run beep yeet publish --message "..."` (cheap gates and head-install
  preflight only; opens a draft labelled `ready-for-heavy`),
  `bun run beep yeet ready` at content-final,
  `bun run beep yeet monitor --until-ready --detach` with
  `bun run beep yeet job wait <jobId>`, `bun run beep yeet reply` for review
  threads, and `bun run beep yeet merge-gate <pr> <sha>` before merge.
- Hosted CI is the authoritative proof. The 20-minute review window
  (`BEEP_YEET_REVIEW_WINDOW`) runs from the later of ready-for-review and the
  last push; threads are re-read immediately before merge.
- One push per fully addressed wave. Every in-scope actionable finding is
  fixed, including P2 and below (program review exception in SPEC.md).
- Lifecycle and reflection changes ride the final PR; completion receipts
  resolve after merge.
- Where the generated manifest `completionGate.statement` differs, this
  section (brief section 5) governs.
- Refresh installed unit snapshots only when a merged program PR changed a
  systemd unit renderer, and only with the authorized `--refresh` forms run
  from the swept clone (see the Closeout Checklist); never a fresh install.

## Staged Acceptance Checklist

Each stage's exit condition is proved by one evidence file. Paths are relative
to this packet; files are created when the stage produces them.

| Stage | Exit condition | Evidence file |
| --- | --- | --- |
| 1 Ownership and recovery | Active owners and recovery paths recorded; no unrelated state adopted or discarded. | `research/baseline-2026-10-09.md` (this stage), plus `history/receipts/stage-1-ownership.md` at stage close |
| 2 Shared decisions and retirements | Reviewed policy and known-finding transfer exist before removing the tools that expose them. | `research/knip-findings-2026-10-09.md` (all rows dispositioned) and `history/receipts/stage-2-policy.md` |
| 3 Parallel implementation | Each lane has explicit files/responsibility, dependencies, package gates, and durable handoff. Shared files remain serialized. | `history/handoffs/<lane>-<YYYY-MM-DD>.md` per lane; `history/receipts/stage-3-f-before-measurement.md` (before the first F owned-field apply); `history/receipts/stage-3-f-inventory.md` (resolved inventory per brief 2.F item 1: canonical sources, symlinks, projections, enabled and disabled items, plugin-owned content, client-native fields; its `#docker-mcp` section resolves Docker MCP gateway/profile ownership and compatibility before any Docker MCP configuration change); `history/receipts/stage-3-github-settings.md` (prior hosted settings, before each change); `history/receipts/stage-3-a-local-residue.md` (untracked local residue archived before deletion: source, bytes, sha256, destination) |
| 4 Existing test work and tooling | Existing systems reused; qualified work preserved; inventory reconciliation tied to final code. | `history/receipts/stage-4-vitest-reconciliation.md`, `history/receipts/stage-4-detectors.md`, `history/receipts/stage-4-standards-docs.md` (B artifact classification table: policy / remediation inventory / exception registry / catalog / coverage floor / generated projection / historical; stale-guidance replacements; `.patterns` review results; agent-discovery verification after consolidation, command plus result), `history/receipts/stage-4-github-audit.md` (E: one row per audit finding with area, finding, disposition — fixed with PR, or documented non-actionable with reason — and evidence; sections for the size-label correction, lane-declaration reconciliation, event/credential fixture results, trusted remote-cache writer boundary preservation, and hosted verification on program PRs), `history/receipts/stage-4-completion-receipts.md` (H2, including the three advisories), `history/receipts/stage-4-h1-catalog.md`, `history/receipts/stage-4-h3-telemetry.md` |
| 5 Operational acceptance | Acceptance table satisfied with current revision/fingerprint evidence; unsupported external conditions explicitly recorded. | `history/receipts/stage-5-acceptance.md` (one row per SPEC acceptance criterion), `history/receipts/stage-5-cache.md`, `history/receipts/stage-5-f-after-measurement.md` (the before receipt's metrics — default advertised tool count, schema/instruction size, labeled token estimates, duplicate ownership and drift, representative workflow success/activation steps/latency/failures, actual cost only from a valid provider source — at the final configuration fingerprint the panel reviewed), `history/receipts/stage-5-panel.md`, `history/receipts/surviving-capabilities.md` |
| 6 Review and closeout | Final-head hosted checks and zero actionable program findings; merged work and workstation proof reported separately. | `history/receipts/final-program-report.md` and `history/reflections/<YYYY-MM-DD>-<agent>.md` |

### Surviving capabilities register

`history/receipts/surviving-capabilities.md` (stage 5) holds one row per
surviving capability with the columns: capability, purpose, owner,
invocation, evidence, reconsideration condition (brief section 1 item 6).
`rsc-a-retire` writes the repository-tool rows (the workstream A retained
rows plus the retained scripts from workstream C); `rsc-f-agents` writes the
agent-capability rows.

## Acceptance Evidence Map

One row per SPEC.md acceptance checkbox, plus the harness-ledger row (brief 2.A, 2.F item 7), which is proved inside the stage 5 acceptance receipt. Anchors name the section of the
receipt that proves the criterion; files are created when the owning lane
produces them.

| SPEC criterion | Owning lane | Evidence file |
| --- | --- | --- |
| Removals | `rsc-a-retire` + `rsc-e-github` | `history/receipts/stage-5-acceptance.md#removals` |
| Retained tools | `rsc-a-retire` | `history/receipts/stage-5-acceptance.md#retained-tools` |
| Surviving capabilities | `rsc-a-retire` (repository tools) + `rsc-f-agents` (agent capabilities) | `history/receipts/surviving-capabilities.md` |
| Harness ledger presentation and decision links | `rsc-a-retire` (compact presentation) + `rsc-f-agents` (decision links via the supported writer) | `history/receipts/stage-5-acceptance.md#harness-ledger` |
| Detector repairs | `rsc-b-standards` | `history/receipts/stage-4-detectors.md` |
| Standards and documentation currency (brief 2.B) | `rsc-b-standards` | `history/receipts/stage-4-standards-docs.md` |
| Script ports | `rsc-c-scripts` | `history/receipts/stage-5-acceptance.md#script-ports` |
| Sensitive scripts | `rsc-c-scripts` | `history/receipts/stage-5-acceptance.md#sensitive-scripts` |
| Retained patches | `rsc-a-retire` | `history/receipts/stage-5-acceptance.md#retained-patches` |
| Release policy | `rsc-d-release` | `history/receipts/stage-2-policy.md` (`#external-contracts`, baseline, `#desktop-release` pending E-09); `history/handoffs/rsc-d-release-2026-10-09.md` (gates) |
| GitHub workflows and hosted configuration (brief 2.E) | `rsc-e-github` | `history/receipts/stage-4-github-audit.md` |
| Completion receipts | `rsc-h2-completion` | `history/receipts/stage-4-completion-receipts.md` |
| Catalog and holds (H1) | `rsc-h1-catalog` | `history/receipts/stage-4-h1-catalog.md` |
| Known advisories (H2) | `rsc-h2-completion` | `history/receipts/stage-4-completion-receipts.md#known-advisories` |
| Telemetry qualification (H3) | `rsc-h3-telemetry` | `history/receipts/stage-4-h3-telemetry.md` |
| Global configuration | `rsc-f-agents` | `history/receipts/stage-5-acceptance.md#global-configuration`, `history/receipts/stage-3-f-inventory.md`, `history/receipts/stage-3-f-before-measurement.md`, and `history/receipts/stage-5-f-after-measurement.md` |
| Storage | `rsc-g-storage` | `history/receipts/stage-5-acceptance.md#storage` and `history/receipts/stage-5-storage-cleanup.md` |
| Cache | `rsc-g-storage` | `history/receipts/stage-5-cache.md` |
| Permission continuity | `rsc-h4-permissions` | `history/receipts/stage-5-acceptance.md#permission-continuity` |
| Package gates | every lane that changes a package | each lane handoff (`history/handoffs/<lane>-<YYYY-MM-DD>.md`), summarized in `history/receipts/stage-5-acceptance.md#package-gates` |
| Knip transfer | `rsc-a-retire` | `research/knip-findings-2026-10-09.md` |
| Final program report | program orchestrator | `history/receipts/final-program-report.md` |
| Workstream F panel | `rsc-f-agents` (panel run by the orchestrator) | `history/receipts/stage-5-panel.md` |
| Closeout | program orchestrator | `history/receipts/final-program-report.md#closeout` (pre-merge state) plus the post-merge H2 completion receipt in clone evidence storage and the closing session-ledger row; `history/reflections/<YYYY-MM-DD>-<agent>.md` |
| No unrelated refactors or formatting churn | every lane (checked by its reviewer) | each lane handoff, summarized in `history/receipts/stage-5-acceptance.md#scope` |

## Closeout Checklist

Before marking the packet closed:

1. Final program report written (SPEC acceptance "Final program report");
   it lists PRs merged so far and names the final PR as pending; the final
   PR's merge result, the H2 post-merge receipt verdict, and lane retirement
   are recorded after merge in the clone-scoped completion receipt (H2
   closeout/refresh) and the closing `beep session note`, not in a repo file.
2. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
3. Run `bun run beep lint reflection-artifacts`.
4. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses; flip lifecycle with
   `bun run beep goals set-status repository-simplification-confidence completed-retained`
   in the final PR.
5. Each program PR published (`bun run beep yeet publish`), marked ready at
   content-final (`bun run beep yeet ready`), and monitored
   (`bun run beep yeet monitor --until-ready --detach` + `yeet job wait`);
   every review thread answered via `bun run beep yeet reply` and re-read
   immediately before merge; final-head hosted checks green, the
   `BEEP_YEET_REVIEW_WINDOW` review window elapsed, and zero actionable
   program findings (brief section 5, stage 6 and publication mechanics).
6. Every program PR merged at the gate
   (`bun run beep yeet merge-gate <pr> <sha>`).
7. Post-merge completion receipts resolved (brief 5: "then resolve
   post-merge receipts afterward").
8. Owned lanes retired through the supported sweep
   (`bun run beep yeet sweep --retire`); other sessions' checkouts and paused
   work preserved.
9. After a program PR that changed a systemd unit renderer merges and its
   lane is swept, run only the authorized `--refresh` forms from the swept
   clone, as applicable: `bun run beep research install-timers --refresh`,
   `bun run beep graft deep install-timer --refresh`, or
   `bun run beep refs install-timer --refresh` (AGENTS.md "Quality
   Operator"). Never run a fresh install. Record the run in the lane handoff.

## Execution Notes

- Preserve unrelated worktree changes and other sessions' work.
- Keep `SPEC.md` normative and update it only when the contract changes;
  record every implementation decision in its Decision Log.
- Record friction in [`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md)
  at the moment it happens.

## Verification Commands

```sh
test "$(wc -m < goals/repository-simplification-confidence/GOAL.md)" -le 4000
jq . goals/repository-simplification-confidence/ops/manifest.json
rg -n "repository-simplification-confidence|GOAL.md|agentLaunchers|packetAnchorDocument" goals/repository-simplification-confidence
git diff --check -- goals/repository-simplification-confidence
bun run beep goals doctor
bun run beep goals index --write
bun run beep lint reflection-artifacts
bun run beep quality package-verify <@beep/package>
```

### D lane progress (2026-10-09)

D census committed before retirement at `da1a85157d`; one-commit reset at
`ec2080bb68`, with subsequent review repairs on this branch. Run 2 resumed
after the workstation crash, merged main and the authorized inherited
knowledge repair, and completed admitted package/parity proof. PR #1566 is ready; hosted evidence
and the S11 review/merge gate remain with the orchestrator. Independent
source/scope review at `3897314253` returned zero actionable findings.
See `history/handoffs/rsc-d-release-2026-10-09.md` for current terminal results.
GitHub Packages lacks read:packages; desktop verification remains E-owned.
