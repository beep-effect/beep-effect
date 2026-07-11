# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-07-10

Dump from the ontology-workbench closeout retrospective (plan approved by user;
plan file: ~/.claude/plans/ok-so-all-of-agile-snowflake.md). The workbench packet
(goals/ontology-workbench, completed-retained, PRs #351/#354/#360/#361) named
"agent/MCP tool surface" as its explicit follow-up packet in GOAL.md's out-list.
This exploration is that follow-up.

Core idea: expose the ontology workbench to agents. SPEC 13-16 of the workbench
packet built the agent-ready plumbing on purpose:

- SPEC 13: session partitioned into derived named graphs
  (asserted/ontologies/inferred/shapes/provenance) with one shared exclusion
  rule — agents can address partitions.
- SPEC 14: schema-typed worker protocol for parse/diff — protocol messages are
  effect/Schema classes, already serializable for a tool boundary.
- SPEC 15: inference invalidation discipline (changed signatures, module-scoped
  recompute, drift-cap fail-closed) — safe for agent-driven bulk edits.
- SPEC 16: batch ops return REAL deltas; SPARQL runner has LIMIT
  injection/truncation safeguards — exactly what an agent tool result needs
  (deltas not booleans; bounded result sets).

So the tool surface should be mostly a THIN adapter: OntologyRpcs (client
package, follows agents ChatRpcs pattern) already expose open/save/apply-batch/
undo/redo/search/snapshot/sparql/infer/validate/export-provenance through the
desktop sidecar. An MCP server (or agent tool registry entry) wrapping those
RPCs gives agents: open a Turtle file, query it, propose typed change-op
batches, get deltas back, validate, receive verified repair proposals, export
provenance. The change-op model means agent edits are undoable + journaled by
construction (PROV-O export already derives from the change log — agent
attribution could ride the same journal).

Repo already has MCP infra: packages/drivers/nlp-mcp, m365-mcp, uspto-mcp exist
as MCP server drivers — check their shape for the pattern. Also mcp-kit package
exists (packages/... check exact path) — likely the shared MCP server toolkit.

Hardening pre-work to fold into P0/P1 of this packet (from the retrospective):

- Repair strategy generalization: repairs are sh:hasValue addQuad proposals
  only; generalize to per-constraint-component strategy registry (minCount,
  datatype, class/range) reusing the same verify-then-offer loop
  (packages/ontology/use-cases/.../Session.validation.ts).
- ROBOT host validation: commands recorded in
  goals/ontology-workbench/history/2026-07-09-p6-harden-close.md — install
  ROBOT once, upgrade structural interop pass to tool-validated.
- Codec fidelity: empty/base @prefix : binding is dropped on save (named
  prefixes survive). Fix in @beep/n3 + session prefix plumbing.

Architecture consolidations to adopt opportunistically (same files get touched):

- Single ingestion pipeline for partition classification — the P5 inert-Validate
  bug happened because base-file quads and change-op quads took different paths
  into partitions. One classifier for ALL quads.
- Worker-safe subpath entrypoints as enforced convention (P3 micromark-in-worker
  crash came from @beep/schema fat root barrel). Generalize the
  aggregates/Session/worker pattern + DOM-free import-graph lint.
- Shared surfaced-action-state helper (idle|running|blocked|failed|complete
  atom pattern from P5) — agents need the same visibility: a tool call that
  silently no-ops is worse for an agent than for a human.

Agent-specific concerns to research/align on:

- Placement: MCP server in the sidecar process? Separate process sharing the
  session store? The sidecar already hosts the RPC handlers — an MCP transport
  over the same handlers is the light path. But desktop-app-hosted MCP is
  unusual — how does an external agent reach it (stdio spawn of the sidecar
  binary? socket?).
- Session ownership: concurrent human (workbench UI) + agent editing the same
  session — the change log serializes edits, undo/redo semantics with two
  writers need thought. Partitioned session indexes (SPEC 16) were built for
  this but the concurrency contract was never exercised.
- Safeguards: SPARQL LIMIT injection exists; agents also need quad-count caps
  on batch ops, maybe rate/size budgets, and the drift-cap fail-closed behavior
  surfaced as a tool error not a silent full recompute.
- Attribution: PROV-O journal should distinguish agent-authored change ops from
  human ones (prov:Agent per actor — the journal already models prov:Agent;
  wire actor identity through the RPC/tool boundary).
- The t2/t3 DL reasoning deferral is NOT this packet (separate follow-up); but
  the tool surface should expose reasoner capability metadata so agents know
  what inference is/isn't available.

Prior art to check in research: MCP servers for knowledge graphs / SPARQL
endpoints (there are community ones), Protégé plugin APIs, LinkML/oaklib agent
tooling, the ontology-* agent skills already in this repo's .claude/skills
(ontology-architect, ontology-conceptualizer, ontology-curator, etc. — they
assume ROBOT/oaklib CLIs; this packet could give them native tools instead).
