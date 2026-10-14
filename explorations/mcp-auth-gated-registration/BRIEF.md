# Brief

<!--
Stage 3. Shaped 2026-07-01 from CAPTURE + RESEARCH + the resolved DECISIONS
(Q1–Q7 + Q4b). Fat-marker fidelity: concrete enough to decompose, rough enough
to leave design latitude to the implementing goals.
-->

## Problem

beep ships two Effect-native MCP servers (`@beep/nlp-mcp`, `@beep/m365-mcp`)
that register every tool unconditionally, and a fleet of gov-legal data
drivers (USPTO built; CourtListener/GovInfo/DOL/eCFR/Federal Register coming
via `gov-legal-data-driver-codegen`) whose sources have three different auth
strengths. Nothing today can: gate a tool's registration or invocation on
credential availability, tell an agent *how to fix* a missing key, keep
verbose source payloads (USPTO `documentBag` alone can blow Claude Code's
25,000-token MCP output ceiling) inside the context budget, enforce a
write-vs-read wall at the candidate→approved boundary, or audit a gated call.
Meanwhile the upstream `Toolkit` annotates every tool span with raw caller
`parameters`, so `nlp-mcp`'s text tools leak user content into telemetry — a
live violation of `standards/architecture/12-observability.md` §3. Every
future `*-mcp` host will re-hit all five gaps; the patterns are cross-cutting
and belong in one kit.

## Appetite

One P2 wedge: the kit package plus one proving slice (minimal USPTO host +
retrofit of the two existing hosts). No gov-legal host program, no driver
builds, no persistence schema changes. If the kit's core (credential-gated
composition, `api_key_required`, field tiers, span hygiene) can't land inside
that bound, cut the tier-gate wrapper to fixture-proof-only before cutting
anything else.

## Solution Sketch

**`@beep/mcp-kit`** at `packages/foundation/capability/mcp-kit` (Q4; ≥2
consumers at landing per Q4b), built natively on `effect/ai` (Q3),
pinned to MCP `2025-06-18`:

- **`SourceAuth` gate registry** — schema-first per-source record
  `{name, envVar, gate: none|soft|hard, signupUrl}` keyed off the
  optional-secret credential class (`Config.redacted(...).pipe(Config.option)`).
  Hybrid behavior (Q5): absent key ⇒ graceful degradation for `none`/`soft`,
  build-time vanish (folded `Layer.merge` composition) for `hard`.
  CourtListener = `soft`.
- **`api_key_required` envelope** (Q6) — typed `failureMode:"return"` failure
  shipped as success-with-error-JSON (`isError:false`), payload mirrored into
  `content[].text` with envVar + registration guidance.
- **Tier-gate dispatch wrapper** (Q7) — `ClaimGate`-shaped, fail-closed,
  refusal-as-value at the `tools/call` boundary (the real gate), paired with
  an `EnabledWhen` list-filter helper (surface/UX only). Gated calls audited
  into `UsageRecord.metadata` (jsonb).
- **Progressive field-tier projector + columnar reshaper** — named
  minimal/balanced/complete Schema tiers + columnar/strip-nulls envelope to
  stay under the 25k ceiling; large payloads behind fetchable handles, never
  inline.
- **Cross-cutting hygiene helpers** (Q4b) — sanitized-span wrapper (stops the
  raw-`parameters` leak) and four-hint annotation helper
  (readOnly/destructive/idempotent/openWorld).

**Proving slice:** a thin USPTO `*-mcp` host (Q2) wiring `@beep/uspto` through
the kit via the `nlp-mcp` `Layer.mergeAll` seam, plus retrofitting
`nlp-mcp`/`m365-mcp` onto the hygiene helpers (Q4b).

## Rabbit Holes

- `effect/ai` is beta (`4.0.0-beta.92`) — the annotation API and MCP
  wire-mapping may shift; pin and re-verify the internals cited in
  [reviews/2026-07-01-codex-verification.md](./reviews/2026-07-01-codex-verification.md)
  at implementation time.
- CourtListener 2026 auth is genuinely contradictory across sources — `soft`
  + degradation is robust to either outcome; do not hard-code.
- USPTO ODP `fields` semantics unsettled (body projection vs sort-field
  selection) — verify before choosing API-side vs client-side tier projection.
- The `check-api-status` health probe is credential-sensitive and flaky by
  nature — needs a per-source probe matrix (endpoint, timeout, TTL, 401/403 vs
  outage, redacted result schema) before it ships.
- Licensing: `mike` (AGPL), `screenpipe` (NOASSERTION), and the
  unresolved-license repos are clean-room only; MIT sources still get
  reimplemented to Effect idiom, never literal-copied
  (see [research/SOURCES.md](./research/SOURCES.md)).

## No-Gos

- No gov-legal MCP host program and no driver builds here (owned by
  `gov-legal-data-driver-codegen` / `uspto-patent-driver-depth`).
- No third-party MCP runtime (`@modelcontextprotocol/sdk`, FastMCP-style).
- No WASM code-mode sandbox (v1 out of scope).
- No method-enum mega-tool (wrong axis for Effect — discrete typed tools).
- No multi-tenant Bearer/team-key model (beep is single-attorney local-first).
- No `Activity` table / persistence schema changes (audit =
  `UsageRecord.metadata`).
- No MCP `2025-11-25` reliance without an effect upgrade + reverification task.
- No absorption of multi-provider LLM dispatch/fallback (boundary-with; a tool
  needing an LLM depends on a provider-selection port).
