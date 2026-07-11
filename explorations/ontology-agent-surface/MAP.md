# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `ontology-agent-surface` | Expose the ontology workbench to agents as a curated ~10-tool MCP surface served from the desktop sidecar over streamable HTTP — gated, attributed, budgeted, stateless over saved files with fingerprint CAS — with the workbench retrospective's hardening pre-work folded in. | `goals/ontology-workbench` (completed-retained); `goals/mcp-kit` (landed) | See capability table below |

One packet, per the brief's appetite. A session-repository refactor or a second
transport would trigger a split — both are v1 no-gos.

### Capability table

| Component | Basis |
| --- | --- |
| Tool gating / annotations / budgets | `@beep/mcp-kit` — `TierGate.ts`, `ToolAnnotations.ts` (RESEARCH in-repo inventory) |
| MCP driver shape | `@beep/m365-mcp` — schema tools → thin handlers → sanitized server + end-to-end protocol test (template) |
| Tool business logic | `@beep/ontology-use-cases` — Session services / projections / sparql / reasoner / validation |
| Real engines | `@beep/oxigraph`, `@beep/shacl`, `@beep/n3` layers via `@beep/ontology-server` |
| CAS fingerprint | `@beep/rdf-canonize` rdfc-1.0 fingerprint (workbench round-trip machinery) |
| Sidecar HTTP + auth | `apps/professional-desktop/server/main.ts`, `RpcSessionAuth` |
| PROV journal | `Session.validation.ts` provenance export + `@beep/rdf/Vocab/Prov` |
| Streamable-HTTP MCP hosting | **NET-NEW** — repo MCP drivers are stdio-only (research gap #3); new transport mount patterned on the MCP spec |
| CAS save precondition | **NET-NEW** — the fingerprint exists; the compare-and-swap write contract does not |
| Repair strategy registry | **NET-NEW** — `sh:hasValue`-only today (research gap; P0 scope) |
| Actor attribution threading | **NET-NEW** — `prov:Agent` emitted ad hoc; caller identity → journal is new |

## Sequencing

Single packet, phased (seeds the goal PLAN); the ordering rationale is that
each phase's outputs are the next phase's inputs:

1. **P0 Bootstrap + hardening** — verify surfaces against research; repair
   strategy registry beyond `sh:hasValue`; base-prefix codec fidelity; ROBOT
   host validation of interop fixtures. The repair tool is hollow and file
   rewrites are lossy until these land, and all three touch files later
   phases touch again.
2. **P1 Toolkit definition** — the ~10 tool schemas wrapping ontology
   use-cases (open/inspect, snapshot/describe, search, sparql-query,
   propose-change-batch, validate, repair, export-provenance,
   capability-metadata); the stateless open → apply → CAS-save helper; static
   budgets; typed tool errors including the drift-cap and CAS-rejection
   contracts. Adopt the single partition-ingestion classifier here (same
   files).
3. **P2 Transport + safety wiring** — streamable-HTTP `/mcp` endpoint on the
   sidecar beside `/rpc/` (Origin validation, loopback bind,
   `RpcSessionAuth`); TierGate fail-closed on mutating tools; actor identity
   threaded into the PROV-O journal; live end-to-end proof from a real agent
   client.
4. **P3 Harden + close** — per-call parse latency benchmark at 1k/10k/100k;
   tool documentation; packet closeout with reflection.

## First Vertical Slice

`capability-metadata` + `sparql-query` served over the real `/mcp` endpoint
with auth, driven by an actual MCP client: the thinnest path exercising
transport, auth, toolkit registration, budgets, and a real engine (oxigraph)
before any mutation ships. Verified by a scripted MCP client session
(initialize → tools/list → tools/call) asserting bounded results.

## Open Risks Inherited From The Brief

- Semantic-vs-byte CAS precondition choice — decide in P1 before the save
  contract freezes.
- Stateless per-call parse cost at 100k scale — benchmark gate in P3; no
  silent caching (that recreates the session-ownership problem).
- First production TierGate wiring sets the repo precedent — review as a
  standard-setting change.
- Actor identity source at the HTTP boundary must be settled before PROV
  attribution is meaningful — P2 entry criterion.
- Concurrent human edits: CAS rejection needs a recoverable error contract
  (current fingerprint + refetch guidance), not bare failure.
