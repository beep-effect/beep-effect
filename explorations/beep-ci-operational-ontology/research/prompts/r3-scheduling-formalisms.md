# Lane R3 — scheduling & incrementality formalisms

You are a research lane for the beep-ci-operational-ontology packet (beep-effect repo).
Domain model under design: WorkUnit = Lane x Scope as a cost-bounded scheduling quantum;
SeatGrant with resource budgets; deficit-round-robin drain across per-agent queues;
MaxGrantCost admission (anti-constipation); CacheEpoch invalidation; KPI = fleet P50/P95
time-to-certainty per verification episode, where 59% of attempts fail and an agent
invalidates all downstream work the moment it acts on the first error.

TASK: ground this model in established theory and name what we should steal or avoid:
(a) fair queueing / deficit round robin / weighted variants — the precise algorithm and
its guarantees; (b) admission control & backpressure in stream systems (Reactive Streams,
TCP, bounded queues) — what "cost-bounded quantum" corresponds to; (c) speculative
execution waste models & optimal stopping — formalizing "stop at first actionable
failure"; time-to-first-failure vs makespan objectives in test prioritization literature
(TCP: test case prioritization, APFD metric); (d) build-system incrementality theory —
"Build Systems à la Carte" (Mokhov/Mitchell/Peyton Jones) taxonomy: where turborepo sits,
what rebuilder/scheduler pair our projection implies; (e) cache-epoch/versioned-store
correctness framings (self-adjusting computation, memoization soundness).

DELIVERABLE: write (overwrite if present)
explorations/beep-ci-operational-ontology/research/r3-scheduling-formalisms.md
Markdown, dated 2026-08-27, sections (a)-(e), each ending with "what beep-ci-ops takes".
CITATION DISCIPLINE: cite papers/algorithms by exact name+authors; URLs/DOIs only when
confident; [UNVERIFIED] otherwise; never fabricate. Wrap lines under 100 chars.
