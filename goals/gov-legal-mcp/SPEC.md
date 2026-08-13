# Gov Legal MCP Spec

## Objective

Create `packages/drivers/gov-legal-mcp` as a thin Effect-native MCP stdio host
that exposes bounded toolkits for the two proven gov/legal drivers,
`@beep/govinfo` and `@beep/ecfr`. Compose the host through shipped
`@beep/mcp-kit` conventions and enforce the MAP’s collision contract:
driver-prefixed stable wire names, safe-character normalization, a fixed length
cap, duplicate detection, a checked-in collision report, and integration tests
against the installed Effect MCP schemas.

## Non-Goals

- No remaining driver breadth: Federal Register, DOL, CourtListener, or wider
  eCFR/GovInfo delivery belongs to `gov-legal-data-driver-delivery`.
- No changes to driver transport/auth/retry/cache/rate-limit behavior and no
  redesign of `@beep/api-transport` or `@beep/mcp-kit`.
- No general-purpose OpenAPI→MCP framework or generated transport code. A small
  deterministic tool-definition projection may consume the proven drivers’
  descriptors, but remains package-local.
- No write tools, candidate→approved wall proof, persistence, `Activity` table,
  or `UsageRecord.metadata` wiring; the host is read-only.
- No live credentials/network in committed tests, new data-source terms, or
  absorption of paused delivery phases.

## Source Hierarchy

1. The ratified 2026-07-14 sibling graduation and source exploration Q3/MAP
   collision contract.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. Shipped contracts in `goals/mcp-kit`, `goals/uspto-mcp`, and the current
   `@beep/mcp-kit`/driver source.
5. This `SPEC.md`.
6. `PLAN.md`, then `GOAL.md`.
7. Source exploration BRIEF, DECISIONS, MAP, and research.

## Target Surfaces

- `packages/drivers/gov-legal-mcp` — package, tool definitions/handlers,
  source-auth registry, naming/collision report generator, server/bin, tests,
  docs, and package wiring.
- Existing `@beep/govinfo`, `@beep/ecfr`, `@beep/mcp-kit`, and
  `@beep/api-transport` are consumed through public exports; source changes are
  out of scope unless a verified blocker is reported and scope is ratified.

## Constraints

1. Gate clearance is factual and bounded: GovInfo plus eCFR are the two proven
   drivers. Do not use that clearance to pull the delivery goal’s remaining
   breadth into this host.
2. Source auth follows shipped `SourceAuth`: eCFR is `none`; GovInfo is `hard`
   and vanishes at composition when its optional secret is absent. A future
   `soft` source must stay registered and degrade with `api_key_required`; do
   not collapse the enum to a boolean.
3. Wire names are deterministic and driver-prefixed. Normalize to
   `^[a-zA-TopZ0-9_-]+$`, cap at 64 characters, and preserve the upstream
   `operationId` only as metadata/description when it cannot be the wire name.
4. Truncation must include a deterministic digest suffix. Any post-normalization
   duplicate is a hard generation/registration failure; never last-write-wins.
5. Generate and commit a stable machine-readable collision report covering all
   candidate tools, original operation IDs, normalized names, truncations, and
   duplicate verdict. Re-running generation must be byte-identical.
6. Compose one `McpServer.layerStdio` host with `@beep/mcp-kit` gated layers,
   `sanitizedToolkit`, and accurate four-hint read-only annotations. No raw tool
   parameters enter span attributes.
7. Tool input/output schemas and registered definitions must validate against
   the installed Effect MCP JSON/schema surface; do not rely on a newer protocol
   than the installed server supports.
8. Fixtures are synthetic/offline. GovInfo missing-key behavior and eCFR
   keyless mounting are tested without real credentials.

## Acceptance Criteria

- [ ] `packages/drivers/gov-legal-mcp` exposes at least one real bounded tool
      from each proven driver through one stdio server.
- [ ] eCFR mounts without credentials; GovInfo vanishes without its hard-gate
      key and mounts under injected test configuration.
- [ ] Every wire name is stable, driver-prefixed, safe-character-only, and at
      most 64 characters; truncation is deterministic.
- [ ] Duplicate detection fails closed, with fixtures for cross-driver,
      normalization, and truncation collisions.
- [ ] The checked-in collision report is complete and byte-identical after a
      second generation; the report’s duplicate verdict is clean.
- [ ] Tool definitions/encoded results validate through the installed Effect
      MCP schemas; sanitized-span and four-hint proof tests pass.
- [ ] No remaining driver breadth, driver transport changes, or unrelated churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher | `test "$(wc -m < goals/gov-legal-mcp/GOAL.md)" -le 4000` | Pass |
| Manifest | `jq . goals/gov-legal-mcp/ops/manifest.json` | Pass |
| Naming | Generator/collision fixtures + checked-in report | Stable, ≤64, duplicate-free |
| Auth composition | Offline none/hard gate tests | eCFR mounts; GovInfo absent/present behavior correct |
| MCP contract | Installed Effect MCP schema integration tests | Green |
| Repo quality | `bun run beep yeet verify` | Green or unrelated failure attributed |

## Stop Conditions

- A proven driver lacks a stable public operation/handler surface needed by the
  thin host; report rather than redesigning the driver here.
- Collision safety requires unstable, order-dependent, or lossy naming.
- Implementation would absorb delivery breadth, write-wall persistence, or a
  general-purpose generator.
- Installed MCP internals have drifted enough to invalidate the shipped kit
  conventions.

## Decision Log

- Exploration Q3 chose a sibling package behind ≥2 proven drivers; the gate is
  now cleared by GovInfo + eCFR.
- The generated-name collision contract is mandatory and precedes toolkit merge.
- Shipped MCP kit Q5 preserves `none|soft|hard`; annotations are UX hints, not
  security boundaries.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
