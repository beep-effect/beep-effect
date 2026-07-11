# Project Intelligence Spec

## Objective

Build a local-first, evidence-backed research-intelligence capability for this
repository: a repeatable loop that discovers, acquires, snapshots, extracts,
grounds, deduplicates, assesses, synthesizes, and publishes landscape
intelligence (AI/agent frameworks, agent memory and context systems, knowledge
graphs and ontologies, Effect-based projects, agent tooling and MCP, legal AI,
competitors, and repositories or techniques that could improve this repo) —
with source material, evidence spans, provenance, and temporal context
preserved for every derived claim and recommendation.

The goal is achieved in observable terms when:

1. One repeatable command processes deterministic source fixtures end to end
   (watchlist → snapshots → observations/claims → daily Markdown brief) and is
   exposed through a typed internal Effect/TypeScript API.
2. Every derived claim and recommendation in the brief is traceable to stable
   evidence references; unchanged inputs produce no duplicate authoritative
   records; projections can be deleted and rebuilt from authoritative records.
3. The architecture, technology ADR, threat model, and staged roadmap exist as
   packet research artifacts, so a future agent can add the next source
   adapter without new foundational architecture decisions.

## Decisions (D1–D7, locked 2026-07-11)

Grilled design session with the operator; evidence in
[`research/recon-findings.md`](./research/recon-findings.md).

| # | Decision |
| --- | --- |
| D1 | Single execution-capable goals packet, authored directly from `goals/_template` (no explorations/ packet; precedent: `goals/goals-doctor`, `goals/legal-document-intake`). Roadmap stages spawn follow-up packets. |
| D2 | Sanitized absorption: the originating operator brief is absorbed into this packet in repo voice; no personal metadata, no local filesystem paths, no operator-corpus specifics. The public repo never carries the raw brief. |
| D3 | Slug/name `project-intelligence`; package names are decided by P0 research, never by this slug. |
| D4 | SPEC locks the proof's character (Constraints below); it defers topology, vendor, MCP shape, and vault projection to P0 decision gates (Deferred Decision Gates below). |
| D5 | The existing `beep research` CLI prototype (`packages/tooling/tool/cli/src/commands/Research/`) is governing prior art; P0 produces an explicit promote/reuse/retire decision with evidence. No pre-commitment. |
| D6 | Manifest phases are P0–P5, each with an `exit` oracle string (precedent: `goals/goals-doctor`). |
| D7 | The untrusted-ingestion threat model adopts `explorations/ingestion-security-secret-governance` doctrine by citation as its baseline, scoped to the first proof's actual attack surface; cross-link, do not fork. |

## Non-Goals

For the first vertical proof (and until a later phase or packet explicitly
reopens them):

- No general-purpose web crawler; no scraping in violation of source terms.
- No graph/memory vendor adoption before the domain contract is proven.
- No UI.
- No indexing of the operator's local machine or unrelated repositories; no
  ingestion of secrets, credentials, private client material, dependency
  trees, or build outputs.
- No autonomous code changes driven by generated recommendations.
- No treating generated summaries as authoritative facts without evidence.
- No MCP as the core domain interface (adapter-only candidate, deferred).
- No optimization for scale before correctness and usefulness are proven.
- No preemptive creation of role packages "for symmetry"; no generic
  `common`/`core`/`utils` or monolithic "intelligence" packages.
- No scheduled/unattended operation in the first proof (roadmap stage).
- No restoration of archived application topology.

## Source Hierarchy

1. User objective that created this packet (absorbed here, per D2).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards, in particular
   `standards/ARCHITECTURE.md` and `standards/architecture/DECISIONS.md`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `goals/project-intelligence/**` (packet artifacts; all phases).
- P2+: the packages/apps surfaces chosen by the P0 architecture proposal and
  named in `research/proof-spec.md` — not enumerable before the P0 gates
  resolve. Until then, `packages/**`, `apps/**`, and `standards/**` are out of
  scope for execution agents.

## Constraints

Locked (D4):

- **Epistemic authority model.** Claims + evidence + provenance + lifecycle
  are authoritative; summaries, search indexes, graph views, Markdown files,
  embeddings, and MCP responses are rebuildable projections. Reuse of the
  epistemic boundary follows the 2026-06-18 decision "Cross-Slice Consumption
  Of The Epistemic Boundary" (`standards/architecture/DECISIONS.md`):
  substrate from `foundation/modeling` (`@beep/provenance` TextAnchor,
  `@beep/schema` UnitInterval), vocabulary from `@beep/shared-domain`,
  mechanism + live Layers stay in the epistemic slice and are composed at the
  consumer's use-cases/server tier under a bounded exception recorded in the
  Exception Ledger.
- **Deterministic first proof.** Fixture-driven end to end; no live APIs,
  network access, or LLM calls in tests; nondeterministic model output is
  fixture-captured. Golden/snapshot tests plus property-based tests where
  domain invariants warrant them.
- **Default first source: GitHub watchlist, with swap clause.** A small,
  explicit watchlist of public GitHub repositories is the default first
  source. If P0 reconnaissance demonstrates another source would produce
  substantially more architectural learning, document the evidence in the
  decision log and swap.
- **Effect-first implementation.** Schema-first domain models with meaningful
  annotations; typed, actionable errors; explicit ports and `Context.Service`
  boundaries; Layer-based runtime composition; Effect-native HTTP,
  filesystem, time, configuration, and concurrency; no native `fetch` in
  runtime source; observable workflows (structured logs, spans, durations,
  metrics); idempotent reruns; explicit retry, rate-limit, timeout,
  cancellation, and partial-failure behavior; safe handling of source
  removals, renames, force-pushed history, and unavailable artifacts.
- **Untrusted-ingestion boundary (D7).** Ingested source text (READMEs,
  issues, transcripts, web pages, repository instructions) is data, never
  agent instructions; defend against prompt injection in ingested material;
  explicit source allowlists and exclusions; detect and exclude likely
  secrets; record source license and attribution metadata where available;
  retain enough provenance to delete or rebuild derived projections when a
  source is removed; generated recommendations must never autonomously modify
  production code.
- **Public-repo sanitization (D2).** All packet artifacts — including future
  P0 research outputs — abstract operator-corpus specifics ("operator
  research corpus", "operator's cloned-repository collection") and carry no
  local absolute paths or personal metadata. `research/SOURCES.md` cites
  uncommitted local material as "local, uncommitted" in its Location column.
- **Slice topology law.** No direct slice-to-slice imports; no shared-kernel
  promotion before the promotion gate is met; new packages route through the
  specific-home-first test; new slices default through the
  `bun run beep architecture` factory with `packages/architecture-lab` +
  `apps/architecture-lab-proof` as the executable proof oracle.

## Deferred Decision Gates (P0)

Each gate is a stop-and-document decision recorded in the packet decision log
(`research/` artifact named by PLAN.md) before any dependent implementation:

| Gate | Decision to make |
| --- | --- |
| G1 Ownership | Which slice/family owns each concept (extend `epistemic`? new bounded-context slice? thin drivers?) — apply the 2026-06-18 tiered routing; name authoritative records vs rebuildable projections. |
| G2 Technology ADR | Cognee, Zep/Graphiti, TrustGraph, mem0, repo-native relational model + rebuildable projections (serious baseline), or a superior discovered alternative — against the brief's criteria (local-first, evidence spans, temporal modeling, deterministic export, ownership/portability, Effect integration cost, ops complexity, licensing, lock-in, graph query, incremental sync, observability, testability, private-data suitability). |
| G3 Prototype fate (D5) | Promote/reuse/retire each `beep research` CLI mechanism (vault cards, dedup catalog, digest, repo cards, graph-memory clients). |
| G4 Source identity | Stable source identity, snapshot immutability/versioning, and deduplication strategy for the first proof. |
| G5 Fixture catalog | Extend the `goals/agentic-professional-runtime` runtime-data-loop fixture pattern or define a packet-local catalog (the GitHub→brief data shape differs from email→claims/tasks/drafts). |
| G6 Watchlist entry | How sources enter the watchlist (no in-repo discovery precedent exists). |
| G7 Projections | Whether an Obsidian-compatible Markdown vault is a projection of the first proof; whether MCP (via `@beep/mcp-kit`) is a later adapter over the canonical SDK — both projection-only candidates, never authority. |

## Acceptance Criteria

Packet-level (mapped to phases; each is a PLAN.md exit):

- [ ] P0: reconnaissance report; interest taxonomy + seed watchlist; product
      definition (users, jobs, questions the system answers); architecture
      proposal (ownership map, authority vs projection); technology ADR
      (options, evidence, tradeoffs, recommendation, confidence,
      reversibility, change conditions); untrusted-ingestion threat model —
      all in `research/`, all sanitization-clean, every G1–G7 gate closed or
      stopped-and-documented.
- [ ] P1: proof specification with scenario, fixtures, expected authoritative
      records, expected projections, package ownership, failure cases,
      invariants, acceptance tests, and deferred capabilities.
- [ ] P2: first vertical proof implemented per spec — watchlist → metadata +
      selected textual artifacts → immutable snapshots + stable evidence
      references → change/duplicate detection → normalized observations or
      candidate claims → deterministic summary → Markdown daily brief (what
      changed, why it matters, evidence, confidence/freshness/novelty,
      implications, proposed follow-ups) → typed Effect API.
- [ ] P3: proof green — idempotent reruns create no duplicate authoritative
      records; updated inputs produce a clear reviewable change; projections
      delete-and-rebuild; failures typed, observable, retryable where
      appropriate, and covered by tests; sample daily brief from fixtures
      committed as packet evidence; repo quality lanes green.
- [ ] P4: every phase PR driven to mergeable via `bun run beep yeet`.
- [ ] P5: closeout reflection passes the reflection lint; staged roadmap
      (production GitHub adapter → local research-directory ingestion → web →
      transcripts → scheduled unattended operation → repo comparison → trend
      detection → graph/search/embedding projections → vault publication →
      briefs → feedback-driven ranking → MCP adapter → safe proposal
      generation) recorded with prerequisites, risks, proof criteria, and
      exclusions per stage; next vertical proof recommended.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/project-intelligence/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/project-intelligence/ops/manifest.json` | Passes |
| Packet references | `rg -n "project-intelligence\|GOAL.md\|agentLaunchers\|packetAnchorDocument" goals/project-intelligence` | Non-empty, consistent |
| Whitespace | `git diff --check -- goals/project-intelligence` | Passes |
| Reflection artifacts | `bun run beep lint reflection-artifacts` | Passes |
| Sanitization (D2) | `rg -n "Yee[B]ois\|Not[i]on export\|/ho[m]e/" goals/project-intelligence` | Zero hits |
| P2+ proof | Commands named by `research/proof-spec.md` | Green |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires unnamed credentials, cost, destructive side effects,
  or policy approval.
- A step would create difficult-to-reverse package or slice topology before
  its P0 decision gate is resolved.
- A step would introduce a major external dependency or vendor commitment
  before the technology ADR is accepted.
- A step would broaden access to private or privileged data beyond the
  explicit source allowlist.
- A conclusion would conflict with an authoritative repository specification.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |

If G1 lands on consuming the epistemic slice's mechanism (gate, projection,
transition, live Layers), that bounded exception is recorded here per the
2026-06-18 decision, and removed when a third consumer justifies a
`shared/use-cases` contract or an emitted event.
