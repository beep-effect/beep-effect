# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-09-04 — packet shape and stage authority

**Question:** Should this begin as one implementation goal or as a stage-gated
exploration?

**Answer:** Open one umbrella exploration named `turborepo-quality-cache` and
enforce explicit research, alignment, shaping, decomposition, and graduation
handoffs. Stop after research at the alignment gate in this implementation
session.

**Rationale:** The task combines correctness, security, CI economics,
infrastructure, and backend selection. Opening implementation goals before the
evidence and ownership boundaries are ratified would make speculative choices
look authorized. Rejected: one monolithic implementation goal and immediate
configuration changes.

## 2026-09-04 — production, canary, and upstream authority

**Question:** Which Turborepo versions may govern production decisions?

**Answer:** The repo's exact stable release is production authority. The exact
published canary is tested in isolation. Unreleased upstream `main` is a
research appendix only. Every upgrade is requalified against its exact release
and future/experimental flags are introduced one at a time.

**Rationale:** Published canary behavior and upstream-main behavior can diverge,
and neither should silently change the production contract. Rejected: treating
`main` as the canary, floating tags, and adopting multiple experimental flags
at once.

## 2026-09-04 — evidence-neutral backend selection

**Question:** Should the packet preselect Bruno, Ducktors, or the incumbent AWS
service?

**Answer:** No. Freeze a differential conformance rubric first and select only
after an evidence-producing lab compares the incumbent and eligible candidates.
A replacement must pass every hard gate and show a material win: a lead of at
least 10 weighted points, an improvement of at least 20 percent on a declared
decision metric, or removal of a proven blocker without regression.

**Rationale:** Self-hosting interest is a hypothesis, not a backend decision.
Rejected: feature-count selection, forced ranking despite unknowns, and a
migration justified only by implementation novelty.

## 2026-09-04 — conformance lab boundary

**Question:** Where does the disposable AWS comparison lab belong?

**Answer:** Designing the corpus, rubric, threat model, and required evidence
belongs in this exploration. Deploying and operating the lab belongs in a
graduated implementation goal. The initial capacity envelope is derived from
measurements, defaulting to twice observed p99 artifact size and 1.5 times
observed peak concurrency until evidence justifies another bound.

**Rationale:** A lab deployment mutates infrastructure and deserves explicit
goal authority, teardown proof, and budget controls. Rejected: production
probing as the benchmark and arbitrary oversized load generation.

## 2026-09-04 — cache trust model

**Question:** What integrity and producer-trust mechanisms are required?

**Answer:** Require native Turborepo HMAC artifact verification plus protected
workflow producer receipts. Do not add asymmetric attestation unless a
concrete consumer requirement or demonstrated gap survives the lab.

**Rationale:** Native HMAC protects artifact integrity and authenticity for a
shared-key domain, while workflow receipts cover operational provenance. They
do not prove task-input completeness or confidentiality. Rejected: treating a
valid MAC as exact-main attestation and building PKI preemptively.

## 2026-09-04 — credential and rotation topology

**Question:** Who may read, write, and verify signed artifacts?

**Answer:** Keep read and write bearer tokens distinct. Approved CI readers and
workstations receive the signature key; only protected trusted writers receive
write authority. A reader missing its required key falls back to attributable
local-only execution. A trusted writer or canary missing the key fails hard.
Rotate signature material by namespace epoch rather than pretending native
dual-key verification exists.

**Rationale:** Verification-key holders can forge HMACs offline, so upload
authorization must remain independent. Epochs make rollback and mixed-fleet
behavior explicit. Rejected: broad write tokens, unsigned downgrade, and an
invented atomic in-place rotation.

## 2026-09-04 — qualification unit and states

**Question:** What exactly earns cacheability?

**Answer:** Qualify each computation independently for each reuse layer and
environment envelope. The lifecycle is `unassessed`, `excluded`, `candidate`,
`shadow`, `qualified`, or `suspended`; configuration never upgrades the state
by itself.

**Rationale:** Turbo task-result reuse, GitHub transport of `.turbo/cache`, and
Yeet lane-proof reuse have different semantics. Rejected: task-name heuristics,
duration-only decisions, and a single global cacheable boolean.

## 2026-09-04 — evidence required before enablement

**Question:** What evidence is enough to move a computation to `qualified`?

**Answer:** Require at least three isolated fresh/fresh comparisons and three
fresh/remote-hit comparisons per supported profile, independent perturbation
of each semantic input class, portability/concurrency/log-safety checks, at
least ten representative shadow decisions, and zero unexplained divergence.

**Rationale:** Hits are valuable only after observational equivalence and
invalidation are demonstrated. Rejected: one successful replay, archive
restore as hit evidence, and silent normalization of unexplained differences.

## 2026-09-04 — computation boundaries and hosted proof

**Question:** Should whole quality lanes be cached?

**Answer:** Cache the lowest pure computation that has a complete replay
contract. Keep volatile verdicts and required external observations fresh
while allowing their qualified pure prerequisites to hit. Required hosted jobs
must still start and emit their own exact-head or merge-ref statuses.

**Rationale:** Reuse must not suppress required observations, mutations, job
statuses, or Yeet orchestration. Rejected: treating local proof or a restored
archive as hosted proof, and skipping an entire lane because some prerequisites
are reusable.

## 2026-09-04 — adoption order and portability

**Question:** Where should qualified reuse be enabled first?

**Answer:** Prove local behavior first, then a named hosted cohort, then broaden
only inside the demonstrated environment envelope. Linked-worktree sharing is
allowed only after cross-root portability evidence passes.

**Rationale:** Absolute roots, runner classes, toolchains, concurrency, and
filesystem behavior can invalidate otherwise deterministic artifacts.
Rejected: universal cross-platform claims and immediate fleet-wide rollout.

## 2026-09-04 — observability and economics

**Question:** Which signals and outcomes should drive optimization?

**Answer:** Start with stable Turbo summaries, bounded probes, server events,
and correlated structured receipts. Keep experimental OpenTelemetry behind a
captured-payload safety gate. Evaluate value per reuse layer in this order:
correctness and security, critical-path time, reliability, cost, then hit rate.
Use an evidence-derived warmer rather than a static guessed task list.

**Rationale:** Hit rate alone can reward unsafe or useless reuse, while
high-cardinality telemetry can create a new security and operations problem.
Rejected: a telemetry platform before proving the minimum signals and warming
every task indiscriminately.

## 2026-09-04 — backend rollout and rollback

**Question:** What rollout is acceptable after a backend is selected?

**Answer:** Require a seven-day non-production soak, a seven-day named cohort,
and a fourteen-day broader observation window. Retain the incumbent as a
rehearsed rollback target throughout the cutover window.

**Rationale:** Cache data is disposable, but an ambiguous or irreversible
cutover is not. Rejected: big-bang migration and incumbent retirement before
rollback evidence.

## 2026-09-04 — durable conformance and governance artifacts

**Question:** What should remain after the initial audit?

**Answer:** Keep a generated OpenAPI baseline plus hand-authored semantic and
adversarial cases as a reusable exact-version upgrade gate. Project the
qualification ledger into a durable enforced configuration surface. Commit
compact evidence and retain large raw traces only as bounded artifacts.

**Rationale:** OpenAPI describes wire shapes but cannot prove authorization,
tenant isolation, failure attribution, client fallback, or task correctness.
Rejected: one-off screenshots, raw log archives in git, and an advisory-only
spreadsheet that drifts from configuration.

## 2026-09-04 — research breadth and session freshness

**Question:** How broad should the landscape and ideation pass be?

**Answer:** Perform a bounded landscape scan around the named and incumbent
backends. Future sessions refresh material upstream evidence and reuse the
existing ADHD synthesis; run only a targeted gap ideation pass if new evidence
creates a genuinely unhandled branch.

**Rationale:** The original divergent pass produced enough option diversity;
repeating it without a new gap adds volume rather than information. Rejected:
unbounded vendor research and mandatory re-brainstorming every session.

## 2026-09-04 — production observation boundary

**Question:** May research touch the incumbent production cache?

**Answer:** Only sanitized authenticated read-only status, `HEAD`, or `GET`
probes are eligible, with bodies discarded, and only when source or disposable
fixtures cannot answer the claim. No production writes are authorized.

**Rationale:** Read-only observation can resolve operational ambiguity without
polluting the cache or widening the exploration into deployment. Rejected:
test writes, artifact retention, and interpreting secret resolution as service
health.

## 2026-09-04 — active-goal ownership

**Question:** Which adjacent programs remain outside this packet's authority?

**Answer:** This packet may cite and feed facts into active work, but it does
not replace or reopen the `time-to-certainty` ProofLedger, `ci-lane-economics`,
the CI operational ontology, or completed ship-velocity work.

**Rationale:** Those packets own their existing contracts and chronology.
Rejected: a second proof authority, duplicated lane-economics measurements, and
retroactive reopening of completed goals.

## 2026-09-04 — intended graduated goal families

**Question:** How should implementation eventually decompose?

**Answer:** Shape four active candidates after alignment:
`turborepo-task-qualification`, `turborepo-cache-conformance`,
`turborepo-cache-trust-observability`, and
`turborepo-quality-cache-adoption`. Create the conditional
`turborepo-cache-backend-migration` goal only after an explicit backend
selection passes its gate.

**Rationale:** Qualification, lab construction, trust/telemetry, adoption, and
migration have different authorities and rollback surfaces. Rejected: a single
cross-cutting implementation goal and a pre-authorized migration packet.

## 2026-09-08 - continue into shaping with existing code homes

**Question:** Does the continuation change the recommendation to use existing
packages before extracting a cache library or driver?

**Answer:** The user said "Continue" after the existing-homes-first
recommendation. Carry that recommendation into shaping as the working decision.
This is an interpretation of the continuation, not a newly explicit answer
approving every implementation detail or the as-yet-unreviewed brief.

**Rationale:** The current checkout retains the same relevant source homes and
architecture rules. Pure policy belongs in the proposed repo-configs cache
facade; operations in Cache; enforcement/rendering in Quality/CI; consumption
in Yeet; and deployed adaptation in infra. Extraction needs a stable contract
with two independent production consumers that cannot use existing homes or
versioned JSON cleanly. A driver also needs an independent external client
boundary. Immediate package extraction remains rejected.

## 2026-09-08 - proposed shape for review

**Question:** Does the four-goal program, full-population audit, and first
synthetic-plus-`@beep/identity#lint` slice match the intended scope?

**Answer:** Open at drafting; resolved by the approval entry below. The proposal is in
[`BRIEF.md`](./BRIEF.md), its candidate sequence in [`MAP.md`](./MAP.md), and
the reusable next-session instructions in [`PROMPT.md`](./PROMPT.md).

**Rationale:** The pilot bounds the first implementation without shrinking the
comprehensive audit or allowing unqualified legacy entries to count as done.
The map was pre-seeded to make the scope reviewable before graduation.

## 2026-09-08 - defer measured deployment and rollout values

**Question:** Must the exploration choose the lab budget, backend, hosted
cohort, and final retention/SLO values before drafting implementation goals?

**Answer:** DEFERRED to the named implementation gates in [`MAP.md`](./MAP.md).
The conformance goal must resolve numeric cost/TTL/load bounds and a deployment
preview before starting the lab. Backend selection follows its comparison.
Adoption must name the cohort and measured thresholds before rollout.

**Rationale:** These decisions need measurements not produced during research.
The deferral permits goal preparation, not deployment with guessed values.
The previously agreed trust, material-win, and observation gates still apply.

## 2026-09-08 - approve the brief and graduate four goals

**Question:** Does the four-goal scope and synthetic-plus-`@beep/identity#lint`
first slice match the intended program, allowing graduation?

**Answer:** The user answered "yes". Approve the complete brief, existing-home
architecture, goal map and first slice. Graduate `turborepo-task-qualification`,
`turborepo-cache-conformance`, `turborepo-cache-trust-observability`, and
`turborepo-quality-cache-adoption`.

**Rationale:** The brief provides the full-population outcome and bounded first
slice; the map names the work, dependencies, existing capabilities and net-new
parts. All four readiness conditions pass. Backend migration stays conditional
until an executable comparison passes the selection gate. Numeric lab budget,
hosted cohort and measured SLO/retention values remain deferred to their
implementation gates, with no guessed deployment authority.

**Lifecycle:** The exploration graduates after all four packets exist. Each
implementation packet starts `paused`, meaning authored but not started under
`goals/README.md`, and activates when its launcher is invoked. Graduation is
not implementation completion or evidence of a deployed cache change.
