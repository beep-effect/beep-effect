# MCP Auth-Gated Registration & Progressive Disclosure — Decisions

<!--
Stage 2 (align) log. Q1–Q7 were pre-drafted 2026-06-29 from RESEARCH.md +
CAPTURE.md and resolved 2026-07-01 in a /grill-with-docs session (one
branch-closing question at a time, recommendation first). Every code fact the
recommendations rest on was re-verified against current HEAD by read-only
Codex sub-agents — evidence in
[reviews/2026-07-01-codex-verification.md](./reviews/2026-07-01-codex-verification.md).
-->

## Q1: Patterns-only kit, or also the gov-legal MCP host and its drivers?

**Decision (2026-07-01): Kit only; host = proof.** `@beep/mcp-kit` (credential-
keyed `Toolkit` composition, `api_key_required` envelope, tier-gate dispatch
wrapper, progressive field-tier projection) is the shipping deliverable, proven
against exactly one thin consumer. The full gov-legal MCP host and driver
builds stay in their own goals (`gov-legal-data-driver-codegen`,
`uspto-patent-driver-depth`), cross-linked never absorbed. The multi-provider
LLM dispatch/fallback work remains a boundary-with, sharing only the
`Config.redacted` primitive.

**Rationale:** CAPTURE seeds this explicitly as "about PATTERNS … NOT a third
server"; RESEARCH confirms the host/driver work is owned elsewhere and the
`requiresAuth`/`api_key_required`/tier-gate/field-tier gaps are genuine NOT
FOUND. Absorbing host + drivers would re-scope a P2 wedge into a multi-goal
program and collide with goals that already own that work.

**Rejected:** kit + one real shipping host (scope collision with the gov-legal
goals); kit + host + drivers (full-program absorption).

## Q2: Which concrete MCP surface proves the kit first?

**Decision (2026-07-01): A minimal real USPTO host** — a thin new `*-mcp`
package wiring `@beep/uspto` through the kit, reusing the `@beep/nlp-mcp`
`Layer.mergeAll(...)` seam (`packages/drivers/nlp-mcp/src/Server.ts:101-107`)
verbatim. It seeds the future dedicated gov-legal MCP goal rather than being
throwaway.

**Rationale:** `@beep/uspto` is the only driver already built key-optional
(`apiKey: Option<Redacted>`, `X-API-KEY` only when present *and* same-origin —
`Uspto.service.ts:249-255,398`, verified 2026-07-01) and carries the real
25k-token `documentBag` reshaping pressure. The existing hosts can't prove the
kit's core: `nlp-mcp` has no API key (local wink-nlp) and `m365-mcp` is OAuth —
neither exercises the optional-secret credential-keyed path.

**Rejected:** extending `nlp-mcp`/`m365-mcp` as the proof (under-proves the
credential path); fixture-only proof (never exercises real credential
resolution or the real token ceiling).

## Q3: Native `effect/unstable/ai`, or wrap a third-party MCP framework?

**Decision (2026-07-01): Reimplement native to `effect/unstable/ai`.** No
third-party MCP runtime; port prior-art *shapes* into Effect idiom only.

**Rationale:** The runtime is chosen — both servers run `{Tool, Toolkit}` +
`McpServer.layerStdio` on `effect@4.0.0-beta.92` (pin corrected from beta.91,
2026-07-01) — and the kit's gating depends on Effect's typed
`Toolkit`/`Layer`/`Config` substrate. Licensing gravity independently forbids
copying (MIT sources are port-to-idiom; `screenpipe` NOASSERTION and `mike`
AGPL are clean-room only). Inherited constraint: `effect/unstable/ai` is beta —
pin + re-verify the internals at implementation time.

**Rejected:** wrapping `@modelcontextprotocol/sdk`/FastMCP-style (forks the
server off the Effect substrate the kit is built on).

## Q4: Where does the shared kit live?

**Decision (2026-07-01): `packages/foundation/capability/mcp-kit`**
(`@beep/mcp-kit`) — the doctrine-pure repo-owned-substrate home, sibling to
`foundation/capability/nlp-processing`.

**Rationale:** The kit wraps no external engine — it composes Effect's own
`McpServer`/`Toolkit`/`Config`, and `03-driver-boundaries.md:97` routes
repo-owned hardened substrate to `foundation`, not `drivers`. `shared/*` is
ruled out by `02-shared-kernel.md:44` (no "generic schema kits … reusable
technical capability packages"). The `SourceAuth`/gate/field-tier schemas stay
**inline in the kit** — no separate schema parking; promote to `@beep/schema`
(`foundation/modeling`) only if a non-MCP consumer appears.

**Rejected:** `packages/drivers/mcp-kit` (the pre-drafted recommendation —
precedent-aligned but substrate-in-drivers drift per `03:97`); inline-per-host
with later extraction (ships no standalone kit).

## Q4b: The `foundation/capability` ≥2-consumer gate (`07-non-slice-families.md:56`)

**Decision (2026-07-01): Satisfy the gate, don't waive it.** The first goal
wires the new USPTO proving host **and** retrofits `@beep/nlp-mcp` +
`@beep/m365-mcp` onto the kit's two cross-cutting helpers — the sanitized-span
wrapper and the four-hint annotation helper — landing ≥2 (really 3) honest
consumers at creation, named in the kit README per the gate.

**Rationale:** The retrofit is a real doctrine fix, not make-work:
`Toolkit.ts:263-265` annotates every tool span with raw `parameters`
(confirmed 2026-07-01), so `@beep/nlp-mcp`'s raw-`text` tools violate
`12-observability.md` §3 *today*; and `@beep/nlp-processing` tools annotate
none of the four MCP hints while `m365-mcp` annotates all four (the #5
asymmetry).

**Rejected:** waiver via `standards/architecture/DECISIONS.md` entry (needless
— the gate is satisfiable with bounded, genuinely-needed work); reverting Q4 to
`drivers/` (gate-free but drift).

## Q5: Per-source auth model + absent-key behavior

**Decision (2026-07-01): `gate: none | soft | hard` enum + hybrid behavior.**
Gating keys off the optional-secret credential class only
(`Config.redacted(...).pipe(Config.option)`). Absent key: graceful call-time
degradation (Shape C — tool stays registered, returns the `api_key_required`
envelope) for `none`/`soft`/key-optional sources; build-time vanish (Shapes
A/B — `Config.option`-gated Layer composition) reserved for `hard`-gated
sources useless without a key. **CourtListener locks as `soft`**
(optional-token + degradation), robust to its contradictory 2026 auth signals.

**Rationale:** "Auth required" collapses three real gate strengths (none: eCFR
/ Federal Register; hard: GovInfo 401 `API_KEY_MISSING`, DOL APIv4; soft:
CourtListener) — a boolean mis-gates CourtListener. Only the optional-secret
class can self-gate; the idiom exists inline in 7 drivers with no shared
helper (verified 2026-07-01), so the kit's `SourceAuth` registry consolidates
real duplication.

**Rejected:** always-degrade (pays tool-def token cost for unusable hard-gated
tools); always-vanish (kills discoverability/self-correction and undercuts the
`api_key_required` deliverable).

## Q6: `api_key_required` wire channel

**Decision (2026-07-01): Success-with-error-JSON (`isError:false`), pinned to
MCP `2025-06-18`.** Return the typed failure as a normal result and mirror
`{error:"api_key_required", tool, envVar, registration}` into `content[].text`
as JSON — never `structuredContent` alone (clients drop it). The `isError:true`
upgrade stays available through the Q7 dispatch wrapper if a target client
mishandles the success channel, but is not the default.

**Rationale:** Verified 2026-07-01: `McpServer` ships every
successfully-returned encoded result — including a `failureMode:"return"`
typed failure — as `CallToolResult({isError:false})` (`McpServer.ts:717-728`,
`Toolkit.ts:364-366`); `isError:true` is reserved for a failed Effect cause.
The success-JSON contract matches native behavior and the canonical
`mcp-uspto` shape with zero extra machinery. The bundled server advertises
`2025-06-18` only (`McpServer.ts:336-341`) — any `2025-11-25` reliance is spec
drift requiring an effect upgrade + reverification task first.

**Rejected:** wrapper-mapped `isError:true` as default (spec-ideal
self-correction channel, cheap via the Q7 wrapper — deliberately kept as an
upgrade path, not baseline); deferring the choice to the goal.

## Q7: Write-tool wall enforcement + audit sink

**Decision (2026-07-01): Two-layer enforcement; audit in
`UsageRecord.metadata`.** Filter the `tools/list` surface via
`McpSchema.EnabledWhen` AND re-check at the `tools/call` dispatch boundary with
a `ClaimGate`-shaped wrapper (fail-closed, refusal-as-value, never thrown);
annotations remain untrusted UX hints. The dispatch wrapper is the *real*
security boundary — `EnabledWhen` keys off client-initialization params and is
not re-checked at `tools/call` (`McpServer.ts:255-262` vs `:1450`, verified
2026-07-01). Each gated call is audited into the existing
`UsageRecord.metadata` jsonb column; the "one persisted `Activity` per call"
promise is dropped (no `Activity` table exists in `@beep/epistemic-tables`).
The sanitized-span wrapper + proof test is a mandatory kit deliverable
(`12-observability.md` §3 violation live today — see Q4b).

**Rationale:** MCP annotations are "untrusted hints, never the security
boundary"; `ClaimGate` (`ClaimGate.ports.ts:42-47`, total engine, error channel
`never`) is the in-repo refusal-as-value precedent;
`UsageRecord.metadata` is confirmed jsonb (`UsageRecord.model.ts:69,95-97`).
Scope caveat carried to MAP: the USPTO proving host is read-only, so the
write-wall is fixture-proven in goal-1 and proven against a real write-capable
host in a follow-on goal.

**Rejected:** adding an `Activity` table + converter + migration here (adds
persistence scope to a P2 wedge; coordinate with `domain-layer-hardening`'s
provenance-attestation goal instead); span-only audit with no persistence
(loses the durable record).

## 2026-07-14 — sibling review preserves the write-wall gate

**Decision:** Record `mcp-kit`, `uspto-mcp`, and `mcp-host-retrofit` as shipped
completed-retained candidates. Keep `mcp-write-wall` held until a named MCP
host exposes a genuinely write-capable operation requiring candidate→approved
enforcement and end-to-end `UsageRecord.metadata` audit.

**Rationale:** The USPTO ODP proving host validates `soft` credential gating
for read operations. It does not exercise the Q7 security boundary against a
real write, so the 2026-07-14 ODP soft-gate decision does not clear or weaken
the write-wall trigger.
