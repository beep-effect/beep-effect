# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets. The exploration is shaped when the human says
this file matches the picture in their head.
-->

## Problem

The ontology workbench (goals/ontology-workbench, completed-retained) gives a
human everything: open/edit/save Turtle with typed undoable change ops, SPARQL
with safeguards, bounded inference, SHACL validation with verified repairs,
PROV-O journaling. Agents get none of it. The repo's ontology-flavored agent
work (legal-document-intake taxonomies, schema-derived ontologies, future
authoring loops) either shells out to external CLIs or hand-rolls Turtle —
losing the typed edit model, the verified-repair loop, and provenance. The
workbench's SPEC 13–16 plumbing (partitioned graphs, schema-typed protocol,
real batch deltas, query safeguards) was built precisely for this consumer and
has none. Meanwhile the community is converging on agentic ontology tooling
(open-ontologies, owl-mcp) without our differentiators: files-as-truth, typed
undoable change ops shared with a human UI, verified repairs, per-edit
provenance.

## Appetite

One goal packet on the scale of a mid-size workbench phase (P4-ish): roughly
one focused execution arc, phased P0→P3, landing as a handful of stacked PRs.
Not a multi-packet program — the thin-adapter thesis is the point; if the
surface starts demanding a session-repository refactor or a second transport,
that is out-of-appetite and gets deferred.

## Solution Sketch

**A curated ~10-tool MCP surface, served from the existing desktop sidecar,
wrapping the ontology use-cases directly.**

- **Transport/placement** (DECISIONS 2026-07-10): streamable-HTTP `/mcp`
  endpoint mounted beside `/rpc/` on the sidecar's loopback server; reuses
  `RpcSessionAuth`; Origin-validated, 127.0.0.1-bound. stdio launcher is a
  possible follow-up, not v1.
- **Session model** (DECISIONS): v1 tools are stateless over saved files.
  Open server-side → apply typed change-op batch → save guarded by an
  rdfc-1.0 canonize-fingerprint compare-and-swap. Unsaved webview state is
  out of scope; `sessionHandle` reserved in schemas for a stateful v2.
- **Tool vocabulary** (DECISIONS): ~10 task-oriented tools wrapping
  use-cases (not RPC 1:1): open/inspect, snapshot/describe, search,
  sparql-query, propose-change-batch (returns real deltas), validate,
  repair (verified proposals), export-provenance, capability-metadata.
  Toolkit definition lives with the ontology slice; the MCP driver hosts it
  (m365-mcp template: schema tools → thin handlers → sanitized server; the
  first end-to-end HTTP MCP protocol test in the repo).
- **Write safety** (DECISIONS): TierGate fail-closed on every mutating tool;
  actor identity threaded into the PROV-O journal (`prov:Agent` per caller);
  static budgets (max quads/batch, max results/query); reasoner drift-cap
  surfaced as a typed tool error.
- **Hardening folded into early phases** (DECISIONS): repair-strategy
  registry beyond `sh:hasValue` (the repair tool depends on it), base-prefix
  codec fidelity (agents rewrite files), ROBOT host validation of interop
  fixtures. Architecture consolidations (single partition-ingestion
  classifier, worker-safe entrypoints, shared action-state helper) adopted
  opportunistically where phases touch those files.
- **Proof style** (workbench lesson): every tool proven against the real
  engine stack (oxigraph/shacl/n3 layers) in tests, plus a live proof driving
  the MCP endpoint end-to-end from an actual agent client; no fakes-only
  coverage; no silent no-op guards — every refusal is a typed tool error.

## Rabbit Holes

- **CAS semantics under prefix/formatting churn**: the fingerprint is
  canonical (rdfc-1.0), so a byte-different but semantically-equal file passes
  CAS — decide early whether that is the intended precondition (semantic
  equality) or whether saves also need a byte-hash guard.
- **Tool-call latency vs. per-call open/parse**: stateless means re-parsing
  the file each call; fine for pizza-scale, unknown at 100k-element scale.
  Budget a benchmark before declaring the model final; do not silently cache
  (that recreates the session-ownership problem).
- **TierGate wiring precedent**: no production driver wires it today —
  the first wiring defines the pattern; review it as a standard-setting
  change, not a local detail.
- **Actor identity source**: what identifies "the agent" at the HTTP boundary
  (bearer token claims? client-declared name?) — must be decided before the
  PROV attribution is meaningful rather than decorative.
- **Concurrent human edits**: CAS rejects the write, but the agent needs a
  recoverable error contract (current fingerprint + refetch guidance), not
  just failure.

## No-Gos

- No sidecar session repository / revisioned two-writer contract in v1
  (reserved for v2; `sessionHandle` placeholder only).
- No stdio transport in v1.
- No OWL 2 DL reasoning (t2/t3 competency deferral stands; capability-metadata
  tool advertises what inference exists).
- No broad tool vocabulary (25+) before usage data.
- No registry fetch (OLS/BioPortal), multi-format import/export, or
  server-backed workspaces (inherited from the workbench GOAL out-list).
- No unguarded mutations: a tool that cannot be gated, attributed, and
  budgeted does not ship.
