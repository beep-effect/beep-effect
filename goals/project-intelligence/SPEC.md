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

1. One repeatable, named command (exact invocation contract fixed in
   `research/proof-spec.md`) processes deterministic source fixtures end to
   end (watchlist → snapshots → observations/claims → daily Markdown brief)
   and is exposed through a typed internal Effect/TypeScript API.
2. Every derived claim and recommendation in the brief is traceable to stable
   evidence references; unchanged inputs produce no duplicate authoritative
   records; projections can be deleted and rebuilt from authoritative records.
3. The architecture, technology ADR, threat model, and staged roadmap exist as
   packet research artifacts, so a future agent can add the next source
   adapter without new foundational architecture decisions.

## Decisions (D1–D7, locked 2026-07-11)

Grilled design session with the operator; evidence in
[`research/recon-findings.md`](./research/recon-findings.md). Gate
resolutions and later decisions append here as dated D8+ entries.

| # | Decision |
| --- | --- |
| D1 | Single execution-capable goals packet, authored directly from `goals/_template` (no explorations/ packet; precedent: `goals/goals-doctor`, `goals/legal-document-intake`). Roadmap stages spawn follow-up packets. |
| D2 | Sanitized absorption: the originating operator brief is absorbed into this packet in repo voice; no personal metadata, no local filesystem paths, no operator-corpus specifics. The public repo never carries the raw brief. |
| D3 | Slug/name `project-intelligence`; package names are decided by P0 research, never by this slug. |
| D4 | SPEC locks the proof's character (Constraints below); it defers topology, vendor, MCP shape, and vault projection to P0 decision gates (Deferred Decision Gates below). |
| D5 | The existing `beep research` CLI prototype (`packages/tooling/tool/cli/src/commands/Research/`) is governing prior art; P0 produces an explicit per-mechanism promote/reuse/retire decision with evidence (gate G3). No pre-commitment. |
| D6 | Manifest phases are P0–P5, each with an `exit` oracle string (precedent: `goals/goals-doctor`). Every delivery phase (P0–P3) ships as its own PR driven to mergeable via `bun run beep yeet`; P4 is a program-level PR audit; P5 is the separately gated closeout PR. |
| D7 | The untrusted-ingestion threat model adopts `explorations/ingestion-security-secret-governance` doctrine by citation as its baseline, scoped to the first proof's actual attack surface; cross-link, do not fork. |
| D8 (2026-07-11) | Refines D5: the G3 disposition set is promote / reuse / retire / **defer**, where `defer` is valid only under the G3 defer rules (recorded rationale, owner, resolution trigger, target phase/packet, and proof that no P1–P3 scope depends on the mechanism). Adopted from the adversarial review loop (rounds 1–3). |

## Non-Goals

For the first vertical proof (and until a later phase or packet explicitly
reopens them):

- No general-purpose web crawler; no scraping in violation of source terms.
- No graph/memory vendor adoption before the domain contract is proven.
- No UI.
- No indexing of the operator's local machine or unrelated repositories
  beyond the operator-provided, session-only, read-only corpus allowlist
  used for P0 reconnaissance (PLAN "P0 preflight"; the allowlist itself is
  never committed); no ingestion of secrets, credentials, private client
  material, dependency trees, or build outputs.
- No autonomous code changes driven by generated recommendations.
- No treating generated summaries as authoritative facts without evidence.
- No MCP as the core domain interface (adapter-only candidate, deferred).
- No optimization for scale before correctness and usefulness are proven.
- No preemptive creation of role packages "for symmetry"; no generic
  `common`/`core`/`utils` or monolithic "intelligence" packages.
- No scheduled/unattended operation in the first proof (roadmap stage).
- No live-transport production hardening in the first proof (real rate-limit
  handling, pagination, retry timing against live APIs) — that is the
  production GitHub adapter roadmap stage.
- No restoration of archived application topology.

## Source Hierarchy

1. User objective that created this packet (absorbed here, per D2).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards, in particular
   `standards/ARCHITECTURE.md`, `standards/architecture/DECISIONS.md`, and
   `standards/architecture/08-testing.md`.
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
  `@beep/schema` UnitInterval) and vocabulary from `@beep/shared-domain` are
  unconditional reuse. Whether to consume the epistemic MECHANISM (gate,
  projection, transition, live Layers) is G1's decision, not this
  constraint's: IF G1 selects it, mechanism + live Layers stay in the
  epistemic slice and are composed at the consumer's use-cases/server tier
  under a bounded exception recorded in the Exception Ledger; if G1 declines
  it, no cross-slice exception exists.
- **Grounded projections.** The daily brief is a projection: every assertion
  and recommendation it renders must reference the authoritative record IDs
  (claim/evidence) and visibly carry lifecycle state; candidate (unadmitted)
  material must be labeled as such and never rendered as fact. The brief
  projection schema is fixed in `research/proof-spec.md` and enforced by
  tests that reject ungrounded or lifecycle-erasing output.
- **Deterministic first proof.** Fixture-driven end to end; no live APIs,
  network access, or LLM calls in tests; nondeterministic model output is
  fixture-captured; time comes from a fixed test clock. Golden/snapshot tests
  plus property-based tests where domain invariants warrant them. Determinism
  is proven against the scenario matrix in `research/proof-spec.md` (see P1
  acceptance), asserting stable authoritative IDs, record counts, content
  hashes, canonical ordering, and projection equivalence — not merely "tests
  pass".
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
  metrics); idempotent reruns. Failure semantics are partitioned: the first
  proof must define and test **driver-neutral** typed failure and
  cancellation contracts (timeout, retryable-vs-terminal error taxonomy,
  partial failure, source removed/renamed/unavailable) exercised through
  fixtures; **live-transport policy** (real rate-limit handling, pagination,
  retry timing, force-push detection against live APIs) belongs to the
  production GitHub adapter roadmap stage and must not be overbuilt in P2.
- **Untrusted-ingestion boundary (D7).** Ingested source text (READMEs,
  issues, transcripts, web pages, repository instructions) is data, never
  agent instructions; defend against prompt injection in ingested material;
  explicit source allowlists and exclusions; detect and exclude likely
  secrets; record source license and attribution metadata where available;
  retain enough provenance to delete or rebuild derived projections when a
  source is removed; generated recommendations must never autonomously modify
  production code. The proof's test suite must include adversarial fixtures
  (prompt-injection text, secret-shaped tokens, dangerous URLs/HTML, control
  characters, oversized inputs, malformed encodings, missing attribution)
  with explicit expected outcomes: redact, quarantine, or render-safe.
- **Public-repo sanitization (D2).** All packet artifacts — including future
  P0 research outputs — abstract operator-corpus specifics ("operator
  research corpus", "operator's cloned-repository collection") and carry no
  local absolute paths or personal metadata. `research/SOURCES.md` cites
  uncommitted local material as "local, uncommitted" in its Location column.
  Two-layer enforcement: (1) the canonical mechanical check — a tri-state
  wrapper that passes only when `rg` finds nothing (exit 1) and fails on
  both hits (exit 0) and scanner errors (exit 2). This fenced block is the
  SINGLE executable source; other surfaces reference or copy it exactly and
  must never re-escape it for Markdown tables:

  ```sh
  sh -c 'rg -n "/ho[m]e/|/Us[e]rs/|C:.[U]sers|~/[A-Za-z]|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}" goals/project-intelligence; test "$?" -eq 1'
  ```

  (patterns are self-safe and deliberately generic); (2) a recorded manual
  semantic review for operator-corpus specifics regex cannot detect, written
  per phase into a required "Manual sanitization review" section of that
  phase's evidence note `history/P<n>-evidence.md` (P0–P5; PLAN "Phase
  evidence conventions").
- **Slice topology law.** Direct slice-to-slice imports are forbidden at the
  domain tier without exception. Cross-slice composition of the epistemic
  slice's mechanism at the consumer's use-cases/server tier is permitted
  ONLY IF G1 selects it, and then only through the bounded exception of the
  2026-06-18 decision, recorded in this packet's Exception Ledger — the sole
  deviation that CAN be authorized, not one that already is. No
  shared-kernel promotion before the promotion gate is
  met; new packages route through the specific-home-first test; new slices
  default through the `bun run beep architecture` factory with
  `packages/architecture-lab` + `apps/architecture-lab-proof` as the
  executable proof oracle.

## Deferred Decision Gates (P0)

Gate states: **accepted** (decision made, recorded as a dated D8+ entry with
evidence), **deferred-nonblocking** (explicitly deferred with rationale; must
not be a prerequisite of any authorized later phase), **blocked** (cannot be
decided; a blocked gate keeps P0 open or pauses the packet with an explicit
resume condition). Documenting a blocker is not resolution: a blocked gate
never satisfies a phase exit. **G1–G6 must be `accepted` before P1 begins;
G7 may remain `deferred-nonblocking` through the first proof.**

| Gate | Decision to make | Evidence artifact | Blocking |
| --- | --- | --- | --- |
| G1 Ownership | Two matrices, applying the 2026-06-18 tiered routing: a **concept-ownership matrix** (every product concept — watchlist, source identity, snapshot, observation, claim, assessment, brief — routes to a slice or `shared/domain`; product semantics may never live in `drivers/*`) and an **adapter matrix** (external transport — GitHub API, storage engines — routes to `drivers/*` as product-neutral wrappers). Name authoritative records vs rebuildable projections. Epistemic mechanism/live-Layer consumption is a G1 **candidate**, not a pre-decision: selecting it requires populating the Exception Ledger (exact importing tiers/subpaths, owner, rationale, removal trigger) in the same PR, or G1 is not `accepted`. | `architecture-proposal.md` | P1 |
| G2 Technology ADR | Cognee, Zep/Graphiti, TrustGraph, mem0, repo-native relational model + rebuildable projections (serious baseline), or a superior discovered alternative — against the brief's criteria (local-first, evidence spans, temporal modeling, deterministic export, ownership/portability, Effect integration cost, ops complexity, licensing, lock-in, graph query, incremental sync, observability, testability, private-data suitability). | `technology-adr.md` | P1 |
| G3 Prototype fate (D5/D8) | Exhaustive per-mechanism disposition matrix keyed by the nine executable CLI tokens (`capture`, `cognify`, `daily`, `digest`, `history-sift`, `install-timers`, `notion-pull`, `repo-card`, `status`) and every reusable internal mechanism (capture flow, vault card format, URL normalization, content hashing, DuckDB catalog schema, digest generation, chained daily orchestration, repo cards, graph-memory clients, browser-history sift, **systemd user-timer installation**) marked promote / reuse / retire / defer, each with evidence and replacement ownership. A `defer` row is valid only with recorded rationale, owner, resolution trigger, target phase/packet, and proof that no P1–P3 scope depends on the mechanism; otherwise G3 cannot be `accepted`. | `prototype-disposition.md` | P1 |
| G4 Source identity & lifecycle | Stable source identity, snapshot immutability/versioning, and deduplication strategy — including retention and purge rules for raw snapshots, tombstone identity for removed sources, claim-lifecycle transitions triggered by source removal or license revocation, attribution/license-change handling, and deterministic rebuild behavior after deletion. | `architecture-proposal.md` | P1 |
| G5 Fixture ownership & catalog | Where executable test fixtures live, within doctrine (`standards/architecture/08-testing.md`): executable fixtures/stubs are owned by the canonical `/test` surface of the owning package, and slice tests must not depend on `goals/**` or foreign topology. Packet `research/`/`history/` hold only evidence copies deterministically generated from that canonical source. Decide the catalog shape inside those bounds (extend the `agentic-professional-runtime` runtime-data-loop pattern in the owning package, or a new package-local catalog). Also decide cross-slice test placement: consuming-slice tests stub the epistemic boundary (slice-isolation guarantee); any real multi-slice composition proof lives at an app/integration boundary with app-owned wiring and package-local fixtures. | `architecture-proposal.md` | P1 |
| G6 Watchlist entry | How sources enter the watchlist (no in-repo discovery precedent exists). | `architecture-proposal.md` | P1 |
| G7 Projections | Whether an Obsidian-compatible Markdown vault is a projection of the first proof; whether MCP (via `@beep/mcp-kit`) is a later adapter over the canonical SDK — both projection-only candidates, never authority. | `architecture-proposal.md` | may defer |

## Acceptance Criteria

Packet-level (mapped to phases; each is a PLAN.md exit; each delivery phase
P0–P3 ships as its own PR driven to mergeable via `bun run beep yeet`):

- [ ] P0: seven `research/` artifacts — reconnaissance report; interest
      taxonomy + seed watchlist; product definition (users, jobs, questions
      the system answers); architecture proposal (G1 matrices, G4/G5/G6/G7
      resolutions, authority vs projection); technology ADR (options,
      evidence, tradeoffs, recommendation, confidence, reversibility, change
      conditions); prototype-disposition matrix (G3); untrusted-ingestion
      threat model — all registered in the manifest — plus the `history/`
      phase evidence note `history/P0-evidence.md` recording the manual
      sanitization review (history evidence notes follow the deterministic
      paths in PLAN.md's Phase evidence conventions and are exempt from
      `researchReports[]`). Corpus reconnaissance happens only within the
      operator-provided, session-only, read-only allowlist (PLAN "P0
      preflight"); the allowlist is never committed. All
      sanitization-clean (mechanical check + recorded manual review); gates
      G1–G6 `accepted`, G7 `accepted` or `deferred-nonblocking`; recon
      freshness check run and recorded.
- [ ] P1: proof specification with scenario; fixtures; the **exact proof
      invocation contract** (command name, arguments, inputs/config, outputs,
      exit codes); expected authoritative records (stable IDs, counts,
      hashes, canonical ordering); expected projections and the grounded
      brief projection schema (record-ID references + visible lifecycle
      state); the determinism scenario matrix (cold run, same-store rerun,
      clean-store rebuild, modified input, source removal, partial failure —
      all under a fixed clock); adversarial fixture list with expected
      redact/quarantine/render-safe outcomes; package ownership; failure
      cases; invariants; acceptance tests; deferred capabilities.
- [ ] P2: first vertical proof implemented per spec — watchlist → metadata +
      selected textual artifacts → immutable snapshots + stable evidence
      references → change/duplicate detection → normalized observations
      promoted into lifecycle-bearing candidate claims before any brief
      rendering (observations are intermediate records only, never a
      brief's authority) → deterministic summary → Markdown daily brief (what
      changed, why it matters, evidence, confidence/freshness/novelty,
      implications, proposed follow-ups) → typed Effect API. The named proof
      command from `proof-spec.md` executes from a clean checkout against
      fixtures with its transcript recorded as evidence.
- [ ] P3: proof green against the P1 determinism scenario matrix — idempotent
      reruns create no duplicate authoritative records (asserted on IDs,
      counts, hashes); updated inputs produce a clear reviewable change;
      projections delete-and-rebuild to equivalence; adversarial fixtures
      produce their specified outcomes; failures typed, observable, retryable
      where appropriate, and covered by tests; sample daily brief from
      fixtures committed as packet evidence. Quality condition (explicit
      alternative): `bun run beep yeet verify` (full tier) passes, OR every
      failure is reproduced against the `origin/main` base, classified as
      inherited/unrelated in `history/P3-evidence.md`, and no lane covering
      this packet's affected scope fails. Failures in the phase's own scope
      always block.
- [ ] P4 (program audit): an audit note under `history/` lists every P0–P3
      phase PR URL with its base/head branches and dependency order, and
      proves either that predecessors merged in sequence or that the stacked
      chain was rebased/retargeted and revalidated in landing order; each PR
      is MERGED or currently MERGEABLE with required checks green; packet
      phase statuses agree with GitHub state; the audit ships via its own
      yeet-gated PR.
- [ ] P5 (closeout PR), in order: closeout reflection written; staged
      roadmap in `research/roadmap.md` (production GitHub adapter → local
      research-directory ingestion → web → transcripts → scheduled
      unattended operation → repo comparison → trend detection →
      graph/search/embedding projections → vault publication → briefs →
      feedback-driven ranking → MCP adapter → safe proposal generation)
      recorded with prerequisites, risks, proof criteria, and exclusions per
      stage, plus the next-vertical-proof recommendation; pre-status
      Phase-Exit Audit passes (excluding flip/lint/PR conditions); only then
      the atomic status commit (manifest `initiative.status` + `lifecycle` +
      `phases[P5].status`, PLAN P5 row, README status/phase/evidence
      together), `bun run beep lint reflection-artifacts` against that
      completed status, and the status-bearing closeout PR driven to
      mergeable, followed by a final audit against the full oracle. Staging
      the status set is a PRE-publication condition; the published oracle is
      that the yeet-created closeout commit (`publish --staged-only`)
      atomically contains the entire status set with no earlier commit
      containing any of it. On any post-flip lint, audit, or yeet failure,
      restore each surface to its exact pre-transition value (lifecycle
      fields → `active`; phase-status fields → prior value; prose surfaces
      → pre-flip text; `goals/INDEX.md` regenerated against the restored
      manifest) — the goal is achieved only when the status-bearing
      closeout PR is MERGED, or currently MERGEABLE with required checks
      green.
- [ ] Every phase PR registers newly created `research/` artifacts in
      `ops/manifest.json` `researchReports[]` (and `currentSourceOfTruth[]`
      when normative) in the same PR. Deterministic `history/` evidence
      notes are NEVER added to `researchReports[]` — they are linked from
      README "Latest Evidence" instead.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/project-intelligence/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/project-intelligence/ops/manifest.json` | Passes |
| Packet references (grep) | `rg -n "project-intelligence\|GOAL.md\|agentLaunchers\|packetAnchorDocument" goals/project-intelligence` | Non-empty (coarse repo-standard check) |
| Manifest assertions | `jq -e '.initiative.id == "project-intelligence" and .initiative.packetAnchorDocument == "SPEC.md" and .agentLaunchers[0].path == "GOAL.md" and .lifecycle == .initiative.status' goals/project-intelligence/ops/manifest.json` | Exits 0 |
| Indexed paths exist | `sh -c 'set -e; for f in $(jq -r ".currentSourceOfTruth[]" goals/project-intelligence/ops/manifest.json); do test -e "$f"; done; for f in $(jq -r ".researchReports[]" goals/project-intelligence/ops/manifest.json); do test -e "goals/project-intelligence/$f"; done'` | Exits 0 |
| Whitespace | `git diff HEAD --check -- goals/project-intelligence` (covers staged AND unstaged) | Passes |
| Reflection artifacts | `bun run beep lint reflection-artifacts` | Passes |
| Sanitization (D2, mechanical) | Run the fenced tri-state command in the "Public-repo sanitization" constraint above — the single executable source; do not copy a pipe-escaped variant out of this table | Exits 0 (zero hits; scanner errors fail) |
| Sanitization (D2, semantic) | Recorded manual review in the phase evidence note | Present per phase |
| Phase-exit audit | PLAN.md "Phase-Exit Audit" checklist (manual until `beep goals doctor` ships) | All items pass |
| P2+ proof | The named proof command + scenario matrix from `research/proof-spec.md` | Green |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires unnamed credentials, cost, destructive side effects,
  or policy approval.
- A step would create difficult-to-reverse package or slice topology before
  its P0 decision gate is `accepted`.
- A step would introduce a major external dependency or vendor commitment
  before the technology ADR is accepted.
- A step would broaden access to private or privileged data beyond the
  explicit source allowlist.
- A conclusion would conflict with an authoritative repository specification.
- A gate enters `blocked` state: keep P0 open or pause the packet with an
  explicit resume condition; do not advance past it.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |

If G1 lands on consuming the epistemic slice's mechanism (gate, projection,
transition, live Layers), that bounded exception is recorded here per the
2026-06-18 decision, and removed when a third consumer justifies a
`shared/use-cases` contract or an emitted event.
