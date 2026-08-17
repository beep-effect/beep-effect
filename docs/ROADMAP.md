# Roadmap

Freshness: 2026-08-17. Re-eval after the exploration-portfolio closeout:
Lane 3 finished its entire scope and hands its slot to
[`packet-control-plane-core`](../goals/packet-control-plane-core/README.md);
[`agentic-cad-patent-tooling`](../goals/agentic-cad-patent-tooling/README.md)
queues in Lane 1 behind the practice-kg-mcp handoff; the eight zero-execution
goals graduated 2026-07-14 move to the parked/queue section under the
portfolio-as-queue doctrine. Prior freshness: 2026-07-27 (first-user delivery
decision); 2026-07-14 (portfolio consolidation, PR #401).
This file supersedes the *frame* of
[`docs/mirror/2026-07-08-roadmap.md`](./mirror/2026-07-08-roadmap.md) (which
remains a dated personal snapshot). Where the two disagree, this file wins.

## What this file is (and is not)

This is the **only cross-portfolio priority layer** in the repo. It owns
ordering, lanes, horizons, and resume conditions. It owns no lifecycle
status (phase counts quoted below are snapshots at the freshness date):

- [`goals/INDEX.md`](../goals/INDEX.md) — machine truth for packet lifecycle
  (generated; single writer `bun run beep goals set-status`).
- [`explorations/ATLAS.md`](../explorations/ATLAS.md) — exploration status
  board (navigation only).
- [`docs/product/prose-to-proof.md`](./product/prose-to-proof.md) — the
  product PRD and its P0–P5 phase definitions.

Priority changes land here via PR; the lifecycle changes they imply are
executed through `set-status` in the same PR so this file and `INDEX.md`
never disagree.

## North star

**Prose-to-Proof in front of Tom**: a real IP attorney doing real work in a
shipped surface. Every item below ranks by how directly it serves that. The
first surface is the **document portal** in `apps/professional-desktop`,
delivered by [`goals/legal-document-intake`](../goals/legal-document-intake/README.md).
`apps/oip-web` stays paused and decoupled from the first-user metric.

Horizons are **milestone-gated, not dated**: a horizon opens when its gate
artifact ships (PR merged), so the roadmap cannot go stale by date slippage.

## NOW — the lane map

At most three concurrent implementation lanes. A **lane slot** frees only
when a lane finishes (or retires) its listed scope — Lane 3 frees its slot
when its last packet closes, not one slot per packet.

**Accelerator principle (2026-08-17):** goals that accelerate or improve the
quality of other goal packets run in the **Machinery lane in parallel** —
never as a serial phase ahead of product work. A packet claims accelerator
status only by passing two tests: the **named-consumer test** (it names the
specific goals it accelerates, and how) and the **payback-before-horizon
test** (the acceleration lands before its consumer goals would finish
anyway). The 2026-08 CI campaign is the proof case: pipelines and local
checks went from hours to minutes with faster backpressure, and its named
consumer is every subsequent goal — most concretely the paused
goal-portfolio-driver, which is uneconomic at hours-per-iteration.

**The one finish-first goal (2026-08-17):**
[`packet-control-plane-core`](../goals/packet-control-plane-core/README.md)
is the single accelerator that should *finish before the rest* — it is the
trust substrate for autonomous execution. The dependency chain is explicit:
CI speed (paid) + control-plane state truth (this goal) → the
goal-portfolio-driver revisit.

Execution note: [`goal-portfolio-driver`](../goals/goal-portfolio-driver/README.md)
is **paused (2026-08-17)** pending its revisit gate — exploration wrap-up
complete + packet-control-plane-core closed. Its 2026-07-14 locked 25-packet
queue is stale and will be relocked from control-plane derived state at
revisit; until then the portfolio drains through ordinary operator-driven
sessions. Priority stays owned by this file; lifecycle stays owned by
`goals/INDEX.md`.

### Lane 1 — Product

**Live front (this week):**
[`practice-kg-mcp`](../goals/practice-kg-mcp/README.md) — the first-user
delivery cut (decision 2026-07-27): a read-only, local-first stdio MCP server
over a portable data bundle (deterministic docket-family spine + OA candidate
claims + email edges + corpus full-text) into Tom's Claude Desktop, .mcpb
packaged, phases P0–P5 each their own PR. It owns the knowledge-graph scope
orphaned by the deleted `ip-law-knowledge-graph` packet and executes intake
P4's *outcome* (KG rows with span provenance, per intake D6) as a P4-lite,
deferring the librarian/critic/SHACL loop to intake P4-proper. The MCP surface
is thesis, not shim: Claude Desktop is client #1; Word/Outlook/cron/background
agents are the same consumer.

**Resumes after handoff:**
[`legal-document-intake`](../goals/legal-document-intake/README.md), portal
phases P4–P6 in PLAN order, each phase its own PR under the yeet completion
gate (P7 Close follows as packet closeout, outside the portal path):

1. **P4 Extraction → KG loop** — grounded candidates through
   the ClaimGate; KG rows are schema-first Postgres/PGlite tables per intake
   decision D6 (graph DB deferred behind the port; benchmarks reopen it, not
   preference). Tom's captured real questions (practice-kg-mcp P5 handoff)
   become P4/P5 requirements.
2. **P5 Retrieval + viewer** — NL query → span-highlighted document. Gate
   for the NEXT horizon.
3. **P6 M365 write + dual DMS.**

**Queued behind handoff (added 2026-08-17):**
[`agentic-cad-patent-tooling`](../goals/agentic-cad-patent-tooling/README.md)
P1 — the reference-numeral / figure graph extracted from the practice's own
Illustrator artwork (86 of 175 sheets carry live `FIG. n` text). Same Tom
delivery surface: P1's numeral rows land where the practice-kg MCP can serve
them, so it composes with the live front instead of competing. Draft-quality
figures; the illustrator stays the last mile.

**Corpus gate (2026-08-17):** practice-kg **bundle v2** is gated on the
[`oppold-corpus-overhaul`](../explorations/oppold-corpus-overhaul/README.md)
exploration's exit — the next expensive pipeline run happens once, at
maximum quality (T-Box-guided ingestion, salvage integrated, dedupe/prune,
fidelity-verified conversions). The live v1 front is explicitly NOT gated.

**Also queued behind handoff (Phase 2, per practice-kg-mcp SPEC D-7):** a starter
stack distribution packet (revives
[`stack-installer`](../explorations/stack-installer/)) — generic .mcpb bundles
+ FOLIO MCP wiring + curated, license-cleared skills pack for the firms
currently in conversation; per-firm KG onboarding is a separate later packet
gated on first-user dogfood evidence.

P3 Box sync shipped in PR #386; the live-Box/OAuth deferral is recorded in
the intake packet as a tracked exception. The
[`professional-desktop-adversarial-qa`](../goals/professional-desktop-adversarial-qa/README.md)
campaign is standing product-quality work until two consecutive rounds are
clean; it does not consume a lane slot.

### Lane 2 — Product support

Only packets that directly feed Lane 1:

- [`agentic-professional-runtime`](../goals/agentic-professional-runtime/README.md) (3/5)
- [`semantic-foundation`](../goals/semantic-foundation/README.md) (1/6) — scoped to
  **M1 Intake-Serving Semantic Seed** and **M4 ClaimGate Shapes** (feeds
  intake P4). Feeder research phases are now R1–R4; M2/M3 queue in NEXT.

[`file-processing-capability`](../goals/file-processing-capability/README.md)
completed and retired from this lane (2026-08-17 re-eval).

### Lane 3 — Machinery

The previous Harness & metrics scope closed whole:
[`harness-otel-adoption`](../goals/harness-otel-adoption/README.md),
[`harness-hygiene-mechanical`](../goals/harness-hygiene-mechanical/README.md),
and [`ai-metrics-stack`](../goals/ai-metrics-stack/README.md) are all
completed-retained (2026-08-17 re-eval). The freed slot goes to:

- [`packet-control-plane-core`](../goals/packet-control-plane-core/README.md)
  (1/6) — the packet system's event fold, guarded writers, and derived
  projections. It is the instrument that makes the *next* roadmap re-eval
  mechanical (derived pulse: what can start, what is blocked, what awaits the
  operator), scaffolded 2026-08-17 from the ratified packet-system-redesign MAP
  with proofs pre-specified. Self-hosts in advisory mode per D9.

### Maintenance rule (always allowed, any packet, any lane state)

Red CI, security findings, real bugs, dependency security updates. Standards
ratchets hold at zero — keep-green only, no new clicks past zero.

## NEXT — gate: portal P5 (retrieval + viewer) ships

- **PRD P2 librarian** — corpus-scale ingest of the Oppold corpus into
  candidate claims.
- **Graph-&-ask** over the Postgres projection (per intake D6). A dedicated
  graph DB enters only if traversal benchmarks fail targets, behind the
  existing port. `docs/BEEPGRAPH_ARCHITECTURE.md` remains a proposal.
- **Wave-1 freed lane slots** (the `uspto-patent-driver-depth` graduation
  already happened 2026-08-13): schedule its active goal packets
  [`goals/uspto-prosecution-read`](../goals/uspto-prosecution-read/) and
  [`goals/uspto-ptmnfee2-ingest`](../goals/uspto-ptmnfee2-ingest/), plus
  [`citation-grounding-hallucination-guard`](../explorations/citation-grounding-hallucination-guard/).
- **`semantic-foundation` M2** (classification schemes) and **M3**
  (docketing and party roles).
- **`gov-legal-data-driver-delivery`** — a fresh packet citing the closed
  [`gov-legal-data-driver-delivery`](../goals/gov-legal-data-driver-delivery/README.md)
  packet's evidence/specs, opened per named-driver pull when a product feature
  needs a specific driver, never as a batch.
- **Platform re-entries** as slots free:
  [`domain-kernel-hardening`](../goals/domain-kernel-hardening/README.md)
  (before KG tables scale) and
  a fresh packet citing [`one-round-loop`](../goals/one-round-loop/README.md)'s
  evidence/specs (when CI round-trips bottleneck a lane).

## LATER — gate: librarian + graph-&-ask shipped

- **PRD P4 reason & wall** — OWL 2 EL/RL over the TBox, matter walls,
  bitemporal store (the
  [`agent-memory-tiers-bitemporal-edges`](../explorations/agent-memory-tiers-bitemporal-edges/)
  exploration feeds this).
- **PRD P5 sync & scale** — sync engine, Box Events → ingest;
  [`stack-installer`](../explorations/stack-installer/) revival (second-user
  distribution); `oip-web` revival (brand/intake surface) follows the completed
  [`oip-web-production-hardening` launch
  runbook](../goals/oip-web-production-hardening/history/outputs/launch-runbook.md).
- **Generalization verticals** (Todox, wealth management) on the proven
  runtime.
- **Platform programs** — crispening wave continuation,
  `lint:promotion-records`, architecture known-unknowns closure. Each
  re-enters only via a lane slot.

## Parked packets — resume conditions

**Queue doctrine (2026-08-17):** the parked portfolio is the deliberate work
queue — research-backed packets held for lane capacity, a firing gate, or a
model-capability jump — ordered by this file when a slot frees. Parked is not
a soft kill. The exploration side of the queue (14 packets, each with a named
resume trigger) lives in
[`explorations/ATLAS.md`](../explorations/ATLAS.md).

| Packet | Resumes when |
| --- | --- |
| [`domain-kernel-hardening`](../goals/domain-kernel-hardening/README.md) | Before KG tables scale — opens with PRD P2 librarian. |
| [`hybrid-retrieval-fusion-core`](../goals/hybrid-retrieval-fusion-core/README.md) | A retrieval consumer lands (intake P5, or belief-view RRF follow-on). |
| [`law-doc-structure-oa-slice`](../goals/law-doc-structure-oa-slice/README.md) | Intake P4 needs OA structure; wave-2 routed findings seed it. |
| [`law-time-capture-spine`](../goals/law-time-capture-spine/README.md) | The Tom task-set ask is driven (P0 dependency). |
| [`ingestion-secret-scrub`](../goals/ingestion-secret-scrub/README.md) | First real ingestion of sensitive material; gates the ingestion-security queue. |
| [`projection-dispatch-core`](../goals/projection-dispatch-core/README.md) | A second projection consumer exists (packet-control-plane-core may supply it). |
| [`secure-document-delivery`](../goals/secure-document-delivery/README.md) | An approved-document delivery consumer ships in the portal. |
| [`effect-v4-workflow-engine-spike`](../goals/effect-v4-workflow-engine-spike/README.md) | A workflow consumer demands it; spike only. |
| [`voice-composer-slice`](../goals/voice-composer-slice/README.md) | Voice capture re-enters the product bet. |
| [`belief-view-engine`](../goals/belief-view-engine/README.md) | Scaffolded paused 2026-08-17 (queue goal, adversarially reviewed spec); a lane slot frees or an epistemic consumer pulls it. |
| [`model-arrangement-admission-core`](../goals/model-arrangement-admission-core/README.md) | Scaffolded paused 2026-08-17 (queue goal, adversarially reviewed spec); a lane slot frees or the approval-gate consumer pulls it. |

Beyond `domain-kernel-hardening`, this cohort has two vintages. The eight
rows through `voice-composer-slice` were graduated 2026-07-14 and saw zero
execution; the 2026-08-17 re-eval moved them here explicitly rather than
leaving them implied-active, and their manifests stay `active` (they are
executable) while this file owns the fact that they are queued, not in
flight. The last two rows were scaffolded `paused` on 2026-08-17 as queue
goals; their manifests already record that lifecycle.

Completed packets record their own reopening triggers; deleted packets' living
visions were re-captured under `explorations/`:
[`agent-governance-control-plane`](../explorations/agent-governance-control-plane/),
[`knowledge-workspace`](../explorations/knowledge-workspace/),
[`project-intelligence`](../explorations/project-intelligence/),
[`stack-installer`](../explorations/stack-installer/), and the
[`legal-ontology-landscape` survey note](../explorations/legal-ontology-landscape/);
everything else remains in git history.

## Exploration funnel policy

**Shape freely, graduate only into a lane slot.** Explorations may advance
through align → shape → decompose at any time (design work is cheap and
never blocks lanes), but scaffolding a new `goals/` packet requires a free
lane slot — NEXT/LATER entries name candidates for freed slots; they do not
bypass the slot requirement. The gold-intake cohort's
pre-drafted DECISIONS files are the shaping queue;
[`explorations/ATLAS.md`](../explorations/ATLAS.md) stays the status board.

## Projections

A private GitHub Projects board (**beep-effect roadmap**) mirrors this
file's NOW/NEXT/LATER entries with `Lane` and `Horizon` fields. The board is
a derived view, synced manually when this file changes; this file is truth.

## Parked ideas (about this roadmap itself)

- Board-sync automation (`ROADMAP.md` → GitHub Projects).
