# dms-mirror-probe-connected

P2 at `0be1f13d62fa00cb65e34ff69ec99043380f8d81`, 2026-09-22.
Parent-review revision preserves the exported port contract. No implementation
or independent P3 credit.

## Current shape

DmsMirrorProbe in packages/documents/use-cases/src/aggregates/Sync/DmsMirror.ts
581-602 is an exported server-side port result. It stores connected:Boolean,
disconnectReason:Option<DmsMirrorDisconnectReason>, rootRemoteId:Option<RemoteItemId>,
probedAt:Option<DateTimeUtc> and provider:DmsProvider. All three Options default
None; connected/provider remain required. Options use S.Option, not optional
wire keys. Reason domain515-526 has five literals: credentials-missing,
auth-failed, root-unreachable, transient, probe-failed.

The explicit contract558-561 says reason is None while connected and carries
a reason when the adapter knows why it is unreachable. This permits disconnected
None. Existing Box/app failure writers always supply known reasons, but they do
not exhaust the exported port's legitimate constructors. The root contract548-556,
596 says a root is carried when resolved and absent when not resolved; it does
not forbid retaining a known root with a disconnected observation. Preserve
that independent Option. Existing connected/no-root example574 and fixture
Sync.test.ts140 further rule out requiring root for connected.

## Cardinality gap

The qualified cluster is connected plus reason, **12 representable / 7 legal**:
2 Boolean values ×6 reason states (None plus five literals). Connected permits
only None; disconnected permits None and every one of five reasons. Coarse
presence projection is4/3. Including independent root presence gives24/14;
root's complete branded string payload is unchanged. Metadata timestamps and
provider are outside the qualified connection projection.

| Connection | Reason | Legal |
| --- | --- | --- |
| connected | None | yes |
| connected | each of five Some reasons | no |
| disconnected | None | yes: reason unknown |
| disconnected | each of five Some reasons | yes |

Do not substitute producer reachability for this contract. The old8/3 design
required known reasons and excluded disconnected roots; the first private24/7
revision merely expanded its reason domain while retaining those unsupported
restrictions. Both are superseded. This correction removes proven connected/
reason contradictions while preserving legitimate optional payloads; it does
not grant completion credit for narrowing the intended domain.

## Target schema

Define a private two-member LiteralKit for connected/disconnected tags, map its
intact base into named annotated cases, annotate the union before toTaggedUnion
so case/guard/match statics survive. Connected has no reason field. Disconnected
owns default-None reason:Option<DmsMirrorDisconnectReason>. Reuse the existing
reason LiteralKit; no duplicate domain and no forced probe-failed substitution
for a legitimately unknown reason. S.tag supplies discriminants in constructors.

DmsMirrorProbe stores required connection plus unchanged rootRemoteId, probedAt
and provider at the enclosing level. Root and timestamp keep existing defaults,
value domains and independent availability. Remove the flat connected and
disconnectReason fields; retain no Boolean compatibility getters or shadow bag.
Export connection schema/type through the existing server-only barrel for actual
cross-package consumers. Keep private tag kit private. No probe codec is needed
for a transient port; preserve the separate Vault wire boundary by projection.

## Migration inventory

1. DmsMirror.ts581-602 replaces only connected/reason with connection. Retain
   rootRemoteId/probedAt/provider. Migrate examples574,623,650 and service
   documentation; DmsMirrorAvailabilityShape632-635 retains both probe and
   refresh effects. Reuse existing imports/identity/schema helper conventions.
2. packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts849-868 constructs
   disconnected Some(classifiedReason) on failure and connected on success;
   rootRemoteId remains enclosing None/Some exactly as current writers supply.
   Preserve probedAt and provider. Existing writer values remain unchanged,
   without elevating those values to a restriction on every port implementation.
3. Box cache type783-786 stays a complete DmsMirrorProbe. Replace connected
   Boolean TTL choice874 with generated connection guard/match. Preserve30s
   success TTL/3s failure TTL, expiration comparison, cached object and timestamp
   identity, refresh bypass and cache replacement. Failure still returns a
   successful probe Effect value and emits its classified warning.
4. packages/documents/server/src/aggregates/Sync/DmsMirrorFixture.ts567 writes
   connected plus existing fixture root on the enclosing probe; probedAt remains
   None. Shared probe/refresh effects573 remain shared.
5. apps/professional-desktop/src/sync/DmsMirrorDisconnected.ts62 writes
   disconnected Some(credentials-missing), provider box and default-None root/
   timestamp. Retain its Option import because reason is still an Option.
   All unavailable mirror verbs and their exact guidance remain unchanged.
   Update apps/professional-desktop/src/runtime/Layer.ts302 comment only.
6. packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts1317
   keeps reading probe.rootRemoteId directly: it remains independent, including
   a retained root on a disconnected observation. Do not change remote event
   classification or discard that payload. At1561-1562 match connection once
   into legacy Vault connected/reason fields: connected→true/None;
   disconnected→false/its exact Option reason. Provider/probedAt and every
   count/cursor payload1560-1575 remain unchanged. Force refresh1555 remains.
7. Vault service1669 projects generated connected guard to the existing one-
   Boolean recoverStalledOperations argument. Do not claim that helper's own
   guard deleted. Requeue-leased, recovery, scan, queue pump, event poll and
   status-read sequencing stay intact. The later separate Tier2 Vault migration
   projects this connection into its root-free model, preserving reason Option,
   and removes only the temporary flat-field projection.
8. packages/documents/use-cases/src/aggregates/Sync/server.ts14 wildcard exports
   the new connection for server users. public.ts43 retains the client-safe
   reason export; do not expose this internal port through the client barrel.
   Exhaustive DmsMirrorProbe/property searches identify model/examples, Box,
   fixture, desktop disconnected adapter, Vault engine and tests. No actual
   encoded probe caller was found. This is an exported decoded API change,
   not permission to narrow constructors to the finite current adapter set.

## Guard-deletion accounting

Remove connected/disconnectReason's independent stored representation and
manual paired writer coherence. Connection cases make connected-with-reason
unrepresentable. Replace Box TTL Boolean branch with case dispatch and centralize
Vault projection. No existing runtime reason/root coherence guard is claimed
removed. Keep descriptive semantics but eliminate reliance on prose for the
proved connected-implies-no-reason rule.

Root field, root readers and disconnected root payload remain unchanged. Do not
claim root narrowing, reason-required validation or unavailable root access as
improvements. The temporary Vault wire projection is accounted for once by its
later owner; do not double-count it. Recovery's separate Boolean parameter,
normal RemoteItemId validation, provider error classification and cache checks
are not this owner's deletion credit.

## Encoded-side impact

Internal server port is exported across packages, but no persisted/RPC probe
codec caller was found. Preserve its decoded payload domains/defaults through
the new representation; no compatibility transport schema is required. Keep
VaultSyncStatus encoded keys and native union encoding out of RPC until the
separate Tier2 compatibility design lands. Preserve exact reason None rather
than converting it to Some(probe-failed) in the Vault projection.

Box classification retains401 auth-failed,403/404 root-unreachable,429/503
transient,400/unclassified failures and malformed root ID probe-failed. Logs
remain sanitized and equivalent. Preserve no-credentials guidance, cache timing,
full provider/root/timestamp data and independent root-event behavior. Apply
actual release policy; public export alone does not dictate a patch bump.

## Test impact

Enumerate12 connection projections:7 legal and5 connected-with-reason rejected.
Cross all seven legal states with both root presence values to verify14 carrier
strata, specifically disconnected None with/without retained root and disconnected
Some reason with retained root. Use full branded IDs, provider values and None/
Some timestamps while preserving adapter-specific timestamp behavior. Add the
schema-derived probe/connection round trips missing from Sync.test.ts.

Migrate use-cases Sync.test.ts140-150 connected/no-root fixture. Update Box tests
445/483/868 connected checks and retain independent root assertions;886/952
failure checks retain None root as Box-specific behavior, not universal model
law. Migrate all named status-code result variables916-932 and refresh result
fields984-990 as well as generic probe variables. Preserve status classifications,
malformed root, timestamps, cached object identity and real refresh call counts.
Add a Vault fake port returning disconnected with retained root to confirm
classification receives the same root; add disconnected unknown reason to
confirm legacy read-status emits None, not a fabricated fallback.

Use existing fake providers; no live credentials/calls. After implementation run
focused Sync/DmsMirrorBox/VaultSyncEngine tests and full package verification for
@beep/documents-use-cases, @beep/documents-server and the touched desktop package
(resolve its current manifest name). This design audit performs source inspection
and finite enumeration only; no runtime/package/P3 proof claimed.

## Risk

The primary risk exposed by parent review was treating all current adapter writes
as the exhaustive exported contract. Required reason and root exclusivity would
silently narrow legitimate inputs. The corrected12/7 model enforces only the
explicit connected/no-reason implication and preserves independent root metadata.

Apply in the approved Tier1 sequence after P3 and packet ratification, then the
separate Vault Tier2 owner. Coordinate shared engine edits and pass reason Options
unchanged. Do not merge the two inventories merely because their new connection
shapes resemble one another; their ownership and compatibility boundaries differ.
