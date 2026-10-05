# Roadmap

Freshness: 2026-10-05 (re-eval opened 2026-10-02, refreshed before merge).
Re-eval after three weeks under the 2026-09-12 map: 287 PRs merged since
09-12 and none touched a Lane 1 packet (#1387 on 10-02 landed the
document-intake statechart in `apps/professional-desktop` without a packet
commit, the only product-facing merge of the period); the accelerator
[`time-to-certainty`](../goals/time-to-certainty/README.md) paused itself on
2026-09-28 (ruling 80: C4.2 enforcement waits for a post-merge shadow sample),
so the expiry clause's first trigger cannot fire from inside the lane; three
CI admission windows were denied and the signed repair is a fan-out governor,
not more machinery. **Machinery-first ends with this re-eval: Lane 1 starts
practice-kg-mcp P6 now**, the Lane 3 slot passes to
[`effect-vitest-canon`](../goals/effect-vitest-canon/README.md) with
ci-lane-economics P3 riding, and every packet that graduated, closed, paused
or was superseded since 09-12 is reconciled below (the seven `goals doctor`
advisories are cleared in the same PR). Prior freshness: 2026-09-12
(machinery-first with an expiry); 2026-08-17 (exploration-portfolio
closeout); 2026-07-27 (first-user delivery decision); 2026-07-14 (portfolio
consolidation, PR #401).
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

**The one finish-first goal (2026-10-02):** none in Lane 3 this cycle.
[`time-to-certainty`](../goals/time-to-certainty/README.md) finished what it
can without a live sample (P0, P1 and P3 complete; P2 complete except C4.2;
P4 in progress) and paused on ruling 80. It resumes only when
`bun run beep yeet proof-report --since <round-25 merge instant>` in the
owning clone reads ready (200 attempts, 10 branches, 0 disagreements, counting
only rows recorded after that merge) with `malformed rows: 0` on the sample,
every C5 fixture green and the ruling-69 root-input gap closed; that flip PR turns reuse on and closes the
packet. The chain is paid up to the sample: CI speed + control-plane state
truth + shadow proof reuse (C4.1 and the owning-clone ledger) → the
goal-portfolio-driver revisit once the flip lands.
[`cloud-agent-readiness`](../goals/cloud-agent-readiness/README.md) (opened
2026-10-01) is the only new accelerator and takes no slot by its own charter.

**Machinery-first ended (2026-10-02):** the 2026-09-12 clause expired on
neither of its triggers — C4.2 is sample-gated and Tom's inputs did not
arrive — and it ends anyway, by this re-eval. The accelerator has paid what
it can without a sample; the three admission windows (weeks of 09-04, 09-13
and 09-23) were denied with the breach attributed to hosted-queue saturation
and bounded by a six-branch fan-out cap (repair decision 3, signed
2026-10-01), which no further machinery packet changes; and 287 PRs in three
weeks moved one product-facing change (#1387), none through a packet. From
here: Lane 1 holds a dated start (practice-kg-mcp P6 and P7, no attorney
input needed; as of 10-05 no session has opened P6 yet, so it is the first
thing to happen after this merges); Lane 3 keeps one slot (`effect-vitest-canon`) with ci-lane-economics
P3 riding for the governor and window 4; no new machinery packet starts a
lane slot; accelerators that take no slot by charter (cloud-agent-readiness,
ciops-ontology-pipeline run 4) run in parallel.

Execution note: [`goal-portfolio-driver`](../goals/goal-portfolio-driver/README.md)
stays **paused**; its revisit gate (exploration wrap-up complete +
packet-control-plane-core closed) was verified satisfied on 2026-09-12, but
the relock needs the proof ledger's post-merge sample to score what is
certain, so the revisit is sequenced immediately after the time-to-certainty
resume and flip PR (C4.2). Its 2026-07-14 locked 25-packet queue is
stale (8 of 25 drained, 13 dormant); until the relock the portfolio drains
through ordinary operator-driven sessions in the order this file gives.
Priority stays owned by this file; lifecycle stays owned by tracked packet
manifests. Run `bun run beep goals index` for the local generated portfolio
view.

### Lane 1 — Product

**Live front (stalled since 2026-07-30; dated start 2026-10-02):**
[`practice-kg-mcp`](../goals/practice-kg-mcp/README.md) — P0–P4 shipped
(bundle, host package, OA candidate claims, .mcpb distribution); P5
acceptance evidence has been in progress since 2026-07-30 with no commit
since, waiting on the AC-2 provenance defect (B-2) and Tom's G-1..G-5 calls.
Resume order is P6 graph-integrity repair → P7 server hardening, each its
own PR; neither needs Tom and both start now, before P5 closes. P5 closes in
parallel once Tom's calls and the AC-2 provenance fix land. P8 handoff waits
for all three: the bundle is not installed on Tom's machine until the P5
acceptance gauntlet passes. No
commit has touched a Lane 1 packet since the 09-12 re-eval (still true on
2026-10-05; the practice-kg-mcp packet was last touched 2026-08-30);
`legal-document-intake` now carries `blockedBy: practice-kg-mcp` so the
doctor reads its wait as a dependency, not neglect. The cut itself is
unchanged — the first-user
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
(graduated 2026-08-30 from practice-office-provisioning; contacts access is
granted only through the Exchange RBAC-for-Applications assignment scoped to
the attorney's mailbox, never a tenant-wide admin consent of
`Contacts.ReadWrite`; the backfill runs operator-attended only),
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
  (3/5, untouched since 2026-07-14; `blockedBy: practice-kg-mcp`, resumes at
  the P8 handoff).
- [`citation-verified-span-substrate`](../goals/citation-verified-span-substrate/README.md)
  (2/4) — the span-provenance substrate whose close unblocks the dormant
  consumers `citation-extraction-engine` and `law-doc-structure-oa-slice`
  (independent of each other; the OA slice excludes citation parsing) and
  the paused `attributed-multi-claim-span`; the cheapest Lane 1 unlock in the
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
self-hosting in advisory mode per D9. `time-to-certainty` held the slot from
2026-09-12 to 2026-09-28 (P1 closed 09-15; the C3 train, B5 detached proof
jobs, B7 until-ready, B8 heavy admission, C4a and C4.1 shadow proof reuse all
merged) and is paused on ruling 80 (parked table). The slot passes
(2026-10-02) to:

- [`effect-vitest-canon`](../goals/effect-vitest-canon/README.md) (8/11; P1
  inventory and P2 remediation waves in progress, PR #1312 merged, 33
  commits since 09-22, the latest via #1406 and #1408, merged 10-03 and 10-05
  UTC) — the slot
  holder. It closes on the final empty
  baseline, the complete inventory and hosted proof.

Riding in the slot, not holding it:

- [`ci-lane-economics`](../goals/ci-lane-economics/README.md) P3 — three
  windows denied: 09-04 (Check, Coverage Regression, pickup), 09-13 (Test
  Unit, Lint Policy, pickup) and 09-23 (Test Unit 35m00s, Lint 29m16s, pickup
  23m58s under the 16-context population ratified 2026-10-01). Repair
  decision 3 (2026-10-01): bound the load with a six-branch fan-out governor
  on the agent side; window 4 is censused with a concurrency column so a
  pass or breach attributes to the cap, the governor or capacity. The
  governor PR is not open as of 2026-10-05, so window 4 has not started; it
  is the next ci-lane-economics move. Its close
  still fires [`ci-fleet-endgame`](../goals/ci-fleet-endgame/README.md) P6.
- [`agent-pool-doctrine`](../goals/agent-pool-doctrine/README.md) (1/5,
  graduated 2026-09-16; #1162 bound the pool order and admitted the Cursor
  lane) — P1 implement; `agent-pool-picker` resumes when it ships.

**Lane 3 queue (one slot, in this order):**

1. [`turborepo-cache-conformance`](../goals/turborepo-cache-conformance/README.md)
   and
   [`turborepo-cache-trust-observability`](../goals/turborepo-cache-trust-observability/README.md)
   — active early handoff since #1327;
   [`turborepo-task-qualification`](../goals/turborepo-task-qualification/README.md)
   closed via #1389 on 2026-10-02. Single writer for the shared Cache
   contracts; `turborepo-quality-cache-adoption` stays parked until they ship.
2. [`runner-trust-boundary`](../goals/runner-trust-boundary/README.md) (8/9)
   — P8 post-release JIT containment is a security acceptance gate, not a
   closeout: it closes only when live proof shows no recoverable handoff
   credential, or server-side replay rejection after the original listener
   ends, from both the original and a second host.
   [`schema-utils-selective-codec-statics`](../goals/schema-utils-selective-codec-statics/README.md)
   (4/6) — P4 Yeet to mergeable, no gate.
3. [`knowledge-surface-automation`](../goals/knowledge-surface-automation/README.md)
   (3/7),
   [`coding-agent-effectiveness-evidence-loop`](../goals/coding-agent-effectiveness-evidence-loop/README.md)
   (2/9) and
   [`nightly-research-routine`](../goals/nightly-research-routine/README.md)
   (1/5; the routine itself runs — packets 09-22, 09-23, 09-25, 09-27, 09-30,
   10-02 and 10-03 — P1 to P4 are the fillers) — while the slot holder waits on
   review.
4. [`ontology-sidecar-stateless-identity`](../goals/ontology-sidecar-stateless-identity/README.md)
   (1/5, graduated 2026-09-22) — its gate,
   [`mcp-stateless-kit-and-drivers`](../goals/mcp-stateless-kit-and-drivers/README.md),
   closed, so it can start; it feeds the desktop ontology sidecar, so it is
   the queue's one Lane 1-adjacent item.
5. [`slice-topology-audit`](../goals/slice-topology-audit/README.md) (0/5) →
   [`canonical-proof-reconciliation`](../goals/canonical-proof-reconciliation/README.md)
   (0/5, blockedBy the audit) — after the time-to-certainty flip.
6. [`ciops-ontology-pipeline`](../goals/ciops-ontology-pipeline/README.md)
   (0/7, graduated 2026-10-01; auditor run 4 is gated on C4.1 facts from both
   local stages) — slot-free auditor work, listed for order only.

Ended or closed since 09-12: [`boolean-creep`](../goals/boolean-creep/README.md)
— the operator replaced eradication with a documented partial closeout on
2026-10-02 (#1405 set its manifest to `reference`; the unfinished phases stay
recorded there and are not scheduled); both `codex-security-findings`
packets closed (09-16 and #1181); `tsgo-045-effect-idiom-sweep` was
superseded by the single-PR tsgo ratchet. The maintenance rule covers the
next security batch; it consumes no slot.

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
  after the atlas-sync P1 verdict lane, with
  [`semantica-reasoning-spike`](../goals/semantica-reasoning-spike/README.md)
  P1 (fixture only) free to run alongside and P2+ after the storage verdict.
  Nobody has pulled any of the three since graduation (2026-09-03). If that
  is still true at the next re-eval, pause them with resume conditions
  rather than carry them as active.

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
| [`time-to-certainty`](../goals/time-to-certainty/README.md) | Paused 2026-09-28 on ruling 80 (P0, P1, P3 complete; P2 complete except C4.2). Resumes when `bun run beep yeet proof-report --since <round-25 merge instant>` in the owning clone reads ready (200 attempts, 10 branches, 0 disagreements, counting only rows recorded after that merge) with `malformed rows: 0` on the sample, every C5 fixture green and the ruling-69 root-input gap closed; the flip PR turns reuse on, retires the legacy stores and closes the packet. |
| [`turborepo-quality-cache-adoption`](../goals/turborepo-quality-cache-adoption/README.md) | Scaffolded paused 2026-09-08, unstarted. Resumes behind the two active cache packets (conformance, trust-observability) once their shared Cache contracts ship. |
| [`knowledge-freshness-audit`](../goals/knowledge-freshness-audit/README.md) | Paused 2026-09-25 after the planning packet (#1218). Resumes on explicit operator activation of P1 reporting; audited-content mutation follows each report and its false-positive review. |
| [`agent-pool-picker`](../goals/agent-pool-picker/README.md) | Scaffolded paused 2026-09-16. Resumes when `agent-pool-doctrine` ships its seat map and floors (P1 implement there). |
| [`lejeune-knowledge-desk-lab`](../goals/lejeune-knowledge-desk-lab/README.md) | Paused 2026-08-26. Resumes when `lejeune-demo-corpus-and-ontology` closes and a pitch date exists. |
| [`ci-step-watchdog`](../goals/ci-step-watchdog/README.md) | Paused 2026-08-23 (1/8). Resumes when a Lane 3 slot frees and a capped-step incident recurs. |
| [`configurable-full-document-editor`](../goals/configurable-full-document-editor/README.md) | Paused 2026-08-24. Resumes when intake P5 (viewer) pulls an editor surface. |
| [`repo-cli-modularization`](../goals/repo-cli-modularization/README.md) | Paused 2026-08-30 with all ten phases complete but no delivered PR (delivery PR #339 closed after #326 overlapped). Resumes for current-main reconciliation, authoritative proof, and a replacement delivery PR driven to mergeable; its completion gate stays unsatisfied until that PR merges. |

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
lane rows since 2026-08-17 now carry their resume conditions here. The
2026-10-02 re-eval added `time-to-certainty` (paused by its own ruling 80),
`knowledge-freshness-audit` and `agent-pool-picker`, and retired the
`turborepo-task-qualification` row (closed via #1389).

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
pulls them. Machinery-first no longer holds them back; none starts until a
Lane 1 or Lane 2 slot pulls it.

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
`lejeune-knowledge-desk-lab` and `repo-cli-modularization` parked; `citation-verified-span-substrate` and
`patent-document-schema` in Lane 2 as chain unlocks; the 2026-08-13 vintage
listed under the parked table; and `todox-marketing-site` closed (#1101).
The rule held for none of them; the funnel policy stands, and the next
graduation names its lane row in the same PR. **Reconciled again
2026-10-02:** since the 09-12 re-eval these graduated or opened without lane
rows and now have them — `agent-pool-doctrine` and `agent-pool-picker`
(09-16), `ontology-sidecar-stateless-identity` (09-22),
`knowledge-freshness-audit` (09-24), `cloud-agent-readiness` and
`ciops-ontology-pipeline` (10-01); closed without needing one:
`effect-schema-parity`, `harness-evidence-ledger`,
`mcp-stateless-kit-and-drivers`, `model-routing-sync`, `yeet-pr-events`,
`effect-reference-workspace`, `turborepo-task-qualification` and both
`codex-security-findings` packets; `tsgo-045-effect-idiom-sweep` was
superseded by the single-PR tsgo ratchet. The rule held for none of them
either. **Refreshed 2026-10-05** before this re-eval merged: #1405 moved
`boolean-creep` to `reference` on 10-02; nothing else graduated, closed,
paused or was superseded between 10-02 and 10-05 (13 PRs merged, 54 active,
15 paused, 123 completed-retained, 4 reference, 1 superseded). The
gold-intake cohort's
pre-drafted DECISIONS files are the shaping queue;
`bun run beep explore atlas` renders the local status board from D3 state.

## Projections

A private GitHub Projects board (**beep-effect roadmap**) mirrors this
file's NOW/NEXT/LATER entries with `Lane` and `Horizon` fields. The board is
a derived view, synced manually when this file changes; this file is truth.

## Parked ideas (about this roadmap itself)

- Board-sync automation (`ROADMAP.md` → GitHub Projects).
