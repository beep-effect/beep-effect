# MCP Kit Spec

## Objective

Ship `@beep/mcp-kit` at `packages/foundation/capability/mcp-kit`: the reusable
MCP host-construction kit (credential-keyed toolkit composition, structured
`api_key_required` envelope, tier-gate dispatch wrapper, progressive
field-tier projection, span/annotation hygiene helpers) built natively on
`effect/ai`, proven by fixture tests, with its consumer plan recorded
in the package README.

Graduated 2026-07-01 from
[`explorations/mcp-auth-gated-registration`](../../explorations/mcp-auth-gated-registration/README.md)
(BRIEF + MAP + resolved DECISIONS are the design provenance; this SPEC is the
normative contract).

## Non-Goals

<!-- Seeded from BRIEF.md No-Gos. -->

- No gov-legal MCP host program and no driver builds (owned by
  `goals/gov-legal-data-driver-codegen` / `uspto-patent-driver-depth`); the
  thin USPTO proving host is the separate `uspto-mcp` candidate goal.
- No third-party MCP runtime (`@modelcontextprotocol/sdk`, FastMCP-style).
- No WASM code-mode sandbox.
- No method-enum mega-tool (discrete typed tools are the Effect axis).
- No multi-tenant Bearer/team-key model (single-attorney local-first).
- No `Activity` table or persistence schema changes — audit sink is the
  existing `UsageRecord.metadata` jsonb column.
- No MCP `2025-11-25` reliance (bundled `McpServer` speaks `2025-06-18`); any
  upgrade is a separate effect-dependency task.
- No absorption of multi-provider LLM dispatch/fallback (boundary-with).

## Source Hierarchy

1. User objective: the graduated exploration's resolved decisions
   ([`DECISIONS.md`](../../explorations/mcp-auth-gated-registration/DECISIONS.md)).
2. `AGENTS.md`, `CLAUDE.md`, and required skills (`effect-first-development`,
   `schema-first-development`, `effect-services`).
3. Governing architecture standards: `standards/ARCHITECTURE.md`;
   `standards/architecture/{02-shared-kernel,03-driver-boundaries,07-non-slice-families,09-errors-across-boundaries,12-observability}.md`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/foundation/capability/mcp-kit` (new package, `@beep/mcp-kit`).
- Root workspace wiring for the new package (package.json workspaces,
  tsconfig references, turbo — whatever the repo's package-creation checklist
  requires).
- No other package is modified by this goal (retrofits are `mcp-host-retrofit`;
  the proving host is `uspto-mcp`).

## Deliverables (kit surface)

1. **`SourceAuth` gate registry** — schema-first per-source record
   `{name, envVar, gate: "none"|"soft"|"hard", signupUrl}` (schemas inline in
   the kit; promote to `@beep/schema` only when a non-MCP consumer appears).
   Credential resolution keys off the optional-secret class only:
   `Config.redacted(envVar).pipe(Config.option)` (in-repo precedent:
   `packages/drivers/uspto/src/Uspto.service.ts:398` and six sibling drivers).
2. **Credential-keyed toolkit composition** — build-time helper that folds
   gated layers (`layers.reduce(Layer.merge, Layer.empty)`; `Layer.orElse`
   does not exist in effect v4). Hybrid behavior: `hard`-gated sources vanish
   at composition when the key is absent; `none`/`soft`/key-optional sources
   stay registered and degrade at call time.
3. **`api_key_required` envelope** — typed `failureMode:"return"` failure
   shipped as success-with-error-JSON (`isError:false` — native `McpServer`
   behavior, verified `McpServer.ts:717-728`), with
   `{error:"api_key_required", tool, envVar, registration}` mirrored into
   `content[].text` (never `structuredContent` alone).
4. **Tier-gate dispatch wrapper** — `ClaimGate`-shaped (refusal-as-value,
   error channel `never`, fail-closed; pattern:
   `packages/epistemic/use-cases/src/ClaimGate/ClaimGate.ports.ts:42-47`)
   wrapping `tools/call` dispatch, paired with an `McpSchema.EnabledWhen`
   list-filter helper. The dispatch wrapper is the security boundary —
   `EnabledWhen` filters `tools/list` only (verified `McpServer.ts:255-262`
   vs `:1450`). Gated/refused calls write a sanitized audit record shaped for
   the `UsageRecord.metadata` jsonb sink (the kit defines the record schema;
   persistence wiring belongs to consumers).
5. **Progressive field-tier projector + columnar reshaper** — named
   minimal/balanced/complete Schema projection tiers plus a
   columnar/strip-nulls envelope; large payloads via fetchable handles, never
   inline.
6. **Sanitized-span wrapper** — suppresses/sanitizes the upstream
   `Toolkit.ts:263-265` raw-`parameters` span annotation (doctrine:
   `12-observability.md` §3 forbids raw user input on spans), with a proof
   test asserting raw input does not reach span attributes.
7. **Four-hint annotation helper** — terse helper applying
   readOnly/destructive/idempotent/openWorld hints (precedent:
   `packages/drivers/m365-mcp/src/M365Tools.ts`).

## Constraints

<!-- Seeded from BRIEF.md Rabbit Holes + resolved DECISIONS. -->

- **Effect pin:** `effect@4.0.0-beta.92`, `effect/ai` is beta — at P0
  re-verify the internals this kit depends on against the installed source
  (`McpServer.ts:717-728` isError semantics; `McpServer.ts:255-262`/`:1450`
  EnabledWhen list-only; `Toolkit.ts:263-265` span parameters;
  `McpServer.ts:336-341` protocol `2025-06-18`). Evidence baseline:
  [`reviews/2026-07-01-codex-verification.md`](../../explorations/mcp-auth-gated-registration/reviews/2026-07-01-codex-verification.md).
- **Protocol pin:** MCP `2025-06-18` semantics.
- **`foundation/capability` gate (`07-non-slice-families.md:56`):** ≥2 named
  consumers importing the package, listed in the package README. Discharged by
  the first proving slice — this kit lands together with (or in a stacked PR
  train with) `uspto-mcp` and `mcp-host-retrofit`. The kit README must carry
  the named-consumer list and keep it honest; if the kit PR lands first in the
  train, the README names the in-flight consumers with their goal links.
- **License discipline** (per `research/SOURCES.md`): `mike` (AGPL),
  `screenpipe` (NOASSERTION/commercial), `harvest-mcp`/`doc-haus` and
  unresolved-identity repos are clean-room only; MIT sources are
  reimplemented to Effect idiom with attribution, never literal-copied.
- **Schema-first, effect-first:** typed errors via `TaggedErrorClass`; `$I`
  identity annotations; no `unknown` in error channels; namespace-first helper
  imports; repo lint/docgen gates pass.
- **Foundation purity:** no product semantics, no slice imports, no live
  driver dependencies in the kit — consumers provide their own driver layers.
- **CourtListener is `soft`** wherever the kit's fixtures/examples encode the
  gov-legal matrix; do not hard-code either 2026 auth reading.
- **USPTO ODP `fields` semantics are unverified** — the tier projector must
  work client-side; API-side projection is a consumer optimization decided in
  `uspto-mcp`.

## Decision Log

Back-links, not copies — rationale lives in the exploration:

| Decision | Where |
| --- | --- |
| Q1 kit-only scope; Q2 USPTO proving host; Q3 native `effect/ai`; Q4 `foundation/capability` home; Q4b satisfy ≥2-consumer gate; Q5 `none\|soft\|hard` hybrid gating; Q6 success-JSON channel @ 2025-06-18; Q7 two-layer wall + `UsageRecord.metadata` audit | [`explorations/mcp-auth-gated-registration/DECISIONS.md`](../../explorations/mcp-auth-gated-registration/DECISIONS.md) |
| Code-fact verification (all confirmed; effect pin beta.92) | [`reviews/2026-07-01-codex-verification.md`](../../explorations/mcp-auth-gated-registration/reviews/2026-07-01-codex-verification.md) |

## Acceptance Criteria

- [ ] `packages/foundation/capability/mcp-kit` exists, builds, lints, and
      docgens clean; exports the seven deliverables above through a curated
      barrel.
- [ ] Fixture test: a `hard`-gated fixture toolkit **vanishes** from
      composition when its env key is absent and mounts when present.
- [ ] Fixture test: a `soft`/key-optional fixture tool **stays registered**
      and returns the `api_key_required` envelope (`isError:false`, JSON
      mirrored into `content[].text`) when its key is absent.
- [ ] Fixture test: the tier-gate dispatch wrapper **refuses fail-closed as a
      value** for an unapproved write-tool call and produces a sanitized audit
      record matching the kit's audit schema.
- [ ] Proof test: with the sanitized-span wrapper, raw tool `parameters` do
      **not** appear in span attributes.
- [ ] Fixture test: the field-tier projector reduces a large fixture payload
      (documentBag-shaped) below a configured token/size budget;
      minimal/balanced/complete tiers are named Schema variants.
- [ ] Package README names the consumer plan for the ≥2-consumer gate
      (`uspto-mcp`, `mcp-host-retrofit`, existing hosts) with goal links.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/mcp-kit/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/mcp-kit/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/mcp-kit` | Passes |
| Kit tests + quality gates | `bun run beep yeet verify` | Green |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope (e.g. pulling the USPTO host or
  host retrofits into this packet).
- `effect/ai` internals have shifted from the verified baseline in a
  way that invalidates a resolved decision — stop and report; the affected
  decision reopens in the exploration.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| ≥2-consumer gate discharged by the proving slice, not this packet alone | `@beep/mcp-kit` README consumer list | `mcp-kit` + `uspto-mcp` + `mcp-host-retrofit` | Q4b: consumers are real doctrine fixes landing in the same PR train | Remove when both consumer goals have landed and the README lists them as current importers |
