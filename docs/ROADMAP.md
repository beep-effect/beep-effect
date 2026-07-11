# Roadmap

Freshness: 2026-07-11. Synthesized from `goals/`, `explorations/`, `standards/`,
and `docs/` in a grilled interview session; supersedes the *frame* of
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

### Lane 1 — Product

[`legal-document-intake`](../goals/legal-document-intake/README.md), portal
phases P3–P6 in PLAN order, each phase its own PR under the yeet completion
gate (P7 Close follows as packet closeout, outside the portal path):

1. **P3 Box sync** — the first-user moment: filed docs mirror to the real
   Box account (`@beep/box` write surface already exists; the full
   `box-driver` packet stays paused).
2. **P4 Extraction → KG loop** — grounded candidates through the ClaimGate;
   KG rows are schema-first Postgres/PGlite tables per intake decision D6
   (graph DB deferred behind the port; benchmarks reopen it, not preference).
3. **P5 Retrieval + viewer** — NL query → span-highlighted document. Gate
   for the NEXT horizon.
4. **P6 M365 write + dual DMS.**

### Lane 2 — Product support

Only packets that directly feed Lane 1:

- [`file-processing-capability`](../goals/file-processing-capability/README.md) (3/7)
- [`agentic-professional-runtime`](../goals/agentic-professional-runtime/README.md) (3/5)
- [`semantic-foundation`](../goals/semantic-foundation/README.md) — scoped to
  **M1 Intake-Serving Semantic Seed** and **M4 ClaimGate Shapes** (feeds
  intake P4). M2/M3 queue in NEXT.

### Lane 3 — Finish, then retire

Near-done actives driven to close; the lane retires when empty:

- [`codex-security-findings-2026-07-08`](../goals/codex-security-findings-2026-07-08/README.md) (8/10)
- [`ai-metrics-stack`](../goals/ai-metrics-stack/README.md) (6/8)
- [`gov-legal-data-driver-codegen`](../goals/gov-legal-data-driver-codegen/README.md)
  (3/4) — closing it does **not** auto-start `gov-legal-data-driver-delivery`.
- [`ontology-agent-surface`](../goals/ontology-agent-surface/README.md) —
  land the in-flight P1 toolkit branch, then park P2–P4 (resumes when the
  product path needs agent-driven ontology edits).

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
- **`gov-legal-data-driver-delivery`** — resumes per named-driver pull when
  a product feature needs a specific driver, never as a batch.
- **Platform re-entries** as slots free:
  [`domain-kernel-hardening`](../goals/domain-kernel-hardening/README.md)
  (before KG tables scale) and
  [`one-round-loop`](../goals/one-round-loop/README.md) (when CI round-trips
  bottleneck a lane).

## LATER — gate: librarian + graph-&-ask shipped

- **PRD P4 reason & wall** — OWL 2 EL/RL over the TBox, matter walls,
  bitemporal store (the
  [`agent-memory-tiers-bitemporal-edges`](../explorations/agent-memory-tiers-bitemporal-edges/)
  exploration feeds this).
- **PRD P5 sync & scale** — sync engine, Box Events → ingest;
  `stack-installer` revival (second-user distribution); `oip-web` revival
  (brand/intake surface).
- **Generalization verticals** (Todox, wealth management) on the proven
  runtime.
- **Platform programs** — crispening wave continuation,
  `lint:promotion-records`, architecture known-unknowns closure. Each
  re-enters only via a lane slot.

## Parked packets — resume conditions

Newly parked in this synthesis (lifecycle `paused`, executed via
`set-status`). Packets already paused before this synthesis stay paused
under their existing notes.

| Packet | Resumes when |
| --- | --- |
| [`agent-reflection-loop`](../goals/agent-reflection-loop/README.md) | A packet closes without usable reflections (enforcement gap recurs). |
| [`one-round-loop`](../goals/one-round-loop/README.md) | CI round-trips bottleneck a lane (median PR needs >1 round). |
| [`lint-advisory-hardening`](../goals/lint-advisory-hardening/README.md) | Advisory noise measurably slows lane agents, or the post-P5 platform window opens. |
| [`fallow-advisory-ratchets`](../goals/fallow-advisory-ratchets/README.md) | A Fallow advisory lane regresses, or the post-P5 platform window opens. |
| [`fallow-debt-burndown`](../goals/fallow-debt-burndown/README.md) | With `fallow-advisory-ratchets` (same program). |
| [`repo-codegraph`](../goals/repo-codegraph/README.md) | Symbol-discovery friction demonstrably blocks lane work. |
| [`knowledge-workspace`](../goals/knowledge-workspace/README.md) | After portal P5, once the epistemic store holds real user data. |
| [`domain-kernel-hardening`](../goals/domain-kernel-hardening/README.md) | Before KG tables scale — opens with PRD P2 librarian. |
| [`schema-first-v4-capabilities`](../goals/schema-first-v4-capabilities/README.md) | A schema-heavy wave (e.g. intake P4 KG schemas) hits a v4-feature gap. |
| [`unified-ai-toolchain`](../goals/unified-ai-toolchain/README.md) | Agent-config drift next causes a real incident. |
| [`project-intelligence`](../goals/project-intelligence/README.md) | Research-on-cron delegation is worth a lane slot (earliest: post portal P5). |
| [`stack-installer`](../goals/stack-installer/README.md) | Distribution phase opens (LATER: sync & scale; a second non-technical user). |
| [`gov-legal-data-driver-delivery`](../goals/gov-legal-data-driver-delivery/README.md) | A product feature pulls a named gov driver (per-driver, not batch). |

Status flips in the same synthesis: `beep-schema-topology` and `canvas` are
phase-complete and move to `completed-retained`.

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
- A `beep` lint that checks every packet slug named here still resolves and
  its lifecycle matches what this file implies.
