# Repository Simplification and Confidence Spec

Normative contract for the `repository-simplification-confidence` program.
The approved execution brief is preserved verbatim in
[`research/BRIEF-2026-10-09.md`](./research/BRIEF-2026-10-09.md) (decision
date 2026-10-09, status approved). This spec restates its decisions as the
packet contract; where this file and the brief differ, the brief wins and this
file is corrected. Locked dispositions are reproduced from the brief, not
paraphrased.

## Objective

Leave the repository and agent environment with tools that each have a
demonstrated purpose, with actionable debt resolved, and with operational
claims backed by current evidence. Preserve relevant functionality, security
controls, public contracts, coverage floors, and recovery paths except for the
accepted reductions recorded below.

The interview is complete. Refresh facts that depend on the implementation
head; do not repeat the interview or reopen settled preferences merely because
another design is possible.

## Non-Goals

- Deciding the bundler or SchemaCompiler questions. The separately owned
  `build-pipeline-simplification` exploration keeps them; the current compiler
  arrangement is retained.
- Enabling or changing `time-to-certainty` (TTC) proof reuse, verification
  skipping, or TTC semantics. TTC proof reuse stays paused; cache verification
  and storage cleanup do not authorize it.
- A blanket 100% coverage requirement unrelated to this program. Coverage
  floors are preserved, not raised wholesale.
- A Knip parity project, or turning on Fallow's global entry-export reporting
  to recreate Knip.
- A general workstation configuration manager. Thin validation/projection glue
  only where an `ai-sync` contract or native owner is missing.
- Another telemetry backend. Telemetry qualification repairs the existing
  evidence pipeline.
- A replacement optimizer for `tools/skillopt`.
- Decisions owned by other sessions. Other active and paused work stays with
  its existing owners unless a specific integration is required and recorded;
  ownership or terminal state is never inferred from an old session row.
- Remote workstation writes to the Turbo remote cache.

## Source Hierarchy

1. The operator's approved brief:
   [`research/BRIEF-2026-10-09.md`](./research/BRIEF-2026-10-09.md).
2. `AGENTS.md`, `CLAUDE.md`, and required skills
   (`.claude/skills/orchestrate/SKILL.md`, `.claude/skills/yeet/SKILL.md`,
   `.claude/skills/closeout/SKILL.md`, the Effect and schema skills).
3. Canonical authorities named by the brief: `standards/ARCHITECTURE.md`,
   `standards/architecture/README.md`, `standards/architecture/GLOSSARY.md`,
   `standards/architecture/DECISIONS.md`, the relevant numbered files in
   `standards/architecture/` (02, 06, 07, 08, 09, 11, 12),
   `standards/memory-architecture/04-decision-log.md`,
   `.patterns/jsdoc-documentation.md`, the operational runbooks
   (`docs/runbooks/agent-pools.md`, `docs/runbooks/typescript-toolchain.md`,
   `docs/runbooks/design-system-lint.md`,
   `docs/runbooks/xstate-effect-statecharts.md`,
   `docs/runbooks/cloud-environments.md`, `docs/runbooks/systemd-timers.md`),
   and the Effect reference checkout (`.repos/effect` and the configured
   reference workspace) for installed-version API comparison.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files. Research receipts
   are evidence for the revision they record.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

Eight workstreams, A through H. The locked dispositions below are reproduced
from brief section 2. They stay locked unless a concrete external constraint
makes them impossible; such a case is recorded in the Decision Log with its
evidence, never silently.

### A. Retire unnecessary artifacts and explain retained tools

Apply complete removals across dependencies, configuration, scripts, hooks, generated wiring, CI jobs, documentation, tests that exist solely for the retired capability, and disposable local residue. Preserve compact historical provenance and independently useful functionality.

| Surface | Locked disposition | Reason and required result |
|---|---|---|
| SST | Remove residue | No active SST dependency was found. Remove obsolete ignores, exclusions, generated declarations, and inactive wiring. Preserve independently managed infrastructure. |
| `map.html` | Remove | An ignored generated Fallow visualization, approximately 4.9 MB in the inspected clone. |
| Knip | Remove completely | Accept narrower detection from current Fallow. Remove dependency, patch, config, baseline, scripts, and hosted wiring. No parity replacement project. Preserve and triage known findings first. |
| `tools/skillopt` | Retire | Remove the training runner and pilot integration. Preserve a compact results record. The latest pilot adopted no improvement beyond baseline noise. Do not build a replacement optimizer. |
| `plugins/box`, `plugins/github`, `plugins/notion` | Remove repository copies | Vendored agent plugin bundles. Preserve separately installed integrations and Beep vendor drivers and capabilities. |
| `.serena/` | Remove inactive residue | Preserve unique useful local records before removing obsolete configuration, memory/cache residue, and dead references. |
| Repository Impeccable | Remove completely | Cover Claude/GitHub skill payloads, hooks, Codex wiring, scripts, exclusions, and local residue. Global installations follow workstream F's evidence policy. |
| `.ai/mcp/mcp.json` | Remove | Inspected file is empty with no demonstrated live consumer. Preserve the live project `.mcp.json` configuration. |
| `vitest.aliases.generated.json` | Retain | Generated source-alias projection used by shared Vitest configuration and parity checks. Document generator and consumers. |
| `statelyai.json` and Stately CLI | Retain and verify | Selected visual state-machine workflow. Verify machine discovery and the supported visual workflow against current machine definitions. |
| `biome.identity.jsonc` | Retain | Generated scoped configuration consumed by cache qualification tooling. Document purpose and regeneration. |
| `_typos.toml` | Retain | Live spelling-gate vocabulary and exclusions. Correct stale entries and preserve the gate. |
| `.oxlintrc.shadcn.json` | Retain separately | Preserve strict UI scope, nested-config isolation, reviewed exceptions, and dedicated quality lane. |
| `beep-effect.iml` | Retain | WebStorm indexing exclusions have an independent purpose. Keep them accurate and avoid machine-specific leakage. |
| `tools/tsgo-shim` | Retain | Runs the intended Effect compiler artifact. Verify compiler provenance after script migration. |
| `.semgrep/` | Retain | Active deterministic security rules. Maintain positive and negative regression fixtures. |
| `harness-ledger/` | Retain with compact presentation | Append-only evidence and decision chains remain immutable. Reduce default context exposure. |
| Active dependency patches except Knip | Retain | Deliberately carried into the recent dependency update. Document each regression and keep focused tests. |

Before removing Knip, transfer its current findings into a one-time remediation list. The inspected run reproduced 41 findings: 32 exports, five files, two types, one development dependency, and one unresolved reference. Fix genuine issues and document legitimate cases before retiring the baseline. Do not turn on Fallow's global entry-export reporting to recreate Knip. The tested switch produced 1,468 findings and still did not reproduce the complete set.

Retain these patch behaviors until a changed dependency demonstrably provides them and the focused regression passes unpatched:

- Platform filesystem patch: explicit write offsets and buffer lengths.
- Effect patch: JavaScriptCore error-location properties and structural equality.
- XState/Effect patch: declaration-brand compatibility for exported machines.
- Drizzle patch: installed Effect SQL import-path compatibility.
- ONNX patch and override together: safe installer extraction and private staging before publication.

### B. Make standards and documentation current; reach honest zero debt

Audit `standards`, `.patterns`, and `docs` against current code, canonical architecture, and the appropriate Effect reference checkout.

1. Classify each artifact as policy, remediation inventory, legitimate exception registry, catalog, coverage floor, generated projection, or historical evidence.
2. Reproduce debt scanners at a recorded head and tool version. Separate live violations, disappeared findings, false positives, and legitimate boundary exceptions.
3. Fix every live actionable violation. Correct false positives in the detector with fixtures proving real violations remain detectable.
4. Review exceptions individually. Retain only specific, evidenced exceptions with an owner and reconsideration condition. Do not relabel ordinary debt as exceptions or broad exclusions.
5. Preserve useful catalogs, reference inventories, and coverage floors. Zero means zero actionable debt, not zero records in every standards file.
6. Reconcile `effect-vitest-canon` before changing its inventory or test cohorts.
7. Refresh generated snapshots through their owners and the dedicated refresh workflow. Never hand-edit totals to manufacture zero.

Keep binding architecture in `standards/ARCHITECTURE.md` and its rationale packet. Keep code laws and Effect guidance in existing canonical standards. Retain the binding JSDoc document at `.patterns/jsdoc-documentation.md` during this program because agents and tooling already reference it.

Replace stale copied guidance with current tested examples or short pointers to its authority. Verify agent discovery after consolidation. Resolve obsolete JSDoc tags, legacy error helpers, whole-repository formatting advice, and current-tense memory recommendations superseded by file-memory decisions.

Compact historical summaries and mark superseded guidance clearly. Preserve immutable research and acceptance evidence; do not rewrite history as current guidance.

### C. Move eligible scripts into Effect tooling

Move operational implementations into existing TypeScript/Effect command families. Verify current Effect APIs against the reference checkout. Keep small adapters where bootstrapping or external calling conventions require them. Regenerate task-facing package scripts through their owner command.

| Group | Destination and boundary |
|---|---|
| Reference provisioning | Existing Refs commands; preserve manifest semantics and existing-checkout immutability. |
| CI diff classification, environment policy, resource sampling | Existing Ci ownership; update workflow callers together and preserve outputs, exit status, credential boundaries, and event semantics. |
| Turbo remote-read setup | Existing Cache commands; edit secret references without resolving or printing secrets. |
| Git regeneration-driver installation | Existing Worktree/Yeet preparation; preserve local-only Git configuration. |
| Knowledge reference rewriting | Existing Knowledge commands; preserve dry-run, exact counts, idempotence, and drift refusal. |
| Yeet/Grok inbox adapter | Existing Yeet inbox ownership; remove dead wrappers after migrating live callers. |
| 1Password layout transformation | Typed tested administrative tooling; preserve field/reference identity and the existing apply boundary. Test with synthetic fixtures. |
| Compiler backup pruning | Lightweight install-safe tooling through a thin adapter; do not require a fully installed or built CLI during `prepare`. |
| ONNX installer regression script | Owning package tests; retain the security regression while the patch remains. |

Retain `scripts/cloud/bootstrap.sh` for pre-toolchain acquisition, the minimal pre-runtime apt-source adapter, the small fail-closed Git merge-driver adapter, Changesets' required CJS callback while dormant publication tooling retains that contract, and declarative JSON/systemd files.

Retire `scripts/cloud-session-setup.sh`, whose implementation is superseded. Update operational callers and guidance; historical references may remain marked as history. The root `scripts` directory is not banned. Its remaining executable files must be justified bootstrap exceptions or adapters. See the complete 21-entry routing checklist in section 7.

#### Script-by-script routing checklist (brief section 7)

| Existing path | Execution disposition |
|---|---|
| `scripts/changeset-changelog.cjs` | Retain required small CJS publication callback while dormant machinery needs it. |
| `scripts/ci-change-profile.sh` | Port operational diff classification to Ci; preserve workflow evaluation and output contract. |
| `scripts/ci-job-env.mjs` | Port to Ci after runtime exists; preserve credential/event policy and safe `GITHUB_ENV` behavior. |
| `scripts/ci-prune-apt-sources.sh` | Retain minimal pre-runtime adapter; test with synthetic filesystem fixtures. |
| `scripts/ci-runner-resources.sh` | Port to Ci; preserve resource sampling, signal propagation, and nonzero exit status. |
| `scripts/cloud-session-setup.sh` | Retire superseded implementation and live wiring. |
| `scripts/cloud/bootstrap.sh` | Retain pre-toolchain bootstrap; delegate post-runtime behavior where appropriate. |
| `scripts/enable-turbo-remote-reads.sh` | Port to Cache; preserve dotenv references, duplicate handling, and idempotence. |
| `scripts/knowledge-refs-rewrite.rules.json` | Retain reviewed declarative rule data and reproducible semantics. |
| `scripts/knowledge-refs-rewrite.ts` | Move into Knowledge ownership; exact-count dry-run, idempotence, drift refusal. |
| `scripts/onepassword/beep-secrets-layout.jq` | Port transform to typed tooling with synthetic field/reference fixtures. |
| `scripts/onepassword/beep-secrets-layout.sh` | Move administrative behavior to existing ownership; preserve its existing apply boundary and sanitized output. |
| `scripts/prune-tsgo-backups.mjs` | Keep lightweight install-safe entry; preserve intentional `.original` and remove only unwanted rotations. |
| `scripts/references.json` | Retain declarative manifest under existing Refs ownership. |
| `scripts/regenerate-merge-driver.sh` | Retain small fail-closed adapter for incomplete Git merge trees. |
| `scripts/setup-effect-ref.sh` | Port provisioning to Refs; preserve existing reference checkouts. |
| `scripts/setup-regenerate-merge-driver.sh` | Port local Git installation to Worktree/Yeet preparation. |
| `scripts/systemd/agent-runs.slice` | Retain declarative unit source. |
| `scripts/systemd/agent-runs.slice.d/50-oomd.conf` | Retain declarative drop-in source. |
| `scripts/test-onnxruntime-installer-patch.mjs` | Move security regression to the owning package's tests. |
| `scripts/yeet-inbox-grok-tail.sh` | Move any live functionality to Yeet inbox ownership; remove dead adapter. |

`scripts/graft/` exists at `e62411d63f` but is not in the brief's checklist;
workstream C classifies it under the same rule (justified bootstrap exception
or adapter, or move into a command family) and records the result in the
Decision Log.

### D. Reset private release-note accumulation

The inspected repository declares 152 private workspaces, has no npm/Changesets release workflow, and carries hundreds of pending release notes.

- Retire pending changesets for private internal packages. Record one concise pre-release baseline with recovery provenance.
- Preserve current package versions.
- Update quality checks and policy so private-only internal changes no longer accumulate required release notes.
- Keep publication machinery dormant for future publish-enabled packages. Activation must deliberately establish release/versioning policy and restore appropriate changeset requirements.
- Preserve obligations for demonstrated published or externally consumed contracts. This cleanup does not authorize breaking those contracts.
- Keep desktop release/versioning behavior separate.

### E. Audit and repair GitHub workflows and hosted configuration

Adversarially review `.github` and relevant hosted settings. Implement all actionable in-scope findings.

Cover required checks, rulesets, permissions, fork handling, runner trust, secret/environment access, concurrency and cancellation, heavy admission, cache read/write boundaries, artifact retention, release environments, and obsolete workflows.

- Remove retired-tool jobs and references.
- Correct known candidates such as accumulating contradictory PR size labels.
- Reconcile generated task/lane declarations with actual workflows.
- Preserve the trusted remote-cache writer boundary.
- Test event and credential combinations with fixtures, then verify hosted behavior on program PRs.
- Attribute inherited failures and land shared repairs once; dependent lanes integrate the shared repair rather than duplicate it.

### F. Reduce agent context and configuration duplication

Cover repository and global skills, MCP servers, plugins, hooks, instructions, configuration, and installed integrations for Codex, Claude, Cursor, Junie, Grok, and other discovered relevant clients. The target is a small default context with specialist capabilities available through clear tested on-demand workflows.

1. Build a resolved inventory separating canonical sources, symlinks, projections, enabled items, disabled items, plugin-owned content, and client-native fields.
2. Reuse native owners and existing `ai-sync` contracts. Add thin validation/projection glue only where missing. Do not build a general workstation configuration manager.
3. Preserve unowned and unknown native fields when applying changes. Use owned-field transformations with backup, drift detection, validation, and rollback.
4. Remove confirmed duplicates and reduce unnecessary default loading immediately.
5. Permanently remove capabilities only when the agreed workflow inventory excludes them or reliable usage evidence supports retirement. Missing telemetry never proves non-use.
6. For zero-use decisions, require a complete window of 30 qualifying sessions per affected harness under its current configuration fingerprint. If incomplete, retain the capability on demand and record the limitation. Do not manufacture observations or block unrelated work waiting for the window.
7. Keep the harness ledger append-only and use its supported writer. Link the approved interview decisions to execution records.

All relevant authorized evidence may be used, including detailed local agent history and Phoenix data on dankserver. Keep credentials out of output. Publish only necessary sanitized findings to repository records or the Notion brief.

Measure before and after:

- Default advertised tool count and schema/instruction size.
- Clearly labeled token estimates or measured token usage where available.
- Duplicate ownership and configuration drift.
- Representative workflow success, activation steps, latency, and failures.
- Actual cost only when a valid provider/account source supplies it.

Docker MCP uses small explicit profiles and tool allowlists first. Resolve the installed gateway/profile ownership and compatibility discrepancy before changing configuration. Dynamic discovery is allowed only after bounded compatibility and workflow validation. Experimental code mode is excluded. Preserve per-client behavior when clients share an HTTP gateway. Follow Docker's [profiles](https://docs.docker.com/ai/mcp-catalog-and-toolkit/profiles/) and [dynamic MCP](https://docs.docker.com/ai/mcp-catalog-and-toolkit/dynamic-mcp/) contracts.

Run the named independent three-model panel against final configuration, representative workflows, and evidence. Require terminal zero-actionable-findings verdicts on the final reviewed revision and configuration fingerprints. A reviewer verdict for an earlier configuration does not close the final configuration.

### G. Rationalize `.beep` storage and prove cache behavior

Apply selective sharing and retention. Do not replace `.beep` with a blanket shared symlink.

| Data class | Treatment |
|---|---|
| Turbo computation cache | Preserve existing shared location and prove effective use. |
| Clone proof ledger | Preserve clone identity and linked-worktree sharing. |
| Generated package outputs and scanner reports | Keep consumer/restoration paths; reclaim obsolete outputs by ownership and regeneration rules. |
| Active jobs, locks, drafts, inbox acknowledgements, QA handles | Preserve checkout/session/PR/run isolation and active ownership. |
| Completed QA and qualification runs | Keep required durable proof; reclaim redundant derivatives and completed temporary environments. |
| Research/corpus/runtime material | Classify with the owner. Location under `.beep` does not establish disposability. |
| Vitest module cache | Keep checkout-scoped unless a separately proven implementation supports sharing. |

Provide a dry-run cleanup report with bytes, owner, state, recovery destination, and retention reason. Skip active or paused work, unverified terminal state, held locks, and unresolved drafts. Apply must respect the same ownership and liveness decisions and remain recoverable after interruption.

The preflight census found approximately 6.7 GiB across known `.beep` locations, concentrated in qualification, research, QA, and history directories. Prioritize measured sources of waste and refresh the census before cleanup.

For Turbo:

1. Verify effective local cache paths and read-only remote posture across the clone/worktree inventory.
2. Run a cold remote-read fixture using an isolated empty local cache and an existing trusted remote artifact.
3. Run a warm local reuse fixture.
4. Run the same task with identical relevant inputs in two clones and a linked worktree. Record task hashes, hit sources, restored outputs, and attribution for misses.
5. Verify changed inputs invalidate reuse.
6. Repair configuration/input problems while preserving explicit overrides and CI-owned paths.

Existing summaries established local hits, not remote or cross-clone success. Report each claim separately. Do not enable TTC proof reuse or remote workstation writes.

### H. Implement the four approved additional debt items

#### H1. Dependency catalog and compatibility holds

Remove unused catalog reservations after checking manifest, override, generator, and scaffolder consumers. The initial census identified 16 candidates, listed in section 7. For retained overrides and holds, record consumer, failure evidence, owner, and exit condition. When an exit condition is met, run compatibility proof and remove or explicitly renew the hold.

Catalog candidates requiring consumer verification (brief section 7):
`@google-cloud/pubsub`, `@google-cloud/storage`, `@zip.js/zip.js`,
`@xenova/transformers`, `ajv`, `exifreader`, `file-type`, `gl-bench`,
`gray-matter`, `mdast-util-find-and-replace`, `mediabunny`, `music-metadata`,
`officeparser`, `rehype-stringify`, `remark-gfm`, and `typedoc`.

#### H2. Structured goal completion evidence

Replace commit-title heuristics as the primary completion check. Reuse goal manifests, GitHub observations, Yeet acceptance receipts, and clone evidence storage. Reconcile the three known doctor advisories individually. Do not reset unrelated lifecycle state.

Known advisories (brief section 7; reproduced by `bun run beep goals doctor`
on 2026-10-09): `document-ast-pattern-classification` (merged PR #1429 without
a packet-name commit title), `practice-box-onboarding` (manifest PR #1462),
and `push-first-publish` (free-text final provenance).

#### H3. Telemetry qualification

Repair missing attribution and stamping for supported clients through the existing evidence pipeline. Distinguish disabled collection, dropped events, unsupported clients, mixed fingerprints, and genuinely unused capabilities. Validate current-configuration events and counters through representative workflows. Do not create another telemetry backend.

#### H4. Desktop permission continuity

Use disposable fixtures to verify effective sandbox and approval state across fresh launch, dormant continuation, background continuation, and native subagent follow-up. Inspect effective execution policy rather than composer appearance.

If a route downgrades permissions, stop that fixture's execution, retain the safe alternative, and repair available integration/configuration controls. If the defect is upstream and cannot be repaired locally, keep the route explicitly unsupported with a reproducer and documented verified safe path. Do not experiment on another session's live work.

## Constraints

### Operating contract

Reproduced from brief section 1.

1. Establish the implementation checkout, current `main`, dirty state, active sessions, jobs, and ownership before changing anything. Preserve unrelated work and create isolated implementation worktrees through the repository workflow.
2. Create a coordinating goal packet named `repository-simplification-confidence` through the supported goal workflow. Record this brief, dated decisions, workstream owners, dependencies, acceptance evidence, and recovery paths. Load applicable skills before edits.
3. Read `bun run beep session open` and coordinate with the existing fleet orchestrator. Do not claim a second fleet-wide role or overwrite its handoff. Keep this program's work and handoffs durable on disk.
4. Use existing architecture, schemas, command families, and quality workflows. Follow the Graft discovery route and search live source and barrels for reuse before creating helpers, schemas, utilities, or services.
5. Treat the evidence appendix as a researched starting point. Record baseline revisions and tool versions, then refresh head-dependent facts before editing. Evidence from another clone is evidence for its recorded revision.
6. Every surviving capability needs a current use or an explicitly selected future workflow. Record purpose, owner, invocation, evidence, and the condition for reconsidering it.
7. Resolve every actionable finding within the program's scope, including lower-severity findings. This program explicitly overrides the normal two-round review limit. Do not defer an in-scope actionable finding merely to stop a review loop.
8. Continue through implementation, hosted verification, review closure, merge, lane retirement, and reflection. Record genuine external blockers without claiming completion. Purchases, new paid endpoints, quota top-ups, and plan changes remain escalation points.
9. Follow the current privilege and secret routes. Resolve `op` from `PATH`, never print raw credentials or use `--reveal`, and use synthetic data for sensitive script tests. Keep raw private evidence out of public repository records and this brief.
10. Record implementation decisions and reversible recovery procedures in the goal packet. Use the existing friction ledger at the point of friction. Preserve immutable research and acceptance evidence under their existing contracts.

### Model assignments

Reproduced verbatim from brief section 1.

| Role | Model | Effort |
|---|---|---|
| Program orchestrator | `claude-fable-5-1` | Medium |
| Ordinary Codex implementation, exploration, and review | `gpt-6.1-sol` | Medium |
| Ordinary Claude workers | `claude-opus-5-5` | Medium |
| Independent agent-ecosystem reviewer | `gpt-6-astra` | Xhigh |
| Independent agent-ecosystem reviewer | `claude-fable-5-1` | Xhigh |
| Independent agent-ecosystem reviewer | `grok-4.7` | Xhigh |

The three-model panel applies to workstream F, the agent ecosystem, rather than every workstream. Its Fable reviewer must be independent of the orchestrator. Use exact IDs and capture actual model and effort launch evidence. Validate account/model acceptance before substantive reviewer runs; generic CLI help is insufficient. Do not silently substitute a panel member or lower its effort. Ordinary workers retain the approved fallback policy and its quota/availability conditions.

Restore ordinary global Codex and Claude defaults to the approved models above. Preserve separately configured lightweight and research routes. Preserve Junie's `gemini-3-flash-preview` and Auto subagents, document their ownership, and verify their behavior without inventing a fallback chain.

Packet note (not brief text): panel acceptance probed 2026-10-09, see
[`research/panel-acceptance-2026-10-09.md`](./research/panel-acceptance-2026-10-09.md).
All three members were accepted. `gpt-6-astra` effort is evidenced by its
rollout; for `claude-fable-5-1` and `grok-4.7` the harness accepts but does
not echo effort, so effort evidence is the exact recorded launch argv
(`--settings {"effortLevel":"xhigh"}` / `--effort xhigh`). The probes
establish acceptance, not verdicts.

### Existing work boundaries

Reproduced from brief section 1.

- Resume and integrate `effect-vitest-canon`. This is explicitly authorized. Preserve and reconcile its five unpublished lanes and staged work before continuing. Reuse qualified implementation and evidence rather than replaying completed migrations.
- Keep `time-to-certainty` proof reuse paused. Cache verification and storage cleanup do not authorize verification skipping or changes to TTC semantics.
- Preserve the separately owned `build-pipeline-simplification` exploration. Retain the current compiler arrangement; this program does not decide its bundler or SchemaCompiler questions.
- Other active and paused work remains owned by its existing sessions unless a specific integration is required and recorded. Do not infer ownership or terminal state from an old session row.

### Program rules

- Shared files are serialized through one owner, the program orchestrator:
  root `package.json`, `bun.lock`, the models manifest, `AGENTS.md` (the
  `CLAUDE.md` symlink follows it), shared policy files, generated
  inventories, and `turbo.json` task declarations. Workers
  preserve each other's edits and report durable handoff files.
- Any lane that edits `standards/effect-laws.allowlist.jsonc` or the
  generated
  `packages/tooling/policy-pack/repo-configs/src/internal/eslint/generated/EffectLawsAllowlistSnapshot.ts`
  on `main` notifies the effected-port session (through the orchestrator)
  before publishing, so that session can merge `main` and regenerate. Its
  branch rewrites both files (cross-session constraint recorded at take-over,
  2026-10-09T13:55Z). The same rule covers `scratchpad/package.json` and
  `bun.lock`: any lane editing them on `main` notifies the effected-port
  session through the orchestrator before publishing, because that branch
  also rewrites both files.
- The build-pipeline session owns `explorations/build-pipeline-simplification/`
  and its PR #1558; that boundary is the whole of its overlap with this
  program. No program lane edits that exploration, and the build-pipeline
  session makes no program edits. The compiler arrangement stays as it is
  (Existing work boundaries).
- Residue in a clone where another session is live (at take-over:
  `beep-effect` for the effected-port session, `beep-effect2` for the
  build-pipeline session and its #1558 proof) is archived and removed only
  after the orchestrator notifies that session and confirms no running job
  or lane uses the path; otherwise the row is recorded as deferred with its
  owner in `history/receipts/stage-3-a-local-residue.md`.
- Repository-relative paths in every packet record; `~` or `$HOME` for a
  home-relative path wherever a home file must be named (never an absolute
  home-directory path); never a secret, token, client name, tenant id, or mailbox
  address. This repository is public.
- Use the existing friction ledger
  ([`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md)) at the point
  of friction.

### Sweep-derived constraints (2026-10-09)

Read-only sweeps at `e62411d63f` refreshed the head-dependent facts (operating
contract item 5). The repository-facing sweeps are under
[`research/sweeps/2026-10-09/`](./research/sweeps/2026-10-09/README.md).
These facts constrain sequencing and evidence; they change no locked
disposition above. PLAN.md "Sweep sequencing facts" turns them into lane order.

- Knip is a required status check (`Knip`) on the `main` ruleset. The
  `check.yml` Knip job and the ruleset context are removed in the same change
  (workstream E, with or before workstream A's Knip removal); otherwise every
  PR blocks.
- Repository Impeccable is live through `.codex/hooks.json` (PostToolUse and
  Stop) and the `.agents/skills` symlink. Its removal also drops four root
  dependencies (`css-select`, `css-tree`, `domutils`, `htmlparser2`) and the
  four repository `Models.seed` seats (`repo.skills.impeccable.*`); the four
  home seats (`home.agents.impeccable.*`) are decided by workstream F under
  its evidence policy (brief 2.A; 2.F items 5-6).
- SkillOpt: the locked removal of the training runner and pilot integration
  is unchanged (`tools/skillopt/**`, `docs/runbooks/skillopt-rerun.md`, the
  SkillOpt `.gitignore` and `beep-effect.iml` entries, the `flake.nix`
  comment, and local `.venv` residue), and the compact results record is
  written. The `agent-effectiveness evals score` scorer
  (`SkillOptTaskManifest`) is not part of the pilot integration. It stays
  under brief 2.A "preserve ... independently useful functionality" and gets
  a surviving-capabilities row. This is not a new tool.
- `map.html` exists only in the `beep-effect2` clone (ignored, regenerated by
  Fallow). `.serena/` is untracked in 13 clones with no unique records. SST
  residue is `.gitignore` lines 107-109, two ESLint `.sst/**` globs, and local
  `sst-env.d.ts` files.
- Retained patches: the `effect`, `@xstate/effect`, and `drizzle-orm`
  patches have no focused regression test. The Retained patches criterion
  needs one per retained patch, so workstream A adds them. The ONNX override
  and patch keys pin `onnxruntime-node@1.30.0` exactly; a 1.30.x bump would
  silently drop both, so the hold record names that exit condition. Each of
  the five focused regressions (including the existing platform-filesystem
  and ONNX tests) is shown to fail with its patch reverted and pass with it
  applied, recorded in
  `history/receipts/stage-5-acceptance.md#retained-patches`; the effect test
  constructs errors with `new` on different source lines; the drizzle test
  asserts `SqlError` is not `any` (tstyche, independent of `skipLibCheck`);
  the xstate test runs a declaration-emitting typecheck that fails with
  TS4023 unpatched (A-patches.md proposed plan item 2).
- Semgrep has no rule fixtures. Workstream A adds positive and negative
  regression fixtures for the first-party rules (brief 2.A, `.semgrep/`).
- `_typos.toml` carries 4 unused words and 3 excludes for removed paths, and
  CI pins typos 1.44.0 while 1.50.3 runs locally; the correction reconciles
  the version split. `beep-effect.iml` has 181 `excludeFolder` entries, and
  140 packet folders at head are not covered. Reduced harness-ledger exposure
  means adding `harness-ledger/rows/` to the context-ignore files
  (`.rgignore`, `.aiignore`, `.graftignore`; never `.gitignore`), leaving
  rows tracked and untouched. `biome.identity.jsonc`
  is regenerated (`beep cache profile --write`) after the removals.
  `standards/policy-tools.fingerprint.json` is regenerated with
  `bun run beep lint policy-fingerprint --write` through `rsc-shared` in the
  same change as each edit to its inputs (`_typos.toml`, ESLint configs,
  `knip.jsonc` removal).
- The `effect-vitest` inventory holds 1,879 findings (741 open, 1,138
  exceptions with templated reasons) and is regenerated with
  `bun run beep lint effect-vitest --write`, never merged. The JSDoc
  inventory snapshot (2026-10-05) predates PR #1552 and is refreshed before
  any count is cited.
- Lane V transfers the `effect-vitest-canon-continuation` delta by a
  three-way apply of `git diff c921d9e11d e4c608f9c1` onto a fresh lane from
  `main`, never by `git merge`. The detector-resources lane's unstaged changes
  are saved as a patch first. The continuation lane's staged diff is
  exported as a patch before its notes are rewritten in the fresh lane.
- Lane V also covers the gap-19 residue in other `effect-vitest-*` worktrees
  of `beep-effect2` (`rdf`, `wave-d-pacer`, `wave-d-cosmos` commits;
  uncommitted edits in `capability-leaves`, `coverage-followup`,
  `inventory-proof`, `rdf`): each is saved and dispositioned (port,
  superseded with evidence, or discard with reason) in
  `history/receipts/stage-4-vitest-reconciliation.md` before those worktrees
  are removed, reset, or swept.
- Workstream D: all 152 workspaces are `private: true` and return 404 on
  npm; GitHub Packages publication is unverified (token lacks
  `read:packages`),
  and stock changesets tooling already skips private packages. The gate
  change (decode `private` in `ChangesetStatus`; the `changeset-graph`
  fail-versus-warn choice for private-package notes, recorded in the
  Decision Log by `rsc-d-release`) lands with the one-commit note retirement
  and its recorded parent SHA and tree oid. `delete-package` stops emitting `{}` notes for private packages (`DeletionNotePolicy` `private-exempt` or a publish-enabled condition, plus `RegistrationGeometry.plan.ts` texts and fixtures), and the stale `@beep/ontology` entry in `standards/changesets.retired-packages.json` is resolved (D-changesets.md items 3 and 7).
- Root `package.json` scripts are hand-owned (`package-scripts` covers
  workspace members only). Each root-script add or remove is a direct edit
  through `rsc-shared`, and the same PR records the `quality:cache-policy`
  baseline review (`standards/cache-qualification-baseline.json`) and drops
  or retargets the matching `//#` Turbo task.
- Workstream E: the `main` cache-writer run has waited on the
  `turbo-cache-write` deployment since 2026-10-06 and holds the main Check
  concurrency group. Clearing it is a hosted write and precedes cache
  acceptance only when the 10-06 artifacts are unusable (workstream G):
  trusted remote artifacts from Check run 37471280558 at `602e28d3ab`
  (2026-10-06) expire around 2026-11-05 (S3 30-day lifecycle), and the
  agent cannot yet resolve the workstation read-token reference, so
  `rsc-g-storage` first records a Decision Log row giving the agent a
  resolvable read-only token reference (never the write token), per private
  receipt `G-remote-artifact.md`. Required-check declarations disagree
  between the live ruleset, `CI_LANE_DESCRIPTORS`, and the snapshot test.
  E-02/E-03: the writer boundary is currently advisory (repository-level
  `TURBO_TOKEN`; `property-laws-nightly.yml` and `data-sync.yml` read it
  outside the environment and bypass `ci-job-env.mjs`). `rsc-e-github`
  establishes the boundary (environment-only secret plus the E-02
  workflow-lint fixture) before `rsc-g-storage` claims read-only remote
  posture.
- H1: the sweep found 6 candidates with no consumer and 7 declared only in
  `scratchpad/package.json` and never imported (13 removal candidates, plus
  the dependent `pdfjs-dist` catalog line and override). The 3 imported by
  `scratchpad/effect-ontology` are retained with consumer, owner, and
  reconsideration condition recorded. `rsc-h1-catalog` confirms each consumer
  check before removal. Three OSV
  exceptions in `osv-scanner.toml` expire on 2026-10-16; after that the
  required Security check goes red unless they are renewed or resolved first.
- Inline directives are exceptions too: 407 at `e62411d63f`
  (B-inline-suppressions.md). `rsc-b-standards` reviews each one
  individually: it fixes or removes the 3 unjustified and the inert `cspell:`
  directives, converts the debt-labelled fallow-ignore reasons into fixes or
  evidenced exceptions with an owner and reconsideration condition, reviews
  the 25 `PosInt.ts` `code-duplication` suppressions individually: the
  duplication is fixed (for example, a shared home for `PosInt`), or each
  copy that must stay keeps a specific, evidenced exception with owner and
  reconsideration condition (brief 2.B items 3-4); a single blanket record is
  not used; and it re-records the stale fallow dead-code baseline through
  its owner; the totals are reported in the
  final program report.
- H2: the completion gate's substring match over commit subjects gives false
  positives and misses commit bodies; the three advisory PRs were squash
  merges whose accepted heads are not ancestors of `main`, so the receipt
  comes from GitHub observations plus a typed final-PR declaration, never
  from original-head ancestry for squash merges (merge and rebase workflows
  remain supported).

## Interface Requirements

Reproduced from brief section 3.

### Goal completion

- Extend existing goal schemas with typed final/supporting PR references and acceptance-evidence references. Preserve legacy manifest fields and valid grandfathered behavior.
- Add a derived post-merge receipt binding repository, packet, declaration digest, final PR, accepted head, merge result, and verification time.
- Resolve the merge result after merge. A PR cannot contain its own future merge OID.
- Bind acceptance evidence to the actual accepted head. Support squash, merge, and rebase workflows without incorrectly demanding original-head ancestry for squash merges.
- Keep doctor read-only by default, with `verified`, `unsatisfied`, and `unknown` outcomes. Network failures and rate-limited lookups are unknown.
- Write resolved evidence only through explicit closeout/refresh behavior. Reuse clone-scoped evidence ownership; preserve ProofLedger and TTC semantics.

### Scripts, configuration, and retention

- Add script functionality to existing command families and generate manifest scripts with `bun run beep lint package-scripts --write`.
- Use owned-field configuration transformations with backups, drift checks, validation, and rollback. Preserve native fields outside ownership.
- Give retention operations a dry-run representation and explicit apply behavior respecting owner identity and liveness.

## Acceptance Criteria

The twelve area rows (Removals ... Permission continuity) are reproduced
from the brief section 4 table. The other rows derive from the brief section
named in each row. Each box is checked only with a durable
receipt that names the revision or configuration fingerprint, the command or
workflow, the result, and the timestamp. The PLAN.md "Acceptance Evidence
Map" maps each to its owning lane and evidence file.

- [ ] **Removals** — No live consumer, hook, task, export, install, or CI reference remains. Intentional historical references are clearly historical.
- [ ] **Retained tools** — Working aliases, Stately discovery and visual flow, compiler provenance, editor exclusions, scoped lint, spelling, and Semgrep behavior.
- [ ] **Detector repairs** — Paired false-positive and true-positive fixtures; fresh zero-actionable scan and individually reviewed exceptions.
- [ ] **Standards and documentation currency** (brief 2.B, 7) — every
  `standards`, `.patterns`, and `docs` artifact classified; stale copied
  guidance replaced with tested examples or pointers; obsolete JSDoc tags,
  legacy error helpers, whole-repository formatting advice, and superseded
  memory recommendations resolved; historical summaries compacted and
  superseded guidance marked; other `.patterns` files reviewed against
  reference source; agent discovery verified after consolidation;
  agent-loaded skills and agent definitions checked against the installed
  Effect exports (`history/receipts/stage-4-standards-docs.md`).
- [ ] **Script ports** — Argument/output/exit parity, idempotence, dry-run behavior, pre-runtime operation, signal/failure handling, and updated callers.
- [ ] **Sensitive scripts** — Synthetic fixtures establish secret-reference preservation, field identity, event/credential policy, and absence of unintended host changes.
- [ ] **Retained patches** — Filesystem writes, error equality, exported-machine declaration emit, SQL declaration compatibility, and extraction/security regressions.
- [ ] **Surviving capabilities** (brief 1.6) — every retained tool and agent capability has purpose, owner, invocation, evidence, and reconsideration condition recorded (`history/receipts/surviving-capabilities.md`).
- [ ] **Release policy** — Private-only changes avoid obsolete requirements; future publish-enabled paths remain valid; versions and desktop releases behave as intended.
- [ ] **GitHub workflows and hosted configuration** (brief 2.E) — every
  audit finding across the covered areas carries a disposition (fixed with a
  PR, or documented non-actionable with reason) and evidence; PR size labels
  corrected; task/lane declarations reconciled with workflows; event and
  credential fixtures pass; trusted remote-cache writer boundary enforced (E-02/E-03 repaired) and preserved;
  hosted behavior verified on program PRs
  (`history/receipts/stage-4-github-audit.md`).
- [ ] **Completion receipts** — Merged PR without packet name succeeds; unmerged final PR fails; stale-head receipt fails; network failure is unknown; legacy/grandfathered behavior survives.
- [ ] **Catalog and holds (H1)** (brief 2.H1) — each of the 16 candidates is removed or retained with its manifest/override/generator/scaffolder consumer check, and each retained override or hold records consumer, failure evidence, owner, and exit condition; for every hold whose exit condition is met, a compatibility proof is run and the hold is removed or explicitly renewed, with the proof cited in `history/receipts/stage-4-h1-catalog.md`.
- [ ] **Known advisories (H2)** (brief 2.H2, 7) — `document-ast-pattern-classification`, `practice-box-onboarding`, and `push-first-publish` are each reconciled against actual GitHub and acceptance evidence, with no unrelated lifecycle reset.
- [ ] **Telemetry qualification (H3)** (brief 2.H3) — current-configuration events and counters are validated through representative workflows, and disabled, dropped, unsupported, mixed-fingerprint, and unused cases are distinguished per client.
- [ ] **Global configuration** — Native fields survive projection; rollback restores settings; defaults and on-demand workflows work across supported harnesses.
- [ ] **Storage** — Active state retained, stale locks handled safely, interrupted cleanup recoverable, evidence preserved, reclaimed bytes attributable.
- [ ] **Cache** — Explicit remote hit, local hit, cross-checkout reuse, restored outputs, and changed-input miss with recorded hashes.
- [ ] **Permission continuity** — Effective policy preserved or affected route explicitly blocked with a verified safe alternative.
- [ ] **Package gates** (brief 4 prose) — each changed package passes
  `bun run beep quality package-verify <@beep/package>` and the relevant
  architecture, schema, documentation, coverage, and hosted gates (`--quick`
  only when the touched surface justifies that subset); coverage floors are
  preserved.
- [ ] **Knip transfer** (brief 2.A, stage 2) — every row of
  [`research/knip-findings-2026-10-09.md`](./research/knip-findings-2026-10-09.md)
  carries a non-`pending` disposition with evidence before Knip is removed.
- [ ] **Final program report** (brief section 6) — a disposition and evidence
  reference for every original draft item and all four additions; fresh
  actionable debt totals, reviewed exception totals, preserved
  coverage/catalog status; removed artifacts, retired dependencies, migrated
  scripts, documented surviving capabilities; measured context, configuration,
  and storage changes without unsupported savings claims (context and
  configuration claims cite the before/after pair
  `history/receipts/stage-3-f-before-measurement.md` and
  `history/receipts/stage-5-f-after-measurement.md`); separate proof of
  local cache reuse, remote reads, and cross-clone/worktree reuse; exact
  reviewed revisions/configuration fingerprints and final reviewer verdicts;
  merged PRs, workstation verification receipts, recovery locations, and
  genuinely blocked external acceptance items.
- [ ] **Workstream F panel** (brief 2.F, model assignments) — for each of
  `gpt-6-astra` xhigh, `claude-fable-5-1` xhigh (a session distinct from the
  orchestrator), and `grok-4.7` xhigh: a pre-run account/model acceptance
  probe (not CLI help), captured launch evidence of the actual model ID and
  effort, no substitution or effort reduction, a review run against the final
  configuration, representative workflows, and evidence, and a terminal
  zero-actionable-findings verdict on the final reviewed revision and
  configuration fingerprints (`history/receipts/stage-5-panel.md`); where
  the harness does not echo effort, `history/receipts/stage-5-panel.md`
  records the exact launch argv per run and notes the limitation.
- [ ] **Closeout** (brief 5, publication mechanics) — final-head hosted
  checks green, review threads answered and re-read immediately before merge,
  the configured review window (`BEEP_YEET_REVIEW_WINDOW`) elapsed, zero
  actionable program findings, every program PR merged at the gate, lanes
  retired, reflection landed, post-merge completion receipts resolved.
  Pre-merge items are recorded in the final PR
  (`history/receipts/final-program-report.md#closeout`); the final merge,
  lane retirement, and receipt resolution are proved by the post-merge H2
  completion receipt in clone evidence storage and the closing session-ledger
  row.
- [ ] No unrelated refactors or formatting churn (AGENTS.md Code Laws: keep
  changes focused).

Each changed package must pass the required `bun run beep quality package-verify <@beep/package>` handoff and relevant architecture, schema, documentation, coverage, and hosted gates. Use `--quick` only when the touched surface justifies that subset. Preserve coverage floors. Do not impose a blanket 100% coverage requirement unrelated to this program.

Evidence must identify the revision or configuration fingerprint, command/workflow, result, timestamp, and durable receipt. Attribute failures as introduced, inherited, unrelated, or environmental before repair. Do not claim success from a saved configuration or an attempted command alone.

Completion requires demonstrated outcomes. Deleting an inventory, shrinking a
directory, configuring a remote endpoint, opening a PR, or changing a status
field alone does not satisfy its acceptance criterion. Report implemented,
locally verified, hosted verified, merged, and externally blocked states
distinctly.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/repository-simplification-confidence/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/repository-simplification-confidence/ops/manifest.json` | Passes |
| Packet references | `rg -n "repository-simplification-confidence\|GOAL.md\|agentLaunchers\|packetAnchorDocument" goals/repository-simplification-confidence` | Matches present |
| Whitespace | `git diff --check -- goals/repository-simplification-confidence` | Passes |
| Goal doctor | `bun run beep goals doctor` | No new blocking findings; no advisory for this packet after it is committed |
| Goal index | `bun run beep goals index --write` then `bun run beep goals index --check` | Regenerated and consistent |
| Reflections | `bun run beep lint reflection-artifacts` | Passes |
| Package handoff | `bun run beep quality package-verify <@beep/package>` for every changed package | Passes, failures attributed |
| Generated scripts | `bun run beep lint package-scripts --write` leaves no diff (workspace members only; root scripts are hand-owned, see Sweep-derived constraints) | Passes |
| Host-path hygiene | `bun run beep knowledge refs --check` on the committed head | No gated row in files this program touched |
| Hosted proof | final-head hosted CI on each program PR | Required checks green; reds attributed |
| Merge gate | `bun run beep yeet merge-gate <pr> <sha>` | Mergeable: threads answered, window elapsed, required checks green |

## Stop Conditions

- Any spend: purchases, new paid services or endpoints, quota top-ups, or plan
  changes need the operator.
- A panel model or effort that the account does not accept (recorded, never
  silently substituted). This holds only the dependent item; unrelated work
  continues.
- Required source files are missing or materially contradictory.
- The same blocker repeats after reasonable investigation.

Recorded outcomes, not stops: a provider or account that cannot supply
actual cost is reported as not available; an incomplete 30-session telemetry
window retains the capability on demand with the window limitation recorded;
an upstream defect that cannot be repaired locally keeps the H4 route
explicitly unsupported with a reproducer and a verified safe path, which
satisfies Permission continuity.

Scope growth, destructive side effects, and policy calls are not stops: decide
them and record each in the Decision Log. Record genuine external blockers
without claiming completion.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-09 | Create this coordinating packet through `bun run beep goals bootstrap --plan --json`; generated payloads written byte-for-byte, seeds rewritten to carry the brief. | Brief section 1 item 2: supported goal workflow; the plan is the supported materialization. | `git revert` of the landing PR; the plan is reproducible from the same command. |
| 2026-10-09 | Workstream A dispositions locked as reproduced above (remove SST residue, `map.html`, Knip, `tools/skillopt`, the three plugin copies, inactive `.serena` residue, repository Impeccable, `.ai/mcp/mcp.json`; retain the aliases projection, Stately, identity lint profile, typos, shadcn lint, editor exclusions, tsgo shim, Semgrep, harness ledger, non-Knip patches). | Operator brief section 2.A. | `git revert` of each retirement PR; compact provenance records are kept for retired tools. Untracked local residue (`.serena/` in every clone that holds it, 13 at `e62411d63f`; Impeccable and `tools/skillopt/.venv` local residue) is archived before deletion; source path, bytes, sha256, and archive destination are recorded in `history/receipts/stage-3-a-local-residue.md`; restore by moving the archive back to its source path. `map.html` is regenerated by Fallow. |
| 2026-10-09 | Accept narrower detection after Knip removal; transfer the 41 known findings first. | Brief section 2.A and stage 2 exit condition; Fallow 3.32 default reports 0 and entry-export mode 1,468 without parity. | Restore Knip from the recorded baseline (`standards/knip.regression-baseline.jsonc` at `e62411d63f`) by reverting the removal PR. |
| 2026-10-09 | Workstream B: honest zero actionable debt; catalogs, reference inventories, and coverage floors preserved; `.patterns/jsdoc-documentation.md` retained. | Brief section 2.B. | Revert the standards PRs; generated snapshots regenerate through their owners. |
| 2026-10-09 | Workstream C: the script routing checklist above, including retiring `scripts/cloud-session-setup.sh`; `scripts/graft/` classified by the same rule. | Brief sections 2.C and 7. | Revert the port PR; the retired script remains in git history. |
| 2026-10-09 | Workstream D: retire pending private-package changesets behind one pre-release baseline record; preserve versions; publication machinery dormant. | Brief section 2.D (152 private workspaces, no release workflow). | `git checkout <retirement-PR merge commit>^ -- .changeset`, with that commit recorded in `history/receipts/stage-2-policy.md`, together with a revert of the reset policy PR (including the private-note graph guard). |
| 2026-10-09 | D census uses the existing approved `gh` credential without changing scopes; GitHub Packages remains externally blocked (HTTP 403, missing `read:packages`) and note retirement proceeds under R32. | Local npm, registry, consumer and artifact evidence is committed before retirement; uncertainty is explicit and APIs/versions remain intact. | Obtain an approved read-only scoped query and update the census; restore the full changeset directory and revert the reset policy PR together if obligations require rollback. |
| 2026-10-09 | D keeps the existing `lab-exempt`/`enforced` verdict domain and logs `private_skipped=N`; only manifest-derived publish-enabled versioned workspaces require notes. | The path verdict stays compatible while the requirement reads the actual private flag; root/unowned paths intentionally have no independent note obligation. | Revert the policy PR to restore prior requirements. |
| 2026-10-09 | D fails graph validation for notes naming live private workspaces, even when a stale retired-name allowance exists. | Prevents private note accumulation from returning; absent `private` conservatively remains publish-enabled. | Revert the graph hunk or deliberately activate publication before writing a note. |
| 2026-10-09 | D adds `private-exempt` deletion policy, retaining labs exemption and existing public empty deletion note behavior. | Private deletions prune existing keys but create no ceremonial `{}` note; explicit-public deletion behavior remains compatible; manifests omitting `private` now require the published-package override, aligning with npm semantics. All 152 live workspace manifests explicitly declare private true in the census. | Revert deletion policy changes. |
| 2026-10-09 | D removes live `@beep/ontology` from the retired registry and rewrites the five remaining rationales as independent name-reuse guards. | A live workspace cannot accurately be retired; registry guards remain useful after notes disappear. | Revert the registry edit; any subsequent name reuse still follows create-package policy. |
| 2026-10-09 | D preserves the 60 historical `CHANGELOG.md` files and records desktop Cargo 0.0.0 versus npm/Tauri 0.0.3 drift without changing versions (R37). | The reset concerns pending notes; historical and desktop release records retain their independent meaning. | A later reviewed history or desktop-versioning PR may change them. |
| 2026-10-09 | D retains dormant Changesets config, devDependencies and changelog adapter; explicitly disables private version/tag; no publish path is kept. E removes unused `changesets/action` allowlist entry under E-19/R36. | Activation must establish release/versioning and compatibility policy, reconcile ignore entries and restore workflow/allowlist and note requirements. | Deliberate publication activation under the documented policy. |
| 2026-10-09 | Workstream E: adversarial `.github` and hosted-settings audit; implement all actionable in-scope findings; trusted remote-cache writer boundary preserved. | Brief section 2.E. | Prior hosted settings (rulesets, required checks, environments) are exported as JSON to `history/receipts/stage-3-github-settings.md` before each change. Restore with `gh api -X PUT repos/<owner>/<repo>/rulesets/<id> --input <prior.json>`, or the matching endpoint, and revert the workflow PR. |
| 2026-10-09 | Workstream F: owned-field transformations with backup, drift detection, validation, and rollback; zero-use retirement only with a complete 30-session window per harness and fingerprint. | Brief section 2.F. | For each touched home file, `cp` the timestamped copy in `$HOME/.config-backups/` (name recorded in the `rsc-f-agents` lane handoff) back over the file, then rerun the transform's drift check (`bun run beep models check` for model fields); reverse repository changes with `git revert` of the F PR. |
| 2026-10-09 | Workstream F is reviewed by the three-model panel (`gpt-6-astra` xhigh, an independent `claude-fable-5-1` xhigh, `grok-4.7` xhigh); other workstreams use the ordinary routes. | Brief model assignments. The panel IDs are named exceptions to the ordinary-route pins in `AGENTS.md`. | Replace the panel rows in SPEC.md Model assignments and the Exception Ledger after a recorded operator ruling; no configuration is changed by this decision. |
| 2026-10-09 | Workstream G: selective sharing and retention under `.beep`; dry-run report before apply; Turbo claims proved separately (remote read, local hit, cross-checkout, changed-input miss). | Brief section 2.G. | The dry-run report `history/receipts/stage-5-storage-cleanup.md` lists bytes, owner, state, recovery destination, and retention reason per row; restore by moving each row's recovery destination back to its source path as listed in that file. Config changes revert by PR. |
| 2026-10-09 | Workstream H1-H4 implemented as reproduced above. | Brief section 2.H. | Revert the owning PR; H2 preserves legacy and grandfathered manifest behavior so a revert is schema-compatible. |
| 2026-10-09 | Program review exception: every in-scope actionable finding is resolved, including P2 and below; the AGENTS.md "Review loops stop after round 2" rule does not apply to program PRs. | Brief section 1 item 7 explicitly overrides the two-round limit. | Locked by brief section 1 item 7 for the whole program; it ends at program closeout (`completed-retained`). Lifting it earlier needs a recorded operator ruling in this log; then remove the Exception Ledger row and the AGENTS.md "Review loops stop after round 2" rule governs. |
| 2026-10-09 | Resume and integrate `effect-vitest-canon`; preserve and reconcile its five unpublished lanes and staged work first (lane V). | Brief existing work boundaries: explicitly authorized; lanes paused by the operator 2026-10-06. | The lanes stay intact until reconciled; nothing is discarded, so stopping leaves them as found (`research/baseline-2026-10-09.md`). |
| 2026-10-09 | TTC proof reuse stays paused. | Brief existing work boundaries. | No TTC configuration or semantics are changed, so there is nothing to undo; resuming proof reuse requires a new operator ruling recorded in this log and a change in `goals/time-to-certainty`. |
| 2026-10-09 | `build-pipeline-simplification` exploration preserved; its owner keeps the bundler and SchemaCompiler questions. The owner session's reply to the take-over notice was still pending at take-over. | Brief existing work boundaries; owner session live at take-over. | No-op: this program makes no edit under `explorations/build-pipeline-simplification/`; any accidental edit is reverted with `git revert` of the PR that made it. |
| 2026-10-09 | Shared manifests (`package.json`, `bun.lock`, models manifest, `AGENTS.md` (the `CLAUDE.md` symlink follows it), shared policy, generated inventories, `turbo.json` task declarations) serialized through the orchestrator lane. | Brief section 5. | Locked by brief section 5 for the whole program; it ends at program closeout (`completed-retained`). Lifting it earlier needs a recorded operator ruling in this log. |
| 2026-10-09 | Restore ordinary global Codex and Claude defaults to `gpt-6.1-sol` medium and `claude-opus-5-5` medium; preserve lightweight and research routes and Junie's `gemini-3-flash-preview` with Auto subagents. | Brief model assignments; drift recorded in `research/baseline-2026-10-09.md` "Model routes at take-over". | Before the edit, copy `~/.codex/config.toml`, `~/.claude/settings.json` and `~/.config/beep/models.yaml` into `$HOME/.config-backups/` with a UTC timestamp (`beep models` has no write mode at `e62411d63f`, per private receipt F-owned-fields-and-routes; the owned-field writer `rsc-f-agents` designs before any apply uses this backup convention). The program orchestrator takes this copy at stage 1 and records the backup names in `history/receipts/stage-1-ownership.md`; restore with `cp` from those files, then confirm with `bun run beep models check`. |
| 2026-10-09 | The program orchestrator session also holds the single fleet orchestrator role by operator ruling ("you are the orchestrator now"). This is a hand-over of the existing role, not a second role (brief section 1 item 3). Program records stay in this packet (`history/handoffs/`), separate from fleet files; fleet handoffs go through the orchestrate skill's `HANDOFF.md` with a `HANDOFF.prev-<UTC>` snapshot. | Operator ruling at take-over; the predecessor orchestrator session was not live. | Hand the role off with the orchestrate skill hand-off procedure; the take-over snapshot `HANDOFF.prev-20261009T133842Z.md` restores the prior fleet handoff. |
| 2026-10-09 | Any lane editing `standards/effect-laws.allowlist.jsonc` or the generated `EffectLawsAllowlistSnapshot.ts` notifies the effected-port session (through the orchestrator) before publishing. Applies to `rsc-b-standards` and `rsc-f-agents` in particular. The same applies to `scratchpad/package.json` and `bun.lock` (`rsc-h1-catalog` and `rsc-shared` in particular). | Cross-session constraint recorded at take-over (2026-10-09T13:55Z): that session's branch rewrites both allowlist files, and also `scratchpad/package.json` and `bun.lock` (`research/sweeps/2026-10-09/H1-catalog.md`); brief existing work boundaries keep its work owned by it. | Drop the rule (Program rules bullet and PLAN.md dependencies) once that branch lands. |
| 2026-10-09 | Sweep evidence placement: repository-facing sweeps committed under `research/sweeps/2026-10-09/`; workstation-facing sweeps (F agent configuration, G storage, H3 telemetry, H4 desktop permissions, and their gap follow-ups) kept as private operational receipts in the orchestrator briefs directory, listed by name in `research/sweeps/2026-10-09/README.md`. | The repository is public. The workstation sweeps describe home configuration, local stores, and host routes, which brief section 1 item 9 keeps out of public records; the repository sweeps cite only tracked files and public GitHub state. The committed copies are sanitized (`~` paths, no session ids, no credentials or mailbox addresses). | Delete `research/sweeps/2026-10-09/` with `git revert` of the PR that added it; to publish a private receipt, sanitize it and add it under the same directory with a new Decision Log row. |
| 2026-10-09 | Build-pipeline session boundary: that session owns `explorations/build-pipeline-simplification/` and PR #1558 only; this program makes no edit there. | Brief existing work boundaries; boundary recorded by the program orchestrator on 2026-10-09 after take-over (the earlier row above notes the reply as pending at take-over). The storage sweep shows that PR's proof job running in the `beep-effect2` clone, outside this program's lanes. | No-op unless the scope changes; record the new boundary in this log and the Program rules bullet. |
| 2026-10-09 | Knip reconciliation at `e62411d63f`: all 41 baseline rows reproduced (0 disappeared, 0 new); rows tracked in `research/knip-fresh-rows-e62411d63f.tsv`. | A row-level fresh run is the stage 2 transfer input; an earlier draft's 5 "disappeared" `files` rows were a normalizer defect. | Re-run the recorded command at a new head and add a dated column to `research/knip-findings-2026-10-09.md`. |
| 2026-10-09 | Root `package.json` scripts stay hand-owned; no root `PackageKind` extension in this program. | `research/sweeps/2026-10-09/C-ownership-facts.md` (a): `beep lint package-scripts` covers workspace members only; each root-script change needs a `quality:cache-policy` baseline review and a `//#` Turbo task update in the same PR. | Record a later Decision Log row that extends package-scripts ownership to the root. |
| 2026-10-09 | H1 removes the 7 never-imported `scratchpad/package.json` declarations and the dependent `pdfjs-dist` catalog line and override, so that the reservations become unused. | Brief 2.H1; `research/sweeps/2026-10-09/H1-catalog.md`. | `git revert` of the H1 PR. |
| 2026-10-09 | H1 also removes the inert `@opentelemetry/propagator-jaeger` override (no installed instance; `bun.lock` lists it only under overrides) and its Fallow ignore entry. | `research/sweeps/2026-10-09/H1-catalog.md`; brief 1.7 and 2.H1. | `git revert` of the H1 PR. |
| 2026-10-09 | Phase P0 set to `in-progress` in the manifest while stage 1 (ownership and recovery) runs. | `GoalPhaseStatus` admits `pending`, `in-progress`, `complete`, `superseded`. | Set it back to `pending`. |
| 2026-10-09 | Packet-prose review convergence: the verbatim brief (research/BRIEF-2026-10-09.md) is the authority; packet prose is gated by material defects (a misstated locked disposition, model, boundary, owner, dependency, or acceptance row; a missing required element) and by validator failures; wording and verbatim-copy findings against prose that already cites the brief are advisory and go to research/OPPORTUNITIES.md. | 10 review rounds (16,14,12,8 then 15,17,11,6,8,5 findings) did not converge on wording while every material item was fixed; the program's "resolve every actionable finding" rule applies to repository debt and review threads on PRs, and the brief itself is in the packet verbatim. | Delete this row and re-run the three-lens review loop. |
| 2026-10-09 | Codex lane workers run with full access (`codex exec --dangerously-bypass-approvals-and-sandbox`, `gpt-6.1-sol` medium) inside their own sibling worktree and commit, push and publish through Yeet themselves. Orchestrator decision, not an operator instruction. | A sandboxed Codex cannot stage, commit, fetch or publish inside a sibling worktree (`index.lock` read-only), which would force "Codex edits, orchestrator commits" for every lane; the operator's own interactive Codex use is `codex --yolo`. | Relaunch the lane under `-s workspace-write` and fall back to "Codex edits, orchestrator commits" (`~/.cache/beep/orchestrator/bin/launch-codex-lane.sh`). |
| 2026-10-09 | Every program lane, including F, G and H4, runs on Codex `gpt-6.1-sol` medium; the direct Claude route is reserved for the orchestrator and the independent workstream-F panel. Lanes launch in two waves (H1, D, E, A, C, V first; B, F, G, H2, H3, H4 second). | Headless Opus lanes would share the orchestrator account's session limit (a limit at 15:1xZ killed 24 workflow agents); the brief allows Codex for ordinary implementation, exploration and review. | Launch any lane with `launch-claude-lane.sh` instead (`claude-opus-5-5` medium). |
| 2026-10-09 | `rsc-shared` is held by the orchestrator: lanes edit shared files (root `package.json`, `bun.lock`, `turbo.json`, `AGENTS.md`, `.changeset/config.json`, models manifest, generated inventories, `.github` lane declarations) on their own branch, merge `origin/main` and regenerate before `final`, and the orchestrator reviews and merges shared-file PRs one at a time at the gate in the order of RULINGS S6 (H1 OSV, D, the Knip window, V inventory, B refresh, the rest). | Brief section 5 serializes shared edits through one owner; a separate lane would only add a hand-off per edit. | Cut a dedicated `rsc-shared` lane and route the edits through it. |
| 2026-10-09 | The required `Knip` status-check context is removed from the `main` ruleset by the orchestrator at the gate of the A PR that deletes the `check.yml` job, after exporting the prior ruleset to the E receipt; the two land in one window. | A head without the Knip job can never satisfy a ruleset that still requires it, and removing the context first would let other PRs merge without Knip for the whole window. | Re-add the context from the exported ruleset JSON (`gh api -X PUT repos/<o>/<r>/rulesets/<id>`). |
| 2026-10-09 | Lanes may start before this packet PR merges: step 0 merges `origin/main` and, if the packet is absent, the packet branch itself. | Identical additions merge cleanly after the squash; waiting for the merge would idle twelve lanes for the review window. | Relaunch any conflicted lane from a fresh worktree cut after the merge. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Review-loop cap override | Every PR of this program | Program orchestrator | Brief section 1 item 7: resolve every in-scope actionable finding, including lower severity; do not defer one merely to stop a review loop. Overrides AGENTS.md "Autonomy" round-2 rule for this program only. | Program closeout (packet reaches `completed-retained`). |
| Three-model panel IDs | Workstream F final review | Program orchestrator | `gpt-6-astra`, `claude-fable-5-1`, and `grok-4.7` at xhigh are named by the brief; AGENTS.md otherwise forbids substituting non-default models silently. This is an explicit, recorded use. | Terminal zero-actionable-findings verdicts from all three reviewers are recorded in `history/receipts/stage-5-panel.md` on the final workstream F revision and configuration fingerprints, and no F configuration change follows them; any later change keeps the exception for the re-review. |
