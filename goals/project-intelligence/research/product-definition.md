# Product Definition

## Purpose

Project Intelligence is the smallest coherent product loop that turns a bounded set of watched
sources into current, evidence-backed landscape intelligence for this repository. It preserves
source snapshots, evidence spans, provenance, time, and claim lifecycle so that a reader can
distinguish what was observed, what is admitted as a claim, and what is only a rebuildable
summary or recommendation.

The first proof is a deterministic, fixture-driven GitHub-watchlist vertical. It proves the
product contract from a fixed watchlist through immutable snapshots and intermediate
observations to lifecycle-bearing candidate claims and a daily Markdown brief. It does not
prove live discovery, production transport, interactive query, or automated feedback.

## Users and jobs

| User | Jobs performed by the loop |
| --- | --- |
| Repo operator | Stay current on the relevant technical and product landscape; see what changed and why it matters; ground build, borrow, or monitor decisions in inspectable evidence; revisit prior decisions when new evidence arrives. |
| Coding agents working in this repo | Receive compact context made of provenance-bearing claims rather than unsourced summaries; resolve each rendered assertion to a stable claim, evidence span, source snapshot, lifecycle state, and temporal context; use assessments as decision input without treating them as permission to change code. |

## Questions the system answers

Each answer must identify the comparison window, watched sources, stable evidence references,
claim lifecycle, and relevance to a concrete repository decision. “No supported change found”
is a valid answer when the searched scope and evidence are explicit.

| Interest area | Evidence-grounded question template |
| --- | --- |
| AI and agent frameworks | What changed in the watched agent-framework landscape since the last brief in orchestration, tool use, evaluation, or safety, which evidence spans support the change, and does it affect an open build, borrow, or monitor decision in this repo? |
| Agent memory and context systems | What changed in the watched agent-memory and context landscape since the last brief, how do the sources support claims about provenance, temporal behavior, retrieval, or lifecycle, and does the change alter this repo's memory or context strategy? |
| Knowledge graphs and ontologies | Which watched graph or ontology projects added or revised capabilities for provenance, temporal modeling, reasoning, validation, or interoperability, and which evidenced technique is relevant to an open ontology or knowledge decision here? |
| Effect-based projects | Which watched Effect-based projects introduced a reusable pattern for schemas, services, Layers, errors, persistence, testing, or observability, what exact source span demonstrates it, and should this repo build, borrow, or monitor it? |
| Agent tooling and MCP | Which watched agent-tooling or MCP projects changed their protocol, transport, security, lifecycle, or developer workflow, what compatibility or safety consequence is evidenced, and does a repo adapter decision need review? |
| Legal AI | Which watched legal-AI projects changed their evidence handling, citation grounding, document workflow, evaluation, or risk controls, and what supported lesson could improve this repo without importing unsupported legal conclusions? |
| Competitors | Which evidenced capability, positioning, integration, or release changed among watched competitors, how does it compare on the same stated criteria, and does it create a gap, validation signal, or monitoring need for this repo? |
| Repositories and techniques that could improve this repo | Which newly changed or newly relevant repository technique addresses a current repo problem, what evidence shows the fit and constraints, and is the justified disposition build, borrow, monitor, or reject? |

## Loop model and first-proof scope

An observation is an intermediate extraction record only. It may retain candidate text,
location, and extraction metadata, but it is never the authority for a brief assertion. Grounding
must produce claim and evidence records with provenance and lifecycle before the material can
appear in a brief, and unadmitted claims must remain visibly labeled as candidates.

| Stage | Product meaning | First-proof scope |
| --- | --- | --- |
| Discover | Identify potentially relevant sources and decide whether they belong in a bounded watch set. Discovery records why a source is relevant without yet asserting facts from it. | **Exercised, bounded:** consume a small explicit seed watchlist; no crawler or automatic source discovery. |
| Acquire | Retrieve the allowed source material and acquisition metadata through a source adapter, with typed outcomes for unavailable, removed, or malformed input. | **Exercised, fixture-only:** deterministic GitHub-shaped fixtures; no live API. |
| Snapshot | Preserve an immutable, content-addressed representation of acquired material with source identity, capture time, attribution, and version context. | **Exercised:** stable fixture time, identity, and content hashes. |
| Extract | Derive bounded observations and exact candidate spans from a snapshot without treating extracted text as fact. | **Exercised:** deterministic or fixture-captured extraction into intermediate observations. |
| Ground | Link candidate claims to stable evidence records and spans, source-snapshot provenance, temporal context, and lifecycle. | **Exercised:** every brief assertion and recommendation must resolve to claim and evidence IDs. |
| Deduplicate | Reconcile stable identities and content so unchanged input does not create another authoritative source, snapshot, claim, or evidence record. | **Exercised:** reruns prove stable IDs, hashes, counts, and canonical ordering. |
| Assess | Evaluate grounded claims for lifecycle admission, repo relevance, decision impact, confidence, and a build, borrow, monitor, or reject disposition. | **Exercised, bounded:** deterministic fixture assessments; candidate material cannot be presented as admitted fact. |
| Synthesize | Select and organize grounded claims and assessments into a coherent answer to the brief's questions while preserving dissent, uncertainty, and lifecycle. | **Exercised:** deterministic daily-brief composition. |
| Publish | Render a disposable projection for a reader; publication never becomes an authority store. | **Exercised:** daily Markdown brief with visible lifecycle and authoritative record references. |
| Query | Retrieve claims, evidence, change history, and projections through a typed interface for interactive questions. | **Roadmap-only:** the proof exposes a typed internal API for execution, not an interactive query product. |
| Feedback | Capture usefulness judgments, corrections, and new questions, then route them back into watchlist and assessment policy with provenance. | **Roadmap-only:** no automated learning, source expansion, or policy mutation in the first proof. |

## Concept census: reuse before invention

The census distinguishes shared meaning from superficially similar field names. In particular,
`SourceKind` describes who or what wrote a persisted entity, not an external research source.
`Workspace` is a user or team work area, `ContextPacket` is a bounded opaque context snapshot,
and `Document` is a file materialized into a workspace vault. No exported `Collection` concept
was found in the inspected documents or workspace source; none of these names should be stretched
into a research-source collection contract.

| Product concept | Coverage | Existing language and consequence | Verified source paths |
| --- | --- | --- | --- |
| Watchlist entry | **Net-new naming** | No watched-source membership concept exists in the inspected domain barrels. Define the product meaning before choosing an owner; do not overload workspace membership or a document intake batch. | `packages/epistemic/domain/src/entities/index.ts`; `packages/shared/domain/src/index.ts`; `packages/documents/domain/src/aggregates/IntakeBatch/IntakeBatch.model.ts`; `packages/workspace/domain/src/entities/index.ts` |
| Source | **Partially covered** | `Evidence.artifactFixtureKey` identifies a source artifact for proof fixtures, and `Document` models materialized file content with a digest. Neither models durable external research-source identity, origin, attribution, license, rename/removal state, or watch membership. `SourceKind` is audit vocabulary and is not this concept. | `packages/epistemic/domain/src/entities/Evidence/Evidence.model.ts`; `packages/documents/domain/src/aggregates/Document/Document.model.ts`; `packages/shared/domain/src/entity/SourceKind.ts` |
| Snapshot | **Partially covered** | Epistemic `CandidateClaim` and `Activity`, plus workspace `ContextPacket`, carry opaque `snapshot` records; `DocumentContentDigest` provides deterministic content identity. There is no standalone immutable source-snapshot model with source version, capture time, attribution, retention, and tombstone semantics. | `packages/epistemic/domain/src/entities/CandidateClaim/CandidateClaim.model.ts`; `packages/epistemic/domain/src/entities/Activity/Activity.model.ts`; `packages/workspace/domain/src/entities/ContextPacket/ContextPacket.model.ts`; `packages/documents/domain/src/aggregates/Document/Document.model.ts` |
| Observation | **Net-new naming** | The inspected slices export no observation concept. Use it only for a non-authoritative extraction record between snapshot and grounding; it must not become a second claim authority. | `packages/epistemic/domain/src/entities/index.ts`; `packages/documents/domain/src/aggregates/index.ts`; `packages/workspace/domain/src/entities/index.ts`; `packages/shared/domain/src/index.ts` |
| Claim | **Partially covered** | The epistemic kernel proves the claim/evidence pattern (lifecycle, exact character offsets, quote, confidence, artifact reference), and the promoted `ClaimLifecycle` vocabulary plus `TextAnchor`/`UnitInterval` substrate are reused directly. G1 (accepted 2026-07-11) declines importing the epistemic entities and mechanism: the landscape slice defines `ResearchClaim` and `SourceEvidence` locally on that substrate, patterned after the kernel. | `packages/epistemic/domain/src/entities/CandidateClaim/CandidateClaim.model.ts`; `packages/epistemic/domain/src/entities/Evidence/Evidence.model.ts`; `packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts`; `packages/shared/domain/src/values/ClaimLifecycle/ClaimLifecycle.model.ts`; `packages/shared/domain/README.md` |
| Assessment | **Partially covered** | `ClaimGateResult` covers a structured epistemic gate verdict and violations, while `FilingOutcome` demonstrates a domain-specific decision with rationale and confidence. Neither is a landscape assessment of repo relevance or a build, borrow, monitor, or reject disposition. Reuse the verdict pattern, not the documents meaning. | `packages/epistemic/domain/src/values/ClaimGate/ClaimGateResult.model.ts`; `packages/documents/domain/src/aggregates/Document/Document.model.ts` |
| Brief | **Net-new naming** | `ClaimProjectionView` proves a deterministic, rebuildable claim read model, but there is no research brief concept. The documents taxonomy use of “brief” means legal filing material and is unrelated. Model the daily brief strictly as a projection over claim, evidence, lifecycle, and assessment records. | `packages/epistemic/domain/src/values/ClaimProjection/ClaimProjectionView.model.ts`; `packages/documents/domain/src/values/Taxonomy/Taxonomy.model.ts`; `packages/documents/domain/src/aggregates/Document/Document.model.ts` |

## Success signals

The first proof is useful at product altitude when all of these are observable:

- **Deterministic brief usefulness:** the same fixtures and fixed clock produce the same ordered
  brief, and the brief answers what changed, why it matters to this repo, and the evidenced next
  disposition without editorial drift.
- **Provenance completeness:** every rendered assertion and recommendation exposes stable claim
  and evidence references, an exact evidence span, source-snapshot and temporal context, and a
  visible lifecycle state. Candidate material is labeled and never rendered as admitted fact.
- **Idempotent authority:** rerunning unchanged input preserves authoritative IDs, content hashes,
  record counts, and ordering; it creates no duplicate authoritative source, snapshot, claim, or
  evidence record. Deleting and rebuilding the Markdown projection yields equivalent output.

At product altitude, the first proof is deliberately an offline correctness and usefulness test,
not a crawler, live production GitHub integration, UI, scheduled service, graph or memory vendor
adoption, or scale exercise. It does not index unrelated local material or ingest secrets,
credentials, private client material, dependency trees, or build outputs. MCP may later adapt the
typed interface but is not the domain interface. Recommendations never authorize autonomous code
changes, summaries never become facts, and the proof does not justify symmetric role packages,
generic utility packages, a monolithic intelligence package, or restored application topology.

## Relationship to gates

This artifact feeds G1 by establishing the product names, semantic boundaries, reuse candidates,
and authority-versus-projection distinction that the ownership matrices must route. It owns no
gate and makes no package, slice, adapter, persistence, or cross-slice exception decision.

## Recon corrections

No correction to `goals/project-intelligence/research/recon-findings.md` is required for this
product model. The current checkout is newer than the recon's recorded commit, but direct source
inspection still finds no exported watchlist entry, observation, assessment, collection, or daily
research-brief concept. The census above refines the recon by separating partial snapshot and
source vocabulary from complete product concepts; it does not contradict the recon findings.
