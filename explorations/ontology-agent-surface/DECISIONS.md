# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-07-10 — MCP transport & placement

**Question:** How should agents reach the ontology tool surface — streamable
HTTP mounted on the existing sidecar, a stdio headless launcher (m365-mcp
pattern), both, or defer?

**Answer:** Streamable HTTP `/mcp` endpoint mounted on the existing sidecar
loopback server, beside `/rpc/`, reusing `RpcSessionAuth` for the MCP spec's
local-server auth requirement. A stdio headless launcher is an explicit
possible follow-up for CLI-only agent clients, not part of v1.

**Rationale:** The sidecar already serves loopback HTTP with bearer auth, so
this is the minimal-delta option satisfying the MCP spec's local-HTTP security
requirements (Origin validation, 127.0.0.1 binding, authentication). Sidecar
stdio is occupied by Effect RPC framing (`IpcStdoutGuard` — RESEARCH in-repo
inventory), ruling out same-process stdio. Rejected: stdio headless launcher
as v1 (duplicates runtime boot; permanently blind to running-app state);
both-transports-day-one (double the test/parity surface before the tool
vocabulary is proven); defer (this fork gates the P0/P1 slice shape).

## 2026-07-10 — Agent session model (v1)

**Question:** The live editing session is owned by the webview atom registry —
not the sidecar — with no revision/two-writer contract. What session model do
v1 agent tools get?

**Answer:** Stateless on saved files with a fingerprint compare-and-swap:
each tool call opens the Turtle file server-side, applies typed change-op
batches, and saves atomically guarded by an rdfc-1.0 canonize-fingerprint
precondition. Agents see last-saved state; the human's unsaved webview session
is explicitly out of v1 scope. Tool schemas reserve a `sessionHandle` field
for a future stateful v2.

**Rationale:** Matches the files-as-truth doctrine and reuses the existing
canonize fingerprint machinery for conflict safety without building a
revisioned session repository. Agent edits stay typed change-op batches
(applied via the server-side session use-cases), so verified repairs and
PROV attribution still work. Rejected: sidecar session repository now (the
right long-term shape but a client-atom refactor that would dominate the
packet); agent-exclusive live sessions with human-file locking (adds lock
lifecycle complexity without solving stale-read semantics); defer (the choice
drives every tool contract schema, so deferring weakens decompose).

## 2026-07-10 — Mutation safety scope (v1)

**Question:** First write-capable MCP surface in the repo; no production
driver wires mcp-kit's TierGate today. Which safety mechanisms are
launch-blocking?

**Answer:** All three, in minimal forms: (1) TierGate wired fail-closed on
every mutating tool; (2) per-change actor attribution threaded into the
PROV-O journal (`prov:Agent` per caller identity crossing the tool boundary);
(3) simple static budgets — max quads per change-op batch, max results per
query — with the reasoner drift-cap surfaced as a typed tool error rather
than a silent full recompute.

**Rationale:** This surface sets the write-precedent for every future MCP
driver; shipping it gated, attributed, and bounded is the point of having
mcp-kit. Minimal forms keep the lift small (static caps, existing PROV
plumbing, existing TierGate). Rejected: TierGate+attribution without budgets
(pathological batch sizes stay possible); budgets-only (ungated writes
contradict mcp-kit's fail-closed design); read-only v1 (abandons the packet's
differentiator — typed undoable agent edits and verified repairs).

## 2026-07-10 — Tool vocabulary (v1)

**Question:** Expose the 9 wire-ready RPCs 1:1, or curate an agent-first tool
set?

**Answer:** Curated agent-first set of roughly 10 task-oriented tools wrapping
the use-cases directly (not RPC 1:1): open/inspect, snapshot/describe, search,
sparql-query, propose-change-batch (delta-returning), validate, repair
(verified proposals), export-provenance, capability-metadata. Grow toward
open-ontologies-style breadth only as usage proves need.

**Rationale:** The RPC shapes were designed for the workbench UI — most send a
complete `Session`, which the stateless+CAS file model replaces anyway — and
undo/redo/search have no RPC to mirror (client-local). Wrapping use-cases
directly gives agent-shaped contracts without disturbing the UI RPC surface.
Rejected: 1:1 RPC mirror (UI-shaped payloads, missing tools); 25+ tools day
one (schema/test surface ahead of usage data); minimal read+propose pair
(leaves the flagship validate→repair loop out of the first slice).

## 2026-07-10 — Packet scope: hardening pre-work folded in

**Question:** Fold the workbench retrospective's hardening pre-work into this
packet's early phases, or keep a pure MCP-surface packet?

**Answer:** Fold into P0/P1: repair-strategy registry (per-constraint-component
strategies beyond `sh:hasValue`), base-prefix codec fidelity, and ROBOT host
validation. The three architecture consolidations (single partition-ingestion
classifier, worker-safe entrypoint convention, shared surfaced-action-state
helper) ride along opportunistically where phases already touch those files.

**Rationale:** The repair tool is a flagship v1 tool and ships hollow if it
only repairs `sh:hasValue`; agents rewriting files make codec fidelity
first-contact; ROBOT validation is cheap and upgrades interop evidence.
Matches the user-approved retrospective plan. Rejected: pure MCP packet
(serial packets churning the same files); repairs-only fold (defers the
fidelity issue agents hit first).
