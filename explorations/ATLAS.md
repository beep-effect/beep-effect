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
- [`agent-effectiveness-pulse`](./agent-effectiveness-pulse/README.md) — a
  data-driven pulse on repo agent friendliness/effectiveness (stage `shape`,
  opened 2026-07-14): which skills are used or dead, where agent time goes,
  what blocks mergeable, what eats token spend. Same-day arc: pipeline
  revived (backfill + 1.0M spans to Phoenix + systemd timer — the feed had
  been dead since Jun 8/Jul 1), five mining lanes + synthesis in
  [`research/pulse-report.md`](./agent-effectiveness-pulse/research/pulse-report.md),
  Checkpoint A grilling closed seven decisions
  ([`DECISIONS.md`](./agent-effectiveness-pulse/DECISIONS.md)). BRIEF/MAP
  shaped: wave-1 goals `harness-otel-adoption` + `harness-hygiene-mechanical`,
  wave-2 `yeet-verdict-instrumentation` + `repo-replay-evals`, forwarder
  durability rides `ai-metrics-stack` (P7e-linked). Awaiting shape sign-off →
  graduation.
- [`computable-workspace-geometry`](./computable-workspace-geometry/README.md) —
  pretext × dock kernel × blocks (stage `research`, opened 2026-07-12): text
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
  carries the arc). Residue: goal-2 (thread virtualization) coordination
  gate with the beep-effect6 lane. Feeds
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
  practice deals with docketing (office actions, maintenance fees, court orders,
  deadlines years out) without missing one. At `align`, held at a review gate:
  three deep-research tracks done (IP-prosecution vendors; court/litigation
  engines; official-data/handroll), doctrine locked as **vigilance overlay, not
  system of record**. Verified reruns sharpened the recommendation: narrow
  US-deterministic handroll first (ODP/`ptmnfee2` checked, approval-gated), CPI /
  LawToolBox / Alt Legal as additive redundancy (CPI is headless-ready via
  documented OAuth2 password grant), ODP polling is sequential per key, litigation
  L1 uses CourtListener webhooks + hosted MCP, and Outlook push depends on
  [`m365-driver`](../goals/m365-driver/README.md) (the concrete driver for its
  future `Calendars.ReadWrite` scope).
- [`ip-attorney-time-tracking`](./ip-attorney-time-tracking/README.md) - active
  align-stage exploration for a local-first IP attorney time-capture/prebill
  assistant: agents may observe activity and propose candidate billable or
  nonbillable entries, while the attorney approval gate controls what becomes
  billable or exportable.
- [`local-first-voice`](./local-first-voice/README.md) — privilege-safe voice &
  microphone capability (TTS, STT, voice-to-voice) for `apps/professional-desktop`
  (already Tauri v2). At `shape`, awaiting BRIEF sign-off. Research done via two
  adversarial sweeps; 9 forks resolved (hybrid local-default · dictation-first slice
  · desktop-first shared pkg · webview AudioWorklet capture · English-first
  Moonshine+Kokoro · per-capability provider ports · STT→LLM→TTS pipeline ·
  `effect/unstable/rpc` worker). Hand-rolls the missing `@effect/platform-browser`
  audio glue; composes existing `live-waveform`/`use-scribe`/`xai`/`venice-ai`
  bricks. First slice: local desktop dictation. MAP names 7 candidate goals
  (`voice-capture-foundation`, `voice-inference-worker`, `voice-provider-ports`,
  `voice-dictation-slice`, `voice-tts-playback`, `voice-cloud-transport`,
  `voice-to-voice-session`).
- [`domain-layer-hardening`](./domain-layer-hardening/README.md) — systematic
  hardening of every product slice's domain/schema layer (entities, aggregates,
  value objects, typed errors) against a regret-minimization rubric + external
  best practice. At `graduate`: Phases 0–2 done (five-slice audit
  [`10`–`14`](./domain-layer-hardening/synthesis/) + rollup
  [`19`](./domain-layer-hardening/synthesis/19-phase1-crosscutting.md) + external
  grounding [`20`](./domain-layer-hardening/synthesis/20-external-law-and-ontology.md)/[`21`](./domain-layer-hardening/synthesis/21-external-signature-dms-notes-corpus.md));
  Phase 3 ([`BRIEF`](./domain-layer-hardening/BRIEF.md)+[`MAP`](./domain-layer-hardening/MAP.md))
  decomposed into **7 goal packets**, first graduated:
  [`domain-kernel-hardening`](../goals/domain-kernel-hardening/README.md) (soft-delete
  on `BaseEntity` + retire `DomainModel`). Status stays `active` — packets 2–7
  (typed-references, epistemic-claim-body, workspace-candidate-approval,
  law-practice-real-domain, provenance-attestation, agents-and-narrowing) graduate as
  predecessors land. Frontier was: 0 typed
  errors in 3 slices, two competing audit bases (`BaseEntity` vs unused
  `@beep/schema/DomainModel`), no soft-delete / temporal-validity / domain-event
  substrate, near-empty aggregates, law-practice rich-in-nouns-thin-in-lifecycle.
- **Gold-Intake cohort** (opened 2026-06-29, all at `research`-complete) — 13 new exploration
  packets reconciled from the 219-nugget gold-intake corpus; full matrix +
  provenance in [`_gold-intake/ROUTING.md`](./_gold-intake/ROUTING.md) /
  [`routing.json`](./_gold-intake/routing.json) (219/219 routed, user-approved). Each packet:
  CAPTURE seeded from its nuggets, `RESEARCH.md` (external landscape · in-repo inventory ·
  constraints), codex gate-1 folded, `DECISIONS.md` pre-drafted. **Graduate-now (Wave-1,
  user-confirmed):** [`gov-legal-data-driver-codegen`](./gov-legal-data-driver-codegen/README.md),
  [`uspto-patent-driver-depth`](./uspto-patent-driver-depth/README.md) (extends `@beep/uspto`),
  [`mcp-auth-gated-registration`](./mcp-auth-gated-registration/README.md) (grilled+decomposed+
  graduated first goal 2026-07-01: Q1–Q7 resolved, BRIEF+MAP written,
  [`goals/mcp-kit`](../goals/mcp-kit/README.md) scaffolded at `foundation/capability`;
  `uspto-mcp`/`mcp-host-retrofit`/`mcp-write-wall` queue behind it),
  [`citation-grounding-hallucination-guard`](./citation-grounding-hallucination-guard/README.md).
  **Queued (P2/P3, research-complete):**
  [`effect-orchestration-patterns`](./effect-orchestration-patterns/README.md),
  [`agent-memory-tiers-bitemporal-edges`](./agent-memory-tiers-bitemporal-edges/README.md),
  [`deterministic-doc-structure-extraction`](./deterministic-doc-structure-extraction/README.md)
  (langextract streaming-lock sibling),
  [`court-vocabulary-resolver`](./court-vocabulary-resolver/README.md),
  [`ingestion-security-secret-governance`](./ingestion-security-secret-governance/README.md),
  [`multi-provider-llm-dispatch-fallback`](./multi-provider-llm-dispatch-fallback/README.md)
  (partial graduation 2026-07-11: CLI subscription-auth leg →
  [`goals/llm-provider-subscription-auth`](../goals/llm-provider-subscription-auth/README.md);
  dispatch/fallback questions remain queued),
  [`rag-retrieval-projection`](./rag-retrieval-projection/README.md) (the single RRF-layer owner),
  [`secure-document-download-proxy`](./secure-document-download-proxy/README.md),
  [`local-first-projection-sync`](./local-first-projection-sync/README.md) (last two are
  singletons — attach-vs-standalone deferred to their `DECISIONS.md`). Plus **9 non-invasive
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
  effect-only `scratchpad/identity` prototype at 27/27). First packet
  graduated 2026-07-02:
  [`goals/identity-iri-core`](../goals/identity-iri-core/README.md);
  `identity-iri-fold` + `identity-iri-fibered` queue behind it
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
- [`legal-ontology-landscape`](./legal-ontology-landscape/README.md) —
  foundation-layer legal semantics exploration at `graduate`: first packet
  graduated 2026-07-08 into
  [`goals/semantic-foundation`](../goals/semantic-foundation/README.md) for M1
  intake-serving SKOS seed, FOLIO-aligned concept IRIs, and `@beep/ontology`
  taxonomy registry/loader. Status stays `active` while P1-P4 research reports
  land and feed M2-M4; dependent `goals/trademark-docketing-domain` is deferred
  behind M3.
- [`effect-ontology-harvest`](./effect-ontology-harvest/README.md) — opened
  2026-07-11 at `research`: harvest inventory of
  [mepuka/effect-ontology](https://github.com/mepuka/effect-ontology)
  `packages/@core-v2` (MIT, Effect v3) — 8 codex inventory agents map LLM
  governance, content-addressing/storage, workflow/streaming, domain models,
  prompting/extraction, runtime/telemetry, repository patterns, and docs
  rationale to beep homes (foundation modeling/capability vs slice vs
  design-reference), scored active-goals-first
  (`ontology-agent-surface`, `semantic-foundation`,
  `agentic-professional-runtime`); codex verify gate then per-item
  evaluation then align. Harvest-not-port; end state align-complete.

### Proposed

- (none — `atlas-synthesis` is now an Active packet above; its capability-inventory
  half is done and the outcome-decomposition half is its next stage.)

### Parked

- `effect-capability-kg` (parked 2026-06-17; packet removed 2026-06-18) —
  tooling-first deterministic Effect v4 capability graph (JSDoc-derived ontology,
  specialist profiles, judge routing, advisory hook backpressure). The exploration
  directory and its `effect-capability-kg-seed` goal packet were deleted in commit
  `8852619f04` (`chore: remove repo-exports catalog + Reuse + effect-capability-kg`),
  so no packet artifacts remain in-tree; history lives in git and in
  `standards/memory-architecture/04-decision-log.md` (2026-06-17). Resume on an
  explicit decision to invest in agent capability guidance, as a fresh packet.

### Graduated

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
