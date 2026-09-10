## Instance

- id: `r3-drivers-arch-folder-resolution-blocked-provider`
- file:line: `packages/drivers/box-provisioning/src/BoxProvisioningPlanner.ts:60`
- symbol: `FolderResolution`
- members: `blocked`, `providerId`
- evidence classes:
  - E1 — `BoxProvisioningPlanner.ts:476-484,520-528`: writers construct a resolved root/provider, a blocked unresolved parent, or an unblocked create-pending folder; blocked-with-provider is never written.
  - E2 — `BoxProvisioningPlanner.ts:132-148`: dependent action planning short-circuits the blocked case before provider matching and treats the remaining absence/presence cases as create-pending/resolved.

## Current shape

The private planner type stores one common dependency key plus a correlated
boolean and provider Option:

```ts
type FolderResolution = {
  readonly actionKey: Sha256Hex
  readonly blocked: boolean
  readonly providerId: O.Option<BoxProviderId>
}
```

Root and exact-match folders carry a provider, folders awaiting creation do
not, and blocked/unresolved folders do not. Collaboration, webhook, metadata,
and retention planners repeatedly re-derive those cases from the two fields.

## Cardinality gap

The boolean and Option presence bit represent four combinations. Three are
legal: `resolved(providerId)`, `pending-create`, and `blocked`. A blocked folder
with a provider id is never constructed because blocked dependency actions are
fail-closed and an id is retained only for a `Noop` folder action.

## Target schema

Use the existing module `$I` composer and define a private schema-first tagged
union. `actionKey` is common; only the resolved case carries a provider id:

```ts
const FolderResolutionKind = LiteralKit(["blocked", "pending-create", "resolved"])

class BlockedFolderResolution extends S.Class<BlockedFolderResolution>(...)({
  kind: S.tag("blocked"),
  actionKey: Sha256Hex,
}) {}

class PendingCreateFolderResolution extends S.Class<PendingCreateFolderResolution>(...)({
  kind: S.tag("pending-create"),
  actionKey: Sha256Hex,
}) {}

class ResolvedFolderResolution extends S.Class<ResolvedFolderResolution>(...)({
  kind: S.tag("resolved"),
  actionKey: Sha256Hex,
  providerId: BoxProviderId,
}) {}

const FolderResolution = FolderResolutionKind.mapMembers(...).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("FolderResolution", { ... })
)
type FolderResolution = typeof FolderResolution.Type
```

Construct cases with `FolderResolution.cases.*.make`, omitting `kind` because
`S.tag(...)` supplies it. Branch with the schema-derived `.match` helper; do
not add `isBlocked` or provider-presence predicates.

## Migration inventory

- `packages/drivers/box-provisioning/src/BoxProvisioningPlanner.ts:8-14` —
  import `LiteralKit` with `Sha256Hex`, add the runtime `effect/Schema` import,
  and replace the type-only Schema import.
- `BoxProvisioningPlanner.ts:58-63` — replace the type literal with the named
  private LiteralKit/tagged-union schemas and decoded type.
- `BoxProvisioningPlanner.ts:126-183` — make `dependentAction` match the folder
  kind: `blocked` returns the existing blocked-by-dependency action;
  `pending-create` and `resolved` retain the existing candidate cardinality
  behavior.
- `BoxProvisioningPlanner.ts:282-319` and `:328-364` — derive collaboration
  and webhook candidates only from the resolved case; blocked and
  pending-create retain empty candidate arrays.
- `BoxProvisioningPlanner.ts:371-416` — make `blockedCapabilityAction` select
  the blocked-folder reason from the `blocked` case and retain the existing
  entitlement/discovery match for both nonblocked cases.
- `BoxProvisioningPlanner.ts:474-485` — construct the root as `resolved` and
  the missing parent fallback as `blocked`.
- `BoxProvisioningPlanner.ts:487-517` — derive candidate lookup and the parent
  blocked action by matching the parent resolution once; preserve exact
  action keys, digests, dependencies, and policy strings.
- `BoxProvisioningPlanner.ts:520-529` — map `Noop` to `resolved`, `Blocked` (or
  an inherited blocked parent) to `blocked`, and other folder actions to
  `pending-create`; add matched provider ids only in the resolved arm.
- `BoxProvisioningPlanner.ts:534-597` — replace the four unresolved lookup
  fallbacks for collaboration, webhook, metadata, and retention with the same
  blocked case constructor.
- Repeat exact member and `FolderResolution` searches before apply; the type is
  private to this module and must not be exported through `src/index.ts`.

## Guard-deletion accounting

- Delete `if (input.folder.blocked)` in `dependentAction`; the `blocked` case
  owns the payload-free short circuit.
- Delete all `O.match(folder.providerId)` and
  `O.match(parent.providerId)` coherence branches; only `resolved` exposes the
  provider payload.
- Delete the `folder.blocked` ternary in `blockedCapabilityAction` and the
  `parent.blocked` folder-action ternary; exhaustive union matching selects the
  existing behavior.
- Delete the boolean/Option reconstruction at lines 520-528, including the
  `action._tag === "Blocked" || parent.blocked` invariant.

## Encoded-side impact

None. `FolderResolution` is a private, in-process planner value. It is not part
of `BoxProvisioningPlan`, a receipt, persisted desired/observed state, Connect
traffic, or Box API input/output. The final `BoxPlanAction` schemas and their
encoded digests remain byte-for-byte unchanged.

## Test impact

- Extend `packages/drivers/box-provisioning/test/BoxProvisioningPlanner.test.ts`
  around the blocked-folder-dependency cases at lines 250-305 to cover all
  three resolution outcomes through public `planBoxProvisioning` behavior.
- Prove an exact observed folder yields dependent matches, a missing folder
  yields pending create actions, and an unresolved/blocked parent propagates
  the existing `blocked-folder-dependency` policy to every dependent resource.
- Retain deterministic plan digests, action ordering, foreign-resource
  classification, adoption behavior, and every existing exact encoded-plan
  assertion.
- Run full package verification for `@beep/box-provisioning`; no browser QA is
  required because the migration is planner-only and has no gesture surface.

## Risk & sequencing

Land in Tier 1A with backend and driver state. The main risk is changing
dependency propagation or observed-provider matching while deleting the
parallel representation. Preserve every current action tag, reason, digest,
dependency key, and create/noop/update decision; only the private intermediate
shape changes. Do not modify Box credentials, live inventory behavior,
dependencies, lockfiles, generated files, or encoded plan schemas.
