# vault-sync-status-connected

P2 refresh at `0be1f13d62fa00cb65e34ff69ec99043380f8d81`,2026-09-22.
This replaces historical reviewed status with designed, pending independent P3.

## Current shape

`packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:65-118`
defines VaultSyncStatus with connected:Boolean and
Option<DmsMirrorDisconnectReason>. Annotation79 says no reason while connected.
The reason's null/omitted-key decoding default and constructor None default
preserve older sidecars. Disconnected-without-reason is explicitly legitimate.
The five reason literals in DmsMirror.ts516-522 are credentials-missing,
auth-failed, root-unreachable, transient and probe-failed.

The one server readStatus writer1559-1572 copies both fields from one probe.
It first honors forceProbe by choosing availability.refresh or availability.probe
at1555, and independently retains probedAt. UI badge43, note112 and panel309/332
consume connection alongside the authoritative AsyncResult status.

## Cardinality gap

The presence-only projection is4/3. The full finite reason domain has six
values:None plus five reasons. Two Boolean values give **12 representable /7
legal**: connected+None, disconnected+None and disconnected+each of five reasons.
Each connected+Some(reason) is invalid by annotation79. The prior inventory's4/3
is explicitly replaced by12/7; seven is not compared against four representations.

probedAt remains independent Option<DateTime.Utc>; its presence strata multiply
this projection to24/14 without restricting timestamps. Counts, provider and
cursorPosition remain independent payloads with original domains. Do not infer
that a timestamp or cursor must exist under either connection case. Missing/null
wire reason normalize to the same decoded None, not distinct decoded states.

## Target schema

Introduce a root-free VaultSyncConnection with connected(no payload) and
disconnected(reason:Option<DmsMirrorDisconnectReason>, default None). Use a
private LiteralKit, annotated case classes and a union annotated before
S.toTaggedUnion("state") so generated helpers survive. Do not add rootRemoteId:
it belongs to the upstream DMS probe and has never belonged to this wire model.
Reuse the reason literal domain, not the full probe union. No duplicated Boolean
or flat decoded compatibility alias remains.

The public VaultSyncStatus becomes a bidirectional compatibility codec to a
canonical status class with connection plus unchanged sibling fields. Keep the
raw flat schema private; do not export an invalid domain solely to support tests.
Use frozen legacy fixture expectations for compatibility tests. Expose only the
canonical constructor needed by server writers through the existing server
aggregate surface, plus connection schemas needed by client consumers.

The raw schema preserves exact OptionFromNullOr reason/probedAt decoding defaults
and all existing payload schemas. Reject connected+Some(reason) at the boundary
before projection: the former proposal silently discarded the reason and called
that compatibility. That loses contradictory input and is withdrawn. Legitimate
reasonless disconnection stays None rather than inventing probe-failed.

Local Effect decodeTo5388 maps source Type to target Encoded. If the transform
constructs canonical class instances containing runtime Options/DateTime, target
the canonical class's type-side schema. Do not feed a transformed codec into
Class.extend (accepts fields/Struct), or assert missing constructor statics.
Prove public codec, construction, arbitrary and nested RPC behavior in a focused
compile/runtime fixture during implementation. Encoding matches connection and
reconstructs original flat keys; copy all sibling fields without data loss.

## Migration inventory

- VaultSyncEngine.ts65-118: replace only connected/disconnectReason. Preserve
  conflictItems,currentItems,errorItems,failedOperations,openConflicts,pendingItems,
  queuedOperations NonNegativeInt fields; cursorPosition optional runtime value
  with required nullable encoded key; provider DmsProvider; independent probedAt
  with omitted/null tolerance, DateTimeUtcFromString and None default.
- VaultSyncEngine.ts examples45,339,394 and engine port368-377: same encoded
  examples, migrated decoded field reads/construction and status/syncOnce result.
- Server VaultSyncEngine.service.ts1520-1574: preserve repository/count/cursor
  operations and forceProbe ordering. Project the upstream connection once into
  root-free Vault connection. Coordinate with dms-mirror-probe-connected: if its
  migration lands first, match its union and pass its optional disconnected reason through unchanged;
  if not, use its present flat contract at this one adapter until that migration
  replaces it. Never pretend probe.connection exists at the current source.
  The DMS port permits an unknown reason: preserve None rather than inventing
  a reason or wrapping an existing Option in Some. Root-specific probe payloads
  do not enter the root-free Vault read model.
- Sync.rpc.ts146/167 success schemas remain the public compatibility codec for
  TriggerVaultSync and GetVaultSyncStatus. Both must preserve encoded wire shape;
  merely defining an unused codec is insufficient.
- Client public.ts71 and aggregate Sync/index.ts28 expose VaultSyncStatus and
  required VaultSyncConnection runtime/type helpers. Existing server.ts wildcard
  exposes the canonical constructor if exported there. Do not export raw flat
  schema or root-bearing probe data into the client-safe barrel.
- VaultSyncPanel.tsx43-53 badge consumes connection; success branches use union
  guards/match; disconnected note112 preserves optional reason fallback,
  probedAt, waiting and retry action. Preserve AsyncResult Initial/Failure/Success,
  failure retry/loading and waiting, counts/provider and panel busy state.
- Panel309/328/332/346: remove the stored local connected Boolean, narrow existing
  AsyncResult then connection. For Initial/Failure retain the existing disconnected
  badge presentation and disabled trigger without fabricating a Vault status;
  the disconnected note still appears only for successful disconnected status.
  Preserve current fallback provider and retry/trigger behavior exactly.
- use-cases/test/Sync.test.ts, server/test/VaultSyncEngine.test.ts,
  desktop/test/schema-parity.test.ts and vault-sync-disconnected-note.test.tsx
  migrate constructors/assertions and add full finite table/codec cases.
  Source discovery found one production constructor, RPC success consumers,
  public/server barrels and panel readers; recheck all at implementation head.

## Guard-deletion accounting

Delete stored connected and optional reason coherence on the decoded status and
the server's two-field copying. Replace badge Boolean branches and panel's
stored local connection projection with schema case matching. Do not claim that
AsyncResult success checks are unnecessary: success is still required before
reading connection. The round26 proposed success+connected owner is subsumed,
not a separate schema or second cardinality claim.

Retain reason None fallback, forceProbe choice, waiting, retry, busy and count
behavior. No existing runtime status-coherence rejection is claimed deleted;
the documented implication becomes structural plus one legacy-input boundary.
Do not flatten AsyncResult or its independent waiting state into connection.

## Encoded-side impact

Tier2 RPC wire model. Preserve all old flat keys and their ordering, scalar
validation and encoded normalization for seven legitimate decoded states.
Omitted/null reason decode None and canonically encode null, independently of
omitted/null probedAt. Connected remains a required Boolean; cursorPosition's
encoded key does not acquire missing-key tolerance merely because its constructor
defaults None. Preserve full timestamp precision/normalization of the old codec.

Reject five contradictory connected-with-reason values; no silent reason dropping
or implicit disconnection. This intentionally excludes documented-invalid values
accepted by the former permissive raw schema. Do not preserve invalid acceptance
as an alternative success criterion. Existing RPC names/payload defaults and
forceProbe remain unchanged. Assess actual release policy during implementation.

## Test impact

Exercise all12 combinations, accept/round-trip seven, reject five. Cross legal
cases with probedAt None/Some and missing/null input separately, and nontrivial
counts/provider/cursor payloads. Keep both schema-parity exact encoded fixtures
and older-sidecar missing reason/timestamp fixture195-222; compare canonical null
outputs, not invented raw omission identity. Preserve schema-derived arbitrary
round-trip checks and server status/syncOnce behavior.

UI tests preserve all five reason messages, reasonless generic guidance, timestamps,
retry state, Initial/Failure badge behavior and action enablement. Use browser-qa-loop
for gesture-bearing panel changes after implementation. Run package verification
for each edited package and the relevant desktop checks, followed by campaign and
Yeet gates. This audit performs finite enumeration/source inspection only, with
no sync, secret read, network probe, UI operation or runtime codec prototype.

## Risk

Primary risks are coercing malformed connected+reason input, erasing reasonless
legacy disconnection, forcing upstream root payloads into Vault, leaking private
connection tags into RPC JSON, or conflating AsyncResult with connectivity.
Coordinate DMS migration order and shared server file changes explicitly. A green
finite table does not prove runtime codecs, UI equivalence, independent P3 or
campaign closure; all remain subsequent gates.
