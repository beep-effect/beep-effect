# Roadmap

Freshness: 2026-09-12. Re-eval after the 2026-08-25 → 2026-09-12 machinery
sprint: 120 PRs merged and none of them touched Lane 1, so this file now says
what the portfolio actually did — **machinery-first until
[`time-to-certainty`](../goals/time-to-certainty/README.md) C4 lands or Lane
1's attorney-side blockers clear, whichever comes first** — and gives that
order an expiry instead of pretending the 2026-08-17 lane map held.
[`packet-control-plane-core`](../goals/packet-control-plane-core/README.md)
closed 2026-08-26 and its Lane 3 slot passes to `time-to-certainty`; the
[`goal-portfolio-driver`](../goals/goal-portfolio-driver/README.md) revisit
gate is satisfied but the revisit waits for the C4 proof ledger; every active
or paused packet the 2026-08-17 map did not name is reconciled below; three
untouched 2026-08-13 graduations are paused with resume conditions. Prior
freshness: 2026-08-17 (exploration-portfolio closeout); 2026-07-27
(first-user delivery decision); 2026-07-14 (portfolio consolidation, PR #401).
This file supersedes the *frame* of
[`docs/mirror/2026-07-08-roadmap.md`](./mirror/2026-07-08-roadmap.md) (which
remains a dated personal snapshot). Where the two disagree, this file wins.

## What this file is (and is not)

This is the **only cross-portfolio priority layer** in the repo. It owns
ordering, lanes, horizons, and resume conditions. It owns no lifecycle
status (phase counts quoted below are snapshots at the freshness date):

- `goals/<slug>/ops/manifest.json` — tracked machine truth for goal lifecycle;
  `bun run beep goals index` renders the ignored local portfolio view.
- `explorations/<slug>/ops/manifest.json` or, after stream opt-in, the packet's
  D3 event fold — exploration state authority; `bun run beep explore atlas`
  renders the ignored local navigation view.
- [`docs/product/prose-to-proof.md`](./product/prose-to-proof.md) — the
  product PRD and its P0–P5 phase definitions.

Priority changes land here via PR; the lifecycle changes they imply are
executed through `set-status` in the same PR so this file and the tracked
packet manifests never disagree.

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

**The one finish-first goal (2026-09-12):**
[`time-to-certainty`](../goals/time-to-certainty/README.md) replaces
[`packet-control-plane-core`](../goals/packet-control-plane-core/README.md)
(closed 2026-08-26, 6/6) as the single accelerator that should *finish before
the rest*. It passes both accelerator tests: its named consumers are every
Yeet closeout (proof reuse, cheap-gates-first ordering) and the paused
goal-portfolio-driver, and its payback lands before any Lane 1 phase would
finish anyway. The dependency chain is now: CI speed (paid) + control-plane
state truth (paid) + proof certainty (this goal, C4 shadow mode with a
disagreement report) → the goal-portfolio-driver revisit.

**Machinery-first, with an expiry (2026-09-12):** between 2026-08-25 and
2026-09-12 the portfolio merged 120 PRs, all machinery, and Lane 1 has had no
merged PR since 2026-07-30. That order is ratified here as the realized
priority, on two conditions: it ends when `time-to-certainty` C4 lands or
when Lane 1's attorney-side inputs arrive (practice-kg-mcp P5: the AC-2
provenance defect B-2 and Tom's G-1..G-5 calls), whichever comes first; and
no new machinery packet starts a lane slot while it holds — machinery work
is the Lane 3 queue below, drained in order, not a license to scaffold.

Execution note: [`goal-portfolio-driver`](../goals/goal-portfolio-driver/README.md)
stays **paused**; its revisit gate (exploration wrap-up complete +
packet-control-plane-core closed) was verified satisfied on 2026-09-12, but
the relock needs the C4 proof ledger to score what is certain, so the revisit
is sequenced immediately after C4. Its 2026-07-14 locked 25-packet queue is
stale (8 of 25 drained, 13 dormant); until the relock the portfolio drains
through ordinary operator-driven sessions in the order this file gives.
Priority stays owned by this file; lifecycle stays owned by tracked packet
manifests. Run `bun run beep goals index` for the local generated portfolio
view.

### Lane 1 — Product

**Live front (stalled since 2026-07-30; first to resume):**
[`practice-kg-mcp`](../goals/practice-kg-mcp/README.md) — P0–P4 shipped
(bundle, host package, OA candidate claims, .mcpb distribution); P5
acceptance evidence has been in progress since 2026-07-30 with no commit
since, waiting on the AC-2 provenance defect (B-2) and Tom's G-1..G-5 calls.
Resume order is P5 close → P6 graph-integrity repair → P7 server hardening →
P8 handoff, each its own PR; P6 and P7 do not need Tom and may start while
P5 waits. The cut itself is unchanged — the first-user
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

**Practice operations (attended, slot-free; added 2026-09-12):** packets
that provision Tom's practice rather than ship product code, each gated on an
operator-attended step and therefore outside the lane count:
[`practice-m365-contacts`](../goals/practice-m365-contacts/README.md) and
[`practice-mail-backfill`](../goals/practice-mail-backfill/README.md)
(graduated 2026-08-30 from practice-office-provisioning; M365 admin consent),
and
[`oppold-corpus-salvage-restoration`](../goals/oppold-corpus-salvage-restoration/README.md)
(graduated 2026-08-24; feeds the practice-kg bundle v2 corpus gate above).
[`lejeune-demo-corpus-and-ontology`](../goals/lejeune-demo-corpus-and-ontology/README.md)
(3/4, graduated 2026-08-26) closes as a demo deliverable on the same footing;
its lab companion is parked below.

P3 Box sync shipped in PR #386; the live-Box/OAuth deferral is recorded in
the intake packet as a tracked exception. The
[`professional-desktop-adversarial-qa`](../goals/professional-desktop-adversarial-qa/README.md)
campaign is standing product-quality work until two consecutive rounds are
clean; it does not consume a lane slot.

### Lane 2 — Product support

Only packets that directly feed Lane 1:

- [`agentic-professional-runtime`](../goals/agentic-professional-runtime/README.md)
  (3/5, untouched since 2026-07-14; resumes when practice-kg-mcp P8 hands off).
- [`citation-verified-span-substrate`](../goals/citation-verified-span-substrate/README.md)
  (2/4) — the span-provenance substrate whose close unblocks the dormant
  chain `citation-extraction-engine` → `law-doc-structure-oa-slice` and the
  paused `attributed-multi-claim-span`; the cheapest Lane 1 unlock in the
  portfolio (added 2026-09-12).
- [`patent-document-schema`](../goals/patent-document-schema/README.md) (2/5)
  — closes to unblock `document-ast-pattern-classification` →
  `spar-document-annotation-wire` → `folio-lynx-taxonomy-browse` (added
  2026-09-12).
- [`semantic-foundation`](../goals/semantic-foundation/README.md) (3/6) — closed
  after **M1 Intake-Serving Semantic Seed**. Feeder research phases R1-R4 are
  complete; M2-M4 remain gated future capabilities.

[`file-processing-capability`](../goals/file-processing-capability/README.md)
completed and retired from this lane (2026-08-17 re-eval).

### Lane 3 — Machinery

The previous Harness & metrics scope closed whole:
[`harness-otel-adoption`](../goals/harness-otel-adoption/README.md),
[`harness-hygiene-mechanical`](../goals/harness-hygiene-mechanical/README.md),
and [`ai-metrics-stack`](../goals/ai-metrics-stack/README.md) are all
completed-retained (2026-08-17 re-eval), and
[`packet-control-plane-core`](../goals/packet-control-plane-core/README.md)
(6/6, completed-retained 2026-08-26) took and finished the freed slot: the
packet system's event fold, guarded writers, and derived projections,
self-hosting in advisory mode per D9. The slot passes (2026-09-12) to:

- [`time-to-certainty`](../goals/time-to-certainty/README.md) (P1 in
  progress; the C3.3–C3.6 package-task train is PR #1102) — the slot holder
  and the finish-first goal above. Its close is C4 shadow mode with a
  disagreement report; P3 hands the ordering to the portfolio-driver revisit.

**Lane 3 queue (drained in this order, one slot, no new starts while
machinery-first holds):**

1. [`ci-lane-economics`](../goals/ci-lane-economics/README.md) P3 — the
   2026-09-04 → 2026-09-11 admission census; its close fires
   [`ci-fleet-endgame`](../goals/ci-fleet-endgame/README.md) P6 (4/7).
2. [`effect-vitest-canon`](../goals/effect-vitest-canon/README.md) (7/11) —
   sequenced after time-to-certainty C3.4 merges; both edit
   `vitest.shared.ts`.
3. [`runner-trust-boundary`](../goals/runner-trust-boundary/README.md) (8/9)
   and
   [`schema-utils-selective-codec-statics`](../goals/schema-utils-selective-codec-statics/README.md)
   (4/6) — closeouts, no gate.
4. [`boolean-creep`](../goals/boolean-creep/README.md) (2/6) — after the
   operator ratifies GATE 1.
5. [`knowledge-surface-automation`](../goals/knowledge-surface-automation/README.md)
   (3/7),
   [`coding-agent-effectiveness-evidence-loop`](../goals/coding-agent-effectiveness-evidence-loop/README.md)
   (2/9) and
   [`nightly-research-routine`](../goals/nightly-research-routine/README.md)
   (1/5) — fillers while the slot holder waits on review.
6. [`slice-topology-audit`](../goals/slice-topology-audit/README.md) (0/5) →
   [`canonical-proof-reconciliation`](../goals/canonical-proof-reconciliation/README.md)
   (0/5, blockedBy the audit) — after C4.
7. The Turborepo quartet, parked below — after C4;
   `turborepo-task-qualification` first, the other three in parallel behind
   its early contract.

[`codex-security-findings-2026-09-08`](../goals/codex-security-findings-2026-09-08/README.md)
runs under the maintenance rule (all thirteen findings shipped in PRs #1026,
#1032 and #1037; closeout only) and consumes no slot.

### Labs — slot-free canaries (2026-08-24)

A goal packet whose code home is a lab (`apps/labs/*`, ceremony-exempt per
[`standards/architecture/15-lab-apps.md`](../standards/architecture/15-lab-apps.md))
and that ships no product scope does not consume a lane slot; it is listed here
so the map stays true.

- [`semantica-canary`](../goals/semantica-canary/README.md) — closed
  (completed-retained; PR #996) with
  [`openai-driver`](../goals/openai-driver/README.md) as its enabling driver.
  Its three 2026-09-03 successors take the Labs list (added 2026-09-12):
  [`semantica-atlas-sync`](../goals/semantica-atlas-sync/README.md) first
  (the verdict lane), then
  [`semantica-storage-inversion`](../goals/semantica-storage-inversion/README.md)
  after atlas-sync P0, with
  [`semantica-reasoning-spike`](../goals/semantica-reasoning-spike/README.md)
  P1 (fixture only) free to run alongside and P2+ after the storage verdict.

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
resume trigger) lives in the tracked packet READMEs under
[`explorations/`](../explorations/README.md); `bun run beep explore atlas`
renders their current local status view.

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
| [`attributed-multi-claim-span`](../goals/attributed-multi-claim-span/README.md) | Paused 2026-09-12 (graduated 2026-08-13, zero execution, no blocker recorded). Resumes when `citation-verified-span-substrate` closes and a Lane 2 slot pulls the LangExtract-to-ClaimGate proof. |
| [`effect-native-legal-eval`](../goals/effect-native-legal-eval/README.md) | Paused 2026-09-12 (graduated 2026-08-13, zero execution). Resumes when a Lane 2 slot pulls the C&H baseline; `tracked-changes-ingest-wedge` is blockedBy it and waits with it. |
| [`patent-drafting-episode-ledger`](../goals/patent-drafting-episode-ledger/README.md) | Paused 2026-09-12 (graduated 2026-08-13, zero execution). Resumes after practice-kg-mcp P8 hands off and `agentic-professional-runtime` closes; also needs `citation-verified-span-substrate`. |
| [`turborepo-task-qualification`](../goals/turborepo-task-qualification/README.md), [`turborepo-cache-conformance`](../goals/turborepo-cache-conformance/README.md), [`turborepo-cache-trust-observability`](../goals/turborepo-cache-trust-observability/README.md), [`turborepo-quality-cache-adoption`](../goals/turborepo-quality-cache-adoption/README.md) | Scaffolded paused 2026-09-08. Lane 3 queue item 7: after time-to-certainty C4, qualification first, the other three in parallel behind its early contract. |
| [`lejeune-knowledge-desk-lab`](../goals/lejeune-knowledge-desk-lab/README.md) | Paused 2026-08-26. Resumes when `lejeune-demo-corpus-and-ontology` closes and a pitch date exists. |
| [`ci-step-watchdog`](../goals/ci-step-watchdog/README.md) | Paused 2026-08-23 (1/8). Resumes when a Lane 3 slot frees and a capped-step incident recurs. |
| [`configurable-full-document-editor`](../goals/configurable-full-document-editor/README.md) | Paused 2026-08-24. Resumes when intake P5 (viewer) pulls an editor surface. |

Beyond `domain-kernel-hardening`, this cohort has three vintages. The eight
rows through `voice-composer-slice` were graduated 2026-07-14 and saw zero
execution; the 2026-08-17 re-eval moved them here explicitly rather than
leaving them implied-active, and their manifests stay `active` (they are
executable) while this file owns the fact that they are queued, not in
flight. `belief-view-engine` and `model-arrangement-admission-core` were
scaffolded `paused` on 2026-08-17 as queue goals. The rows from
`attributed-multi-claim-span` on were added at the 2026-09-12 re-eval: the
three 2026-08-13 graduations that `goals doctor` flagged as stale-active
(21+ days untouched, no blocker, no status note) were paused via
`set-status` in the same PR, and the paused packets that graduated without
lane rows since 2026-08-17 now carry their resume conditions here.

**2026-08-13 vintage, still `active` (queued, not in flight):** the rest of
that graduation cohort is chained and waits on its `blockedBy` edges rather
than on this file —
[`document-ast-pattern-classification`](../goals/document-ast-pattern-classification/README.md)
→ [`spar-document-annotation-wire`](../goals/spar-document-annotation-wire/README.md)
→ [`folio-lynx-taxonomy-browse`](../goals/folio-lynx-taxonomy-browse/README.md)
behind `patent-document-schema`;
[`citation-extraction-engine`](../goals/citation-extraction-engine/README.md)
and [`law-doc-structure-oa-slice`](../goals/law-doc-structure-oa-slice/README.md)
behind `citation-verified-span-substrate`;
[`tracked-changes-ingest-wedge`](../goals/tracked-changes-ingest-wedge/README.md)
behind the paused `effect-native-legal-eval`;
[`law-docketing-patent-spine`](../goals/law-docketing-patent-spine/README.md)
⇄ [`law-docketing-reliability`](../goals/law-docketing-reliability/README.md)
as a pair, also behind `law-doc-structure-oa-slice`; and
[`thread-virtualization`](../goals/thread-virtualization/README.md),
[`epistemic-memory-retention-projections`](../goals/epistemic-memory-retention-projections/README.md),
[`agentic-governance-laws`](../goals/agentic-governance-laws/README.md),
[`epistemic-contradiction-detection`](../goals/epistemic-contradiction-detection/README.md),
[`epistemic-contradiction-triage`](../goals/epistemic-contradiction-triage/README.md)
and [`openclaw-workstation-agent`](../goals/openclaw-workstation-agent/README.md),
which carry their own status notes and resume when a Lane 1 or Lane 2 slot
pulls them. None of these starts while machinery-first holds.

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
bypass the slot requirement. **Lab-canary exception (2026-08-24):** a packet whose
code home is a lab and that ships no product scope graduates slot-free into the
Labs list above, with its enabling driver packets riding along. **Drift note
(2026-08-24, reconciled 2026-09-12):** `ci-step-watchdog` (#773),
`skill-contract-kernel` (#779), `configurable-full-document-editor` (#781)
and `oppold-corpus-salvage-restoration` (#782) graduated without lane
entries; they now sit, respectively, in the parked table, closed
(completed-retained), in the parked table, and under Lane 1 practice
operations. The same reconciliation placed every other active or paused
packet the 2026-08-17 map did not name: `time-to-certainty`,
`effect-vitest-canon`, `boolean-creep`, `runner-trust-boundary`,
`schema-utils-selective-codec-statics`, `slice-topology-audit`,
`canonical-proof-reconciliation`, `codex-security-findings-2026-09-08` and
the Turborepo quartet in Lane 3 or its queue; the three `semantica-*`
successors in Labs; `practice-m365-contacts`, `practice-mail-backfill` and
`lejeune-demo-corpus-and-ontology` under Lane 1 practice operations;
`lejeune-knowledge-desk-lab` parked; `citation-verified-span-substrate` and
`patent-document-schema` in Lane 2 as chain unlocks; the 2026-08-13 vintage
listed under the parked table; and `todox-marketing-site` closed (#1101).
The rule held for none of them; the funnel policy stands, and the next
graduation names its lane row in the same PR. The gold-intake cohort's
pre-drafted DECISIONS files are the shaping queue;
`bun run beep explore atlas` renders the local status board from D3 state.

## Projections

A private GitHub Projects board (**beep-effect roadmap**) mirrors this
file's NOW/NEXT/LATER entries with `Lane` and `Horizon` fields. The board is
a derived view, synced manually when this file changes; this file is truth.

## Parked ideas (about this roadmap itself)

- Board-sync automation (`ROADMAP.md` → GitHub Projects).
