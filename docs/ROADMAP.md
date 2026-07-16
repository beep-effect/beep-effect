# Roadmap

Freshness: 2026-07-14. Reconciled after the goals portfolio consolidation
(PR #401) and agent-effectiveness-pulse wave 1 (PR #400); priorities unchanged.
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

Execution note: the active-portfolio drain is driven autonomously by
[`goal-portfolio-driver`](../goals/goal-portfolio-driver/README.md), which
locked a dependency-ordered queue of the 25 active packets on 2026-07-14
(NOW lanes first). The lane cap above refers to these thematic program
lanes; the driver's two worktree edit lanes are execution slots, not
program lanes. Priority stays owned by this file; lifecycle stays owned by
`goals/INDEX.md`.

### Lane 1 — Product

[`legal-document-intake`](../goals/legal-document-intake/README.md), portal
phases P4–P6 in PLAN order, each phase its own PR under the yeet completion
gate (P7 Close follows as packet closeout, outside the portal path):

1. **P4 Extraction → KG loop** — the live front: grounded candidates through
   the ClaimGate; KG rows are schema-first Postgres/PGlite tables per intake
   decision D6 (graph DB deferred behind the port; benchmarks reopen it, not
   preference).
2. **P5 Retrieval + viewer** — NL query → span-highlighted document. Gate
   for the NEXT horizon.
3. **P6 M365 write + dual DMS.**

P3 Box sync shipped in PR #386; the live-Box/OAuth deferral is recorded in
the intake packet as a tracked exception. The
[`professional-desktop-adversarial-qa`](../goals/professional-desktop-adversarial-qa/README.md)
campaign is standing product-quality work until two consecutive rounds are
clean; it does not consume a lane slot.

### Lane 2 — Product support

Only packets that directly feed Lane 1:

- [`file-processing-capability`](../goals/file-processing-capability/README.md) (3/7)
- [`agentic-professional-runtime`](../goals/agentic-professional-runtime/README.md) (3/5)
- [`semantic-foundation`](../goals/semantic-foundation/README.md) (0/6) — scoped to
  **M1 Intake-Serving Semantic Seed** and **M4 ClaimGate Shapes** (feeds
  intake P4). Feeder research phases are now R1–R4; M2/M3 queue in NEXT.

### Lane 3 — Harness & metrics

Harness observability, hygiene, and the v1-blocking metrics durability gate:

- [`harness-otel-adoption`](../goals/harness-otel-adoption/README.md) (0/4)
- [`harness-hygiene-mechanical`](../goals/harness-hygiene-mechanical/README.md) (0/4)
- [`ai-metrics-stack`](../goals/ai-metrics-stack/README.md) (6/8), **P7f
  Forwarder Durability** — v1-blocking and gates P7e; evidence is recorded in
  the [packet manifest](../goals/ai-metrics-stack/ops/manifest.json).

The previous finish-then-retire members all closed during 2026-07-11–14.

### Maintenance rule (always allowed, any packet, any lane state)

Red CI, security findings, real bugs, dependency security updates. Standards
ratchets hold at zero — keep-green only, no new clicks past zero.

## NEXT — gate: portal P5 (retrieval + viewer) ships

- **PRD P2 librarian** — corpus-scale ingest of the Oppold corpus into
  candidate claims.
- **Graph-&-ask** over the Postgres projection (per intake D6). A dedicated
  graph DB enters only if traversal benchmarks fail targets, behind the
  existing port. `docs/BEEPGRAPH_ARCHITECTURE.md` remains a proposal.
- **Wave-1 exploration graduations** into freed lane slots:
  [`uspto-patent-driver-depth`](../explorations/uspto-patent-driver-depth/),
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

| Packet | Resumes when |
| --- | --- |
| [`domain-kernel-hardening`](../goals/domain-kernel-hardening/README.md) | Before KG tables scale — opens with PRD P2 librarian. |

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
