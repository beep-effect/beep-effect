# Agent Execution Sandbox

## Status

Stage: `graduate`
Status: `graduated`

Graduated into [`goals/agent-execution-authority`](../../goals/agent-execution-authority/README.md)
on 2026-07-25.

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Model-generated code and cross-tool agent runs should not inherit ambient
host authority merely because their inputs were scrubbed or verified. This
exploration was routed from the
[`academia-corpus-mining`](../academia-corpus-mining/README.md) align
dispatch (2026-07-25, high-priority route) after the corpus exposed the need
for a separate default-deny execution boundary.

## Next Open Question

None — this packet is graduated. Execution continues in
[`goals/agent-execution-authority`](../../goals/agent-execution-authority/README.md).

Three candidate packets remain named but not graduated in
[`MAP.md`](./MAP.md), each blocked on a fact that does not exist yet:
`agent-execution-chat-egress` (needs a real request principal),
`agent-execution-host-isolation` (needs the first packet's policy plane), and
`agent-execution-record-anchoring` (needs a chosen anchoring target). Reopen this
packet when a blocker clears rather than leaving it fake-active.

## Shape Of The Thing (decided)

- First fixture: **privileged read + outbound sink** — the best-attested
  incident class and the one seam no repo packet owns.
- Absorbs `mcp-auth-gated-registration`'s `mcp-write-wall`: an MCP write is a
  governed sink, classified by audience rather than protocol.
- Grants are **`effect/Schema` values held only by the boundary** — no bearer
  credential the agent could leak or replay; revocation is immediate;
  delegation lineage is data, not crypto.
- v1 ledger is the **tamper-evident class only** — hashes, opaque ids, policy
  revision, typed outcomes; payloads are committed-to, never embedded.
- This packet owns **policy decision + execution records**; brokers
  credentials through the vault packet; host isolation is a later tier of
  this packet; certification deferred.
- Grant schema lives in **`packages/epistemic/domain`** with enforcement wired
  at the app composition root (decision 6); `shared/domain` is the eventual
  home, not the starting one.

## Proven Mechanisms (2026-07-25 spike)

Both load-bearing mechanisms were verified against real code, then the spike
files were deleted:

- **`Layer.succeed(FetchHttpClient.Fetch)(policyFetch)` at a composition root
  reaches through drivers that seal their own transport**, including the real
  `AnthropicLive` — so the egress seam is one layer entry and zero driver
  changes. (`Fetch` is a `Context.Reference` read per-request via
  `fiber.getRef`; `layerMergedContext` merges request-time context with
  precedence.)
- **plpgsql exists in PGlite**, and `BEFORE UPDATE`/`BEFORE DELETE` triggers
  raising exceptions do block both while `INSERT` still works. The migration
  splitter trap is narrower than feared: the rule is "no `;` + newline +
  boundary keyword inside the body," not "one line." The owner can still
  `DROP TRIGGER` — tamper-**evident**, not tamper-**proof**.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`MAP.md`](./MAP.md) - decompose (stage 4): candidate goal packets, sequencing, first vertical slice, inherited risks.
3. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3): problem, appetite, solution sketch, rabbit holes, no-gos.
4. [`DECISIONS.md`](./DECISIONS.md) - decision log: fourteen dated decisions (align 1-6, shape 7-14) with rejected options and consequences.
5. [`RESEARCH.md`](./RESEARCH.md) - research synthesis (stage 1): layered-architecture consensus, egress/authz/records landscape, verified repo bricks + gaps, seam map, constraints.
6. [`research/`](./research/) - verbatim agent reports `01`–`10` + [`SOURCES.md`](./research/SOURCES.md) provenance ledger (licenses, mined corpus, re-verification debt).
7. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0): route provenance, corpus evidence, repo composition map, boundary sketches.

## Trail

- 2026-07-25: packet opened — routed from the `academia-corpus-mining` align
  dispatch (high-priority route: default-deny execution authority, resource
  limits, network policy, immutable execution records). Capture landed with
  corpus evidence, the repo composition map, and inherited master align Q10.
- 2026-07-25: research stage run via a 10-agent workflow (4 external slices,
  2 repo inventories, critic, 3 follow-ups). Landed `RESEARCH.md`,
  `research/01`–`10`, and `research/SOURCES.md`. Headlines: two-layer
  architecture is unanimous prior-art consensus; no laptop-tier sandbox
  ships resource ceilings; outbound egress is owned by nobody in the repo;
  TierGate/ClaimGate + `api-transport` + `ChildProcessSpawner` are the
  composition seams; repo has zero KMS/retention/legal-hold infrastructure
  (greenfield for the records design). Research debt registered in
  `research/10-research-critique.md`.
- 2026-07-25: align — all four inherited questions closed in one session
  (decisions 1–5): first fixture is privileged-read-plus-outbound-sink;
  `mcp-write-wall` absorbed as a governed write sink; grants are
  schema-native and in-process with no bearer credential; v1 ledger is the
  tamper-evident class only (no payloads, no KMS dependency); this packet
  owns policy decision + execution records, brokers credentials, keeps host
  isolation as a later tier, defers certification. Stopped at: first-slice
  sink/enforcement-point scope, which is the entry question for shape.
- 2026-07-25: shape — ran the increment-0 spike first (both mechanisms proven,
  see above; throwaway files deleted), logged decision 6 (grant schema lives in
  `packages/epistemic/domain`, enforcement at the app composition root, after
  design review found `foundation/capability` architecturally illegal for a
  `Principal`-embedding schema), then drafted [`BRIEF.md`](./BRIEF.md).
  Stopped at: human confirmation that the brief matches the intended picture.
- 2026-07-25: doctrine grilling pass against `standards/architecture/*` closed
  eight more branches (decisions 7–14) and overturned part of the shape. The
  headline correction: "generalize `TierGate` in place" was **illegal** —
  `mcp-kit` is `foundation`, which may not import a slice *or* the shared
  kernel, so the constraint was never specific to decision 6. The replacement is
  cheaper: `epistemic/server` implements the **existing** `TierGate` port and
  the app swaps one line, leaving `ontology/server` untouched. Scoping to the
  MCP branch alone (decision 9) then collapsed the design to one composition
  root and eliminated the telemetry-recursion rabbit hole outright, since
  `ObservabilityLive` is built inside `RuntimeLive` and never runs in that
  branch's context. Keying the run to `clientId` (decision 10) dissolved the
  `SanitizedSpan` context-erasure constraint rather than working around it. Two
  pieces of repo drift surfaced: ad-hoc `Effect.runSync(Config…)` reads at the
  desktop entrypoint (cleanup-on-touch, in scope) and an epistemic product
  repository living in app code at
  `apps/professional-desktop/src/chat/UsageRecordSink.ts` (recorded, not fixed).
- 2026-07-25: decompose + graduate — wrote [`MAP.md`](./MAP.md) (four candidate
  packets, one graduating) and scaffolded
  [`goals/agent-execution-authority`](../../goals/agent-execution-authority/README.md)
  with `SPEC.md` seeded from the brief, the provenance ledger carried over, and
  both manifests cross-linked. Packet closes as `graduated`; three dependent
  candidates stay named in `MAP.md` rather than holding this packet fake-active.
