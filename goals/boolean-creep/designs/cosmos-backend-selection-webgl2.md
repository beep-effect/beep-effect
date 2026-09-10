# Instance

- id: `cosmos-backend-selection-webgl2`
- file:line: `packages/drivers/cosmos/src/Cosmos.backend.ts:108`
- symbol: `CosmosBackendSelection`
- members: `webGl2`, `backend`
- evidence: E1 at `Cosmos.backend.ts:170-175` — the only constructor pairs
  `cosmos` with true and `sigma` with false, so the two mismatched combinations
  are never written.

# Current shape

`CosmosCapabilityProbe.webGl2` is the legitimate runtime observation. Backend
selection then converts that fact to the existing `CosmosBackend` literal but
copies the input boolean into the selection result as redundant state. The
renderer reads only `backend`.

# Cardinality gap

Four boolean/literal combinations are representable and two selections are
legal: `cosmos` and `sigma`.

# Target schema

Reuse the existing named `CosmosBackend` LiteralKit as the single state owner.
Remove `webGl2` from `CosmosBackendSelection`; retain `backend` plus independent
diagnostic `reason`. Keep `CosmosCapabilityProbe.webGl2` because it is the raw
capability observation that selects the backend.

# Migration inventory

- `Cosmos.backend.ts:86-114` — remove the redundant field from the exported
  decoded selection schema and update its titled example/annotation.
- `Cosmos.backend.ts:153-175` — construct only backend and reason from the
  capability probe.
- `Cosmos.renderer.ts:688-698` already matches `selection.backend`; verify no
  behavior change and no boolean projection is added.
- `CosmosProjection.test.ts:70-78` — assert both selected literals and reasons;
  retain separate raw probe tests at lines 123-130.
- `src/index.ts` exports the backend module wholesale. Whole-package source and
  barrel search found no selection `webGl2` reader or additional constructor.

# Guard-deletion accounting

Delete the `webGl2` member and its constructor write from the selection result.
No guard replaces it: every selection consumer already uses the exhaustive
backend literal.

# Encoded-side impact

None. `CosmosBackendSelection` is an internal decoded diagnostic object and is
not persisted or transported. This is an authorized atomic public TypeScript
shape migration. Raw capability probing, renderer selection, error behavior,
and the package's browser-safe exports remain stable.

# Test impact

Test true/false capability probes selecting cosmos/sigma, exact reason
retention, the absence of the redundant member in constructed/encoded local
selection values, and both renderer branches. Keep tests importing through
`@beep/cosmos`; run full `@beep/cosmos` package verification and add a patch
changeset unless explicitly ignored.

# Risk and sequencing

Land in Tier 1A. Do not remove or rename `CosmosCapabilityProbe.webGl2`; only
the post-selection duplicate is in scope. Preserve lazy renderer loading and
browser import safety.
