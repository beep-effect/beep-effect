# USPTO MCP Spec

## Objective

Ship `@beep/uspto-mcp` at `packages/drivers/uspto-mcp`: a thin MCP host that
wires `@beep/uspto` through `@beep/mcp-kit`, proving the kit's
credential-keyed composition, `api_key_required` envelope, and progressive
field-tier projection against `@beep/uspto`'s real USPTO ODP surface
(`documentBag`, `patentFileWrapperDataBag`), following the `@beep/nlp-mcp`
stdio-server seam.

Graduated 2026-07-01 from
[`explorations/mcp-auth-gated-registration`](../../explorations/mcp-auth-gated-registration/README.md)
(BRIEF + MAP + resolved DECISIONS are the design provenance; this SPEC is the
normative contract). Named as the `uspto-mcp` candidate goal in
[`MAP.md`](../../explorations/mcp-auth-gated-registration/MAP.md) and Q2 of
[`DECISIONS.md`](../../explorations/mcp-auth-gated-registration/DECISIONS.md).

## Non-Goals

<!-- Seeded from BRIEF.md No-Gos + DECISIONS Q1/Q2. -->

- No gov-legal MCP host program and no driver depth builds — those stay in
  `gov-legal-data-driver-codegen` / `uspto-patent-driver-depth`; this host is
  the minimal proving surface, not the dedicated gov-legal MCP goal (though it
  seeds it, per Q2).
- No write operations — `@beep/uspto` is read-only; this host stays read-only.
- No `@beep/mcp-kit` API changes beyond what a real consumer needs; if a kit
  gap blocks this goal, stop and report rather than growing the kit's surface
  unilaterally (the kit's SPEC is a separate, already-shipped contract).
- No `nlp-mcp`/`m365-mcp` retrofit work (owned by sibling goal
  [`mcp-host-retrofit`](../mcp-host-retrofit/SPEC.md)).
- No multi-tenant Bearer/team-key model (single-attorney local-first, per kit
  Q5).
- No `Activity` table or persistence schema changes — any audit trail rides
  the kit's `UsageRecord.metadata`-shaped record schema; wiring actual
  persistence is out of scope for this thin host.
- No MCP `2025-11-25` reliance (bundled `McpServer` speaks `2025-06-18`).
- No live network integration tests requiring a real `USPTO_API_KEY` —
  fixture-based `HttpClient` mocking (precedent:
  `packages/drivers/uspto/test/Uspto.service.test.ts`) is the required test
  shape, so verification never depends on possessing or spending a real
  credential.

## Source Hierarchy

1. User objective: the graduated exploration's resolved decisions
   ([`DECISIONS.md`](../../explorations/mcp-auth-gated-registration/DECISIONS.md)
   Q2, Q5, Q6) and
   [`MAP.md`](../../explorations/mcp-auth-gated-registration/MAP.md) First
   Vertical Slice bullet 1–2.
2. `AGENTS.md`, `CLAUDE.md`, and required skills (`effect-first-development`,
   `schema-first-development`, `effect-services`).
3. Governing architecture standards: `standards/ARCHITECTURE.md`;
   `standards/architecture/{02-shared-kernel,03-driver-boundaries,07-non-slice-families,09-errors-across-boundaries,12-observability}.md`.
4. `goals/mcp-kit/SPEC.md` — the kit contract this host consumes (must not be
   reopened by this goal).
5. This `SPEC.md`.
6. `PLAN.md`.
7. `GOAL.md`.
8. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/drivers/uspto-mcp` (new package, `@beep/uspto-mcp`, `beep.family:
  "drivers"` — sibling to `packages/drivers/nlp-mcp` and
  `packages/drivers/m365-mcp`).
- Root workspace wiring for the new package via `bun run beep create-package`
  (workspace glob `packages/drivers/*` already covers the path; expect a SKIP,
  not a hand-edit, per the precedent in
  `goals/mcp-kit/history/2026-07-01-p0-verification.md`).
- No changes to `packages/drivers/uspto`, `packages/foundation/capability/mcp-kit`,
  `packages/drivers/nlp-mcp`, or `packages/drivers/m365-mcp` (retrofits are
  `mcp-host-retrofit`).

## Deliverables

1. **`SourceAuth` registration for USPTO** — one registry entry
   `{name: "uspto", envVar: "USPTO_API_KEY", gate: "soft", signupUrl}` using
   `@beep/mcp-kit`'s `SourceAuth` module (no reimplementation). `soft` matches
   the kit's Q5 hybrid model: `@beep/uspto`'s layer always constructs
   (`Uspto.service.ts:398` — `Config.redacted("USPTO_API_KEY").pipe(Config.option)`,
   key attached only when present and same-origin, `Uspto.service.ts:249-255`),
   so the tool stays registered and degrades at call time rather than
   vanishing at composition.
2. **Credential-keyed composition** — mount `@beep/uspto`'s tool surface
   through `@beep/mcp-kit`'s `ToolkitComposition` helper, keyed on the same
   `SourceAuth` entry.
3. **`api_key_required` envelope** — the USPTO search/lookup tool returns the
   kit's `ApiKeyRequired` envelope (`isError:false`, JSON mirrored into
   `content[].text`, per kit Q6) when `USPTO_API_KEY` is absent, and returns
   real `@beep/uspto` data when present. Both branches are fixture-tested (no
   real network call, no real key required).
4. **Named field tiers vs `documentBag`** — apply the kit's `FieldTier`
   projector (minimal/balanced/complete) to
   `@beep/uspto`'s `documentBag`/`patentFileWrapperDataBag` shapes
   (`Uspto.service.ts:116`) so a large fixture response is reshaped under a
   configured token/size budget. USPTO ODP API-side `fields` projection
   remains unverified (per exploration Open Risks) — this host does
   client-side projection only; API-side projection is an explicit
   out-of-scope optimization.
5. **Reuse the `nlp-mcp` `Layer.mergeAll` seam** — stdio server bootstrap
   mirrors `packages/drivers/nlp-mcp/src/Server.ts:101-107` (a single
   `McpServer.layerStdio`-backed server mounting toolkit layer(s) via
   `Layer.mergeAll`), not a bespoke wiring shape.

## Constraints

- **Effect pin:** `effect@4.0.0-beta.92`; re-verify at P0 that
  `@beep/mcp-kit`'s exported `SourceAuth`/`ToolkitComposition`/`ApiKeyRequired`/
  `FieldTier` surfaces still match this host's expected call shape (the kit
  shipped 2026-07-01 in PR #288; confirm merged/mergeable state before
  building against it).
- **Protocol pin:** MCP `2025-06-18` semantics.
- **Schema-first, effect-first:** typed errors via `TaggedErrorClass`; `$I`
  identity annotations (new `$UsptoMcpId` via package scaffold); no `unknown`
  in error channels; namespace-first helper imports; repo lint/docgen gates
  pass.
- **Test shape:** fixture-based `HttpClient` mocking, mirroring
  `packages/drivers/uspto/test/Uspto.service.test.ts` and
  `packages/drivers/nlp-mcp/test/Server.test.ts` — never a live network call
  against real USPTO ODP infrastructure.
- **`foundation/capability` gate discharge:** this goal is one of the two
  named consumers (alongside `mcp-host-retrofit`) that discharge
  `@beep/mcp-kit`'s `≥2-consumer` gate (`07-non-slice-families.md:56`, kit
  Q4b). The kit package README's consumer table must name this package once
  it lands.

## Decision Log

Back-links, not copies — rationale lives in the exploration:

| Decision | Where |
| --- | --- |
| Q2 minimal real USPTO host proves the kit; reuses `nlp-mcp` `Layer.mergeAll` seam | [`explorations/mcp-auth-gated-registration/DECISIONS.md`](../../explorations/mcp-auth-gated-registration/DECISIONS.md) |
| Q5 `none\|soft\|hard` hybrid gating; USPTO is key-optional (Shape C) | same |
| Q6 success-JSON `api_key_required` channel @ 2025-06-18 | same |
| First Vertical Slice bullets 1–2 (USPTO degrade/work; `documentBag` reshape under ceiling) | [`MAP.md`](../../explorations/mcp-auth-gated-registration/MAP.md) |
| `@beep/mcp-kit` deliverable contracts (`SourceAuth`, `ToolkitComposition`, `ApiKeyRequired`, `FieldTier`) | [`goals/mcp-kit/SPEC.md`](../mcp-kit/SPEC.md) |

## Acceptance Criteria

- [ ] `packages/drivers/uspto-mcp` exists, builds, lints, and docgens clean.
- [ ] Fixture test: with `USPTO_API_KEY` absent, the mounted USPTO tool
      returns the kit's `api_key_required` envelope (`isError:false`, JSON in
      `content[].text`).
- [ ] Fixture test: with `USPTO_API_KEY` present (fixture/mocked
      `HttpClient`, no real credential), the same tool returns real
      `@beep/uspto` data end-to-end.
- [ ] Fixture test: a `>25,000`-token `documentBag`-shaped fixture response is
      reshaped under a configured budget via a named field tier
      (minimal/balanced).
- [ ] The server composes exclusively through `@beep/mcp-kit`'s exported
      `SourceAuth`/`ToolkitComposition`/`ApiKeyRequired`/`FieldTier` — no
      parallel reimplementation of kit logic in this package.
- [ ] Package README documents itself as a named `@beep/mcp-kit` consumer.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/uspto-mcp/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/uspto-mcp/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/uspto-mcp` | Passes |
| Package tests + quality gates | `bun run beep yeet verify` | Green |

## Stop Conditions

- Required source files are missing or materially contradictory.
- `@beep/mcp-kit`'s shipped surface does not match the deliverable contracts
  cited above (kit SPEC drift) — stop and report; do not patch the kit from
  inside this goal without explicit scope approval.
- The implementation would exceed named scope (retrofitting `nlp-mcp`/`m365-mcp`,
  gov-legal driver depth, write operations).
- Verification would require a real `USPTO_API_KEY` or a live network call.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
