# Pre-packet session, distilled (2026-08-27)

Redacted narrative of the live session that birthed this packet. The raw capture (full
transcript jsonl, session state, logs) sits beside this file in `pre-packet-transcript/`,
deliberately gitignored: raw harness captures carry session and machine identifiers and
absolute paths, and this repo is public. This distillation is the committed record.
Operator-verbatim material is preserved in [`../CAPTURE.md`](../CAPTURE.md); grill outcomes
in [`../DECISIONS.md`](../DECISIONS.md). Home paths are written `~`-relative throughout.

## Arc

**1. Turbo cache diagnosis.** The session opened with a puzzle: `bun run build` and
`bun run docgen` fully cached (FULL TURBO) while `bun run coverage` hit 47/98 and
`bun run test` hit 0/131. Diagnosis from source: `coverage` is `cache: false` by design
(ratchet lane, pinned hosted-CI identity, local-only cache posture — the 47 hits were
`^build` dependencies); `test` is cacheable but has no `dependsOn` (pure 131-task graph)
and its cache was structurally cold — sources had changed since the last *completed* test
run, and killing runs early keeps the cache cold, self-fulfillingly. Local root turbo
steps pin `--concurrency=3`. Runtime split: test = `bunx --bun vitest run` (bun runtime),
coverage = node vitest (v8 coverage needs the inspector), build = tsc. The asymmetry is
cache policy, not runtime.

**2. Three-lever question.** "What are the 3 smallest but highest leverage things we can
accomplish in a single PR that will cheapen anything about yeet?" Candidate answer
(grounded in memory + source): (a) machine-shared turbo cache across checkouts, guarded by
the install preflight (measured: check lane 126/230 misses even in the primary checkout);
(b) `yeet verify --tier affected` — the `turbo query affected` plumbing and the tier enum
already exist; (c) a cost-ordered fail-fast lane ladder from measured lane timings. These
survive as **control interventions** (see DECISIONS purity ruling), not as the answer.

**3. The scheduler spark.** From the operator's parallel yeet-proof-scheduler session: run
`--filter` iteratively instead of the giant contentious gauntlet; 10 agents in 10 clones,
one seat each, a seat being one cheap command on one package; reverse-topological order to
maximize backpressure; cheapest-first because no PR in a year has passed CI on the first
try. Claim that turbo can be outsmarted: a `@biomejs/biome` bump should not invalidate
typecheck.

**4. Pushback that survived, pushback that fell.** Survived: seat = (package, task) is too
fine a quantum (per-invocation turbo boot tax; same-checkout turbo runs contend
destructively) — the right quantum is cost-bounded (lane × affected-subgraph) grants,
sharded when they exceed a max-cost bound; diff-proximity beats topo depth as a failure
predictor; turbo already hashes external deps per package (`hashOfExternalDependencies`) —
the world-nuking mechanism is root `package.json` sitting in turbo `global.inputs`, so the
principled fix is hash-surface narrowing, not semantic diffing; lint-green never licenses
skipping typecheck — only hash math licenses skipping; the full publish proof stays (local
is deliberately stricter than CI). Fell: "turbo is already an incremental engine" — the
operator's counter is correct that this is a single-player argument. Turbo assumes one
checkout accumulating warmth, one run at a time, a human who reads the whole report. An
agent fleet violates all three, and most deeply: an agent invalidates the rest of the
report the moment it acts on the first error, so everything computed after the first
in-scope failure is probabilistically wasted work. Turbo optimizes makespan of one graph;
the fleet needs time-to-first-actionable-failure per agent and aggregate progress per
machine-second. The compressed principle, operator's words: backpressure — a hose that
takes a little at a time instead of being constipated. Design law: the failure mode of
today's yeet is an unbounded quantum.

**5. The ontology pivot.** "Just for fun I want to make this an ontology" sharpened into
the packet thesis: don't hand-pick levers — formalize the repo's verification &
backpressure semantics into a reasoned T-Box whose runtime projection computes the optimal
pipeline, judged by ONE deterministically computable KPI: time from agent-writes-code to
agent-knows-with-certainty-it-passes. The operator proposed an 8-step derivation pipeline
(capture → deep-research with /adhd-derived angles → vein mining → adversarial taxonomy →
parameterization → A-Box ratification → OWL + SHACL + self-built reasoners → full review),
citing the agento chapter of *The Semantic Web* for the derivation-process pattern and
`A_LETTER_FROM_THE_OTHER_SIDE_OF_THE_LOOP.md` as the thing this packet gets to prove.

**6. The grill.** Solo critique first, then /grill-with-docs, two frontier rounds, eight
decisions locked (all on recommended arms): fleet-aggregated KPI; baseline-first;
OWL 2 RL → Datalog on the critical path (DL reasoner off-path); formal-first mining with
tiered veins; CQ-gated admission ("decision-relevance or death", certainty = CQ regression
green under KGCL); dry-2 + coverage + budget loop bounds; labs incubation with artifacts
through the `packages/ontology` slice; quick levers allowed as tagged control
interventions. Amendments: the original steps 5/6 were duplicated — the missing stage is
the projection function `(T-Box, A-Box, live instance) → WorkUnit schedule`; a reuse scan
(PROV-O, P-Plan, OSLC Automation, SEON) was added; raw captures gitignored per redaction
law. Sharpest external witness: the letter's own doubts section ("the meta-work is more
fun than the object-level work… measurable, not assumable") — this packet's baseline-first
and control-intervention rulings are the direct answer to it.

**7. Packet launch.** Hygiene pass (rename `pros/`→`prose/`, gitignore raw capture),
scaffold from `_template/`, decisions pre-seeded, S0 first-cut baseline computed from this
checkout's 41 yeet verdicts (see `../research/`).
