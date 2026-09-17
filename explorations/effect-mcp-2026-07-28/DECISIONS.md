# Effect MCP 2026-07-28 Stateless Protocol Adoption — Decisions

<!--
Stage 2 (align) log. One entry per resolved branch-closing question, newest
last. Unresolved questions live in ops/manifest.json `openQuestions` until they
land here. Deferred questions get an entry too, marked DEFERRED with the reason.

G1–G9 were settled on 2026-09-16 in the grounding grill that preceded the
research plan (plan-mode session, AskUserQuestion rounds, recommendation first).
They scope the research; the post-research /grill-with-docs session appends the
design decisions below them.
-->

## 2026-09-16 — G1 release vehicle

**Question:** #7265 merged after `effect@4.0.0-rc.115` was cut and rc.116 (#8201) is unpublished.
Wait for rc.116, pin a pkg.pr.new snapshot, or research only?

**Answer:** Pin a pkg.pr.new snapshot of upstream main, following the #1060 (`c8349ed`) precedent,
and swap to the published RC once one carries the adapter.

**Rationale:** Starting implementation does not have to wait on an unscheduled release. The repo
has already run a snapshot campaign end to end.

**Rejected:** research now and gate implementation on rc.116 (recommended at the time: one bump,
no re-pin); research only with no goal until rc.116 ships.

## 2026-09-16 — G2 ambition

**Question:** Migration only, full adoption, or kit plus one proving host?

**Answer:** Full adoption, staged: absorb the snapshot's breaking changes, move hosts to
2026-07-28, and wire new capabilities where the protocol makes them natural. Order is mcp-kit
first, then a proving host, then the remaining hosts.

**Rationale:** The kit is shared by every host, so a kit-first order proves the design once.

**Rejected:** migration only (stay on 2025-06-18, defer features); kit plus one proving host with
the other hosts as later goals.

## 2026-09-16 — G3 packet vehicle

**Question:** Exploration packet that graduates, or a goal packet directly?

**Answer:** This exploration packet, driven through `/explore` (capture, research, align via
`/grill-with-docs`, shape, decompose, graduate), producing one goal or a short goal train sized by
the evidence.

**Rationale:** The work is research-heavy and the design has open branches; the exploration
pipeline carries the provenance and the graduation checks.

**Rejected:** scaffolding `goals/<slug>/` directly (faster, skips the definition-of-ready gate).

## 2026-09-16 — G4 protocol posture

**Question:** Which protocol adapters should each host negotiate: 2026-07-28 plus legacy
fallbacks, a per-host matrix, or 2026-07-28 only?

**Answer:** `McpProtocol.v2026_07_28` only. No mixed protocol lists.

**Rationale:** The goal is a clean stateless protocol, not a compatibility layer; carrying the
session-era runtime alongside it keeps the complexity the upgrade is meant to remove.

**Rejected:** `[v2026_07_28, v2025_11_25, v2025_06_18]` negotiation (recommended at the time);
a research-driven per-host protocol matrix.

## 2026-09-16 — G5 motivation

**Question:** Which new capabilities (MRTR `InputRequired`, `subscriptions/listen`, JSON
`structuredContent`, `server/discover` with `instructions` and prompt titles) have product pull?

**Answer:** None specifically. The driver is "an actually good protocol"; capabilities get wired
where the protocol makes them the natural shape, not because a product feature demands them.

**Rationale:** Operator statement. Research and the align grill decide per capability whether it
is forced, natural, or optional for each host.

## 2026-09-16 — G6 client compatibility scope

**Question:** What happens when a client in use cannot speak 2026-07-28 (for example cursor-agent)?

**Answer:** Out of scope. The work targets the in-repo MCP servers; external agent clients do not
gate the protocol flip.

**Rationale:** Operator statement: "This is for the in package mcp servers we have mostly in
./packages/drivers. cursor-agent is irrelevant here".

**Rejected:** holding a host on its current protocol until each client catches up; a flagged
temporary legacy fallback.

## 2026-09-16 — G7 snapshot PR shape

**Question:** How should the snapshot bump land, given 29 non-MCP changesets on upstream main?

**Answer:** Its own first PR, pinned to the newest upstream main snapshot at implementation start,
absorbing every repo-wide breaking change (as #1060 did) while hosts stay compiling. Stateless MCP
work follows in later PRs; the swap to rc.116 happens when it publishes.

**Rationale:** Keeps repo-wide migration noise out of the MCP design review.

**Rejected:** pinning at `769f6046a2` (#8242) to avoid the later commits; folding the pin into the
first MCP PR.

## 2026-09-16 — G8 upstream documentation

**Question:** `effect:packages/effect/MCP.md` does not cover 2026-07-28. Contribute docs upstream?

**Answer:** Research records the doc gaps with evidence; the goal carries an optional, non-blocking
lane for a docs PR from the `beep-effect/effect` fork, using examples proven on in-repo hosts.

**Rejected:** a required upstream docs deliverable in acceptance; no upstream work.

## 2026-09-16 — G9 host scope

**Question:** Beyond the four drivers, are the practice-kg server and the desktop ontology HTTP
sidecar (with `GovernedTierGate`) in scope?

**Answer:** Yes: all in-repo servers. `packages/drivers/{nlp,m365,uspto,gov-legal}-mcp`,
`packages/law-practice/server` with `apps/practice-kg-mcp`,
`apps/professional-desktop/server/OntologyMcpTransport.ts`, and `@beep/mcp-kit`.

**Rationale:** mcp-kit is shared; leaving any host on the session protocol keeps the
`McpServerClient` path alive inside the kit. The `GovernedTierGate` identity redesign becomes the
central research and grill topic.

**Rejected:** drivers plus practice-kg only (sidecar deferred); drivers only.
