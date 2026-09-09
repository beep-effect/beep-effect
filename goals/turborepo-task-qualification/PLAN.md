# Turborepo task qualification plan

## Status

Status: `active`
Lifecycle: `active`

Launched with `bun run beep goals set-status turborepo-task-qualification active`.
P0 refresh is recorded in [census-refresh.json](./research/census-refresh.json).
The user approved the program scope on 2026-09-08; no repeated shape approval
is needed.

## Phases

| Phase | Status | Work | Exit criteria |
| --- | --- | --- | --- |
| P0 Refresh and contract | in-progress | Refresh checkout, tools, scripts and source ownership. Specify the versioned qualification tuple and evidence requirements. | Reconstructable census and reviewed contract; no phantom executable nodes. |
| P1 Policy and discovery | in-progress | Implement pure policy/projection in repo-configs and discovery, transition checks and drift reporting in Cache. | Fixtures prove lifecycle legality, deterministic projection and pilot-only enforcement. |
| P2 Local pilot and shadow | in-progress | Exercise one synthetic fixture and @beep/identity#lint in one named profile; record reads, writes, logs and semantic perturbations. | Fresh comparisons and shadow evidence are attributable; legacy settings remain visibly unassessed. |
| P3 Signed replay integration | pending | Consume conformance/trust receipts and run the full isolated signed-replay protocol for the real pilot. | A real pilot qualifies with the required comparisons and shadow sample; unsupported profiles remain excluded. |
| P4 Verify and hand off | pending | Run package gates, command/fixture tests and the qualification replay suite; hand the population and policy API to adoption. | Acceptance and negative cases pass with versioned receipts and no unexplained divergence. |
| P5 Yeet: PR to mergeable | pending | Publish the scoped work through Yeet and resolve hosted failures and review threads. | Yeet monitor reports merge-ready: yes on the final head. |
| P6 Close | pending | Land final evidence, reflection and completed-retained lifecycle in the final implementation PR. | Same-PR closeout and all evidence links are present. |

## First action

Refresh the executable census and define the qualification policy shared by the pilot, conformance runner and adoption audit.

## Dependency gates

P0/P1 can begin immediately when this goal is launched. Conformance and trust
may consume the early qualification contract without waiting for this entire
goal to close. P3 consumes a passing signed-fixture/lab boundary from those
siblings. Do not declare that dependency satisfied from a source-only review.
Continue local fixtures and discovery while remote proof is pending.

[SPEC.md](./SPEC.md) governs authority and the [program map](../../explorations/turborepo-quality-cache/MAP.md)
governs handoffs. A sibling's accepted milestone can unblock work before its
whole goal closes.

## Evidence to produce

census and per-computation contracts; deterministic projection/diff reports;
input perturbation matrix; fresh/shadow/signed-replay receipts; profile/epoch
pins; package verification and final Yeet receipt.

Store compact receipts in research/history and large raw evidence in bounded
artifacts. Record source/tool/profile/epoch identity, command/case, result and
retention. Register new reports in the manifest. Record friction immediately
in [OPPORTUNITIES.md](./research/OPPORTUNITIES.md). Missing evidence is unfinished
work, not an implied pass.

## Verification and attribution

Apply the SPEC matrix to actual changes. Package editors run package-verify
before handoff. Attribute failures as introduced, inherited, unrelated or
environment-only before repair. Preserve dirty work and use canonical
admission/worktree workflows for heavy experiments.

## P6 closeout checklist

P6 preparation can occur during P5 so final reflection/lifecycle land with the
final implementation. Acceptance still requires final Yeet proof. Do not defer
closeout to an unrelated state-only PR.

1. Confirm every SPEC criterion and applicable representative observation.
2. Use the reflect skill and copied reflection template to record tooling
   friction, implementation opportunities and prompt critique.
3. Run `bun run beep lint reflection-artifacts`.
4. Update phase evidence and use
   `bun run beep goals set-status turborepo-task-qualification completed-retained` only once
   completion conditions hold, in the final implementation PR.
5. Regenerate/check the goal index and preserve exploration links. Completion
   of this goal alone does not establish the whole cache program's completion.

## Rollback and resume

Use SPEC's rollback at the affected boundary. Record the failed gate, remaining
work and safe resume action. Retain paused state with explicit conditions when
external evidence/authority is missing; do not label that pause complete.

## Implementation checkpoint: 2026-09-09

- Branch: `codex/turborepo-task-qualification`; unrelated initial dirty paths
  remain outside the implementation ownership list.
- Owned workspaces: `@beep/repo-configs`, `@beep/repo-cli`.
- [Qualification contract](./research/qualification-contract.md): initial
  versioned handoff; sibling remote receipt formats remain sibling-owned.
- [Executable census](./research/executable-census.json): 142 workspaces,
  2,840 configured graph nodes, 1,503 executable configured scripts, 2,695
  total workspace scripts, 106 entrypoint source files and 258 source digests.
  Expanded raw plans/reports stay under ignored `.beep/` and can be recreated.
- `beep cache census` uses the exact installed client with remote/local cache
  operations disabled, joins manifest scripts, preserves graph-only nodes,
  records effective settings and fingerprints expanded inputs deterministically.
- Initial `@beep/repo-configs/cache` facade models keys, pins, contracts and
  observations; pure promotion checks enforce independent matrices. Cache still
  needs operational receipt verification and the durable lifecycle writer.
- Tests: nine policy regressions, a schema-derived tuple serialization property,
  and three census join tests pass. Package
  verification for repo-configs passes audit and docgen. CLI package verification also passes audit and docgen;
  [verification receipt](./research/verification-2026-09-09.md). No final Yeet
  proof or pilot qualification exists.
- Next: finish nested CI/Quality/Yeet semantic review; add lifecycle/receipt
  operations and a scoped Quality drift gate; execute local fixtures and pilot
  evidence. Signed replay stays gated on conformance/trust runtime receipts.

## Governance checkpoint: 2026-09-09

- Cache now owns the reviewed baseline, explicit tuple ledger, optimistic
  state transitions, directory mutex and read-only policy audit. The zero-state
  ledger grants no qualifications; missing state fails closed.
- The real audit passes with zero findings and 928 unassessed cached
  computations. Source-only root/child changes are attributable; semantic
  config, nested script and dependency drift block reuse expansion.
- Six operational tests cover persistence, revision conflicts, competing
  writers, tampered/symlinked evidence and missing/malformed/duplicate state.
  Nineteen policy tests and the existing census/Quality-plan regressions pass.
- [Current static decomposition](./research/command-decomposition.md) includes
  40 top-level command groups, 65 nested wrapper definitions, 70 root scripts,
  69 CI variant plans and nine Quality mode plans. Dynamic and workflow-owned
  branches remain explicitly unfinished.
- [Governance verification](./research/governance-verification-2026-09-09.md)
  records this source increment: repo-configs audit/docgen pass (8.9s/4.7s),
  and repo-cli audit/docgen pass (359.5s/19.6s). No pilot is qualified and no final PR exists.
- Next P1 work: hosted repository-sanity audit route; durable transition
  history; live configuration/toolchain pin verification; then complete local
  receipt interpretation and fixture/pilot execution. Signed replay remains
  gated on accepted sibling runtime evidence, without source-only substitution.

## Runtime and exclusion checkpoint: 2026-09-09

- [Runtime verification](./research/runtime-boundary-verification-2026-09-09.md)
  records passing full package checks for repo-configs, repo-cli and identity.
  History integrity, bounded original-byte reads, native fingerprints and the
  hosted repository-sanity plan are implemented. A consuming Yeet expectation
  was repaired and the full CLI audit rerun successfully.
- P2 exploratory work found a successful lint warning that exposed a synthetic
  source canary. [The review](./research/unsafe-lint-review.md) excludes only
  identity lint; its child Turbo configuration disables cache reuse while
  preserving all inherited inputs and dependencies. Ledger revision is 1.
- A network-isolated fresh run and bounded process/file trace completed.
  The 16 MiB failed trace, main/linked-root input-map difference, and initial
  repair probes remain explicitly outside promotion-matrix counts.
- [The operator-requested sibling search](./research/sibling-evidence-search.md)
  covered local Codex/Claude histories and 112 checkout/worktree roots. No
  accepted signed-runtime receipt was found; the two sibling goals remain
  authored but unstarted. Independent local work continues.
- Next: implement the bounded, durable Cache fixture runner, finish the pilot
  repair and negative matrix, and bind observed local/shadow receipts to the
  transition mechanism. Keep P3 closed until accepted sibling runtime evidence
  exists. No final PR, qualified computation or completion claim exists.

## Local fixture checkpoint: 2026-09-09

The Cache-owned `cache synthetic` command now runs a dependency-free fixture
under existing admission and a network-isolated Linux sandbox. Separate exact
stable and canary experiments exercised local restoration, independent input
and configuration invalidation, fresh cross-root/concurrent comparisons, and
unsafe-log/overflow/failed-execution rejection. See the
[local verification report](./research/synthetic-local-verification-2026-09-09.md).
The local runner and receipts confer no signed-remote or promotion authority.

P2 remains in progress: the real identity lint capture repair, its full matrix
and shadow observations, and remaining mandatory synthetic runtime cases are
still outstanding. P3 remains gated on accepted sibling runtime receipts.

## Activation contract checkpoint: 2026-09-09

The read-only activation preview binds immutable disabled/enabled child
configuration artifacts and the full disabled fingerprint. It accepts only
the selected task's cache flag change. Candidate/shadow policy now requires
ordinary reuse to remain disabled, including under a previously cache-enabled
legacy baseline. Promotion requires per-client activation-invariance evidence.

The [activation report](./research/activation-verification-2026-09-09.md)
records passing focused and final package checks and passing exact-stable
native Turbo configuration parity. The temporary workspace child configuration
and tool aliases were removed; the main disabled file is unchanged. This contract does not
activate the pilot or interpret remote receipts. The ledger remains revision 1
with identity lint excluded. Both sibling goals remain unstarted; a proposed
launch in isolated tasks awaits the operator's answer. Independent local work
continues.

## Dynamic census and capture-repair checkpoint: 2026-09-09

The v2 [entrypoint review](./research/dynamic-entrypoints.md) repairs omitted
step environments and records clean local/hosted-context plans. Each context
includes 69 CI plans, nine Quality modes, 15 partition argument plans and four
local dispatch shapes, plus documentation-selection examples. Dynamic CI
source review now covers partitions, Docgen, Doctest, Fallow, local dispatch,
the Heavy wrapper and both CI-native descriptors. Operational census
integration and the remaining Quality/Yeet/workflow review are still required.

The subsequent [Quality/Yeet review](./research/quality-yeet-entrypoints.md)
adds 30 branch/mode plans per clean context, preserves complete operational
schemas and records interpreter-only pre-push/review-fix dispatch. Lane-proof
reuse, virtual-tree identity, skipped execution, publication ordering and
live hosted authority remain distinct. All four CI/Quality/Yeet snapshots
regenerate byte-identically. The remaining work is operational census
integration, deeper nested interpreter coverage and workflow/action boundaries;
these source snapshots grant no runtime or qualification credit.

The [quiet lint preflight](./research/quiet-lint-preflight.md) uses a second
owned isolated worktree. The first native and quiet probes failed before their
intended comparisons because of missing service composition, proposal-file
formatting and incompatible Turbo flags. Those setup defects are repaired;
both reruns await admission. The main lint script, excluded ledger state and
cache-disabled posture are unchanged. Apply a capture repair only after a
successful baseline and the negative-case results support it.

The native rerun has now passed. The quiet rerun passed all six direct exit
and capture checks and five stable-client graph cases, then stopped because
the invalid root config failed a dependency and omitted the selected task.
The probe now records that attributed omission as not executed; its complete
stable/canary rerun awaits admission. No complete-matrix or activation-invariance
claim is made from the partial evidence.

## Expanded synthetic and workflow checkpoint: 2026-09-09

The [v2 synthetic runner](./research/synthetic-local-v2-verification.md) adds
three independent fresh/fresh pairs in total, fresh orchestration invariance,
explicit execution metadata checks and separate absent-script observations.
Formatting and schema-first checks pass. The current CLI package gate passes
audit in 381.7 seconds and docgen in 19.8 seconds. Exact stable/canary runtime
experiments remain pending; earlier runtime receipts are historical for the
three changed source files.

The [workflow review](./research/workflow-boundaries.md) preserves all nine
workflows and the composite setup action through the shared YAML decoder.
The 28 job definitions and 171 step definitions regenerate byte-identically;
they are not executions or expanded matrix counts. Provisioning, dependency
archives, Turbo archives/artifacts, external security verdicts, measurements
and publication remain distinct. Operational census integration and candidate
runtime evidence still remain; the parsed source grants no qualification.

The [SCM device preflight](./research/scm-device-preflight.md) attributes an
environment defect in the original linked-worktree trace: its sandbox denied
reads from `/dev/null`, preventing Git discovery. A controlled metadata check
succeeds with a proper device mount. The admitted paired dry run also passes
and attributes the three extra root-config inputs to that mount defect. The
old trace grants no cross-root portability credit; current synthetic and
quiet-lint probes already provide a device mount.

## Local results and census integration: 2026-09-09

Both exact clients pass the expanded synthetic suite: 21 runs, one separate
absent-script observation and 16 checks each. The complete quiet-lint preflight
passes six direct pairs and five selected-task executions per client, with
invalid configuration attributed to a dependency failure before identity.
The verified quiet script is applied. `@beep/identity` joins the owned
workspaces and passes its full audit/docgen gate. Its tuple remains excluded
at ledger revision one, and caching remains disabled.

The baseline writer records the exact one-script repair and existing cache
disablement. Eleven identity records inherit a new complete-script digest;
the other commands/settings and the population are unchanged. The refreshed
audit has zero findings and 927 unassessed cached computations.

The source-reviewed census now attaches six complete documents, 274 verified
source bindings and five authored reviews through `--entrypoint-review`.
It preserves 142 workspaces, 2,840 graph nodes and 1,503 executable nodes.
Missing/stale sources, duplicate references, malformed data and symlinks are
rejected. The full parsed documents retain environments and owner fields;
the attachment has source-only authority and keeps six explicit review/runtime
obligations. The initial focused suite passes 24 tests; the expanded seven-test
attachment suite also passes its schema-derived JSON preservation property.
Schema-first passes with zero advisories. The introduced docgen example import
and test-facade export ordering are repaired. The final full CLI package gate
passes audit in 377.4 seconds and docgen in 18.1 seconds, bound to the current
nine-file source checkpoint. Packet checks pass with no new blocking findings.

The paired SCM dry probe also passes: mounting a working `/dev` restores Git
metadata and exactly matches the historical main input maps/task hashes.
This explains the initial sandbox mismatch, not portability of the repaired
task. The full real-pilot matrix, remaining synthetic perturbations, signed
sibling integration, shadow evidence, adoption handoff and final Yeet proof
remain required.

The repaired manifest's live source fingerprint and read-only activation
preview are refreshed. An isolated exact-stable native parity rerun for that
new source is queued through the existing admission route; it cannot supply
task execution or activation-invariance credit by itself.

## Main integration: 2026-09-09

The operator requested committing the current work and merging current main.
Implementation commit `f85bbe2760` preserves the pre-merge qualification
checkpoint. The merge imports main `85cc86d1f3`, including Bun 1.4.2, dependency
updates and the generated workspace-script contract. Existing qualification
receipts remain historical for their recorded source/toolchain fingerprints;
refresh the census, reviewed baseline and pilot contract before new acceptance.

Identity keeps `cache: false` and its excluded ledger entry. Its generated
`lint` wrapper now invokes the quiet `beep:lint` implementation. The original
verbose Biome command remains available as `beep:lint:verbose`, and its package
audit uses that verbose command. This preserves diagnostic access while
complying with the imported task-wrapper policy. The canonical package-script
check reports 142 manifests, zero drift and zero writes. This integration
requires a fresh capture/exit matrix; earlier repair receipts do not establish
equivalence for the new wrapper or Bun version.
