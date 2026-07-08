# Legal Document Intake Spec

## Objective

A lawyer using `apps/professional-desktop` can: (1) select a workspace vault
directory during first-run onboarding; (2) drop one or many files onto an
app-level intake surface and have each filed into a taxonomy-derived folder
path, validated against the taxonomy before placement; (3) have the vault
mirrored one-way to Box (later OneDrive); (4) have filed documents parsed,
extracted, and proposed into a knowledge graph through a librarian → critic →
gate loop; (5) ask a natural-language question ("pull up the indemnification
clause of the agreement for matter #X") and have the source document open in a
dock panel at the exact highlighted span, with a working DMS link and
open-in-Word handoff.

## Locked Decisions

Decisions D1–D11 were locked 2026-07-08 in a grilled design session backed by
an 8-agent exploration workflow
([`research/exploration-findings.md`](./research/exploration-findings.md)).
Changing one requires updating this table with a dated superseding entry.

| ID | Decision | Choice |
| --- | --- | --- |
| D1 | Packet shape | One umbrella packet; each `PLAN.md` phase is its own mergeable PR. Dependency packets referenced, not duplicated. |
| D2 | Owning slice | New `documents` slice owns Document, FilingDecision, SyncState, IntakeBatch product language. `workspace` slice owns vault config; `law-practice` keeps legal semantics. Cross-slice flow via events per `standards/architecture/10-cross-slice-coordination.md`. |
| D3 | First DMS | Box. `@beep/box` already ships uploads/folders/streaming/webhooks in source. M365 write verbs are P6, behind the same `documents` DMS port. |
| D4 | Sync model | One-way push v1: local vault is canonical; sync pushes creates/moves/renames to the DMS mirror. Remote changes detected (delta/events) are surfaced as conflicts-to-review, never auto-merged. Bidirectional sync is out of scope. |
| D5 | Taxonomy | Repo-owned SKOS-style seed: Effect Schema/LiteralKit domain + JSON-LD data, concept IRIs aligned to FOLIO where they exist. Local folder layout is a deterministic projection of the taxonomy. Default layout picked by P0 research (matter-centric is the working hypothesis). |
| D5-S1 | Taxonomy projection default (2026-07-08 superseding entry) | Supersedes only D5's working hypothesis: the default vault projection is matter-centric: `{vaultRoot}/matters/{clientSegment}/{matterSegment}/{taxonomyConceptPath}/{documentFileName}`, with `00-inbox/{intakeBatchId}/` reserved for unfiled intake artifacts. D5's repo-owned SKOS-style taxonomy and deterministic projection requirements remain unchanged; taxonomy concepts remain the only document-class folder source. Evidence: [`research/folder-structure.md`](./research/folder-structure.md). |
| D6 | KG storage | Postgres/PGlite projection: nodes/edges as schema-first tables; embeddings via pgvector; two-hop traversal via recursive SQL. Resolves `ip-law-knowledge-graph`'s FalkorDB-vs-projection P0 in favor of projection. Dedicated graph DB stays a later optimization behind the same port. |
| D7 | Critic loop | KG submissions are epistemic claims. Librarian proposes candidates; the loop composes a new LLM critic with the extended symbolic ClaimGate (validates against the D5 taxonomy); only admitted claims materialize as KG nodes/edges. Turn count is a typed config contract, not a constant. |
| D8 | Phase-1 cut | Vault onboarding + app-level DnD + taxonomy seed + deterministic (heuristic) filing writing local FS. The LLM agent swaps in at P2 behind the same FilingDecision port (law-practice rung-0 precedent). |
| D9 | Dock UI | Adopt the `dockview` npm package app-local in `apps/professional-desktop` (framework wrappers stay app-local, per the `TauriIpcSocket.ts` precedent). Promote to `foundation/ui-system` only when a second app needs it. Line highlight builds on langextract span/Alignment types. |
| D10 | Privacy posture | Cloud LLM allowed (Anthropic; the Tauri shell already resolves the API key). Embeddings run locally via an ONNX driver (bge-m3 / nomic-embed candidates; P0 bake-off decides) so bulk privileged text does not transit an embedding vendor and search works offline. |
| D11 | Agent runtime | Filing/librarian/critic agents execute in the bun sidecar behind ChatRpcs-style RPC contracts. The webview stays a thin client. |

## Non-Goals

- Bidirectional DMS sync, tombstones, or automatic conflict merging (v1 is
  one-way push per D4).
- OCR (out of scope per file-processing-capability V1; only the strategy flag
  exists).
- Multi-device or team/shared vaults.
- Local LLM inference (Ollama-class) for agents.
- FalkorDB or any dedicated graph database (D6).
- Implementing `@beep/box` or `@beep/m365-mcp` internals beyond what sync
  requires — driver-internal work belongs to those packets.
- Building the generic skills/MCP host substrate — gated on `mcp-kit` /
  `mcp-host-retrofit` merging; this packet only consumes it (P4+).

## Source Hierarchy

1. User objective that created this packet (2026-07-08 design session).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `standards/ARCHITECTURE.md` and `standards/architecture/*` (notably 01, 02,
   03, 05, 06, 09, 10).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/documents/*` — NET-NEW slice (domain, use-cases, config, server,
  tables, client, ui as needed), scaffolded via `bun run beep architecture`.
- `packages/workspace/*` — Workspace gains a vault directory path and a real
  workspace table; per-workspace config contract.
- `packages/agents/*` — live LLM AgentMode; filing/librarian/critic agent
  services; configurable-turns config contract.
- `packages/epistemic/*` — LLM critic composition with ClaimGate; taxonomy
  validation hook; KG node/edge materialization from admitted claims.
- `packages/drivers/m365` — write verbs (P6 only).
- NET-NEW local embedding driver package under `packages/drivers/`.
- `apps/professional-desktop` — onboarding flow, DnD intake surface, dockview
  panel, document viewer with span highlight, Box OAuth integration setup UX,
  sidecar RPC wiring.
- This packet's docs and the two cross-packet touch-ups recorded in `PLAN.md`.

## Constraints

- Slice-to-slice direct imports are forbidden; documents ↔ workspace ↔
  epistemic integration goes through emitted events or promoted
  `shared/use-cases` contracts with promotion records
  (`standards/architecture/02-shared-kernel.md`, `10-cross-slice-coordination.md`).
- Schema-first domain models, typed errors, tagged unions; error translation at
  boundaries per `09-errors-across-boundaries.md`.
- The DMS surface must be a `documents` use-cases port; Box and M365 are server
  adapters over drivers. No driver types leak into domain or use-cases.
- Deterministic tests first: every LLM-backed behavior needs a fixture-mode
  Layer so slices test without live keys (rung-0 precedent).
- Only `apps/professional-desktop`-local modules may import `@tauri-apps/api`
  or `dockview` (D9; app-local framework wrapper rule).
- The taxonomy is data plus derived schema — filing logic must not hardcode
  folder names outside the taxonomy projection.
- Atomic local FS materialization: a failed filing must never leave partial
  files in the vault.
- Each phase ends as one mergeable PR via `/yeet` (completion gate).

## Acceptance Criteria

Per-phase exit criteria live in `PLAN.md`. Program-level acceptance:

- [ ] First-run onboarding creates/opens a vault; the choice persists in a
      workspace table (no localStorage-only state).
- [ ] Dropping N files results in N taxonomy-valid vault paths (deterministic
      in P1, LLM-decided but taxonomy-validated in P2), atomically written.
- [ ] Vault → Box mirror converges after create/move/rename with durable sync
      state; remote drift is surfaced as a conflict, never auto-merged.
- [ ] Filed documents yield span-grounded extractions; librarian → critic →
      gate loop with configurable turns produces only admitted claims as KG
      nodes/edges, each carrying a DMS link and source span provenance.
- [ ] A natural-language query resolves via semantic entry + two-hop graph
      traversal and opens the document in a dockview panel with the exact span
      highlighted; open-in-Word handoff works.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/legal-document-intake/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/legal-document-intake/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/legal-document-intake` | Passes |
| Repo quality | `bun run beep yeet repair` then `... verify` on each phase branch | Green |
| Slice isolation | Each phase's tests run with own Layers + shared test-kit + driver test Layers only | Passes |
| Reflections | `bun run beep lint reflection-artifacts` at each phase close | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope (e.g. bidirectional sync creep,
  graph-DB adoption, OCR).
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec (Box/M365 test tenants must be arranged
  before P3/P6 execution, not improvised).
- A dependency packet blocks a phase (`mcp-kit` for skills support) — pause the
  phase, do not inline the dependency's work here.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
