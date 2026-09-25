## Instance

- id: `r3-drivers-arch-folder-resolution-blocked-provider`
- source/main: `0be1f13d62fa00cb65e34ff69ec99043380f8d81`; P2 only, no census/review credit.
- file:line: `packages/drivers/box-provisioning/src/BoxProvisioningPlanner.ts:58`
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

Root and uniquely observed, exactly authorized/adopted folders carry a provider, folders awaiting creation do
not, and blocked/unresolved folders do not. Collaboration, webhook, metadata,
and retention planners repeatedly re-derive those cases from the two fields.

## Cardinality gap

The boolean and Option presence bit represent four combinations. Three are
legal: `resolved(providerId)`, `pending-create`, and `blocked`. The private owner has no public constructor or decoder accepting additional
states. A blocked folder with a provider id is inconsistent with fail-closed
dependency resolution: blocked folders cannot authorize candidate matching.
The root is resolved with its full rootFolderId. Other resolved folders require
one observed candidate and exactly one matching adoption authorization, including
logical key, expected provider id and expected parent id. Merely matching a name
is insufficient. Zero candidates yields pending create; multiple candidates,
missing/duplicate authorization, or a blocked parent yields blocked. All provider
and action-key strings remain full payloads, outside the finite quotient.

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
  $I.annoteSchema("FolderResolution", { ... }),
  S.toTaggedUnion("kind")
)
type FolderResolution = typeof FolderResolution.Type
```

Keep the LiteralKit base unannotated until its member construction is
complete; annotate the union before `toTaggedUnion` so `.cases`/`.match`
remain present. Reuse literal members for the case tags instead of a second
independently maintained list. The snippet is structural pseudocode: validate
actual class/member composition against installed/local Effect before apply.

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
- `BoxProvisioningPlanner.ts:520-529` — preserve the current action-to-resolution projection without an unsafe
  Option unwrap: inherited blocked parent or Blocked action yields blocked;
  otherwise present provider (retained only from Noop precondition today) yields
  resolved, and absence yields pending-create. The private folderAction Noop
  writer always supplies Some, but its declared BoxPlanAction type is broader;
  do not add a runtime assertion or claim the public Noop schema guarantees
  provider presence. Add matchedFolderIds from the same present provider before
  resolution storage, preserving exact foreign-resource classification.
- `BoxProvisioningPlanner.ts:534-597` — replace the four unresolved lookup
  fallbacks for collaboration, webhook, metadata, and retention with the same
  blocked case constructor.
- Preserve public planBoxProvisioning's optional third additionalAdoptions input
  and planWithAdoptions service entry; concatenate explicit and trusted in-memory
  authorizations exactly as today, with duplicate authorization still blocking.
- Preserve tenant mismatch before subject mismatch, then canonicalization,
  folder depth/logical-key sorting, folder/collaboration/webhook/metadata/retention
  action order, matched-resource sets, counters and final seal/digest. No foreign
  resource classification or entitlement/discovery policy becomes a resolution
  Boolean deletion.
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
traffic, or Box API input/output. The final `BoxPlanAction` schemas and their encoded digests remain
byte-for-byte unchanged. Preserve complete etags, before/after digests, logical
keys, principal strings/types, role, webhook address and normalized trigger
lists. Preserve root-anchor and unresolved-key digest preimages. Root folder
actions have empty dependencies despite their anchor; child/dependent actions
keep exact ordered action-key arrays. Schema codecs and defaults for desired,
observed and final plan stay unchanged.

## Test impact

- Extend `packages/drivers/box-provisioning/test/BoxProvisioningPlanner.test.ts`
  around the blocked-folder-dependency cases at lines 250-305 to cover all
  three resolution outcomes through public `planBoxProvisioning` behavior.
- Prove a uniquely observed and exactly authorized/adopted folder yields dependent matches, a missing folder
  yields pending create actions, and an unresolved/blocked parent propagates
  the existing `blocked-folder-dependency` policy to every dependent resource.
- Retain deterministic plan digests, action ordering, foreign-resource
  classification, adoption behavior, and every existing exact encoded-plan
  assertion.
- Retain parent-child create chain159–179, unauthorized parent propagation,
  duplicate-name ambiguity345–367, provider-ID collaboration matching and
  entitlement/discovery disagreement tests. Exercise all dependent resource
  classes for blocked parent precedence; nonblocked metadata/retention retain
  the existing capability policy even for pending-create folders.
- This source-only P2 task ran no planner, package test, Box call or codec.
  Existing fixtures are evidence of required behavior, not passing execution.
- Run full package verification for `@beep/box-provisioning`; no browser QA is
  required because the migration is planner-only and has no gesture surface.

## Risk & sequencing

Land in Tier 1A with backend and driver state. The main risk is changing
dependency propagation or observed-provider matching while deleting the
parallel representation. Preserve every current action tag, reason, digest,
dependency key, and create/noop/update decision; only the private intermediate
shape changes. Do not modify Box credentials, live inventory behavior,
dependencies, lockfiles, generated files, or encoded plan schemas.
