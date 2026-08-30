# Research

## 2026-08-27 — S0/S3: in-repo grounding + external lanes launched

### In-repo grounding (done)

- **KPI baseline**: [`research/kpi-baseline-2026-08-27.md`](./research/kpi-baseline-2026-08-27.md)
  — fleet of 27 checkouts, 2,433 attempts, 3.5 weeks: episode P50 41.3m / P95 3.1h, 59%
  red attempts, 17% lock bounces, 292 machine-hours inside episodes. CI tier: Check P50
  12.0m, 80% red on last 50 runs.
- **Vein map**: attempt journals (`.beep/yeet/runs/*/attempts.ndjson`,
  `yeet-attempt-journal/v1`) are the episode source; `verdict.json` is last-write-only.
  Capability inventory in [`research/SOURCES.md`](./research/SOURCES.md) §4.
- **S2 requirements** (CQ gate): [`ontology/docs/orsd.md`](./ontology/docs/orsd.md),
  [`ontology/docs/competency-questions.yaml`](./ontology/docs/competency-questions.yaml)
  (13 Must / 4 Should / 1 Could / 3 Won't), pre-glossary (26 classes / 36 properties),
  generated CQ test suite + traceability matrix.

### External research angles (lanes; grok & codex only, per operator directive)

Angle derivation rationale: the four highest-leverage unknowns after S0+S2 are (1) how
others run LLM-agentic ontology derivation loops (the packet's method), (2) what existing
vocabularies cover our pre-glossary (map before minting), (3) which scheduling/build-theory
formalisms our WorkUnit/grant/epoch model should steal from, and (4) what current fleet-CI
practice looks like in the wild. Prompts are committed under
[`research/prompts/`](./research/prompts/); every lane writes its report into `research/`
with the no-fabricated-URL discipline (unverifiable claims marked UNVERIFIED).

| Lane | Runner | Deliverable |
| --- | --- | --- |
| R1 agentic ontology learning practice | codex (Sol medium, --search) | `research/r1-agentic-ontology-learning.md` |
| R2 vocabulary reuse scan (PROV-O, P-Plan, OSLC Automation, SEON, SPDX/in-toto) | codex | `research/r2-reuse-scan.md` |
| R3 scheduling & incrementality formalisms (DRR, admission control, Build Systems à la Carte) | codex | `research/r3-scheduling-formalisms.md` |
| R4 live practice sweep (turborepo internals, merge queues, agent-fleet CI 2025-26) | grok 4.6 | `research/r4-live-practice.md` |
| R5 AgentO chapter distillation (*The Semantic Web*, ESWC 2026) | Fable (PDF read, judgment) | `research/r5-agento-process.md` |

Lane reports are inputs to S4/S5; nothing in them is doctrine until it survives the
adversarial loops and the CQ admission law.

### Lane conclusions (distilled 2026-08-27; R1–R3 landed, R4 in flight)

**R1 — agentic ontology learning** ([report](./research/r1-agentic-ontology-learning.md)):
the 2024–2026 evidence does NOT support autonomous multi-model taxonomy invention; the
strongest systems (SPIRES/OntoGPT lineage, DRAGON-AI-style curation) constrain the model
with a schema, keep validation and acceptance outside the model, and let mechanical
extraction own facts the corpus already states — independently confirming this packet's
formal-first + CQ-gate rulings. New hazard for us: **reviewer latency becomes the
bottleneck** (auditing shifts cost, potentially RAISING time-to-certainty) — S5 must
account review time inside the KPI, and the packet should pin model+prompt versions with
a small owned benchmark.

**R2 — vocabulary reuse scan** ([report](./research/r2-reuse-scan.md)): layered reuse
pattern — PROV-O for provenance/invalidation entities; P-Plan (license check pending) and
OSLC Automation as alignment spines; SPDX Build + in-toto only at supply-chain
interchange boundaries; everything else (SSN/SOSA, schema.org, DOAP, SEON) documented
mappings only. Verdict that matters most: **ten clusters of our operational core are
genuinely novel** — cache epochs as proof-validity worlds, hash-surface membership,
computed blast radius, tree×epoch proof validity, certainty tiers as outstanding
obligations, seat/grant/budget backpressure, checkout contention laws, KPI decomposition,
failure-signature economics, tagged control interventions. We are not reinventing; we are
minting where nothing exists.

**R3 — scheduling & incrementality formalisms** ([report](./research/r3-scheduling-formalisms.md)):
keep scheduling, admission, stopping, and cache validity as FOUR separate mechanisms
(one score/flag erases guarantees). Concrete steals: per-agent FIFO with carried deficit
and cost-denominated quanta (DRR); `SeatGrant` = cost-denominated demand with expiry,
never a mutex; order ready checks by actionable-failure probability per unit cost and
cancel obsolete work the moment a failure commits the agent to editing; a topological
ready-set scheduler composed with cost admission; proof reuse defined by from-scratch
consistency, keyed by `CacheEpoch × TreeState` plus complete declared inputs
(Build Systems à la Carte constructive traces). These map directly onto CQ-002/003/010
and the S7 projection contract.

**R4 — live practice sweep, grok/X-primary** ([report](./research/r4-live-practice.md);
methodology honest: X retrieval only, HTTP fetch gated, inference marked): the
novelty-check verdict — **no retrieved source shows a reasoner deciding "this PR touches
capability X therefore run suite S, skip T, admit on lane L."** Closest live prior art is
queryable build graphs: `turbo query` as GraphQL over the task graph (agents told to
"dump --schema, then optimize"), Nx affected + distributed task execution assignment,
Bazel/Buck2 action graphs with agent-readable invocation reports, and repo-as-KG tools
(Graphify, code-to-knowledge-graph) which serve orientation, not pipeline authoring.
Positioning consequence (lane's inference, adopted as working stance): beep-ci-ops is not
a Turbo/Nx/Bazel replacement — it is the **organizational layer that binds the
operational graphs to typed entities** (lane, capability, proof, flake class) and answers
the questions fleet operators already ask in English: what is affected, who is blocked,
which agent's work is waste, which lane is fair. The sweep also corroborates the
agent-fleet trend (hermetic target-graph build systems recommended *for* agent-driven
development).

**R4-deep — iterative grok variant** ([report](./research/r4-deep-research.md)): confirms
the novelty gap independently (OSLC/SPDX/PROV describe *what ran*, never *what is
admissible next*) and contributes seven contrarian findings, three of which changed packet
artifacts same-day: (1) **fail-open affected reasons** (`LockfileChangeDetectionFailed`,
`GitRefNotFound`, shallow clones) silently select the whole graph — a projection ignoring
those typed outcomes lies about certainty → admitted as **CQ-019** (Must, zero-rows
constraint) with `AffectedComputation`/`FailOpenOutcome` pre-glossary terms; (2) priority
is not fairness — jump-to-front burns in-flight work; never encode priority as DRR
deficit; (3) `--force` still WRITES cache — any "disable cache" semantics must name
read/write × local/remote/worktree axes. Also: batching can move episode P50 while
merges/day stay flat (KPI interpretation caution), and Pants-style speculation/
cancellation of pure rules is the prior art for killing obsolete WorkUnits cheaply — but
yeet WorkUnits are impure (locks, cache writes), an open S7 question. Its open-questions
list is adopted as S4/S7 work-list input.

**R4-firecrawl — fetched-source variant** ([report](./research/r4-firecrawl-deep-research.md)):
the highest source-fidelity of the three R4s (documents actually fetched; version-pinned
claims). Deltas that matter: `--affected` defaults to PACKAGE granularity — task-input
granularity rides `futureFlags.affectedUsingTaskInputs`, which this repo already enables
(our affected math is on the finer path); a too-shallow checkout makes every package
affected (CQ-019 reinforced from a second angle); GitHub merge queue is FIFO and
graph-blind while real RBE schedulers (EngFlow priority-FCFS, BuildBuddy Sparrow
late-binding) are NOT contributor-fair — DRR remains our differentiator, not table
stakes; Mergify's observational data says AI PRs broke main *less* than human PRs
(1.9% vs 4.4%) — gate policy should key on evidence, not authorship. Novelty gap
confirmed a third time (#7: "no product found that derives CI jobs from a reasoned
ontology").

**R5 — AgentO derivation process, personal read** ([report](./research/r5-agento-process.md);
Ekelhart et al., ESWC 2026, LNCS 16550 pp. 298–320; ontology CC BY 4.0 at
w3id.org/agentic-ai/onto): the closest published dry run of our S4–S6 mechanics, and it
validates them — frozen T-Box with the LLM as *constrained translator* (extraction prompt
hard-forbids minting; missing expressivity surfaces as a typed "Issues/Assumptions"
ledger a human rules on), taxonomy rulings driven by extraction friction (their
Tool ⊒ LLMAgent and Config splits came from reviewer confusion, not armchair design),
explicit recorded rejections, thin subclass alignment into PROV-O/P-Plan, and a
$2.72-cheap rerunnable extract-extend-rerun-diff inner loop whose real bottleneck was
reviewer time (36% sampled) — R1's reviewer-latency hazard quantified. Its one
structural weakness is the discipline we added: no CQ gate, hence tautological classes
(`Context`, `Instance`) no query ever touches — vocabulary-for-interop, not a decision
engine. AgentO models design-time structure only; runtime traces are its future work —
so it stops exactly where this packet begins (fourth independent novelty corroboration).
Eight-item stage-mapped steal list adopted into S4/S6 lane contracts; one S7 amendment
candidate raised for grilling: write the projection's computed schedule back as A-Box
individuals (`ScheduleProposal`) so schedule audit becomes a CQ, not a log-dive.

**Lane triangulation verdict**: three independent methods (X-primary retrieval, iterative
yolo search, fetched-document deep research) agree on the core: the operational-ontology
layer above build graphs is unoccupied ground, and the packet's levers-as-projections
thesis has no named competitor as of 2026-08-27. R5 adds a fourth angle from the
agentic-AI side: the nearest ESWC-published neighbor explicitly defers runtime/dynamic
semantics to future work.
