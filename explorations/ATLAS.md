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

- [`lynx-lkg-ontology-grounding`](./lynx-lkg-ontology-grounding/README.md) —
  align-stage: deep-dive of the Lynx project's Legal Knowledge Graph ontology
  (https://lynx-project.eu/doc/lkg/) and its 15 reference ontologies, grounded
  against beep-effect's semantic/KG capability (successor strand to graduated
  `legal-ontology-landscape`, which cited Lynx in one line only). Research
  landed 2026-08-06: Lynx is a pattern donor, not a vocabulary donor — five
  ranked opportunities in `research/05-value-assessment.md` (lead: attributed
  multi-claim span annotation; `lkg.ttl` as first VETTED vendor slice); zero
  patent/IP modelling in the whole corpus, so semantic-foundation M2/M3 gaps
  stay open. Next: grill the five open questions.
- [`graphnosis-prior-art`](./graphnosis-prior-art/README.md) — shape-stage:
  mined the Apache-2.0 Graphnosis dual-graph memory engine plus four papers
  (two Zenodo preprints, two arXiv; all CC BY 4.0, linked from
  [`assets/README.md`](./graphnosis-prior-art/assets/README.md)) against the
  live checkout — 191 mappings, beep-effect partial-or-better on 78%. Yield:
  26 amendments to existing packets and shipped code
  ([`AMENDMENTS.json`](./graphnosis-prior-art/research/AMENDMENTS.json)),
  three live-defect findings (WinkCorpus tie-break, DocText WorkerTransport
  leak, law-scan vacuity), and a dissolve verdict with exactly two
  graduations (`epistemic-contradiction-detection`, repo-law bundle). Align
  Q1–Q10 resolved 2026-08-06
  ([`DECISIONS.md`](./graphnosis-prior-art/DECISIONS.md)); next: BRIEF for
  the two graduations, then the amendment-application pass.
- [`full-document-editor`](./full-document-editor/README.md) — graduate-stage
  initiative for a configurable full-document substrate and eventual
  Professional Desktop document Portal. A live Lexical Playground `0.49.0`
  audit captured 17 screenshots, keybindings, highlighting, inserts, settings,
  and accessibility gaps; a pinned source audit reconciled the node/plugin
  registration graph at commit `a933222`. Architecture grill D1-D27 keeps
  `@beep/md` canonical, Lexical/Pandoc as projections, product profiles
  app-owned, and collaboration/redlining/DOCX/PDF/Portal work sequenced after
  single-user parity. First goal graduated:
  [`lexical-playground-capability-atlas`](../goals/lexical-playground-capability-atlas/README.md).
- [`legal-patent-kg-deepening`](./legal-patent-kg-deepening/README.md) —
  align-stage: wave 2 of the legal/patent ontology-KG strand
  (`legal-ontology-landscape` graduated into
  [`semantic-foundation`](../goals/semantic-foundation/README.md)); campaign
  complete — 122 distillates, four verified track syntheses, /adhd pass, and
  the routing seed (8 clusters, 4 proposed slugs) SIGNED OFF in the
  2026-08-01 reconciliation grill with remo1/remo2/remo3 resolved without
  supersession; first wedge opened 2026-08-04 (phase-2 grill; the
  contradiction-semantics cluster re-routed to ride with
  `legal-position-relator-runtime`); queued wedges UNBLOCKED 2026-08-04 (the
  decided milestone — the candor BRIEF's approval — was reached the same
  day). The first two wedges are fully GRADUATED: the first 2026-08-04 into
  [`goals/patent-citation-candor-gate`](../goals/patent-citation-candor-gate/README.md)
  (graduation PR #560 merged 2026-08-05; implementation PR #575 merged
  2026-08-06), and the second — opened 2026-08-05 carrying the
  contradiction-semantics cluster — 2026-08-06 into
  [`goals/legal-position-relator-runtime`](../goals/legal-position-relator-runtime/README.md).
  Third wedge
  [`patent-drafting-episode-ledger`](./patent-drafting-episode-ledger/README.md)
  OPENED 2026-08-06 (capture stage). Next: the FunctionalUnit extension on
  Benjamin's call.
- [`patent-drafting-episode-ledger`](./patent-drafting-episode-ledger/README.md) —
  capture-stage third wedge of the `legal-patent-kg-deepening` routing matrix
  (opened 2026-08-06): a law-owned, append-only `DraftingEpisode` product
  record — closed event union + pure replay fold over outline, retrieval,
  chunk generation, limitation support, deterministic validation, bounded
  retry, correction delta, and attorney disposition — whose first rung is the
  `ClaimLimitationSupportSet` promotion gate (a submachine sharing
  `RuntimeApprovalGate`, merged in by the 2026-08-01 reconciliation grill),
  with deterministic retrieval disclosed through a machine-readable answer
  annex and memory engines behind an engine-agnostic `MemoryProjection` port
  as lossy rebuildable projections with recent-raw fallback — the resolved
  remo2/remo3 boundaries binding (no persistent graph store; no projection
  becomes authority; the 2026-08-06 operator dev-memory role change leaves
  the product/operator boundary untouched). Eleven nuggets seeded verbatim;
  two research lanes locked; the align session is Benjamin's.
- [`context-rent-telemetry`](./context-rent-telemetry/README.md) — capture-stage
  spin-off of [`goals/knowledge-surface-automation`](../goals/knowledge-surface-automation/README.md):
  instrument which always-loaded guidance lines (CLAUDE.md / AGENTS.md / skill
  frontmatter) actually change agent behavior, so context pruning becomes
  empirical instead of taste; candidate backend is the
  agent-effectiveness-loop Phoenix substrate.
- [`bitemporal-goal-roadmap`](./bitemporal-goal-roadmap/README.md) — capture-stage
  spin-off of [`goals/knowledge-surface-automation`](../goals/knowledge-surface-automation/README.md)
  and named sibling of
  [`goals/epistemic-bitemporal-edge-core`](../goals/epistemic-bitemporal-edge-core/README.md):
  `beep goals next --as-of <commit|date>` replays the capability roadmap graph
  over an event ledger; deliberately outside Workstream D's now-view v1.
- [`agent-governance-control-plane`](./agent-governance-control-plane/README.md) —
  capture-stage preservation of the paused goal’s load-bearing governance
  design: ordered law canon, explicit role authority, gated lifecycle,
  decision-complete artifacts, and expiring exception contracts.
- [`fleet-coordination`](./fleet-coordination/README.md) — graduate-stage: ~13
  agent checkouts on one workstation duplicating each other’s fixes and rotting
  each other’s in-flight PRs. Research verdict is a derived **mirror**, not a
  message board — derive early, deliver ambiently, enforce late — shipped
  through the reserved `AgentBrief.fleet` field. First goal graduated 2026-08-06:
  [`fleet-mirror`](../goals/fleet-mirror/README.md) (D6), scoped to the
  **derivation rung**, which the capability check proved depends on nothing
  unmerged; the **delivery rung** stays here, gated on PR-I landing
  `AgentBrief`/`OwnershipClaim`. Grill #1
  locked D1–D5 and disposed four questions; en route it killed `law-pulse.sh`
  ever reaching the model (fixed here), `beep yeet` being a gate, `flock`
  releasing on holder death, and merge queue at this repo’s measured shape (19%
  main gauntlet pass rate).
- [`model-artifact-admission`](./model-artifact-admission/README.md) —
  capture-stage: bind model qualification to the exact model, adapter,
  modality, prompt, wrapper, decoding configuration, and artifact digest —
  no qualification transfer across any substitution; routed out of
  `academia-corpus-mining` (align dispatch 2026-07-25).
- [`epistemic-belief-view-revision`](./epistemic-belief-view-revision/README.md) —
  capture-stage: a recoverable, replayable projection that selects one working
  assertion per logical lineage (or abstains) under a named policy, revised by
  new versions with causal ancestry rather than by mutating evidence. Routed out
  of `academia-corpus-mining` (align dispatch 2026-07-25, master Q4: the first
  composition over the bitemporal core) once
  [`epistemic-bitemporal-edge-core`](../goals/epistemic-bitemporal-edge-core/README.md)
  landed. Carries master align Q1 (verdict-family naming) and Q3 (retention
  classes for prunable projections).
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
  **closed `graduated` 2026-07-25** — the write wall was absorbed into
  [`agent-execution-authority`](../goals/agent-execution-authority/README.md)
  as its MCP sink class),
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
  (stage `graduate`, still active for the retention lane): graduated
  [`epistemic-bitemporal-edge-core`](../goals/epistemic-bitemporal-edge-core/README.md),
  the `@beep/epistemic-tables` port milestone whose landing triggers write-frozen
  operator Graphiti retirement without making product tables its backend —
  closed `completed-retained` 2026-07-25, which cleared the order-2 gate and
  graduated
  [`epistemic-contradiction-triage`](../goals/epistemic-contradiction-triage/README.md)
  the same day (approval-gated `CONTRADICTS` candidates; Deferred spike B is its
  P0 hard gate). Retention/tier projections remain the only queued lane,
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

### Proposed

- (none — `atlas-synthesis` is now an Active packet above; its capability-inventory
  half is done and the outcome-decomposition half is its next stage.)

### Parked

- [`academia-corpus-mining`](./academia-corpus-mining/README.md) — parked
  2026-07-25 at align-complete with all 15 high-priority routes dispatched:
  443 canonical Academia.edu papers mined in tiers (T1 triage of all 443,
  185 Sol-max T2 deep-reads — 42 gold / 125 silver / 15 bronze / 3 dross —
  7 cluster reports + a repo-grounded master synthesis with a 36-route
  table). Nine align decisions landed 2026-07-25: 11 bounded dispatch notes
  into target packets, 2 new capture packets (`agent-execution-sandbox`,
  `model-artifact-admission`), prose-to-proof/approval-policy fact language
  replaced with typed-verdict vocabulary, memory-layer-taxonomy
  episodic/projection split, belief views first over the bitemporal core,
  argumentation after semantic-foundation M1. Medium/low routes stay
  recorded in the master table; the June-29 prior synthesis stays adopted
  (snippets errata-flagged); the normalized corpus lives externally
  (`~/YeeBois/research/academia-2026-07/`). Revival trigger: the approved
  wave-2 backlog run (97 legal-NLP/extraction papers first).
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

- [`legal-position-relator-runtime`](./legal-position-relator-runtime/README.md) —
  graduated 2026-08-06 (opened 2026-08-05) into
  [`goals/legal-position-relator-runtime`](../goals/legal-position-relator-runtime/README.md):
  second wedge of the `legal-patent-kg-deepening` routing matrix, carrying the
  re-routed contradiction-semantics cluster. A closed eight-member
  `HohfeldPosition` domain whose correlative and opposite derivations range over
  `(kind, content)` — the opposite one negating act/omission polarity in the
  same step, without which it manufactures false contradictions — plus a simple
  `LegalPositionRelator` storing one advantage-side relation and deriving every
  other view, and rung-2 authority-gated transition events that keep attempted
  and ineffective acts on record. Two research lanes (repo surfaces; Hohfeld /
  FLINT / UFO-L legal frame), six align branches closed in one pass, a BRIEF
  hardened by a three-lens Opus review (39 findings, 5 P1), and a
  one-packet/two-rung MAP ([`MAP.md`](./legal-position-relator-runtime/MAP.md))
  whose capability anchors were re-verified against `main` after the candor
  sibling's implementation landed. FLINT/UFO-L donor verdicts: `P100`
  verified-with-correction, `R25` verified with the Apache/MPL split confirmed
  on the real TNO GitLab files; both promoted to `adopt` in the parent ledger.
- [`patent-citation-candor-gate`](./patent-citation-candor-gate/README.md) —
  graduated 2026-08-04 (opened, researched, aligned, shaped, and graduated in
  one day) into
  [`goals/patent-citation-candor-gate`](../goals/patent-citation-candor-gate/README.md):
  first wedge of the `legal-patent-kg-deepening` routing matrix — a law-owned
  `PatentCitationEvent` + attorney `CandorDisposition` gate whose derived,
  fail-closed `CandorPolicy` predicate blocks filing promotion while any
  current AI-discovered patent reference lacks a disposition bound to its
  exact observation version; no legal judgment ever computed. Two research
  lanes (repo surfaces; 37 CFR 1.56/1.97/1.98 + MPEP 2001/609 + Therasense
  never-compute boundary), four align branches + deferrals, a twice-hardened
  BRIEF (three-lens Opus review, 24 findings; four PR #557 refinements), and
  a one-packet/two-rung MAP with follow-ons named-not-graduated
  ([`MAP.md`](./patent-citation-candor-gate/MAP.md)).
- [`agent-effectiveness-pulse`](./agent-effectiveness-pulse/README.md) — fully
  graduated 2026-07-31 (opened 2026-07-14). A data-driven pulse on repo agent
  friendliness/effectiveness: pipeline revived same-day (backfill + 1.0M spans
  to Phoenix + systemd timer), five mining lanes + synthesis in
  [`research/pulse-report.md`](./agent-effectiveness-pulse/research/pulse-report.md),
  grilling rounds closed twelve decisions
  ([`DECISIONS.md`](./agent-effectiveness-pulse/DECISIONS.md)). **Wave-1
  graduated 2026-07-14** →
  [`goals/harness-otel-adoption`](../goals/harness-otel-adoption/README.md) +
  [`goals/harness-hygiene-mechanical`](../goals/harness-hygiene-mechanical/README.md);
  forwarder durability landed as `ai-metrics-stack` P7f. **Wave-2 graduated
  2026-07-31** → one packet,
  [`goals/coding-agent-effectiveness-evidence-loop`](../goals/coding-agent-effectiveness-evidence-loop/README.md),
  absorbing the ratified `yeet-verdict-instrumentation` + `repo-replay-evals`
  splits after the 2026-07 Codex bottleneck audit; plan amended via a
  five-frame `/adhd` run + operator interview (flight-record truth model,
  Yeet mistrial doctrine, sequence-break notification instrument, five
  evidence-integrity laws — inventory in the packet's
  `research/2026-07-31-adhd-amendments.md`).
- [`effect-jsdoc-quality`](./effect-jsdoc-quality/README.md) — graduated
  2026-07-30 (capture→graduate in one day) into
  [`effect-jsdoc-quality`](../goals/effect-jsdoc-quality/README.md): port
  Effect v4's JSDoc section grammar (**When to use**/**Details**/**Gotchas**/
  titled **Example** sections, described `@see`) into beep law + kind-aware
  jsdoc-inventory rules on the existing fail-on-growth ratchet, keeping the
  example compile validation Effect v4 lost when it banned `@example`. Twelve
  decisions in [`DECISIONS.md`](./effect-jsdoc-quality/DECISIONS.md), carrier
  choice settled by a WebStorm hover-fidelity lab (body sections render at
  full Effect fidelity; the `@example` tag body renders degraded). Follow-on
  candidates (link resolution, rubric CI lane, runExamples, category
  vocabulary repair, LLMS corpus) mapped but NOT graduated in
  [`MAP.md`](./effect-jsdoc-quality/MAP.md).
- [`agent-execution-sandbox`](./agent-execution-sandbox/README.md) — graduated
  2026-07-25 (capture→graduate in one day) into
  [`agent-execution-authority`](../goals/agent-execution-authority/README.md):
  a default-deny authority boundary over the MCP agent surface with a
  hash-chained append-only record of every decision and outcome. Routed out of
  `academia-corpus-mining`. 14 decisions in
  [`DECISIONS.md`](./agent-execution-sandbox/DECISIONS.md) — align 1–6 (first
  fixture = privileged read + outbound sink, absorbing
  `mcp-auth-gated-registration`'s `mcp-write-wall`; schema-native in-process
  grants; tamper-evident-only ledger; grant schema in `epistemic/domain`) and
  shape 7–14 from a doctrine grilling pass that overturned the original
  enforcement design: `foundation` may not import a slice, so the evaluator
  became a slice-side implementation of `mcp-kit`'s **existing** `TierGate`
  port rather than a generalization of it. Scoping to the MCP branch alone
  collapsed the build to one composition root and eliminated the
  telemetry-recursion hazard. Both mechanisms proven by spike
  (`FetchHttpClient.Fetch` override reaches sealed drivers; plpgsql triggers
  work in PGlite) — though the `Fetch` half is proven only for a
  directly-provided effect, and the goal carries a blocking check for the
  server-dispatched case. Three dependent candidates stay named in
  [`MAP.md`](./agent-execution-sandbox/MAP.md) (chat egress, host isolation,
  record anchoring), each blocked on a fact that does not exist yet.
- [`openclaw-deployment-platform`](./openclaw-deployment-platform/README.md) —
  graduated 2026-07-25 (capture→graduate in two days) into
  [`openclaw-workstation-agent`](../goals/openclaw-workstation-agent/README.md):
  a legal-focused OpenClaw agent on the workstation as immutable,
  generation-based Pulumi+Effect infrastructure — `OpenClawGeneration`
  revisions in a root-owned config root, desired-intent schema + versioned
  render adapters in a new `@beep/openclaw` driver, op:// refs with one
  recorded bootstrap-credential exception, Telegram v1; goal P0 is the
  four-prototype gauntlet that hard-gates implementation. 29 decisions in
  [`DECISIONS.md`](./openclaw-deployment-platform/DECISIONS.md); research
  merged as #439, shape/decompose as #440. GATE C struck the dankserver
  migration entirely — dankserver stays on Ansible; the platform deploys NEW
  instances only.
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
  owns active M1 execution, while `trademark-docketing-domain` remains a
  paused stub behind M3 (packet no longer in the working tree; history in
  git).
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
