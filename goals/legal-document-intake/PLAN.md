# Legal Document Intake Plan

## Status

Status: `active` (P2 LLM filing agent is the open phase)

Each phase below ships as its own mergeable PR via `/yeet` (completion gate).
Phase content is normatively bounded by `SPEC.md` decisions D1–D11.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Close the five research questions below; no feature code. | Freshness-dated notes under `research/` answer each question with sources; SPEC updated if a decision needs a superseding entry. |
| P1 Vault + deterministic intake | complete | Workspace vault onboarding, app-level DnD, taxonomy seed, heuristic filing to local FS. | A dropped file lands at a taxonomy-valid vault path atomically; onboarding persists vault choice in a workspace table; deterministic tests green. |
| P2 LLM filing agent | pending | Content-aware filing per D8-S1: JS-native PDF/docx text-extraction driver; optional text excerpt on the FilingDecision port; LLM filing layer in `documents/server` (single-shot structured call; typed config for model, confidence threshold, excerpt length); auto-file with visible rationale, uncertain → `00-inbox`. | LLM proposes from document text, taxonomy validates, file placed or inboxed with rationale surfaced in the intake UI; heuristic stays the deterministic fixture Layer; agent-run browser-smoke evidence in the PR. |
| P3 Box sync | pending | One-way push sync process, durable sync state, remote-drift detection, Box OAuth setup UX. | Vault → Box mirror converges for create/move/rename; drift surfaces as conflict records; sync survives app restart via durable cursors. |
| P4 Extraction → KG loop | pending | file-processing + langextract on filed docs; librarian proposes epistemic candidates; LLM critic + extended ClaimGate (real `@beep/shacl` validator per D7-S1); configurable turns. | Admitted claims materialize as KG node/edge rows with DMS link + span provenance; rejected submissions leave an auditable trail; turn count is config. |
| P5 Retrieval + viewer | pending | Local embedding driver + pgvector; two-hop query; dock panel with span highlight (shell per D9-S1); open-in-Word. | NL query → semantic entry → recursive-SQL traversal → document opens at highlighted span; DMS link clickable; OS handoff to Word works. |
| P6 M365 write + dual DMS | pending | Upload/folder-create/move verbs in `@beep/m365`; second adapter on the same DMS port. | Same sync suite passes against OneDrive; port abstraction unchanged. |
| P7 Close | pending | Program closeout: statuses, evidence, reflection. | README/manifest updated; closeout reflection exists; lint green. |

## P0 Research Tasks

1. **Default vault folder structure** — survey legal DMS conventions
   (matter-centric vs client-centric vs doc-type-first; NetDocuments/iManage
   workspace norms). Output: recommended default layout as a taxonomy
   projection rule. → `research/folder-structure.md`
2. **Taxonomy seed design** — enumerate the seed concept set (pleadings,
   correspondence, agreements, discovery, billing, ...), map to FOLIO IRIs
   where they exist, define the Effect Schema/LiteralKit + JSON-LD shape and
   the projection function contract. → `research/taxonomy-seed.md`
3. **Embedding bake-off** — evaluate local ONNX candidates (bge-m3,
   nomic-embed-text, ...) for legal text against pgvector; latency and recall
   targets for both KG symbolic-entry search and document semantic search;
   pick the driver's default model. → `research/embedding-bakeoff.md`
4. **Librarian/critic prior art** — mine `goals/trustgraph-port` findings,
   `~/YeeBois/dev/trustgraph/ts` (librarian patterns), and
   `~/YeeBois/dev/cognee` (pipeline stages, ontology validation, provenance
   anchoring) for prompt and loop design. → `research/librarian-critic.md`
5. **Sync-state model** — design durable sync tables (content hashes, remote
   ids, cursors/stream positions, conflict records), atomic-materialization
   protocol, and the Box events/webhook vs polling choice for drift detection.
   → `research/sync-state-model.md`

## Key Reuse (evidence: `research/exploration-findings.md`)

- Slice scaffold: `bun run beep architecture` (aggregates archetype) for the
  `documents` slice.
- Transport/runtime: `apps/professional-desktop/src/transport/TauriIpcSocket.ts`
  pattern, `src/runtime/` atom runtime, ChatRpcs-style contracts in
  `packages/agents/*`.
- DnD precedent: `packages/foundation/ui-system/editor/src/chat/attachments.tsx`
  + schema-first `ComposerAttachment` (attachment-model.ts).
- E2E precedent to generalize: law-practice rung-0 loop —
  `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.service.ts`,
  `OfficeActionReview.service.ts`, epistemic ClaimGate,
  `packages/law-practice/server/src/Layer.ts`.
- Drivers: `@beep/box` (write surface exists), `@beep/m365` (read-only),
  `@beep/tika`, `@beep/libpff`, `@beep/wink`, `@beep/nlp-mcp`.
- Extraction: `@beep/file-processing`, `@beep/langextract`
  (span-aligned `GroundedExtraction[]`, `Handoff` IR), `@beep/nlp-processing`.
- Ontology: `@beep/rdf`, `@beep/ontology`, `@beep/semantic-web` (bounded SHACL
  validator), FOLIO OpenAPI models in
  `packages/foundation/modeling/ontology/src/Ontology.models.ts`.
- Loop precedents: `agents/server/AssistantTurn/BlockRepair.ts` (2-turn repair
  loop to generalize), epistemic claim lifecycle.
- Sync primitives: file watch + `DrainableWorker` in
  `packages/foundation/modeling/utils/src/`.

## Cross-Packet Touch-Ups (shipped with packet authoring)

- `goals/box-driver/README.md` — stale "Pending implementation" status
  corrected against actual `@beep/box` source.
- `goals/ip-law-knowledge-graph/research/kg-storage-resolution.md` — records
  the FalkorDB-vs-projection P0 resolution (projection, per D6) with pointer
  back to this packet.

## P7 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained` /
`complete`):

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`; frontmatter must validate
   against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (`reflectionRequired: true`).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Every phase PR includes evidence of an agent-run browser smoke: frontend +
  sidecar over HTTP against a temp vault, driving the phase's real user flow
  end to end (added 2026-07-10; P1's drop path shipped broken despite green
  unit tests).
- Keep `SPEC.md` normative; decision changes get dated superseding entries in
  the D1–D11 table.
- Skills support rides P4+ and is gated on `mcp-kit` / `mcp-host-retrofit`
  merging; if blocked, ship the phase without skills and record the deferral.
- Keep this plan current; archive run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/legal-document-intake/GOAL.md)" -le 4000
jq . goals/legal-document-intake/ops/manifest.json
rg -n "legal-document-intake|GOAL.md|agentLaunchers|packetAnchorDocument" goals/legal-document-intake
git diff --check -- goals/legal-document-intake
```
