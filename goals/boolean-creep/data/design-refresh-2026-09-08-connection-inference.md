# Connection and inference design refresh — 2026-09-08

## Source

- Reviewed corpus SHA: `be8995e66aeefedf0dabf131deaeaaf25c8e6fc8`
- Local checkout HEAD during review: `05405bf322da0ca7eb88b8bb402145081e8fded6`
- The reviewed `packages/**/src` and `apps/**/src` corpus is identical between those revisions.
- Follow-up root-id audit refreshed at checkout `7440cb8c4302ce64b87860069a464bafbf65f576` against frozen upstream corpus `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`; the DMS source and call-site graph used below are unchanged.

## Refreshed designs

### `ontology-inference-recompute-cause`

- Removed the unsupported E2 claim at `Session.reasoner.ts:724`. The helper at lines 724-732 receives only `fullRecompute`, `affected`, and a previous module; it does not branch on `drifted` and `fullRecompute` together.
- The qualifying E4 evidence is the producer implication at `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:793-794`: `drifted` is computed first and `fullRecompute = O.isNone(previous) || drifted` proves `drifted => fullRecompute`.
- Kept the three-case compatibility table and exact old `drifted` / `fullRecompute` RPC and nested-request encoding. The impossible `true / false` pair remains rejected by the proposed decoded transformation.

### `dms-mirror-probe-connected`

- Replaced declaration-only/stale evidence with the actual exclusive writes at `packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts:849-867`. Failure writes disconnected plus `Some(reason)` and no root; success writes connected plus the defaulted absent reason and `Some(rootRemoteId)`.
- Recorded the `disconnectReason` constructor default at `packages/documents/use-cases/src/aggregates/Sync/DmsMirror.ts:586` and the no-credentials disconnected writer at `apps/professional-desktop/src/sync/DmsMirrorDisconnected.ts:61-62`.
- Verified every production, example, and test constructor: every disconnected DMS probe supplies `Some(reason)` and omits or explicitly clears `rootRemoteId`; connected probes may omit the root or carry `Some(rootRemoteId)`. The complete `(connected, reasonPresent, rootPresent)` cluster therefore has 8 representable / 3 legal coarse states. Expanding the reason literals gives two connected root-presence states plus five reasoned disconnected states, or seven specific states.
- Corrected the raw-r25 conclusion for `r25-shared-documents-dms-mirror-probe-root-id`. The connected-without-root example at `DmsMirror.ts:568-576` disproves `connected => rootPresent`, but does not disprove `rootPresent => connected`. The latter implication is supported by the Box writes at `DmsMirrorBox.ts:849-867`, the fixture at `DmsMirrorFixture.ts:566-568`, both disconnected constructors, and the contract prose at `DmsMirror.ts:550-556`. No actual supported writer constructs a disconnected probe with a root.
- Preserved `probedAt`, `rootRemoteId`, all five disconnect reasons, force-refresh behavior, and the Tier 1 temporary projection into the existing Vault fields.

### `vault-sync-status-connected`

- Corrected the producer evidence to `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1552-1562`, where `readStatus` writes the two connection fields together and independently preserves `probedAt`.
- Kept the optional-key/null defaults at `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:73-80` and `:99-105`. A legitimate disconnected payload with a null or omitted reason now decodes to `VaultSyncDisconnected { reason: None }`; it is never rewritten to `probe-failed`. An omitted `probedAt` still becomes `None`.
- The final design uses a separate root-free `VaultSyncConnection`: its connected case has no payload, while its disconnected case owns `Option<DmsMirrorDisconnectReason>`. This preserves Vault's coarse 4 representable / 3 legal cardinality without weakening DMS's stricter internal invariant or admitting unsupported `rootRemoteId` data.
- The test plan compares `encodeNew(decodeNew(input))` with the old codec's canonical encoding for connected/null, disconnected/null, all five disconnected reasons, omitted optional keys, and every timestamp form. The root-free schema also permits a true unconstrained decoded arbitrary round trip.
- Preserved current encoded keys and values, current and legacy input acceptance, RPC behavior, and the required Tier 1 DMS-before-Tier 2 Vault sequence.

### Required inventory metadata corrections

The canonical inventory was not edited in this lane. Its owner should make these evidence-backed adjustments:

- `dms-mirror-probe-connected`: expand the canonical cluster members to `connected`, `disconnectReason`, and `rootRemoteId`, with cardinality `8 / 3`. Revise the E3 note so it no longer calls reasonless unprobed or unconfigured DMS adapters legitimate; the no-credentials adapter at `DmsMirrorDisconnected.ts:61-62` supplies `Some("credentials-missing")`. Keep E1 at `DmsMirrorBox.ts:849-867`, cite the connected-without-root constructor at `Sync.test.ts:129` or the example at `DmsMirror.ts:568-576`, and record the asymmetric implications: connected may lack a root, but every supported root-bearing probe is connected and every disconnected writer lacks a root. The five reason literals expand the three coarse cases to seven specific states.
- Absorb/supersede the held raw record `r25-shared-documents-dms-mirror-probe-root-id` into that canonical cluster rather than retaining its D1 conclusion. Its current note establishes only that `connected` does not imply root presence.
- `vault-sync-status-connected`: retain cardinality `4 / 3`. Update E1 to the full writer at `VaultSyncEngine.service.ts:1552-1562`; keep E3 at `VaultSyncEngine.ts:73-80` and explicitly state that false/null or false/missing is legitimate supported wire data preserved as a reasonless disconnected decoded case.

### `ontology-inspector-form-state`

- Corrected the legal cardinality from 27 to 29 eight-bit tuples. The three field-state pairs yield 27 six-bit tuples; the all-valid tuple has applicability outcomes `00` with no session, `10` with a session plus a literal object, and `11` with a session plus an IRI object, adding two outcomes.
- The target remains three stored `empty | invalid | valid` field states. Applicability stays derived at each consumer from current session presence, all three field states, and object kind.
- Added explicit test expectations for absent-session, literal-object, and IRI-object applicability so removing the form atom's session dependency does not stale or broaden action authorization.

## Validation

`bun goals/boolean-creep/ops/validate-designs.ts` passes: `design coverage OK: 106 qualified ids`. `git diff --check` also passes for the four refreshed designs and this handoff.

After the later root-id expansion and concurrent inventory changes, the pinned rerun `mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts` reached coverage and failed only because the separately owned `html-link-imagesizes-disposition` and `tabstrip-overflow-disposition` designs were missing across the then-current 103 qualified ids. No connection/inference design was named. The scoped `git diff --check` still passed.
