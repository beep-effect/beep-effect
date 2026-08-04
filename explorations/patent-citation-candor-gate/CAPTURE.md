# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-08-04

Seeded from the signed-off routing matrix of
[`legal-patent-kg-deepening`](../legal-patent-kg-deepening/ROUTING-SEED.md),
cluster **"Patent citation events and candor disposition"** (route `mixed`,
wave P1, proposed slug `patent-citation-candor-gate` — this packet). Machine
row: [`routing-seed.json`](../legal-patent-kg-deepening/routing-seed.json).
Chosen as the first wedge in the 2026-08-01 reconciliation grill; opened by the
2026-08-04 phase-2 grill.

### Nuggets (from the parent 46-row ledger)

From
[`research/nugget-catalog.json`](../legal-patent-kg-deepening/research/nugget-catalog.json):

- **T2-F2** (verified-finding, survived 3/3; track `11-track-patent-kg` F2;
  distillates P017, P006, P041): "Patent citations must be reified because
  actor provenance, office-action use, submission time, and similarity method
  change their meaning. Face-list presence, office-action reliance, and model
  relevance remain distinct claims."
- **T3-F7** (verified-finding, survived 2/3+; track `12-track-graphrag` F7;
  distillates P064, P074, L14, P099): "Evidence should resolve to durable
  provision, claim, paragraph, figure, judgment, or episode locators before
  optional offsets. Structured locator identity deepens exact spans rather
  than replacing them."
- **ADHD-1** (deepened /adhd play, not a verified finding; source frames
  spee6, regu3, onca4, comp3): "Persist a source-versioned PatentCitationEvent
  around each patent-reference occurrence and block filing promotion until
  every current AI-discovered event has an attorney-owned CandorDisposition.
  Unknown codes remain quarantined and stale observations are explicit."

### The deepened play (verbatim intent, from the parent /adhd artifact)

From
[`research/20-adhd-integration.md`](../legal-patent-kg-deepening/research/20-adhd-integration.md)
§ Focus 1:

- `@beep/law-practice-domain` owns a persisted `PatentCitationEvent` relating
  the existing `PatentReference` to a citing application — replacing the
  occurrence semantics currently embedded in the examiner-only
  `PriorArtReference.officeActionFixtureKey`, and accepting the planned
  `CitationMention` from `goals/citation-extraction-engine`.
- Schema keeps citation actor (`applicant | examiner | both | unknown`)
  separate from a tagged discovery-provenance union, with optional
  `OfficeActionId`, submission and observation times, method/model metadata,
  and release/code/mapping identity supplied by `goals/uspto-prosecution-read`.
- `TextAnchor` (`@beep/provenance`) and `EvidenceSpan`
  (`@beep/epistemic-domain`), hardened by
  `goals/citation-verified-span-substrate`, ground each event beside a
  law-practice `Claim | Paragraph | Figure | Document` locator.
- Unknown USPTO codes produce quarantined observations retaining raw values;
  source-version mismatch derives explicit staleness rather than rewriting
  evidence.
- A promotion policy holds `RuntimeApprovalGate` pending while any
  AI-discovered reference lacks a current attorney disposition — disposition
  records attorney judgment (MPEP § 2001 materiality stays human), never
  manufactures it.
- **Risk (named):** false closure — incomplete event
  identity/reconciliation/versioning could report every reference disposed
  while silently omitting a duplicate, stale, quarantined, or newly discovered
  one.
- **First step:** a failing `CandorPolicy.test.ts` in
  `packages/law-practice/use-cases` with examiner-observed and AI-discovered
  events for one `PatentReference`; assert promotion stays `blocked` until an
  attorney disposition covers the AI event's exact observation version.
- **Children (later rungs):** split `PatentReferenceDiscoveryEvent` from
  citation; tagged `PatentFragmentLocator` (claims, paragraphs, figures)
  surviving text reflow; deterministic candor-closure receipt manifest;
  reference-reconciliation inbox merging OA/IDS/engine/model occurrences
  around one normalized reference; as-of citation timeline projected
  read-only into practice-kg-mcp.

### Cluster grounding (net-new vs already-covered, from the routing seed)

Net-new (source-only rg 2026-08-01 returned zero symbols):

- `PatentCitationEvent` with citation actor, discovery provenance,
  office-action linkage, observation version, method/model, quarantine,
  staleness, and attorney `CandorDisposition`.
- Filing-promotion closure over the exact current observation version
  (`ProfessionalRuntime.contracts.ts:473-490` has no candor or
  observation-version field).
- A tagged `PatentFragmentLocator` for claim, paragraph, figure, and document
  identity.

Already covered (compose, do not rebuild):

- `PatentReference` parses country, number, kind code
  (`packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:188-216`);
  `PriorArtReference` records an examiner-linked occurrence
  (`packages/law-practice/domain/src/entities/PriorArtReference/PriorArtReference.model.ts:50-84`).
- `CitationMention` is specified as a document-local, source-versioned
  occurrence with a verified anchor
  (`goals/citation-extraction-engine/SPEC.md:169-196`).
- Exact UTF-16 anchors, source digest/version, ambiguity, fail-closed drift
  belong to `goals/citation-verified-span-substrate/SPEC.md:44-80,108-123`.
- `RuntimeCandidateDraft` / `RuntimeApprovalGate` expose candidate references,
  evidence, policy basis, reviewer, and a pending decision
  (`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:428-490`).

### Cautions (carried forward verbatim from the routing seed)

- "[ADHD-1] CandorDisposition records attorney judgment; the system must not
  compute MPEP materiality or infer closure from missing events."
- "[T2-F2] Keep face-list presence, citation act, office-action reliance, and
  model similarity as separate claims."
- "[ADHD-1] Reconciliation must not let duplicates, stale observations, or
  quarantined codes create false candor closure."

### Cluster rationale (routing seed, verbatim)

"`[T2-F2,T3-F7,ADHD-1]` compose existing reference, mention, verified-anchor,
USPTO observation, and runtime-gate bricks into one law-owned candor workflow;
none of those existing bricks owns candor closure."

### Phase-2 grill pointers

Ownership grounding: `PatentCitationEvent` + `CandorDisposition` are
law-practice product language → `packages/law-practice/domain`, composing
epistemic + agents bricks. Wedge-scoped decisions (research lanes, dependency
posture, orchestration, PR staging): [`DECISIONS.md`](./DECISIONS.md).
Campaign-level decisions (phase shape, contradiction-triage route):
[`../legal-patent-kg-deepening/DECISIONS.md`](../legal-patent-kg-deepening/DECISIONS.md),
2026-08-04 entries.
