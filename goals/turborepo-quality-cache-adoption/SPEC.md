# Turborepo quality cache adoption spec

## Objective

Adopt every eligible quality computation in its proven profiles and optimize the full Turbo/CI/Yeet workflow with measured benefits and fresh hosted statuses.

Graduated 2026-09-08 after the user approved the complete
[brief](../../explorations/turborepo-quality-cache/BRIEF.md) and [goal map](../../explorations/turborepo-quality-cache/MAP.md).
The [decision record](../../explorations/turborepo-quality-cache/DECISIONS.md) supplies inherited trust,
qualification, rollout and ownership requirements.

## Non-goals

Out of scope: replacement backend cutover, new proof ledger or scheduler, runner-placement ownership, and whole-task caching of external/security verdicts.
Preserve adjacent proof, timing/placement and ontology ownership. A new package
requires the approved consumer test and canonical generator. A cache hit never
substitutes for fresh required hosted proof.

## Source hierarchy

1. User objective and approved exploration decisions.
2. AGENTS.md, CLAUDE.md and required skills.
3. Binding architecture and package standards.
4. This SPEC.md.
5. PLAN.md, then GOAL.md.
6. Supporting evidence and the [source ledger](./research/SOURCES.md).

Higher sources govern conflicts. Refresh materially stale evidence without
reopening settled design decisions.

## Target surfaces

- [turbo.json](../../turbo.json): Root graph and exact-version schema/config policy.
- [package.json](../../package.json): Root delegation and package-manager/tool configuration where proven necessary.
- [.github/workflows](../../.github/workflows): Named quality callers, protected warmer and resolved workflow-aware cohort changes.
- [.github/actions/setup-monorepo-ci/action.yml](../../.github/actions/setup-monorepo-ci/action.yml): Actions archive key, restore/save timing and transport contract.
- [packages/tooling/tool/cli/src/commands/Cache/index.ts](../../packages/tooling/tool/cli/src/commands/Cache/index.ts): Measured warming/dashboard consumer of shared result and qualification contracts.
- [packages/tooling/tool/cli/src/commands/Quality](../../packages/tooling/tool/cli/src/commands/Quality): Qualified policy enforcement and lane reporting.
- [packages/tooling/tool/cli/src/commands/Ci](../../packages/tooling/tool/cli/src/commands/Ci): Hosted summaries and workflow identity.
- [packages/tooling/tool/cli/src/commands/Yeet](../../packages/tooling/tool/cli/src/commands/Yeet): Curated cache-fact bridge while preserving the existing proof owner.

This goal owns tests beside its implementation and its packet evidence.
Record every additional touched workspace in the verification and ownership
list. Only change scripts/configuration where this contract names their role.

## Implementation contract

### Comprehensive audit

Refresh the entire executable computation population across root/child Turbo
config, workspace scripts, nested commands, Quality, CI and Yeet. Reconcile
historical OPPORTUNITIES.md and misspelled opportunity-file leads with current
source, disposition and owner. Keep actual executions distinct from configured
nodes, and required hosted contexts tied to a current ruleset/run receipt.

For stable and exact published canary, inventory graph/dependencies/transit,
entrypoint/affected/filter semantics, global/task config, inputs, env and
passthrough, outputs, descriptions, persistence/watch, concurrency, worktrees,
artifacts, summaries/query tooling, pruning/deployment workflows, boundaries,
future/experimental flags, archive transport and warming. Record exact
availability, prerequisites, Beep use case, correctness test, expected benefit,
disposition and owner for each applicable feature. Unsupported/non-applicable
features need a reason. Main stays a non-scoring research appendix.

### Governed task changes

Use the qualification policy and transition API for all promotion and
suspension. Adoption supplies evidence and owns rollout, not a parallel state
store. Qualify each computation/layer/profile/epoch with the full comparison,
input perturbation, portability, concurrency, safe-log and shadow requirements.
Preserve real semantic inputs even when they reduce hit rate.

Inspect build compiler state and portable outputs; lint/check dependencies and
transit alternatives; property seeds/run counts; docgen discovery/order/writes;
coverage shard/aggregate/ratchet boundaries and shared paths; browser and
integration prerequisites; and separate no-write checks for mutating generators.
Fixers, services and required external/security verdicts remain fresh at their
current whole-task boundary. Cache eligible pure prerequisites separately.

Audit Actions cache keys/save timing including child configuration and output
ownership. Archive restore is transport, not a qualified task hit. Correct
schema/version alignment and config descriptions as part of the exact-version
review. Experimental flags change individually with regression evidence.

### Hosted and Yeet adoption

Prove local use first, then supported cross-worktree directions. Name the
hosted workflow/runner/source cohort before enabling remote reuse and consume
trust's production-ready signing/tenant/credential receipt. Preserve fork
isolation and protected writers. Record the reusable Heavy definition actually
resolved by the run; branch-local edits are not execution proof.

Required jobs must start and produce their own exact-source or merge-ref
status even when pure prerequisites hit. Quality lane reuse, Yeet full proof
and the time-to-certainty ProofLedger remain distinct authorities. Integrate
through curated facades and existing owners, never private Yeet imports or
new proof/lease/scheduler stores.

### Value and completion

Consume ci-lane-economics' baseline rather than publishing a competing timing
or runner-placement authority. Measure correctness/security, critical-path
seconds, reliability, compute/storage/transfer/operations cost, then hit rate.
Attribute real hits and remote faults using the conformance/trust result model.
Rank warming by measured protected-source demand and qualified profile, with
explicit time, byte, request and concurrency bounds and selection receipts.

Complete named local/hosted/broader cohorts inside proven profiles. Preserve
the seven-day nonproduction, seven-day cohort and fourteen-day broader backend
observation when the trust/backend change is rolled out; cite the owning
receipt rather than rerunning an already valid observation window. Do not
manufacture elapsed representative time from synthetic samples.

Every in-scope entry needs a final evidence-backed disposition. Eligible work
must be qualified and adopted; exclusions need reasons and pure decomposition
where viable. Unassessed/candidate/shadow/suspended entries and temporary
exceptions are unfinished work, unless a new explicit scope decision removes
them with rationale. A lower hit rate never justifies a correctness regression.

## Dependencies and ownership

P0 and feature/source inventory can start independently. P1 consumes the
qualification contract; broad promotion waits for its validated runner/pilot.
P3 requires passing protocol and current production trust readiness. Coordinate
cohort execution with trust's rollout rather than introducing a cycle between
whole-goal completion gates. Replacement cutover, if selected, stays in the
conditional migration goal; keep safe independent local improvements moving.

The [program map](../../explorations/turborepo-quality-cache/MAP.md) defines cross-goal handoffs. Assign one
writer to each shared file/artifact before concurrent work. A pending sibling
goal does not justify duplicating its schema, state or evidence.

## Constraints and governing references

- [Architecture constitution](../../standards/ARCHITECTURE.md) and
  [placement rationale](../../standards/architecture/07-non-slice-families.md).
- [Agent laws](../../AGENTS.md), schema-first/Effect-first skills for relevant
  implementation, and Yeet for quality/publishing work.
- [Remote-cache operator contract](../../standards/turbo-remote-cache.md).

Detailed contracts for this goal:

- [task-census.md](../../explorations/turborepo-quality-cache/research/task-census.md)
- [cache-qualification.md](../../explorations/turborepo-quality-cache/research/cache-qualification.md)
- [opportunity-disposition.md](../../explorations/turborepo-quality-cache/research/opportunity-disposition.md)
- [observability-and-economics.md](../../explorations/turborepo-quality-cache/research/observability-and-economics.md)
- [ownership-map.md](../../explorations/turborepo-quality-cache/research/ownership-map.md)
- [architecture-grill.md](../../explorations/turborepo-quality-cache/research/architecture-grill.md)

Use schema-first models, typed errors/tagged outcomes, Effect helpers/services,
explicit config boundaries and curated exports. Search live source/barrels
before adding helpers. Keep the standalone Lambda build boundary explicit;
exchange versioned JSON instead of CLI implementation imports. Reuse generic
evidence vocabulary only where it fits.

Artifact HMAC does not prove complete task inputs or a protected producer.
Separate task reuse, archive transport, lane proof, Yeet full proof and hosted
status. Keep raw artifacts/logs/traces out of git; store bounded sanitized
receipts and retention-controlled raw references. Resolve op from PATH and
follow the approved agent lane. Never reveal secret values or repair an agent
secret failure through desktop sign-in.

## Acceptance criteria

- [ ] Current executable/lane population and applicable stable/canary feature matrix are complete, source-backed and assigned to owners.
- [ ] Every adopted computation has valid tuple-specific qualification, semantic invalidation, output/log safety and supported portability/concurrency evidence.
- [ ] Root/child graph, scripts, env, outputs, persistence and Actions transport match the reviewed qualification projection.
- [ ] Named hosted cohorts preserve fork/read/write policy and emit fresh required statuses tied to the source and resolved workflow actually executed.
- [ ] Demand-based warming and result attribution have bounded costs and demonstrable critical-path/reliability value using the owning baseline.
- [ ] Every in-scope computation has a final disposition, eligible work is adopted, and representative observations and rollback evidence are complete.
- [ ] Relevant package/protocol checks pass; failures are attributed and no
  introduced regression remains.
- [ ] The final implementation PR reaches Yeet `merge-ready: yes`, with
  required checks and reviews handled.
- [ ] Final evidence, reflection and lifecycle closeout land in that same PR.

Packet creation satisfies no implementation criterion. A partial or blocked
result remains active/paused with receipts, not completed-retained.

## Verification matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet conventions | `bun run beep goals doctor`; `bun run beep explore --check` | No new findings; attribute inherited fleet findings. |
| Launcher | `wc -m < goals/turborepo-quality-cache-adoption/GOAL.md` | At most 4,000 characters; target at most 3,500. |
| Package handoff | `bun run beep quality package-verify @beep/repo-cli` | Pass after editing this package; include every other edited workspace. |
| Behavioral proof | Acceptance-specific tests and experiments | Negative cases fail for the intended reason; source review cannot fabricate runtime proof. |
| Reflection and evidence | `bun run beep lint reflection-artifacts` and receipt review | Valid, safe evidence and a closeout reflection at completion. |
| Hosted acceptance | Yeet repair, verify, publish and monitor per current skill | Final head is merge-ready with required proof and handled reviews. |

For infra/Lambda edits, use its existing verification lane and inspect build/temp
targets first. A bundle build is not deployed conformance. Docs-only preparation
needs JSON/link/projection checks; actual implementation needs behavioral proof.

## Rollback

Suspend the affected qualification tuples, disable their remote use and
revert the smallest graph/consumer change to the reviewed prior policy.
Recompute authoritative results, preserve required job startup/status, and
record the fault and cost. Stop the warmer before it propagates a bad epoch;
do not purge a shared cache or relax inputs to conceal a regression.

## Stop conditions

- Semantic divergence, failed invalidation, sensitive capture or unauthorized
  read/write/tenant access appears. Stop affected reuse and preserve a receipt.
- Required exact-version or dependency evidence is missing. Continue independent
  work but do not cross the gate.
- A concrete deployment/rollout exceeds scope or an unresolved numeric budget.
  Prepare the change/preview before requesting a missing material decision.
- A change would overwrite another owner's artifacts, weaken required statuses,
  or bypass the approved secret or runner-admission paths.

## Exception ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None approved | This goal | Goal executor | Record real exceptions before using them. | Every temporary exception needs a bounded removal condition. |

## Decision log

| Date | Decision and reason | Reversal |
| --- | --- | --- |
| 2026-11-03 | Preserve at most 2,000 trailing output characters when a captured quality command times out. The policy job on #2686 lost all captured doctor output at its unchanged 15-minute deadline, preventing phase attribution. Keep the timeout, failure status, bounded cleanup and existing capture prefix unchanged; this diagnostic repair does not qualify a cache or resolve the underlying doctor timeout. | Revert the focused capture-tail repair; no persisted state, cache policy or runtime budget changes. |
| 2026-10-28 | Resume in the dedicated `codex/turborepo-goals-completion` lane. Refresh current source, client pins and population before promoting anything; older qualification remains bound to its original tuple. | Retain the previous approved configuration and remove only this lane's changes through a reviewed revert. |
| 2026-10-28 | Treat the already approved R2 fleet as the current consumer path and retain AWS as its rollback. The user approved named trusted workstation writers; this grants upload capability, not protected-workflow producer identity. Refresh both boundaries before claiming production trust. | Disable affected remote reuse, stop mixed writes and restore the prior approved endpoint and epoch through a rehearsed path. |
| 2026-10-28 | Pin native experiment execution with `--skip-infer --single-package`; a zero-task fixture is a failure. Keep supervisor failures bounded to exit code or capture truncation without attaching private worker streams. | Revert the runner change through Yeet; keep promotion closed when exact native execution is unproven. |


### Native storage test readiness and reply correctness, 2026-10-31 UTC

- Repair the inherited CI held-message test in its focused test-only PR2374.
  Reuse the existing layer-start and storage reply-notification boundaries;
  retain the virtual-clock timeline, both count assertions and 15-second limit.
  Require a successful WithExit response and join the reply reader so a failure
  response or listener failure cannot satisfy the regression assertion.
- The actual CI zero-reply failure and the review's count-only false-success
  case justify this change. Keep its current-source package/runtime checks and
  bounded decoded-reply fault controls separate from cache qualification. The
  first handler-defect control restarted the entity and timed out; it proves
  nothing about the success assertion and remains retained as a failed approach.
- Reversal is a reviewed Git revert of the scoped test repair. No production
  storage behavior, cache policy, credential, runtime budget or proof floor
  changes. Fresh complete and hosted/review gates precede acceptance.


### Current pinned runtime observation, 2026-10-29

Admit Bun1.4.4 as an observed Linux x64 toolchain identity because it is the
current repository pin. Retain historical identities and reject a declared-pin
mismatch. A current snapshot does not inherit qualification from either older
profile; actual binary changes still alter the runtime digest. Leave task cache
flags and the qualification ledger unchanged. Reversal removes this additional
observation profile before any current-profile reuse is admitted; an activated
profile would first need its own disable/rollback procedure.


### Explicit current-runtime qualification baseline

2026-10-29: Use the existing reviewed baseline writer to move observation scope
from Bun1.4.2/qualification-v2 to Bun1.4.4/qualification-v3. The old public
fingerprint refusal demonstrates its profile guard. Name only the root review
subject and require unchanged effective configuration, cache flags, scope,
carried package reviews and ledger. This creates no qualification or signed
production epoch. Reversal uses the same compare-and-swap writer against the
retained prior baseline after checking current-epoch state. The immutable
review is `research/current-runtime-baseline-review.md`.


### Current mutating-fixer disposition, 2026-10-29

- Keep the 136 exact reviewed `lint:fix` commands fresh. Each delegates to
  Biome check with `--write`, has no archived outputs, and has an existing
  separate read-only `lint` computation. Native stable/canary controls show a
  logs-only hit skips the required rewrite; cache-disabled controls perform it.
  Bind this source review to full script maps, manifests and configuration
  files. A changed binding requires a fresh review.
- These are final whole-command exclusions for the reviewed semantics, not
  qualification transitions. The 136 read-only counterparts and every remaining
  population row retain their independent qualification/adoption obligations.
  Reversal removes only the review/dispositions; no task flag, script, ledger
  entry, production cache or required hosted status changes.


### Persistent development service disposition, 2026-10-29

- Keep the exact reviewed OIP Web and Todox `dev` commands fresh. Both start
  named Portless Next development services and already declare persistent,
  cache-disabled tasks with no output archive. Their existing application and
  dependency build computations retain separate review and qualification work.
- Bind this source-only exclusion to current manifests, complete script maps,
  configuration and runtime declarations. Reversal removes only the review
  records; no service, script, flag, ledger entry or hosted status changes.


### Remaining source-rewriting lint commands, 2026-10-29

- Review all 50 remaining `lint:fix` commands from exact current manifest, full
  script-map and effective-configuration bindings. Forty-nine delegate to the
  same `biome check . --write` implementation. Storybook's existing shell
  wrapper also writes cross-workspace story sources. Keep each whole command
  fresh; all 50 already disable caching and archive no outputs.
- The population now has 186 reviewed source-rewriting fixers and two reviewed
  persistent services. Their separate read-only lint/build computations keep
  their own qualification obligations; 2,383 population dispositions remain
  unfinished. This source review changes no script, task flag or qualification
  ledger. Reversal removes only these additional review/disposition records.


### Remaining persistent service boundaries, 2026-10-29

- Keep the ten additional exact current Portless service commands fresh: four
  Bun watchers, four Vite development servers, Storybook development and Vite
  static preview. This completes source review of all twelve configured
  persistent executable computations; each already disables caching and has
  no archived outputs. A restored cache result cannot supply a live service.
- Bind each disposition to exact manifests, complete script maps and effective
  configuration. Finite application/dependency builds and Storybook static
  build keep their independent qualification obligations. The population now
  had 198 reviewed fresh boundaries and 2,373 remaining disposition gaps at that checkpoint.
  No service is launched and no script, flag or ledger changes. Reversal
  removes only these additional review/disposition records.


### Publication memory guard and documentation consistency

- 2026-10-29: Preserve the current weighted admission around cheap publication
  gates: source and tests deliberately protect the schema-catalog scan's measured
  memory demand. Correct the stale no-ticket claim in the Yeet skill. Attribute
  local admission wait separately from remote-cache latency and hosted queues.
  The existing ten-minute constrained-compute escape remains unchanged; record
  local proof scope and require fresh hosted acceptance. Reversal changes only
  the documentation wording; no scheduler capacity, proof floor or cache flag
  is altered by this correction.


### Current external verdict and generator source review

Keep `repo-sanity:bun-audit` fresh at its whole-command boundary because its
verdict depends on live advisories and clock-expiring exceptions. Its separate
pure policy prerequisite remains eligible for independent qualification. The
source review now gives 199 fresh boundaries and 2,372 final-disposition gaps.
All nine generator write commands have explicit source-reviewed pure rendering
or drift-check leads; none receives a final exclusion or reuse grant here.
No configuration, qualification state or production consumer changes.
### Go workspace discovery applicability, 2026-10-30

- Retain the disabled Go workspace flag. The accepted tree has no root go.work,
  Go modules or Go source, and none of its tracked manifest scripts directly
  invokes the enumerated Go build/module commands. No computation or graph
  edge in this repository can benefit from this discovery feature today.
- Record this feature as accepted-not-applicable with its exact source and
  client identities. Canary documentation absence does not establish runtime
  non-support. Existing Cargo and Python consumers keep their separate reviews.
- Reopen when a Go consumer or discovery-contract change appears. Require
  exact-client positive/negative evidence before any proposed activation.
  Reversal sets this review back to pending; it changes no runtime setting.


### Exact-native future-flag availability observations, 2026-10-30

- Add isolated configuration observations for every schema-listed future flag
  on each exact pinned native client. Set one flag false/true per case, keep
  cache local/read-only, and use dry-run with a command that would leave a
  marker and exit 37 if accidentally executed. Require both baseline acceptance
  and an unknown-key refusal control on each client.
- All 56 flag cases parse on these pins; both unknown controls refuse and no
  sentinel executes. This proves the observed configuration boundary only.
  It grants no feature semantics, task qualification, production safety or
  performance claim. Applicable features still need their complete regressions.
- Retain the recorded observations if later semantic cases fail. Reverse the
  matrix annotation by removing its observation links; no runtime setting changes.

### Constrained publication replay, 2026-10-30

- Use the existing hosted escape after the generator-repair publisher spends
  more than thirteen minutes in admission and local gates. Cancel that owned
  publisher, retain the scoped native proofs, push the completed repair wave
  and let current hosted checks provide the broad proof.
- The interrupted publisher is not a passing local proof. Keep the PR in draft
  until its current content-final requirements are met; preserve all existing
  acceptance and review gates. Reversal is an ordinary repair/revert PR.

### Attempt and publication identities, 2026-10-30

- Preserve the attempt's starting head and diff fingerprint. Publishing staged
  changes may create a different commit within that same attempt. After its
  owned commit succeeds, resolve subsequent scheduler tickets, proof-shadow
  facts, verdict and terminal journal rows to the commit it created. The
  attempt-started row retains the original source identity; an unrelated head
  change still refuses publication. Push-only, already-committed and
  non-publish attempts retain their existing resolution behavior.
- Add an optional published-head identity to the existing verdict. Record it
  only around a successful owned Git push with unchanged head; an unsuccessful
  push or head drift grants no such identity. This is transport provenance,
  not qualification, hosted status or proof reuse authority.
- Keep older verdicts readable when the append-optional field is absent. No
  new proof store, scheduler or ledger is introduced.
- Exercise the standard prove-first route against the same disposable Git
  remote as the push-first route. A commit created during full pre-push proof
  must refuse publication; moving the prepared-head capture after that proof
  must make the regression test fail. This adds no production authority.
- Reverse by removing the new writer path while retaining backward-compatible
  decoding of already emitted records. Do not rewrite historical attempts.

The clarification above adopts the accepted
[#2478 implementation](https://github.com/beep-effect/beep-effect/commit/f69e6dd06759639279eed885665a5c564528bd7c)
on 2026-11-02. Its disposable-remote regressions bind the created commit in
verdicts, leases, shadow facts and both finished and interrupted terminal rows.
That commit identity is provenance for what ran and was pushed; it grants no
cache qualification or hosted-proof reuse. Reversal remains a repair PR that
preserves the original journal and readable historical verdicts.

### Publication-repair hosted escape, 2026-10-30

- The first canonical publisher stopped on an introduced duplication after
  roughly ten minutes of local gates. Repair that duplication in the existing
  shared phase, rerun focused checks and use the standing hosted escape to
  open the reviewable draft under constrained local compute.
- Preserve the failed publisher and deliberately interrupted old-source package
  audit. Neither grants current proof. Current full package/final, hosted checks,
  review threads and the review window remain required before completion.
- Reverse through an ordinary repair/revert PR; keep historical attempt facts.


### Task descriptions feature disposition, 2026-10-30

- Retain the current absence of optional task descriptions. The current canonical
  census covers 190 workspaces and 22 Turbo configuration files; none of 101
  explicit task definitions declares this field. This feature supplies human
  metadata, not an execution or caching benefit that warrants a second source
  of task documentation in the current repository.
- Both pinned native clients exclude description from resolved task definitions
  while including raw `turbo.json` in task inputs. Assert addition/edit misses and
  exact earlier-hash reuse after removal. Never exclude a real configuration
  input merely to make a documentation edit hit.
- Reopen this current-tree decision for a concrete task-inspection/UI consumer
  with reviewed maintenance and invalidation costs. This is a final no-change
  feature decision, not a qualification exception or a deferred eligible task.
  All computation, trust, hosted status and observation requirements remain.

### Native task-selection semantics, 2026-10-30

- Retain a bounded native selection driver beside the existing input and
  availability drivers. The existing entrypoint attachment owner establishes
  source identity, not this runtime behavior; do not add another runtime owner
  or qualification state store. Use the exact two pins, finite environments,
  offline fixture setup, local-only execution and explicit process budgets.
- Compare strict selection false/true without changing the three fixed flags.
  Assert transit preservation, explicit missing tasks, graph-only requests,
  empty selection, filter refusals and actual native execution records. A zero
  native exit alone must never become successful selected-task evidence.
- Treat `--only` according to the observed named-task semantics: other-name
  prerequisites disappear, while same-name transit dependencies remain. Keep
  real inputs and graph closure intact in any later task qualification.
- Preserve the current production setting and all 33 unfinished feature reviews
  until real consumers, remaining selector families and qualified changes are
  reviewed. Reverse this evidence addition by removing its driver/report and
  matrix links together; no production setting changes in this component.

### Nested Python workspace feature decision, 2026-10-30

- Retain the absent experimental root uv discovery flag. The tracked nested
  `beep-photo-face` project is standalone; there is no root uv workspace. Its
  lint and test commands remain explicitly owned by the Beep CLI package audit.
  Do not add another discovery path without a concrete consumer and measured
  benefit, or mistake a missing root workspace for missing Python quality work.
- This final no-change feature decision grants no task qualification. Review
  the Python quality computations and their complete source, lockfile, tool and
  interpreter inputs independently. Never infer whole-task reuse for external
  person-matching or model verdicts from this discovery decision.
- Reopen for a proposed root uv workspace, independent Python quality ownership
  or a changed client/discovery contract. Exact-client real uv graph and
  execution controls precede any activation. Reverse this decision by restoring
  the feature row to pending; runtime configuration is unchanged.

### Existing external-security boundary review, 2026-10-30

- Preserve fresh `repo-sanity:bun-audit` execution. The current command combines
  current vulnerability information with wall-clock expiry of OSV exceptions;
  an unchanged tree cannot prove a current verdict. Retain its existing
  `cache: false`, empty outputs and explicit local proof-reuse exclusion.
- Record one final whole-task keep-fresh disposition without running the audit
  or asserting a vulnerability outcome. Any pure parser decomposition needs
  independent qualification and cannot replace the external verdict. Reverse
  only the review projection to pending; existing safety behavior stays fresh.
### Markdown test-resource isolation, 2026-10-30

- Keep the Markdown parser unchanged and preserve the per-file 100% coverage
  floor. A root proof reported two uncovered default-metadata branches while
  all tests passed; existing focused and standalone full tests cover both.
  Standalone checks do not reproduce the original measurement failure or prove
  a particular V8 internal cause.
- Apply the shared harness rule for module-replacing tests to this package's
  registry spies: use an isolated module context per file during coverage too.
  Both native profiles pass all 4,501 cases and retain full parser coverage.
  The measured local coverage cost is about 45 extra Node seconds and 29 Bun
  seconds; these single co-running observations are not a speedup claim.
- Reverse the one-package override after equivalent mock isolation and reliable
  branch evidence are shown. No runtime parser, coverage floor, required check,
  task qualification, credential or production cache setting changes.

### Accepted feature review join, 2026-10-30

The accepted feature-review commit `0e601a3d55` is consumed before the next
producer publication. Both external-advisory source reviews remain evidence for
the same single computation. Its current disposition uses the accepted security
review; the existing structural fingerprint counterpart remains a decomposition
lead, without qualification or reuse authority. The population stays at 199
whole-command fresh dispositions and 2,372 final-disposition gaps. Branch-local
SPEC digests remain preserved as historical provenance, while the current audit
binds this merged SPEC. The preceding producer commit is the reversal point;
this documentation join deploys nothing and satisfies no whole-goal criterion.


### Standalone Cargo workspace feature decision, 2026-10-31

- Retain the absent experimental Cargo discovery flag. The two Tauri crates are
  standalone and the repository has no root Cargo workspace. Both exact native
  clients produce the same complete ninety-node Bun build graph with the flag
  disabled and enabled. Rust work remains owned by its existing native and
  sidecar commands; it is neither absent nor already cache-qualified.
- Preserve the positive synthetic root-workspace discovery and exact executable
  restoration controls. Explicit cache/output configuration is required in this
  fixture. The undeclared external-input negative case reproduces stale reuse;
  declaring the input restores invalidation. Do not generalize that fixture to
  Tauri build scripts, system libraries, signing or shared target directories.
- Reopen for a proposed root Cargo workspace, a direct Turbo Rust consumer or
  changed client/native ownership. Before adoption, review all actual toolchain,
  target, source, lockfile, vendored ABI patch, C/sidecar and external inputs.
  Reverse this decision by returning its matrix row to pending and removing the
  report links together. Runtime settings and qualification state are unchanged.


### Retain current setup ownership, 2026-11-02

Keep `experimentalSetup` and the root `setup` policy absent. Exact stable and
current-canary controls show real native skip-policy behavior despite stale
parsing-only help/schema text. Managed setup still requires its lock/resolution
prerequisites; it is not classified as unimplemented. The current cloud, CI and
worktree preparation owners already provide the named consumers, and no measured
quality critical-path benefit justifies another toolchain/lock owner. Reopen for
a concrete owner-proposed consumer, evidence of benefit, compatible frozen
profiles and rollback. This no-change feature decision removes no eligible task
obligation and grants no task qualification or production rollout.

### Refresh after accepted audit-script removal, 2026-11-02

Accepted main PR2526 removed the 188 per-package audit wrappers and added the
root deprecated-import check. The retained census is historical: 231 of its
438 source bindings differ from the later phase-runner source. Use the canonical
census and preservation recipe against a separate fixed accepted-main checkout;
do not alter the source of a running qualification experiment.

Archive the entire reviewed population byte-identically before replacement and
verify its bounded history chain. Re-establish whole-task freshness only where
the literal fixer wrapper and source-writing implementation, or persistent
service command and declaration, remain unchanged and caching is disabled.
The census command digest binds the complete workspace script map; it does not
prove command equivalence. Keep pure counterparts and all other computations
pending. Returning to the retained population is the data-only reversal; preserve
the newer evidence and change no runtime cache policy or qualification record.


### Retain the enabled global configuration layout, 2026-11-02

- Keep `futureFlags.globalConfiguration` enabled, preserve the root `global`
  block and its six current input paths, and keep root-only global settings out
  of child configurations. The source review binds all 26 actual child files.
- Use the exact stable/canary native controls to distinguish global-hash files
  from per-task global-input projection, restoration and child invalidation.
  The tested child negation does not remove the global input on either pin;
  do not promise a narrowing optimization from the documentation alone.
- This is a no-change feature decision. It grants no task qualification,
  broader graph-family acceptance, production activation or measured savings.
  Any real input removal or client/layout change needs renewed evidence.
- Reverse by reverting this research decision and registration, preserving the
  original failed and passing receipts. Runtime configuration is unchanged.


### Preserve selection history while replaying current pins, 2026-11-02

- Keep the original selection report and its immutable source/pin bindings.
  Use the reviewed current client manifest for a separate 44-case replay, and
  require a compatibility replay against the historical pair before replacing
  the driver interface. Never relabel older-canary observations as current.
- Reuse the existing streaming collector. An owned process wrapper preserves
  the stricter ten-second process and three-minute experiment ceilings; new
  reports use exclusive creation and raw output uses private unique directories.
- A synthetic replay grants no actual-root review, feature acceptance or task
  qualification. Preserve the 27 pending feature decisions and all production
  settings. Real consumer and tuple evidence remain required.
- Reverse by reverting this driver/registration change while retaining both
  report generations and the historical Git source. Runtime policy is unchanged.

Selection replay inputs use canonical checkout paths and repository-contained
pin manifests. Bind parsed pin bytes and executed harness bytes from the same
captured snapshots; verify those snapshots against disk before and after the
controls. Retain source-change refusals and symlink-path regression evidence
without replacing the earlier source-bound observations.

Evidence helpers extracted by sibling drivers retain their explicit loading
contract. Keep the historical self-contained `invoke` definition available to
the five existing AST callers, including Cargo applicability's reviewed stdout
adaptation; route current selection through its separately named streaming
helper. Test the real sibling preludes and process bounds before publishing a
change to that shared source. Preserve historical report hashes against their
original immutable whole-driver source, and bind new observations separately.


### Retain absent Turbo exporter configuration, 2026-11-02

- Keep the absent `experimentalObservability` flag and exporter configuration.
  The tracked repository has no named Turbo exporter consumer; use structured
  summaries and bounded backend events for the existing attribution work.
- Follow the exact client behavior: disabled file settings are dropped, while
  environment/CLI settings require the flag. The bundled prose does not describe
  that difference. Preserve the failed first expectation and pinned-source proof.
- Reopen for a named measured requirement after actual payload capture, synthetic
  secret/path/content safety, separate credentials, bounded labels/volume/retention
  and a disable path. Synthetic default controls grant no exporter safety, task
  qualification or production benefit. Reversal reverts this decision record;
  runtime settings remain unchanged.

### Explicit lane scope and pinned filter composition, 2026-11-02

- Interpret selector combinations against the configured exact clients. With
  the current enabled task-level flags, the affected set intersects positive
  filters; multiple positive selectors still union within that intersection.
  Preserve executable prerequisite closure and verify negative filters and
  `--only` separately. Do not infer behavior from an older comment.
- The labs lane deliberately runs its full set under the existing workflow
  path gate. Correct the false widening rationale without changing lane argv,
  replay parity or claiming a newly narrowed hosted proof.
- Synthetic plans and source review grant neither real computation qualification
  nor final feature acceptance. Reopen runtime changes only with the complete
  current caller, tuple and hosted evidence. Reverse this research/comment wave
  through a reviewed Git revert, retaining the native reports.


### Retain absent prune global-file copying, 2026-11-02

- Keep `futureFlags.pruneIncludesGlobalFiles` absent. The bounded tracked-source
  review found no named production Turbo prune caller. Classify ordinary Git,
  Docker, retention and directory-walker pruning separately.
- The exact stable/current-canary fixtures show global-file copying only with
  the flag enabled in both legacy and global configuration layouts, including
  both Docker output trees. Frozen offline installation and explicit missing-file
  refusals establish fixture input presence; no real pruned build was executed.
- Reopen for a named consumer with actual global-input and sensitive/ignored-file
  rules, pruned build, portability and qualification controls. Keep the broad
  pruning/deployment rows and every whole-goal acceptance criterion pending.
- Reverse through a reviewed Git revert of this decision and registration,
  retaining the observations. No runtime setting or deployment changes.


### Native watch applicability, 2026-11-03

Retain the absent `watchUsingTaskInputs` flag for the reviewed tracked callers.
The root development command runs `turbo run dev`; four manifest scripts name
Bun's watcher, while the other matching source lines are prose or declared
Yeet input paths. No configured native Turbo watch consumer was found. This is
a scoped feature disposition, not execution, hot-reload or qualification proof.
A named native watcher reopens the decision with complete input, file-event,
persistence, output-loop and portability controls on both exact clients. Watch
cache writes require their own qualification. Reverse this evidence/decision
registration without changing runtime configuration.


### Source inventory after T3 and root-task changes, 2026-11-03

Refresh the native static census at accepted source `fae5b2098c`: 191 workspaces,
115 root scripts, 4,459 graph nodes and 2,400 executable computations. Account
for 47 removed and 13 added computations from source, retaining all historical
reviews. Whole-workspace script-map digest changes alone do not establish
literal operation changes. Revalidate 197 surviving keep-fresh decisions by
exact command/implementation and disabled-cache checks; explicitly review the
new Party fixer, yielding 186 source-mutating fixers and twelve persistent
services. Their pure counterparts remain unqualified.

Keep the five original qualification exclusions and all other native reviews
pending (2,202). Retired entries are source removals, not a scope waiver. The
two unresolved entrypoint obligations and non-Turbo/nested execution coverage
still require review. Census, review and archived bytes grant no runtime,
qualification, adoption or whole-goal acceptance. Reverse publication by
restoring the byte-identical prior snapshot as historical evidence; preserve
that archive and rerun source-bound inventory before treating it as current.


### Current feature pair and canary-only permission hashing, 2026-11-03

Refresh published metadata, native binary identities and documentation for
stable 2.11.10 and current canary 2.11.11-canary.1. Preserve the earlier pin file
byte for byte and keep every historical semantic report bound to its actual
client/source envelope. Configuration parsing alone grants no feature or task
qualification. The installed repository client remains stable 2.11.10.

The current canary declares `hashFilePermissions`, absent from stable. Include
this canary-only feature in the matrix rather than assuming stable/canary flag
parity. Native dry runs must accept both settings on canary, refuse both on
stable and execute no task. Keep it disabled: executable-bit, other-mode-bit,
symlink, Unix/Windows, cross-worktree and epoch/hash invalidation evidence is
required before any profile-specific adoption. Adding this unfinished decision
raises the complete matrix to 36 entries with 25 pending, retaining 11 prior
scoped reviews. No prior result is transplanted to a different binary.

Reverse this metadata refresh by restoring the preserved pin file and prior
matrix while retaining the discovery/observations. No credential, runtime,
configuration flag, dependency version, cache epoch or cohort changes here.


### Linux permission-hash observations, 2026-11-03

Keep the canary-only `hashFilePermissions` flag disabled while its qualification
remains incomplete. A source-bound driver records 132 offline native dry runs
on stable 2.11.10 and canary 2.11.11-canary.1 across non-Git, unstaged Git and
staged Git fixtures. Assert regular-file executable-bit invalidation only with
the canary flag enabled, ignored non-executable mode bits, content invalidation
and repeatability. Omit the unsupported key entirely on stable.

Record symlink inclusion, target mode and equal-content target changes as
observations. Stable non-Git planning omits the three alias cases; alias
relationships differ by version and Git state. Linux symlink-own-mode variation
and Windows behavior were not proved. Output restoration, cross-worktree
portability, real computations and hash/epoch qualification remain required.
The feature row stays pending; no dependency, flag, cache or cohort changes.
Reverse this evidence registration without changing runtime configuration, and
retain the immutable observations when a later source/version is reviewed.


### Bind native observations to captured input bytes, 2026-11-03

Read pin, collector and schema bytes once, parse those bytes and record their
digests. Reject a changed source before client selection and after observation.
Review found that a later digest read could otherwise describe different bytes
from those parsed. Apply the same repair to the permission availability and
shared flag availability drivers; keep the bounded collector function unchanged.

Retain the original reports and exact prior checkpoint with their published
source head. Fresh 60, four and 132-case dry-run observations replace no historical
results. Six controlled source changes must refuse before client selection; the
legacy prefixes lack that refusal. No task body executes, feature/tuple is
qualified or runtime setting changes. Reverse the driver/registration wave
through Git while retaining both source envelopes and their observations.


### CI doctor timeout phase diagnostics, 2026-11-03

The actual second policy attempt on #2688 failed both the inherited
ClaimElement effect-vitest policy and a 900-second knowledge-doctor timeout.
The first attempt's runner-loss attribution applies only to that attempt.
The new capture tail correctly retained the normal non-mint gate-selection
output; it did not identify the stalled doctor phase or a permission failure.

Use fourteen fixed phase messages on CI stderr in the live doctor check. Keep
ordinary local output, report stdout, the command deadline, ordered operations,
error propagation and all seal/mint gate rules. No file contents, paths, refs,
identifiers, tokens, environment values or per-document messages are logged.
This prepares the next hosted execution to identify a phase; it does not claim
the timeout is repaired. Reverse by removing these phase emissions while
retaining the actual timeout evidence and its unresolved hold. No local quality
suite, generator, new runner capacity or paid service is authorized by this
diagnostic change.


### First cached history read diagnostic, 2026-11-03

Review of #2688 showed that the scan consumes cached path-removal history
inside its report grouping. Move the `read-removals` phase and first read ahead
of the scan, and keep the later baseline consumer on that same value. This
supersedes the earlier operation-order statement only for this optional cached
read. Keep its query arguments, fallback, cache, report and gate rules. All
fourteen fixed labels and their 564-byte bound remain; no per-document output
or new quality operation is introduced. Reverse by moving this cached read
back while retaining the review finding and unresolved timeout evidence.

### Refresh the accepted population without carrying stale grants, 2026-11-03

Use Cache's source-bound census at accepted main `31e2ac20f3`. Retain the prior
population byte-identically before replacing the current review queue. Check
every prior literal keep-fresh operation against its current manifest and
effective configuration; review the three new package fixers explicitly. Keep
all pure counterparts and other computations pending, preserve the original
qualification records and leave every runtime flag unchanged.

Consume the CI lane economics owner's preview with its source and measurement
limits. The window-4 preview used the old layout before the listed repairs and
measures no speed-up from those repairs or Turbo. The missing final full-week
verdict is not an implied pass. Reverse this
registration through Git to the retained population and reports. Historical
receipts and qualification evidence keep their original source and authority.


### Explicit service, fixer and live-audit boundaries, 2026-11-03

- Keep `@beep/beep-effect-web#dev` fresh: its portless Vite process is a
  persistent service. Cached completion cannot restore the running server.
- Keep `@beep/beep-effect-web#lint:fix` fresh: its literal alias reaches
  `biome check . --write`, whose source mutation must execute.
- Keep `//#repo-sanity:bun-audit` fresh: its existing owner reads current time
  for ignore expiry and invokes the live vulnerability audit. Source identity
  cannot establish that the external advisory set is unchanged. The lane-proof
  owner already explicitly excludes this lane from reuse.
- Existing effective caching is disabled for all three. Review and qualify
  their named pure prerequisites independently; these whole-task decisions
  confer no prerequisite or hosted-status authority. The source-bound review
  records the six-file accepted-Git comparison and unchanged qualification ledger.
- Reverse only these three population decisions using the report's prior Git
  revision. No runtime setting or trust boundary needs reversal.


### Refresh the installed fleet scanner, 2026-11-03

- The workstation scanner still used the original enrollment source after
  accepted #2669 moved policy code to `@beep/repo-cli-kit`. Its read-only plan
  incorrectly classified four current checkouts as legacy. Apply the existing
  accepted scanner source, preserving compatibility with both policy locations.
- Bound this maintenance to one installed source file on this workstation,
  under 64 KiB combined source bytes, with zero service restarts, cloud or
  artifact requests. Retain and verify the original source backup before the
  atomic replacement. Client/backend configuration and the ordinary adapter
  remain unchanged; no enrollment, signing or qualification is activated.
- Actual read-only discovery changes 5 legacy / 33 planned checkouts to
  1 legacy / 37 planned. Source-capable read-write entries increase from 22
  to 26. These counts establish recognition, not an artifact read/write result.
- Reverse only the installed scanner using the verified backup or named prior
  accepted Git source, with mode 0700. The receipt retains numeric bounds,
  source identities, current local adapter observations and remote evidence gaps.


### Enumerate nested script entrypoints without inventing executions, 2026-11-03

The configured dry-run graph is not the whole manifest-script population.
Keep its 2,436 executable rows and 2,092 graph-only nodes unchanged, and join
both pinned clients' complete query catalogue to all 4,235 manifest scripts.
Explicitly retain the additional 1,799 script-only entrypoints for semantic,
caller and pure-boundary review. A literal `bun run <script>` invocation edge
does not grant semantic equivalence, execution, qualification or cache reuse.

Bound this metadata observation to one process at a time, twelve seconds and
one MiB stdout per query, sixty-four KiB stderr, thirty seconds aggregate and
zero repository task bodies. Verify the 458 census source bindings before and
after capture. Keep raw bounded captures private, preserve refusals and publish
only source identities and the complete normalized inventory. Reversal removes
this supplementary inventory projection; runtime and qualification are unchanged.

### Bind signature-key observations to captured inputs, 2026-11-03

Extend the existing selection/permission source-binding rule to the signature-key
driver. Parse the captured pins and bounded-collector bytes, hash those same
bytes, include the captured Bun version pin, and refuse source movement before
native client selection. Reject an external pin manifest before reading it.
Keep the final source guard and existing native experiment budgets unchanged.

Thirteen metadata-only prefix controls reproduce four legacy false bindings,
prove six current source-movement refusals and the external-pin refusal, and
preserve two unchanged-input controls. Version probes are stubs; no real child
process, native client or task body runs. The original 168 native cases retain
their original source binding; current-driver semantic replay stays pending.
The feature and all qualification/rollout gates remain pending. Reversal is a
reviewed Git revert of the driver and registrations, retaining both evidence
envelopes. See `research/signature-key-source-binding-repair.json`.

Use one existing admission token to replay the same 168 offline synthetic cases
after the source repair is pushed. Keep the existing 600-second whole-run,
20-second per-case, 1-MiB stdout and 64-KiB stderr bounds. Expose no production
credentials or network, execute no repository quality task, and write exclusive
private captures. Fresh observations retain their new source envelope; the
historical report stays immutable. Reversal removes only the new observation
references while retaining both reports. Feature and tuple acceptance remain
separate from this replay.


### Actual source-bound signature replay, 2026-11-03

The admitted replay completed all 168 cases in 3.809 seconds: 162 isolated
fixture tasks executed and six supplied-key length cases refused before their
task. This is separate from the thirteen prefix controls, which execute no
native client or task. Both pinned clients reproduce the historical semantic
rows. Source digests still match; all 336 raw stdout/stderr capture digests and
bounds were checked, totaling 46,878 bytes. One existing admission token was
admitted and released; recorded peak memory was 278,233,088 bytes.

Register `research/signature-key-sourcebound-native-replay.json` and its new
native report without replacing historical bytes. The isolated endpoint was
unavailable and no production credentials or cache traffic were used. Missing
keys still permit task execution with a signature warning, so role-policy
qualification remains necessary. Signed transport, protected producer proof,
feature adoption and every whole-goal acceptance criterion remain pending.


### Complete the related native source-capture repair, 2026-11-03

Audit the related native experiment drivers as one wave. Bind parsed pin, helper
and Bun-version bytes to the same captured bytes and reject movement before
version probes. Preserve each experiment's collector function, bounds, task
semantics and historical reports. Confine optional pin manifests before reads.
Use disposable metadata-prefix controls with version queries stubbed and real
subprocesses refused; they grant no native replay or feature qualification.
Keep historical observations bound to their original drivers until a separately
admitted replay records new evidence. Reverse through Git while retaining both
source envelopes and reports; no production setting or credential changes.


### Opened-descriptor containment, 2026-11-03

The review identified a valid replacement race after a pathname containment
check. Reuse the existing bounded-reader owner for a source reader that opens
with no-follow and nonblocking flags, checks the kernel-reported descriptor
path inside the checkout and regular-file status, then reads at most one MiB.
Hash and parse those captured bytes. Revalidation also verifies its opened
descriptor; never read an external redirect merely to compare its digest.
Twenty controlled legacy replacements read synthetic external bytes, while
twenty repaired leaf/parent replacements refuse before external reads. Record
the 208-case actual-reader and 13-case stubbed binding controls separately.

This change invalidates current-driver semantic replay claims for its affected
source envelopes. Preserve the earlier 168-case signature replay as historical,
with its exact original digests. Fresh native evidence remains pending. No
qualification, key, signed epoch, cache setting or production cohort changes.


Containment applies to pin manifests. Fixed dependency metadata can resolve
through the approved shared install outside the lane; preserve its captured
bytes and digest checks without imposing pin-manifest containment on it. The
actual dependency schema/docs resolve outside this worktree. Include that
shared-doc symlink in the metadata fixture alongside all pin replacement
negatives. Reversal preserves the pin fence and restores only the overbroad
dependency read restriction.


### Bounded repaired-driver native replay, 2026-11-03

Replay all thirteen affected native experiment drivers after the source repair
is pushed. Use one existing admission token and sequential execution, at most
ten minutes total and one minute per experiment, retaining each driver's
existing per-case/stream limits. Use fresh private output paths, isolated
synthetic fixtures and credentials, no repository quality suite and no real
cache traffic. Retain at most 16 MiB of compact publication evidence; preserve
raw captures privately under their existing bounds. Stop on the first failure
and retain partial evidence rather than repeating or overwriting it. This is
native semantic evidence only; feature and tuple qualification remain separate.


### Isolated native boundary-checker controls, 2026-11-03

Use twelve disposable workspace shapes on both existing exact client pins to
exercise declared/undeclared imports, relative package escapes, dependency and
dependent tag rules, package-name rules and transitive denials. Reuse the
captured availability driver's bounded collector and contained pin reader.
Retain the one existing token, 60-second wrapper, 20-second subprocess,
256-KiB per-command retained output, four-MiB aggregate raw and two-MiB compact
report bounds. Isolate the network; provide no host secrets. Fixture-only
offline lock generation ignores lifecycle scripts. Beep task bodies, quality
suites and live configuration remain outside this experiment.

Require the expected diagnostic class for negative outcomes, unchanged fixture
inputs, source/tool hashes before and after execution, and removal of owned
fixtures. Preserve earlier observations under their original driver bytes.
This supplies synthetic semantics, not a real-repository adoption decision or
a task/profile qualification. Reverse the registration through Git while
retaining the observations; production settings need no rollback.


### Isolated native Git worktree sharing controls, 2026-11-03

Use disposable main/linked Git worktrees on both frozen native clients. Exercise
implicit local sharing in both directions, changed-input misses, explicit
cache-directory isolation, same-worktree replay, and an absolute-output-path
counterexample against a fresh consumer execution. Run only tiny fixture task
bodies; do not use Beep tasks, real checkout caches, remote transport or secrets.

Reuse the captured availability collector and contained pin reader. Use one
existing admission token, a 60-second wrapper, 20-second native subprocess
deadlines, 256-KiB command streams, four-MiB total retained raw evidence and a
two-MiB compact report. Isolate the network. Fixture-only offline lock generation
ignores lifecycle scripts; Git uses a private fixture identity and no hooks.
Require unchanged inputs and source/tool digests, actual HIT/MISS and task-body
markers, complete output-file/mode and task-log comparisons, raw-summary joins
and owned fixture removal. Stop on the first failure and retain partial output.

This supplies synthetic local semantics, not independent-clone/remote-box proof,
real computation/profile qualification, a feature adoption decision or measured
production savings. Reverse the registration through Git; no live setting or
cache activation requires rollback.


The worktree fixture also includes an observed permission counterexample:
under private umask 0077, an explicitly chmodded 0755 output is restored as
0700. Require that exact mismatch and a fresh consumer control returning 0755
on both pinned clients. Separate it from the positive owner-only 0700 output
controls; never accept bytes-only equality as full metadata equivalence. This
extends the bounded matrix to 36 tiny invocations, without changing its token,
time, retention or isolation limits. Both counterexample families keep real
portability and permission-sensitive computation qualification open.


### Unconditional native-driver startup refusal, 2026-11-03

Before parser, fixture, source, tool or report work, both new boundary/worktree
drivers must unconditionally reject disabled assertions or a non-Linux platform.
An assertion cannot guard assertion-dependent evidence because optimized Python
removes it. Preserve the refusal message and apply the same existing experiment
bounds. Optimized flags/environment and simulated platform branches must create
no output parents. Normal guarded replays retain their exact source envelopes;
old reports remain historical and no feature/task qualification is promoted.

### Prepare the signed native minimum-key safeguard, 2026-11-04 UTC

The trust-owned signed overlay must include `longerSignatureKey: true` and
its projected identity must bind that exact flag. Consume the source review at
`../turborepo-cache-trust-observability/research/signed-key-floor-review-2026-11-04.json`.
This prepares the named signed pilot consumer using the recorded native
32-byte-boundary behavior; it changes no root flag or live cache setting.
Keep the feature pending until current hosted, signed remote and rollout
evidence satisfy its remaining gates. Missing-key roles and protected producer
authority remain independent. Suspend affected candidate tuples before a
reviewed revert; do not relabel historical qualification for the new overlay.

### Preserve source during generator checks, 2026-11-03

The HTML and label-glyph `generate:check` entrypoints must compare freshly
rendered, project-formatted content without writing a target or creating its
parent directory. Reuse CodegenKit drift reporting and add a project-format
path while preserving the OpenAPI formatter's existing defaults. Treat a
nonzero formatter exit as a typed failure. Keep ordinary generation unchanged.
The isolated CI regressions preserve dirty bytes, reject missing outputs and
formatter failure, and forbid writes through the check's filesystem service.
No cache or qualification transition is included. If this repair must be
withdrawn, suspend the affected checks until repaired rather than restoring
the destructive generate-then-diff wrappers.

### Freeze the Storybook deployment install, 2026-11-04 UTC

Require `bun install --frozen-lockfile` in Storybook's existing Vercel installer.
Keep its full-monorepo working directory, build command and output directory.
This prevents deployment-time lockfile changes; it does not establish the
actual Vercel Bun version, deployment success or a qualified cache profile.
Reverse with a reviewed revert while retaining the source finding.

The source review names the actual Vercel, Alchemy and desktop build callers.
Keep pruning pending until a real app install/build and missing-input comparison
passes. Keep native boundaries pending until their package semantics are mapped
to the existing manifest/doctrine owner and aliases. A text scan proves neither
policy equivalence nor that a new tool has no useful application. Feature counts
and all whole-goal gates remain unchanged. See
`research/deployment-boundary-source-review-2026-11-04.json`.

### Align scoped proof comparisons, 2026-11-04

The existing Turbo config proof query supplies the requested base/head, but its
--affected dry runs inherited ambient/default SCM refs. Bind both query and dry
children to TurboConfigProofOptions.base/head through the existing runCaptured
environment, extending the tool environment. Reuse the existing schema/helper
and retain both selector modes. Add one hosted regression covering both modes
and all three captured commands per mode; do not run local quality suites.

This source repair grants no qualification or feature acceptance. Immutable
comparisons still require caller-supplied commit SHAs. Reverse the binding, test
and packet entries together; prior affected reports need independent actual-ref
evidence before reuse. Hosted proof remains pending.

The same proof reader also defaulted absent/malformed task arrays to empty
selections. Decode required query/dry envelopes through private schema-first
models, retain valid empty arrays, and return generic typed failures without
retaining native payload values. Four further authored regressions cover ten
malformed rows, explicit empty selections and three synthetic payload values.
No local unit suite runs; current hosted proof remains required.

A separately captured current-root observation uses direct pinned native
commands on accepted source31e2ac20, without invoking the proof wrapper. Eight
dry plans agree across both clients and selector forms: unchanged refs select
zero nodes; the actual accepted domain change selects the same28-node closure
containing @beep/law-practice-domain#check. This does not execute tasks or prove
semantic input completeness, safe outputs, cache reuse or qualification.

### Isolate the enabled selector flags, 2026-11-04

Extend the existing bounded, network-isolated filter driver with an optional
two-by-two selector-flag mode. Compare each flag false/true while holding the
other flag false and then true; keep globalConfiguration fixed. Both pinned
clients pass 320 explicit selection cases and 320 one-flag comparisons.

The controls falsify a simple independence assumption: either enabled flag
narrows --affected against declared task inputs, while a bare Git-range filter
follows filterUsingTasks and does not automatically include dependents. Keep
these measured distinctions in any later current-root or caller change.

This is feature evidence, without task execution, current-root qualification,
performance claims or activation. Preserve all 25 pending feature decisions and
all whole-goal gates. Revert the optional driver mode, its reports and evidence
links together to reverse this component; runtime configuration is unchanged.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug turborepo-quality-cache-adoption`; add a `kind: decision` file there, never edit this block._

### Count native query packages and bind prepared-source history, 2026-11-06

After accepted PR #2695, nonempty affected-query summaries still reported zero packages. Count distinct valid package.name identities with existing Effect helpers; retain the accepted optional-array codec fix. Extend the three-task/two-package and explicit-empty assertions for hosted CI without running local quality suites. Bind the initial SCM report explicitly to f48bf842, whose two recorded hashes match, and preserve every historical hash and native capture. Record the current repair source separately. This changes diagnostic metadata only and grants no qualification, signing, capacity or whole-goal completion.

Lane `codex/turbo-query-package-counts`

Reverse: Revert the package counter and its assertions while preserving historical source and native evidence.

<!-- beep:decisions:end -->
