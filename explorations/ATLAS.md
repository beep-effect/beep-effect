# Atlas

Living map of the product vision: the outcomes we are steering toward, the
capability bricks already built, and every exploration's place in the tree.
This is the first file a cold session should read.

Navigation only — no doctrine. Load-bearing prose belongs in `docs/product/`,
`goals/<slug>/SPEC.md`, or `standards/`; this file links to it. Updated at
every exploration stage transition.

## Outcomes

The durable "why" behind explorations. Seeded from
[`goals/agentic-professional-runtime`](../goals/agentic-professional-runtime/README.md)
(the active product-definition authority).

- **Local-first agentic professional runtime** — a governed workspace where a
  professional brings their own agent clients, tools, data sources, and model
  credentials; every durable assertion carries evidence, provenance,
  lifecycle, and cost. Vision prose:
  [`product-vision-law-practice.md`](../goals/agentic-professional-runtime/docs/product-vision-law-practice.md).
- **Agentic solo IP law practice** (sole active vertical) — capture context,
  propose work, maintain evidence-backed practice memory, automate safe office
  loops, keep legal judgment under attorney approval.
- **Agent control plane** — `apps/professional-desktop` as the workbench where
  the professional directs, reviews, and approves agent work.

## Capability Bricks

The lego pieces already built. Authoritative inventories (link, never copy):

- Existing exports: search with ripgrep over `packages/*/*/*/src/**` and the
  package barrels (`packages/*/*/*/src/index.ts`), or use the
  `repo-symbol-discovery` skill.
- Package families: `packages/{foundation,shared,drivers,tooling}` (substrate),
  `packages/{workspace,agent-capability,epistemic,law-practice,architecture-lab}`
  (slices), `apps/*` (runtimes).

## Explorations

### Active
- [`academia-corpus-mining`](./academia-corpus-mining/README.md) —
  capture-stage mining of 519 Academia.edu PDFs (444 unique titles; June-29
  agent/memory wave + July-24/25 legal-ontology wave) against four live work
  streams (memory/bitemporal No-Escape, semantic foundation, retrieval/
  citation grounding, agent architecture). Adopts the June-29 prior synthesis
  (72 papers deep-read) as
  [`research/prior-synthesis-legal-ontologies.md`](./academia-corpus-mining/research/prior-synthesis-legal-ontologies.md);
  normalized corpus lives externally (`~/YeeBois/research/academia-2026-07/`,
  public-repo copyright discipline). Pipeline: dedupe → extract → codex T1
  triage (all) → Sol T2 deep-reads (shortlist) → T3 cluster + master
  syntheses → routing table for later goal graduation.
- [`agent-effectiveness-pulse`](./agent-effectiveness-pulse/README.md) — a
  data-driven pulse on repo agent friendliness/effectiveness (stage
  `graduate`, opened 2026-07-14, still active for wave 2): which skills are
  used or dead, where agent time goes, what blocks mergeable, what eats
  token spend. Same-day arc: pipeline revived (backfill + 1.0M spans to
  Phoenix + systemd timer — the feed had been dead since Jun 8/Jul 1), five
  mining lanes + synthesis in
  [`research/pulse-report.md`](./agent-effectiveness-pulse/research/pulse-report.md),
  two grilling rounds closed eleven decisions
  ([`DECISIONS.md`](./agent-effectiveness-pulse/DECISIONS.md)). **Wave-1
  graduated 2026-07-14** →
  [`goals/harness-otel-adoption`](../goals/harness-otel-adoption/README.md)
  (native harness OTel into dankserver's monitoring collector hub;
  attribution attributes) +
  [`goals/harness-hygiene-mechanical`](../goals/harness-hygiene-mechanical/README.md)
  (4 dead skills, cache-prefix eviction, 3 requested laws); forwarder
  durability landed as `ai-metrics-stack` P7f (v1-blocking, gates P7e).
  Wave-2 candidates (`yeet-verdict-instrumentation`, `repo-replay-evals`)
  gate on wave-1 OTel attributes flowing.
- [`agent-governance-control-plane`](./agent-governance-control-plane/README.md) —
  capture-stage preservation of the paused goal’s load-bearing governance
  design: ordered law canon, explicit role authority, gated lifecycle,
  decision-complete artifacts, and expiring exception contracts.
- [`knowledge-workspace`](./knowledge-workspace/README.md) — capture-stage
  product vision for an immutable event journal projected into a live graph,
  Lexical wiki-link authoring/backlinks, and auditable temporal replay; stale
  implementation anchors were deliberately discarded.
- [`project-intelligence`](./project-intelligence/README.md) — capture-stage
  condensation of the fixture-first watched-source research loop: repo-owned
  evidence authority, rebuildable projections, stable source lifecycle,
  untrusted-input boundaries, and deterministic briefs.
- [`stack-installer`](./stack-installer/README.md) — capture-stage preservation
  of approval-first repair UX, app/manual parity, fresh-machine evidence
  contracts, and the still-unclosed Windows proof gap.
- [`computable-workspace-geometry`](./computable-workspace-geometry/README.md) —
  pretext × dock kernel × blocks (stage `graduate`, opened 2026-07-12): text
  layout as pure arithmetic over shippable per-engine font metrics closes the
  workspace-as-data composition — rendered geometry becomes data, agents gain
  sight, and the dock-divergence "costs" audit came back almost empty of true
  costs. First proof landed same day:
  [`scratchpad/computable-layout`](../scratchpad/computable-layout/README.md)
  (browser-oracle fixture → pure greedy breaker reproduces Chrome's wrap
  counts under `bun test`). Same-day landings: minimum-extent constraints in
  the dock kernel itself (global floor + per-group `GroupMinimumLookup` via
  `requiredExtent`; kernel 72/72), `FontMetricsSnapshotV1` versioned
  envelope, and the full-circle proof (metrics → content minimum → kernel
  geometry → guaranteed one-line render). Align closed 2026-07-13: Q1
  RATIFIED (driver `@beep/pretext`), stage `graduate`, **goal #1 graduated →
  [`goals/pretext-driver`](../goals/pretext-driver/README.md)** (PR #391
  carries the arc). The thread-virtualization gate remains: secure beep-effect6
  editor-stack ownership and complete the pretext-driver handoff. Feeds
  [`docs/product/workspace-substrate.md`](../docs/product/workspace-substrate.md) §4–§5.
- [`atlas-synthesis`](./atlas-synthesis/README.md) — grounding/context packet
  (stage `research`): a maximal-fan-out synthesis of current repo state vs.
  goals/vision, centered on a gap map
  ([`synthesis/00-baseline-gap-map.md`](./atlas-synthesis/synthesis/00-baseline-gap-map.md)).
  The **capability-inventory half of the grand-vision exercise** (renamed from
  `baseline-synthesis`, 2026-06-17). First decomposition done (2026-06-17): graduated the
  office-action wedge into two goal packets —
  [`epistemic-claim-lifecycle-gate`](../goals/epistemic-claim-lifecycle-gate/README.md) (build
  first) and [`law-practice-office-action-spike`](../goals/law-practice-office-action-spike/README.md).
  More verticals (intake/drafting/contract review) follow once the loop turns once.
- [`solo-firm-docketing`](./solo-firm-docketing/README.md) — how Tom's solo IP
  practice deals with docketing (stage `graduate`, still active while gated
  candidates remain). Graduated 2026-07-14 into
  [`law-docketing-patent-spine`](../goals/law-docketing-patent-spine/README.md)
  and [`law-docketing-reliability`](../goals/law-docketing-reliability/README.md),
  with product orientation at
  [`docs/product/solo-firm-docketing.md`](../docs/product/solo-firm-docketing.md).
  Queued: CPI after the handroll-v1 trigger, trademark on a qualifying matter,
  court on a qualifying matter plus licensed-engine shape, and foreign on a
  qualifying matter plus licensed engine/source shape.
- [`ip-attorney-time-tracking`](./ip-attorney-time-tracking/README.md) —
  capture/prebill overlay for Tom's solo IP practice (stage `graduate`, still
  active while gated candidates remain). Graduated 2026-07-14 into
  [`law-time-capture-spine`](../goals/law-time-capture-spine/README.md), with
  product orientation at
  [`docs/product/ip-attorney-time-tracking.md`](../docs/product/ip-attorney-time-tracking.md).
  Queued: FreshBooks after its API/write/mapping P0, one M365 signal after its
  permission/sync/retention P0 and consent, PST on a demonstrated need,
  profitability after sufficient Slice 1 data, and LEDES/UTBMS on a client
  mandate with a concrete billing target.
- [`local-first-voice`](./local-first-voice/README.md) — privilege-safe voice for
  `apps/professional-desktop` (stage `graduate`, still active while follow-ons remain).
  Graduated 2026-07-14 into
  [`voice-composer-slice`](../goals/voice-composer-slice/README.md): local
  push-to-talk Moonshine dictation plus manual, interruptible Kokoro read-aloud,
  with the five-day Linux Tauri proof as fail-fast P0. Capture foundation and the
  general inference worker are absorbed until a second consumer appears. Provider
  ports, auto/streaming read-aloud, cloud transport, and voice-to-voice remain gated
  follow-ons off the proven slice.
- [`domain-layer-hardening`](./domain-layer-hardening/README.md) — systematic
  hardening of every product slice's domain/schema layer (entities, aggregates,
  value objects, typed errors) against a regret-minimization rubric + external
  best practice. At `graduate`: Phases 0–2 done (five-slice audit
  [`10`–`14`](./domain-layer-hardening/synthesis/) + rollup
  [`19`](./domain-layer-hardening/synthesis/19-phase1-crosscutting.md) + external
  grounding [`20`](./domain-layer-hardening/synthesis/20-external-law-and-ontology.md)/[`21`](./domain-layer-hardening/synthesis/21-external-signature-dms-notes-corpus.md));
  Phase 3 ([`BRIEF`](./domain-layer-hardening/BRIEF.md)+[`MAP`](./domain-layer-hardening/MAP.md))
  decomposed into **7 goal packets**. First goal
  [`domain-kernel-hardening`](../goals/domain-kernel-hardening/README.md) is
  paused until KG tables approach scale with PRD P2 librarian; packets 2–7 are
  held behind it. The six 2026-07-14 law consumers are packet-5 shaping inputs,
  not dependency clearance. Frontier was: 0 typed
  errors in 3 slices, two competing audit bases (`BaseEntity` vs unused
  `@beep/schema/DomainModel`), no soft-delete / temporal-validity / domain-event
  substrate, near-empty aggregates, law-practice rich-in-nouns-thin-in-lifecycle.
- **Gold-Intake cohort** (opened 2026-06-29, all at `research`-complete) — 13 new exploration
  packets reconciled from the 219-nugget gold-intake corpus; full matrix +
  provenance in [`_gold-intake/ROUTING.md`](./_gold-intake/ROUTING.md) /
  [`routing.json`](./_gold-intake/routing.json) (219/219 routed, user-approved). Each packet:
  CAPTURE seeded from its nuggets, `RESEARCH.md` (external landscape · in-repo inventory ·
  constraints), codex gate-1 folded, `DECISIONS.md` pre-drafted. **Graduate-now (Wave-1,
  user-confirmed):** [`uspto-patent-driver-depth`](./uspto-patent-driver-depth/README.md) (stage
  `graduate`, still active for queued/parked lanes): graduated
  [`uspto-prosecution-read`](../goals/uspto-prosecution-read/README.md) and
  [`uspto-ptmnfee2-ingest`](../goals/uspto-ptmnfee2-ingest/README.md) on
  2026-07-14,
  [`mcp-auth-gated-registration`](./mcp-auth-gated-registration/README.md)
  (Q1–Q7 resolved; [`mcp-kit`](../goals/mcp-kit/README.md),
  [`uspto-mcp`](../goals/uspto-mcp/README.md), and
  [`mcp-host-retrofit`](../goals/mcp-host-retrofit/README.md) completed-retained;
  write-wall gate remains for a named genuinely write-capable host),
  [`citation-grounding-hallucination-guard`](./citation-grounding-hallucination-guard/README.md)
  (stage `graduate`, still active while two lanes remain): graduated
  [`citation-verified-span-substrate`](../goals/citation-verified-span-substrate/README.md)
  and scaffolded
  [`citation-extraction-engine`](../goals/citation-extraction-engine/README.md)
  on 2026-07-14, with product doctrine at
  [`docs/product/citation-grounding.md`](../docs/product/citation-grounding.md).
  The engine is blocked by the verified-span substrate and
  [`court-reporter-vocabulary`](../goals/court-reporter-vocabulary/README.md);
  `citation-ground-before-cite` remains queued, with MPEP patterns, hosted
  enrichment, matter-wall enforcement, and rich-text annotation gated.
  [`effect-orchestration-patterns`](./effect-orchestration-patterns/README.md)
  (stage `graduate`, still active for four demand-gated candidates): graduated
  [`effect-v4-workflow-engine-spike`](../goals/effect-v4-workflow-engine-spike/README.md)
  on 2026-07-14. Consumer-led reframe: Effect v4 workflow and promoted
  `@beep/api-transport` supersede the original helper-bundle premise.
  **Queued (P2/P3, research-complete):**
  [`agent-memory-tiers-bitemporal-edges`](./agent-memory-tiers-bitemporal-edges/README.md)
  (stage `graduate`, still active for triage/retention lanes): graduated
  [`epistemic-bitemporal-edge-core`](../goals/epistemic-bitemporal-edge-core/README.md),
  the `@beep/epistemic-tables` port milestone whose landing triggers write-frozen
  operator Graphiti retirement without making product tables its backend,
  [`deterministic-doc-structure-extraction`](./deterministic-doc-structure-extraction/README.md)
  (stage `graduate`, still active for queued families/streaming/calibration):
  graduated [`law-doc-structure-oa-slice`](../goals/law-doc-structure-oa-slice/README.md)
  on 2026-07-14; it consumes the verified-span substrate and feeds the
  patent-docketing spine,
  [`court-vocabulary-resolver`](./court-vocabulary-resolver/README.md) (stage
  `graduate`, still active for resolver/fuzzy/SKOS lanes): graduated
  [`court-reporter-vocabulary`](../goals/court-reporter-vocabulary/README.md)
  on 2026-07-14,
  [`ingestion-security-secret-governance`](./ingestion-security-secret-governance/README.md)
  (stage `graduate`, still active across two tracks): graduated
  [`ingestion-secret-scrub`](../goals/ingestion-secret-scrub/README.md) while five
  content-security/secret-governance candidates remain gated,
  [`rag-retrieval-projection`](./rag-retrieval-projection/README.md) (stage
  `graduate`, still active for four gated satellites): graduated
  [`hybrid-retrieval-fusion-core`](../goals/hybrid-retrieval-fusion-core/README.md),
  the single RRF-layer owner,
  [`secure-document-download-proxy`](./secure-document-download-proxy/README.md)
  (stage `graduate`, still active for three gated candidates): graduated
  [`secure-document-delivery`](../goals/secure-document-delivery/README.md) on
  2026-07-14,
  [`local-first-projection-sync`](./local-first-projection-sync/README.md) (stage
  `graduate`, still active for gated projector/topology candidates): graduated
  [`projection-dispatch-core`](../goals/projection-dispatch-core/README.md) on
  2026-07-14. Plus **9 non-invasive
  Case-A research notes** folded into existing goals (`file-processing-capability` OCR,
  `langextract-capability` anti-inference, `law-practice-office-action-spike` IP-depth,
  `law-practice-office-action-extraction-rung` relational-grid, `ip-law-knowledge-graph` CPC/IPC,
  `agent-governance-control-plane`, `epistemic-claim-lifecycle-gate` claim-gate,
  `workspace-thread-domain` branching, `agentic-professional-runtime` agent-skills) — SPECs
  untouched. Every gold-intake packet now carries a `research/SOURCES.md`
  provenance ledger (mined nuggets + upstream repos/licenses + external
  citations + in-repo bricks), registered in its manifest and cross-linked
  exploration↔goal (2026-06-30). Next: `/grill-with-docs` the four graduate-now wedges → shape → decompose → graduate.
- [`identity-as-iri`](./identity-as-iri/README.md) (opened 2026-07-01, at
  `graduate`; capture→graduate in two days — 3 spec docs, 12 repo-mining
  reports, 3 audits, adversarially-verified synthesis, 6 decisions,
  `goals/ontology-modeling-foundation` superseded, design proven by the
  effect-only `scratchpad/identity` prototype at 27/27).
  [`identity-iri-core`](../goals/identity-iri-core/README.md) is complete;
  [`identity-iri-fold`](../goals/identity-iri-fold/README.md) graduated
  2026-07-14; `identity-iri-fibered` remains gated behind it
  ([`MAP.md`](./identity-as-iri/MAP.md)) — merge `IdentityComposer`, the ontology layer, and fibered
  metadata retrieval: identity path and IRI as two literal-typed encodings of
  one value, borrowed RDF vocab as CURIE literal types, `$I.ontology` fold
  over triples-as-tuples, `Fibered` kit from the `JSDocTagDefinition.make`
  pattern. Seeded from a locked design handoff
  ([`assets/identity-iri-fibration-handoff.md`](./identity-as-iri/assets/identity-iri-fibration-handoff.md),
  D1–D9). Exploration's job: first-principles spec grounding (RFC/W3C prose),
  repo audits (`SemanticSchemaMetadata`, `Id.ts` coupling, supersede
  `goals/ontology-modeling-foundation`), and an effect-only scratchpad
  prototype proving types/ergonomics before the packaging call
  (all-in-`@beep/identity` vs identity/rdf/ontology split).
- [`openclaw-deployment-platform`](./openclaw-deployment-platform/README.md) —
  Effect-native OpenClaw deployment platform (stage `decompose`, opened
  2026-07-24, GATE B passed same day): deploy a professional, legal-focused
  OpenClaw agent on the workstation through a Pulumi + Effect stack, then
  migrate dankserver's ~4790-line Ansible openclaw role onto what greenfield
  proves. Research (merged as #439): four cited legs + config-internals
  source dive + 12-finding adversarial pass → locked design is
  `OpenClawGeneration` revisions in a root-owned config root
  (`OPENCLAW_NIX_MODE` as defense-in-depth only), desired-intent schema +
  versioned render adapters in a new `@beep/openclaw` driver, shared
  renderers + explicit applicator contracts, Telegram v1, op:// refs with
  one recorded bootstrap-credential exception; 22 decisions in
  [`DECISIONS.md`](./openclaw-deployment-platform/DECISIONS.md).
  [`MAP.md`](./openclaw-deployment-platform/MAP.md): `openclaw-workstation-agent`
  (P0 = four-prototype gauntlet) then `dankserver-openclaw-migration`.
  Next: GATE C grilling → graduation.
### Proposed

- (none — `atlas-synthesis` is now an Active packet above; its capability-inventory
  half is done and the outcome-decomposition half is its next stage.)

### Parked

- [`effect-ontology-harvest`](./effect-ontology-harvest/README.md) — parked
  2026-07-14 at align-complete: harvest-not-port complete with zero goals by
  design; demand gates and reference routes are recorded, and every item must
  be re-verified with exact source/notice attribution before any port.
- `effect-capability-kg` (parked 2026-06-17; packet removed 2026-06-18) —
  tooling-first deterministic Effect v4 capability graph (JSDoc-derived ontology,
  specialist profiles, judge routing, advisory hook backpressure). The exploration
  directory and its `effect-capability-kg-seed` goal packet were deleted in commit
  `8852619f04` (`chore: remove repo-exports catalog + Reuse + effect-capability-kg`),
  so no packet artifacts remain in-tree; history lives in git and in
  `standards/memory-architecture/04-decision-log.md` (2026-06-17). Resume on an
  explicit decision to invest in agent capability guidance, as a fresh packet.

### Graduated

- [`graph-3d-navigation`](./graph-3d-navigation/README.md) — graduated
  2026-07-14 into [`graph-3d-view`](../goals/graph-3d-view/README.md) (generic
  3D graph component → ontology-workbench 2D/3D toggle, cosmos stays default,
  ~2.5k-node target). Reverse-engineered the graph.infranodus.com 3D style
  clean-room (three.js r158 + d3-force-3d, ColorBrewer Paired community colors,
  betweenness-proportional distance-faded Sprite labels with adaptive-budget
  declutter, tube edges, 0.10/0.35 selection dimming, z-flatten toggle) via 6
  codex lanes + a verify gate over two corroborating browser passes; the
  reference-only capture corpus is gitignored (see
  [`SEED-INVENTORY.md`](./graph-3d-navigation/research/SEED-INVENTORY.md)).
- [`gov-legal-data-driver-codegen`](./gov-legal-data-driver-codegen/README.md) —
  graduated after the codegen substrate and `@beep/api-transport` promotion
  completed: [`gov-legal-data-driver-codegen`](../goals/gov-legal-data-driver-codegen/README.md),
  paused named-consumer delivery in
  [`gov-legal-data-driver-delivery`](../goals/gov-legal-data-driver-delivery/README.md),
  and collision-safe MCP sibling
  [`gov-legal-mcp`](../goals/gov-legal-mcp/README.md).
- [`legal-ontology-landscape`](./legal-ontology-landscape/README.md) — research
  complete; [`semantic-foundation`](../goals/semantic-foundation/README.md)
  owns active M1 execution, while
  [`trademark-docketing-domain`](../goals/trademark-docketing-domain/README.md)
  remains a paused stub behind M3.
- [`multi-provider-llm-dispatch-fallback`](./multi-provider-llm-dispatch-fallback/README.md)
  — graduated 2026-07-14 on its shipped auth leg,
  [`llm-provider-subscription-auth`](../goals/llm-provider-subscription-auth/README.md).
  The `llm-runtime-dispatch` remainder is demand-gated until a real consumer
  requires two compatible, credential-resolvable runtime targets; then it owns
  ordered runtime `ExecutionPlan` policy only.
- [`ontology-agent-surface`](./ontology-agent-surface/README.md) — graduated
  2026-07-11 into
  [`ontology-agent-surface`](../goals/ontology-agent-surface/README.md): a
  curated ontology MCP toolkit on the professional-desktop sidecar, stateless
  over saved Turtle files with fingerprint CAS and guarded by authenticated
  streamable HTTP, TierGate, per-change attribution, and static budgets. First
  live slice: `capability-metadata` + `sparql-query` from an actual MCP client;
  P0 folds in verified-repair, base-prefix, and ROBOT hardening.
- [`skillopt-training-pilot`](./skillopt-training-pilot/README.md) — graduated
  2026-07-06 (same-day compressed ceremony; BRIEF signed off) into
  [`skillopt-training-pilot`](../goals/skillopt-training-pilot/README.md):
  train `.claude/skills/schema-first-development` with microsoft/SkillOpt
  (MIT) against a ≥10-task law-scored eval suite composed from existing
  bricks (QualityWorkerEval runner, ai-metrics BenchmarkCase, schema-first/
  tsgo scorers, `beep worktree` throwaways; Phoenix stretch). Loop-runs =
  success bar; adoption out of scope; revives the superseded
  phoenix-enrichment experiments/evals slices.
- [`agent-pipeline-velocity`](./agent-pipeline-velocity/README.md) — graduated
  2026-07-05 (same-day compressed ceremony) into a single goal packet
  [`agent-pipeline-velocity`](../goals/agent-pipeline-velocity/README.md):
  agent context economy (single-sourced instruction laws, progressive-disclosure
  skills, permission allowlist + hooks) + time-to-mergeable-PR (greptile-only
  reviews, read-only PR turbo cache, green main, yeet instrumentation/parity,
  `beep worktree`), one PR. Absorbs/supersedes 4 packets
  (agent-effectiveness-{phoenix-enrichment,workflow-integration},
  yeet-{operator-clarity,pr-closeout-loop}); continues repo-quality-throughput
  numbering at rqt-011. Grounded by 3 baseline sweeps + 2 in-repo audits +
  an 11-finding adversarially-verified deep-research report.
- [`microsoft-365-integration`](./microsoft-365-integration/README.md) —
  graduated 2026-06-18 into two goal packets:
  [`m365-driver`](../goals/m365-driver/README.md) (the `@beep/m365` native
  Microsoft Graph driver — delegated auth-code+PKCE, read verbs for
  OneDrive/SharePoint + Outlook mail/calendar, write-ready shape) and
  [`m365-mcp`](../goals/m365-mcp/README.md) (exposes the driver's read verbs as
  the repo's own MCP server, the `@beep/nlp-mcp` pattern). Follow-on named in its
  MAP: `m365-document-ingest` (gated on the document-portal MVP).
- [`docx-roundtrip-interop`](./docx-roundtrip-interop/README.md) — graduated
  2026-06-15 into
  [`pandoc-ast-foundation`](../goals/pandoc-ast-foundation/README.md), the pure
  schema-first Pandoc JSON AST mirror and `@beep/md` compatibility proof.
  Follow-ons named in its MAP: pandoc-driver-sidecar, docx-fixture-pipeline,
  document-ast-decision.
- [`agent-chat-interface`](./agent-chat-interface/README.md) — graduated
  2026-06-12 into three goal packets:
  [`rich-text-foundation`](../goals/rich-text-foundation/README.md),
  [`workspace-thread-domain`](../goals/workspace-thread-domain/README.md),
  [`desktop-chat-surface`](../goals/desktop-chat-surface/README.md)
  (depends on the first two). Follow-ons named in its MAP:
  acp-chat-binding, proposal-blocks, attachment/table blocks,
  thread-pdf-export.

### Killed

(none yet — epitaphs go here, one line each)
