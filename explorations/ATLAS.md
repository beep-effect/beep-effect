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
  package barrels (`packages/*/*/*/src/index.ts`).
- Package families: `packages/{foundation,shared,drivers,tooling}` (substrate),
  `packages/{workspace,agent-capability,epistemic,law-practice,architecture-lab}`
  (slices), `apps/*` (runtimes).

## Explorations

### Active

- [`packet-system-redesign`](./packet-system-redesign/README.md) —
  decompose-stage: operator signed off [`BRIEF.md`](./packet-system-redesign/BRIEF.md)
  on 2026-08-13; [`MAP.md`](./packet-system-redesign/MAP.md) now proposes the
  single colocated packet-core, design/approval gate, projection migration,
  evidence closure, and gated React v2 packets app. D8 keeps one core behind
  existing CLI groups; D9 self-hosts the first advisory slice; D12 leaves KSA
  owning static HTML v1. Next: operator MAP review; no goals exist yet.
- [`typed-agent-skill-contracts`](./typed-agent-skill-contracts/README.md) —
  graduate-stage, still active: spine graduated 2026-08-13 to
  [`goals/skill-contract-kernel/`](../goals/skill-contract-kernel/README.md)
  (`@beep/skill-contract` foundation/modeling kernel + qa judge-gate retrofit +
  SKILL.md render-as-encode projection). Waves 2–6 (KG ingestion, ops ladder,
  browser leases, memory routing, fleet protocols) remain candidates in
  [`MAP.md`](./typed-agent-skill-contracts/MAP.md); decision log in
  [`DECISIONS.md`](./typed-agent-skill-contracts/DECISIONS.md).
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
- [`model-artifact-admission`](./model-artifact-admission/README.md) —
  align-stage: ratify identity assurance, requalification policy, and scoped
  human dispositions for exact, digest-bound model arrangements.
- [`epistemic-belief-view-revision`](./epistemic-belief-view-revision/README.md) —
  align-stage: ratify contention grouping, selection/abstention policy, and
  replayable belief-view materialization over a new cross-lineage authority query.
- **Gold-Intake cohort** (opened 2026-06-29, all at `research`-complete) — 13 new exploration
  packets reconciled from the 219-nugget gold-intake corpus; full matrix +
  provenance in [`_gold-intake/ROUTING.md`](./_gold-intake/ROUTING.md) /
  [`routing.json`](./_gold-intake/routing.json) (219/219 routed, user-approved). Each packet:
  CAPTURE seeded from its nuggets, `RESEARCH.md` (external landscape · in-repo inventory ·
  constraints), codex gate-1 folded, `DECISIONS.md` pre-drafted.
  **Graduate-now (Wave-1, user-confirmed):**
  [`mcp-auth-gated-registration`](./mcp-auth-gated-registration/README.md)
  (Q1–Q7 resolved; [`mcp-kit`](../goals/mcp-kit/README.md),
  [`uspto-mcp`](../goals/uspto-mcp/README.md), and
  [`mcp-host-retrofit`](../goals/mcp-host-retrofit/README.md) completed-retained;
  **closed `graduated` 2026-07-25** — the write wall was absorbed into
  [`agent-execution-authority`](../goals/agent-execution-authority/README.md)
  as its MCP sink class),
  [`citation-grounding-hallucination-guard`](./citation-grounding-hallucination-guard/README.md)
  (closed `graduated` 2026-08-13): graduated
  [`citation-verified-span-substrate`](../goals/citation-verified-span-substrate/README.md)
  and scaffolded
  [`citation-extraction-engine`](../goals/citation-extraction-engine/README.md)
  on 2026-07-14, with product doctrine at
  [`docs/product/citation-grounding.md`](../docs/product/citation-grounding.md).
  The engine is blocked by the verified-span substrate and
  [`court-reporter-vocabulary`](../goals/court-reporter-vocabulary/README.md);
  `citation-ground-before-cite` is the reopen-at-`decompose` point once both
  prerequisites land, with MPEP patterns, hosted
  enrichment, matter-wall enforcement, and rich-text annotation gated.
  **Queued (P2/P3, research-complete):**
  [`agent-memory-tiers-bitemporal-edges`](./agent-memory-tiers-bitemporal-edges/README.md)
  (closed `graduated` 2026-08-13): graduated
  [`epistemic-bitemporal-edge-core`](../goals/epistemic-bitemporal-edge-core/README.md),
  the `@beep/epistemic-tables` port milestone whose landing triggers write-frozen
  operator Graphiti retirement without making product tables its backend —
  closed `completed-retained` 2026-07-25, which cleared the order-2 gate and
  graduated
  [`epistemic-contradiction-triage`](../goals/epistemic-contradiction-triage/README.md)
  the same day (approval-gated `CONTRADICTS` candidates; Deferred spike B is its
  P0 hard gate), then graduated
  [`epistemic-memory-retention-projections`](../goals/epistemic-memory-retention-projections/README.md)
  on 2026-08-13 (repo-native mechanism now; policy-as-data behind calibration;
  standalone tier/memory-pressure report plus delete/rebuild first; RRF
  follow-on),
  [`deterministic-doc-structure-extraction`](./deterministic-doc-structure-extraction/README.md)
  (closed `graduated` 2026-08-13; four MAP re-entry points):
  graduated [`law-doc-structure-oa-slice`](../goals/law-doc-structure-oa-slice/README.md)
  on 2026-07-14; it consumes the verified-span substrate and feeds the
  patent-docketing spine,
  [`court-vocabulary-resolver`](./court-vocabulary-resolver/README.md) (stage
  `graduate`, closed `graduated` 2026-08-13): graduated
  [`court-reporter-vocabulary`](../goals/court-reporter-vocabulary/README.md)
  on 2026-07-14,
  [`ingestion-security-secret-governance`](./ingestion-security-secret-governance/README.md)
  (closed `graduated` 2026-08-13 with five re-entry points): graduated
  [`ingestion-secret-scrub`](../goals/ingestion-secret-scrub/README.md) while five
  content-security/secret-governance candidates remain gated,
  [`local-first-projection-sync`](./local-first-projection-sync/README.md) (stage
  `graduate`, closed `graduated` 2026-08-13 with three re-entry points): graduated
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
### Proposed

- (none)

### Parked

- [`project-intelligence`](./project-intelligence/README.md) — parked
  2026-08-13, superseded by the operating loop in
  `goals/nightly-research-routine`; resume when a legal-grade provenance
  consumer demands byte-reproducible authority.
- [`knowledge-workspace`](./knowledge-workspace/README.md) — parked 2026-08-13
  as a vision archive; the workspace-thread-domain / rich-text line is the
  product path. Resume when the workspace product bet returns, with the first
  vertical consuming `epistemic-bitemporal-edge-core` as a projection.
- [`stack-installer`](./stack-installer/README.md) — parked 2026-08-13 as a
  pattern archive; resume when product pull adopts the approval-first repair
  and fresh-machine evidence pattern.
- [`agent-governance-control-plane`](./agent-governance-control-plane/README.md)
  — parked 2026-08-13 behind `agentic-governance-laws` and completed
  `agent-execution-authority`; resume if the laws goal needs the full
  role-authority / expiring-exception protocol.
- [`domain-layer-hardening`](./domain-layer-hardening/README.md) — parked
  2026-08-13 to mirror roadmap-paused `domain-kernel-hardening`; resume when
  that goal unpauses, then give packets 2–7 a fresh align/shape pass.
- [`bitemporal-goal-roadmap`](./bitemporal-goal-roadmap/README.md) — parked
  2026-08-13 until knowledge-surface-automation Workstream D ships the now-view
  roadmap projection; decide the ledger-source fork at unpark.
- [`context-rent-telemetry`](./context-rent-telemetry/README.md) — parked
  2026-08-13 until knowledge-surface-automation Workstream C ships pruning-
  proposal machinery; decide the A/B guidance-degraded-session question at
  unpark.

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
  (`~/YeeBois/research/academia-2026-07/`). Wave 2 executed 2026-08-13 after
  operator-ratified re-triage: 199 no-note papers classified core 2 / extended
  44 / excluded 153, all 46 core+extended deep-read with zero failures. The
  external synthesis found zero contradictions and made 14 routing proposals;
  revival trigger is operator triage of those proposals, which never
  auto-enter the packet tree.
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

- [`patent-drafting-episode-ledger`](./patent-drafting-episode-ledger/README.md)
  — graduated 2026-08-13 into
  [`patent-drafting-episode-ledger`](../goals/patent-drafting-episode-ledger/README.md):
  law-owned append-only DraftingEpisode, statutory-closure support-set gate,
  seven-field annex, and rebuildable projection/fallback proof. The public-
  USPTO benchmark remains a reopen-at-`decompose` MAP point.
- [`lynx-lkg-ontology-grounding`](./lynx-lkg-ontology-grounding/README.md) —
  graduated 2026-08-13 into
  [`attributed-multi-claim-span`](../goals/attributed-multi-claim-span/README.md),
  including lexicog CQ authoring on the TextAnchor/EvidenceSpan and
  LangExtract-to-ClaimGate seam. SHACL generation remains M4-gated; language
  discipline remains a consumer/CQ-gated re-entry note.
- [`harvey-lab-firm-knowledge`](./harvey-lab-firm-knowledge/README.md) —
  graduated 2026-08-13 into
  [`effect-native-legal-eval`](../goals/effect-native-legal-eval/README.md) and
  [`tracked-changes-ingest-wedge`](../goals/tracked-changes-ingest-wedge/README.md).
  The former owns one external-harness baseline; the latter starts with U4 as
  a kill-gate and retains the structural fallback. Synthetic C&H is first;
  later real OIP data stays out of the repo. Generator/DMS rungs remain MAP
  re-entry points.
- [`document-structure-ontologies`](./document-structure-ontologies/README.md)
  — graduated 2026-08-13 after live capability verification and four-goal
  decomposition: [`patent-document-schema`](../goals/patent-document-schema/README.md)
  ships first for the practice-KG claims batch, followed by
  [`document-ast-pattern-classification`](../goals/document-ast-pattern-classification/README.md),
  [`spar-document-annotation-wire`](../goals/spar-document-annotation-wire/README.md),
  and [`folio-lynx-taxonomy-browse`](../goals/folio-lynx-taxonomy-browse/README.md).
  Lynx `lkg.ttl` shares the final goal's TaxonomySeed machinery while the
  Lynx packet retains source-specific vetting/license ownership. Later
  candidates reopen at `decompose`.
- [`agent-memory-tiers-bitemporal-edges`](./agent-memory-tiers-bitemporal-edges/README.md)
  — graduated 2026-08-13 after all three MAP rows produced goals. The final
  row, [`epistemic-memory-retention-projections`](../goals/epistemic-memory-retention-projections/README.md),
  ships a repo-native rebuildable operator tier/memory-pressure report with
  policy-as-data behind calibration evidence; RRF integration is follow-on.
- [`identity-as-iri`](./identity-as-iri/README.md) — graduated 2026-08-13
  after core and fold completed-retained and the fired capstone graduated into
  [`identity-iri-fibered`](../goals/identity-iri-fibered/README.md). The
  capstone carries the full MAP row but remains text-blocked by semantic-web
  PR2+PR3 cleanups, which have no goal packets; discrete case, post-move SHACL
  contract, and test/dev store Layer constraints are binding.
- [`legal-patent-kg-deepening`](./legal-patent-kg-deepening/README.md) —
  graduated 2026-08-13 after the candor and relator wedges completed and the
  episode-ledger align gate closed. `uspto-patent-driver-depth` remains a
  reopen-at-`decompose` point; ELI routes to future
  `legal-rule-time-identity` on operator call.
- [`computable-workspace-geometry`](./computable-workspace-geometry/README.md)
  — graduated 2026-08-13 after the operator confirmed thread-renderer
  ownership and scaffolded
  [`thread-virtualization`](../goals/thread-virtualization/README.md). Kernel
  residue remains in the dock-substrate goal's migrated Residuals section (the
  historical route was `scratchpad/dockview/WHAT-IS-LEFT.md`).
- [`citation-grounding-hallucination-guard`](./citation-grounding-hallucination-guard/README.md)
  — graduated 2026-08-13; `citation-ground-before-cite` reopens at `decompose`
  after both prerequisite goals land, and the reopened shape gate decides
  qualifier-aware stance-layer placement.
- [`court-vocabulary-resolver`](./court-vocabulary-resolver/README.md) —
  graduated 2026-08-13; `court-string-resolver` is the reopen-at-`decompose`
  point after artifact, stable-ID lifecycle, and compatibility proof.
- [`local-first-projection-sync`](./local-first-projection-sync/README.md) —
  graduated 2026-08-13; its three topology/projector/graph candidates remain
  reopen-at-`decompose` points behind their named triggers.
- [`ip-attorney-time-tracking`](./ip-attorney-time-tracking/README.md) —
  graduated 2026-08-13; five external-trigger candidates remain
  reopen-at-`decompose` points.
- [`ingestion-security-secret-governance`](./ingestion-security-secret-governance/README.md)
  — graduated 2026-08-13; five gated candidates remain
  reopen-at-`decompose` points after `ingestion-secret-scrub` ships.
- [`deterministic-doc-structure-extraction`](./deterministic-doc-structure-extraction/README.md)
  — graduated 2026-08-13; its four gated MAP rows reopen at `decompose` after
  first-slice acceptance.
- `compound-engineering` — exploration directory removed 2026-08-13 after its
  capture folded into
  [`knowledge-surface-automation/research/2026-08-13-compound-engineering-capture.md`](../goals/knowledge-surface-automation/research/2026-08-13-compound-engineering-capture.md).

- [`atlas-synthesis`](./atlas-synthesis/README.md) — graduated 2026-08-13 after
  its two promised-now goals completed-retained; a future synthesis pass reopens
  the packet at `decompose` or starts a fresh packet.
- [`effect-orchestration-patterns`](./effect-orchestration-patterns/README.md) —
  graduated 2026-08-13 with its workflow-engine spike scaffolded and four
  demand-gated MAP re-entry points; a fired MAP gate reopens at `decompose`.
- [`local-first-voice`](./local-first-voice/README.md) — graduated 2026-08-13
  with the composer slice scaffolded and four gated voice re-entry points; a
  fired MAP gate reopens at `decompose`.
- [`rag-retrieval-projection`](./rag-retrieval-projection/README.md) — graduated
  2026-08-13 with the fusion core scaffolded and four gate-proofed retrieval
  satellites preserved; a fired MAP gate reopens at `decompose`.
- [`secure-document-download-proxy`](./secure-document-download-proxy/README.md)
  — graduated 2026-08-13 with secure document delivery scaffolded and three
  gated integrations preserved; a fired MAP gate reopens at `decompose`.
- [`solo-firm-docketing`](./solo-firm-docketing/README.md) — graduated
  2026-08-13 with its patent spine and reliability goals scaffolded and four
  queued lanes preserved; a fired MAP gate reopens at `decompose`.
- [`uspto-patent-driver-depth`](./uspto-patent-driver-depth/README.md) —
  graduated 2026-08-13 with its prosecution-read and `PTMNFEE2` goals scaffolded
  and four provider/search lanes preserved; a fired MAP gate reopens at
  `decompose`.
- [`fleet-coordination`](./fleet-coordination/README.md) — graduated
  2026-08-10 into the retained
  [`fleet-mirror`](../goals/fleet-mirror/README.md) goal with no open design
  questions. Rung 1 shipped 2026-08-08 as `beep worktree fleet` (#621); rung
  1.5 adds the positive-only Claude session-registry liveness probe and
  live-first contested rendering. D7 keeps rung 2 in the same goal as
  **push-to-reachable plus pull-for-everyone**, with the mirror authoritative
  because messaging cannot cover the full fleet. Research verdict: derive a
  mirror, not a message board — derive early, deliver ambiently, enforce late.
- [`graphnosis-prior-art`](./graphnosis-prior-art/README.md) — graduated
  2026-08-06 (opened same day) into
  [`goals/epistemic-contradiction-detection`](../goals/epistemic-contradiction-detection/README.md)
  and [`goals/agentic-governance-laws`](../goals/agentic-governance-laws/README.md):
  mined the Apache-2.0 Graphnosis dual-graph memory engine plus four papers
  (two Zenodo preprints, two arXiv; all CC BY 4.0, linked from
  [`assets/README.md`](./graphnosis-prior-art/assets/README.md)) against the
  live checkout — 191 mappings, beep-effect partial-or-better on 78%, so the
  packet **dissolved** (Q1) rather than porting: 26 amendments routed to the
  packets that already own the territory
  ([`AMENDMENTS.json`](./graphnosis-prior-art/research/AMENDMENTS.json)),
  three live-defect findings (WinkCorpus tie-break, DocText WorkerTransport
  leak, law-scan vacuity), and exactly two graduations — the contradiction
  detective producing against triage's shipped contract, and the repo-law
  bundle (minting ceilings, per-edge lifetime caps, scanner non-vacuity).
  Align Q1–Q10 resolved in one sitting; BRIEF adversarially verified against
  main and confirmed 2026-08-06. Remaining exploration-owned work: the
  amendment-application pass (spec-delta docs-PR carrying the Q10 standards
  paragraph, then the three code-change PRs).
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
