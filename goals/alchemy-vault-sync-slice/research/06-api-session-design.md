# PR 3c: one vault-sync Api, Session, and authorized Views

Date: 2026-11-07. Status: implementation design; no product code or security
acceptance proof. Governing decisions: D8, D9, D10, D13, D14 and D17 in
`explorations/alchemy-domain-adoption/DECISIONS.md`. The packet's
`decisions/provenance-in-driver-rows*` ruling refines D10: provenance is in
driver-owned stored rows, not additional kernel-envelope fields.

## Evidence and version boundary

All alchemy citations below refer to **installed 2.0.0-beta.85** files under
`node_modules/@alchemy.run/domain/`; abbreviations such as `src/Api.ts:80-96`
are relative to that directory. This lane initially had no dependencies.
For read-only source access and packet CLI execution, its ignored
`node_modules` links to the existing main checkout installation; its
`@alchemy.run/domain/package.json:1-3` identifies beta.85. No reference
checkout HEAD was used.

Read the installed skill and its modeling, building-block, layout, hosting
and testing guidance. In particular:
`skills/alchemy-domain/references/modeling.md:33`,
`references/layout.md:33-41`, `references/building-blocks.md:120-146`,
`references/hosting.md:75-110,151-179` (all under that skill directory).
Repo placement takes precedence over upstream layout:
`standards/ARCHITECTURE.md:1729-1775`.

## 1. Schemas first

### Request identity and scope

Declare an annotated opaque value schema `VaultSyncRequest`, then a
`VaultSyncRequestContext` using
`Domain.RequestContext<VaultSyncRequestContext>()(
"documents/vault-sync/RequestContext/v1", VaultSyncRequest)`.
This is a schema-backed Context service, not a global actor variable.
The constructor builds an Effect service and JSON codec
(`src/RequestContext.ts:21-27,66-85`).

| Field | Proposed schema and authority |
| --- | --- |
| principal | Reuse `Principal.Principal` from `@beep/shared-domain/entity/Principal`; resolved from verified credentials, never request JSON |
| sourceKind | Named transport literal domain: `http\|cli\|mcp\|sidecar\|system`; fixed by the trusted entrypoint |
| actorSourceKind | Reuse existing `SourceKind.SourceKind`; records actor category without changing its existing literals |
| orgId | Existing branded shared org id; requested scope is untrusted until membership validation |
| workspaceId | Optional branded workspace id: required for workspace/destination operations, absent for org-wide DestinationList |
| correlationId | Bounded validated correlation identifier, generated at the boundary when absent |
| authenticatedAt | Server timestamp; not a client assertion or a membership lease |
| sessionRef | Opaque non-secret handle for fresh session/grant checks; never a bearer token or cookie |

Do not replace existing `SourceKind` with transport strings. Its values are
`User, Agent, Admin, Application, System, Sync, Connector`
(`packages/shared/domain/src/entity/SourceKind.ts:11-18,50-67`).
The separate transport field makes the requested HTTP/CLI/MCP distinction
explicit. Principal already distinguishes users, service accounts, agents and
connectors (`packages/shared/domain/src/entity/Principal.ts:75-84,106-123,
147-164,186-198`). An MCP client name is not a Principal.

Define named org/workspace/destination read-key schemas and typed
`Unauthenticated`, `ScopeDenied`, `AuthorizationUnavailable` rejections
before services. Use existing public ids for destination, operation and
conflict keys; resolve legacy numeric conflict ids through the D14 mapping
only inside the compatibility adapter. No new inheritance from EntityKit.
Define bounded pagination and public DTOs for the four Views; exclude
credential references, filesystem roots, raw Box payloads, and full legacy
entities. Explicit emitted View event schemas must have the same disclosure
budget as their DTOs: beta.85 otherwise forwards consumed events unchanged
(`src/View.ts:232-240`).

### Provenance encoding and audit

Session provides the request service inside the command effect. Kernel
capture produces a record keyed by the registered service key, for example:

```json
{
  "documents/vault-sync/RequestContext/v1": {
    "principal": { "kind": "User", "userId": 7 },
    "sourceKind": "cli",
    "actorSourceKind": "User",
    "orgId": 11,
    "workspaceId": 23,
    "correlationId": "request-example",
    "authenticatedAt": "2026-11-07T09:00:00Z",
    "sessionRef": "local-operator-example"
  }
}
```

The numbers illustrate existing numeric identity schemas; public stream ids
remain branded public ids. Exact encoded timestamp format follows the chosen
schema codec. This example contains no credentials.

Capture encodes only registered services present in the fiber; restore decodes
by the same key and fails on an unknown registration
(`src/RequestContext.ts:93-116`). Every command's `SendMeta.context` contains
this record (`src/Aggregate.ts:242-251`;
`src/Model.ts:598-623`). The driver atomically stores the encoded record with
the receipt, copies principal and transport sourceKind to every event row,
and keeps actorSourceKind too. Event time comes from the committed event.
Audit decodes the persisted v1 record and reads the event's stored provenance,
not today's user profile or projection audit columns. Register the same
context module in command hosts, workers and replay/audit runtimes; preserve
old codecs when adding a v2 key.

The correlation field alone does **not** set kernel correlation:
`Model.ts:606-619` calls `Telemetry.correlationFor`, which uses its
`Correlation` service or command id (`src/Telemetry.ts:62-75`).
PR 3c must isolate a beta.85 bridge providing that service at dispatch and
prove the context, SendMeta, outbox and saga correlation agree. This is an
internal upstream API dependency, not an assumed public constructor option.
Policies/sagas stamp their system principal and system source, retain causal
correlation and initiating provenance separately, and never persist credentials.

## 2. Context.Service and middleware contracts

### Contracts and package ownership

Use `Session` as an `RpcMiddleware.Service` providing
`VaultSyncRequestContext` plus the live read-authorization service.
Declare it in domain `Session.middleware.ts`. Beta.85's middleware module
only applies Effect RPC middleware in order
(`src/Middleware.ts:5-36`); there is no alchemy Session constructor.
The installed example uses this exact service/provides pattern
(`src/RequestContext.ts:49-63`).

Declare these additional contracts with Effect Context.Service, with named
schema inputs, results and errors:

- `VaultSyncIdentityResolver`: verified transport evidence + requested scope
  → principal, actor category, non-secret sessionRef. Implement in server.
- `VaultSyncAccess`: principal/sessionRef + org + optional workspace + action
  → current permission or typed denial. Verify workspace belongs to org and
  any destination/conflict/operation belongs to that workspace.
- `VaultSyncReadAuthorization`: authorize a Read request/key/state against
  current `VaultSyncAccess`; no storage implementation in domain.

These are proposed contracts, not claims of existing services. Shared
membership data exists: orgId is inherited, and role/status/userId are explicit
(`packages/shared/domain/src/entities/Membership/Membership.model.ts:21,
34-39`; role/status values in `Membership.values.ts:12-13,67-71`).
Searches of `packages/**/src` found no general authenticated-user session
resolver or shared membership repository service to reuse. The ontology
Session services model graph sessions, not login identity. Do not invent
an IAM package or assume better-auth is installed. Server adapters must use
the actual shared membership table via its owning data boundary, or introduce
a narrow approved boundary contract with that owner. Fail closed until wired.

### Transport resolution

| Entry | Authentication and context stamping | Membership enforcement |
| --- | --- | --- |
| HTTP | Verify bearer token or session cookie with the host's resolver; reject expired/revoked sessions; reject ambiguous conflicting credentials; stamp http | Resolve active org membership and workspace ownership before dispatch; cookie mutations also require the host's CSRF/origin protection |
| CLI | Default: authenticated local operator enrollment bound to a stored user/service-account identity; obtain a scoped credential through the existing agent secret lane; stamp cli | Same live policy; OS uid, flags and localhost access alone grant no org rights |
| MCP HTTP | Authenticate each tool call using request headers, bind token subject/client registration to a Principal; stamp mcp from the route, ignore client-supplied identity/source fields | Same policy; client name, MCP initialize metadata and an established connection never substitute for membership |
| Sidecar | Existing launch token identifies the local channel; bind it to the enrolled operator and selected org/workspace; stamp sidecar | Channel token alone is insufficient; missing enrollment denies vault-sync access |
| System worker | Dedicated configured service principal + explicit per-org/workspace grant; stamp system | No implicit all-org bypass; initiation and worker permissions are distinct |

The current sidecar only compares an Authorization header with its launch
token (`apps/professional-desktop/server/RpcSessionAuth.ts:32-60,92-132`).
Its HTTP runtime registers the RPC group and auth layer
(`server/main.ts:72-98`, relative to the same app).
That is reusable channel authentication, not an org-membership service.

Validate active membership independently of public-id/key spelling (D14).
Caller-selected org/workspace fields never become trusted merely because they
decode. Recheck action permission for commands at dispatch; domain decide
checks resource scope and business invariants. Offline intents retain stable
command ids, not an old authorization grant; reconnect reauthenticates (D8).

## 3. Wiring one Api and its transport surfaces

Assemble one `VaultSyncModel` and one `VaultSyncApi` in documents use-cases.
Use explicit command and View name lists, with `streams: []` and
`aggregates: []`: omitted lists expose all eligible members
(`src/Api.ts:80-96,1198-1236`). Apply Session on every command and View
contract. An Api-wide label alone does not protect an entry
(`src/ReadRpcs.ts:82-89`).

### Commands and the current RPC mapping

The following new command names are proposed; PR 3a owns their final spelling.

| Current RPC | HTTP/CLI replacement | Read result and compatibility |
| --- | --- | --- |
| TriggerVaultSync | RequestVaultSync command on destination; starts the PR 3b pass | Receipt immediately; then VaultSyncStatus, optionally atLeast the receipt |
| GetVaultSyncStatus | VaultSyncStatus.get/snapshot | forceProbe=true becomes explicit RefreshDestinationConnection command, HTTP/CLI only; MCP reads cached status |
| ListVaultSyncConflicts | OpenConflicts.get/list | Public conflict ids and safe DTOs; no raw entity dump |
| MarkVaultSyncConflictReviewed | ReviewSyncConflict command on public conflict id | Receipt + OpenConflicts refresh; temporary numeric mapping verifies org/workspace before dispatch |

Current definitions and wiring:
`packages/documents/use-cases/src/aggregates/Sync/Sync.rpc.ts:148-152,
169-173,190-194,211-236`;
`apps/professional-desktop/src/sync/VaultSyncOrchestrator.ts:75-123`.
Current forceProbe refreshes external availability state; do not smuggle it
into a read-only MCP tool. Destination setup commands (RegisterDestination,
RenameDestination, PauseDestination, ResumeDestination) go on HTTP/CLI after
PR 3a defines them. Lease, cursor, observation, retry and worker-completion
commands remain internal to the Model. UI compatibility handlers invoke this
same Api; they do not keep the old engine as a second writer.

### Views and operations

| View | Key and audience | HTTP / CLI | MCP |
| --- | --- | --- | --- |
| VaultSyncStatus | Org/workspace/destination; member | get, snapshot, list, watch, events | get, snapshot, list |
| OpenConflicts | Org/workspace/destination; member | get, snapshot, list, watch, events | get, snapshot, list |
| DestinationList | Org; member; safe destination summaries only | get, snapshot, list, watch, events | get, snapshot, list |
| OperationQueue | Org/workspace/destination; sync diagnostics permission | get, snapshot, list, watch, events | get, snapshot, list with same diagnostics permission |

A single Api cannot conditionally hide fields by transport. Each View is safe
for its declared audience; add a separate View if a future audience needs a
different shape. History exposes only safe emitted View events, never the
aggregate stream. list is the View's emitted-entry history, not automatically
pagination over an array in its state; PR 3a must define that representation
(`src/ReadRpcs.ts:144-249`; `src/Api.ts:698-745`).

HTTP: `Http.toHttpApi(VaultSyncApi)` returns group/api/layer/layerFor
(`src/Http.ts:46-59,316-365`). Compose its group in the host's HttpApi and
generate OpenAPI from that same composed API, including prefix and declared
errors. `HttpApiBuilder.layer(..., { openapiPath: "/openapi.json" })` is the
installed documented route (`skills/alchemy-domain/references/hosting.md:77-99`;
`node_modules/effect/src/http-api/HttpApiBuilder.ts:72,122-128`).
Annotate 401/403/503 errors explicitly; upstream's fallback status is 422
(`src/Http.ts:62-63,320-325`). Commands are POSTs; watch/events are GET SSE
routes with terminal typed failures (`src/Http.ts:194-230`).
Add OpenAPI bearer/cookie security metadata at the host boundary; RPC Session
middleware does not by itself prove that documentation is generated.

CLI: `Cli.toCli(VaultSyncApi, { headers: credentialEffect })` derives the
surface and reads headers per call (`src/Cli.ts:58-70,431-458`).
Use the Api client over the selected HTTP endpoint, or an explicitly
authenticated local in-process host. CLI headers/source labels are not trusted
assertions; bind cli to the credential's allowed channel. Api client/protocol
contracts: `src/Api.ts:374-401,1253-1275`.

### MCP adapter: existing upstream support, restricted repo registration

Beta.85 has `Ai.toMcp` only through `@alchemy.run/domain/Ai`
(`src/Ai.ts:269-310`). It wraps `toToolkit`, which registers all non-stream
operations, including command sends (`src/Ai.ts:173-185,212-242`).
Options only customize headers (`src/Ai.ts:48-57`); there is no commands-off
switch. Calling toMcp on the full Api violates D13.

Build a small documents-server adapter registering exactly the twelve
View × get/snapshot/list tools above. Take payload/success/error schemas
from the existing Api.group's read RPCs; invoke the corresponding namespace
on that Api's in-process client with per-call authenticated headers.
The client and RPC group are public Api surfaces
(`src/Api.ts:361-372,415-430`); upstream does the same read invocation
(`src/Ai.ts:161-170`). Use a closed table of read RPC tags; fail registration
if a tag is missing, streaming, or outside the four View namespaces.
Never derive the allowlist by rejecting names containing "command".
No second Domain.Api, duplicated policy, generic RPC forwarding tool, SQL
reader, raw event tool, watch tool or command tool.

Reuse Effect MCP and the repo's sanitized tooling registration pattern:
`packages/drivers/m365-mcp/src/Server.ts:8-15,70-96,123-130` uses
`@beep/mcp-kit` and `effect/ai/McpServer`.
Search included McpServer and effect/unstable/ai usages; the existing source
uses the dedicated `effect/ai/*` leaves. Register read-only tool annotations
and client-safe typed failures. HTTP MCP forwards the call's credentials;
stdio, if added, uses an enrolled identity per process, never an anonymous
System principal. Protocol registration follows the existing MCP kit.

## 4. View authorization and revocation

Every View declares Session, ScopeDenied/AuthorizationUnavailable, and a
validate function. `Read.Request` contains mode and key, not client filters;
filters only narrow already authorized data
(`src/Read.ts:43-81`). The validator:

1. Reads VaultSyncRequestContext and the live VaultSyncReadAuthorization service.
2. Resolves the requested key's authoritative org/workspace/destination binding.
   Compares it with the requested scope and any state scope. Does this even
   when state is null; absence and guessed foreign ids return the same
   ScopeDenied response without counts, cursor, ownership or existence hints.
3. Checks session validity, current active membership, workspace permission
   and diagnostic permission where applicable. Never treats captured role,
   authenticatedAt, an org prefix or old state as current authorization.
4. Allows only the View's declared read modes and safe DTO/event schemas.

The domain contract is declarative; server owns live membership I/O.
Session provides the live read gate for in-process RPC calls. **Do not put
functions, DB clients or authorization services in RequestContext JSON.**
The Postgres host must also provide that gate in its delivery runtime:
beta.85 Watch restores only schema-backed contexts
(`src/Watch.ts:91-103`). A subscription's serialized identity is an input
to a fresh check, not permission to deliver indefinitely.

This service availability is a required PR 3c/driver integration spike:
prove both Api in-process streaming and driver-delivered Watch validation
can resolve the live service after restore. If the beta.85 host cannot carry
the additional service, implement a scoped server delivery wrapper that
calls the **same** read-authorization contract before initial response and
every emitted frame. Do not replace validate with transport-specific rules.
Until that wrapper is proven on all exposed paths, disable watch/history
routes rather than ship an unauthorizable subscription. This is a proposed
runtime contract, not a claim that beta.85 serializes arbitrary services.

Native behavior matters:

- View get/snapshot validate after loading state; watch validates each
  snapshot before emission (`src/Api.ts:667-700,721-732`).
- View events validates matching historical entries; list authorizes from
  the current state before returning emitted entries
  (`src/Api.ts:702-745`). Stream events follows a similar path
  (`src/Api.ts:634-663`).
- Durable Watch stops with an Exit on validation rejection, but skips
  CaughtUp markers (`src/Watch.ts:98-129,133-140`).
  Therefore validate alone does not guarantee an empty history, a filtered
  history, or a marker is checked before transport output.

All server read entrypoints consequently use a shared authorization preflight
on the selected key before loading/starting a stream or returning any marker,
and a delivery check before flushing each frame/page. MCP and HTTP/CLI invoke
this same path. A caller cannot evade it with where filters, after cursors,
atLeast receipts, list pagination or a null/deleted View. Do not expose the
raw Api RPC endpoint beside the protected adapters unless it has the same
preflight. Do not expose aggregate/Stream history in this Api.

Membership revocation must end an idle subscription too: the hosting scope
listens for access/session invalidation and closes matching subscriptions
with ScopeDenied. Every delivery still rechecks against the authoritative
membership source so a missed invalidation cannot leak a later frame.
Permission lookup failure denies; no stale positive cache fallback.
Define the guarantee as: after revocation commits and the invalidation
barrier is acknowledged, no newly delivered data or history page is allowed.
Already delivered data cannot be recalled. Serialize final delivery with
the access-version barrier so a frame checked before revocation but buffered
afterward is discarded. This stronger contract needs PR 3b's subscription
lifecycle and access-owner invalidation integration; it is not an upstream
automatic revocation guarantee.

History must retain scope binding across deletion: use durable ownership
metadata, never infer access solely from the last projected state.
Org-wide DestinationList requires org membership and emits only destinations
the member may see; if workspace access differs within an org, partition its
key by permitted workspace/audience rather than return a caller-filtered
mixed-visibility org list. Recommend requiring org-wide destination-list
permission for the org key until that partition is defined.

Audit history is separate from public View history. Its future endpoint needs
an explicit audit permission and row-scoped driver read; PR 3c exposes neither
raw driver rows nor platform history. View event history must remain safe even
if a caller once had a higher role: current permissions apply to old entries.

## 5. Test plan: Views are the boundary

Run server boundary tests with real Session + policy and a controllable
membership authority. Reuse cases against Domain.InMemory and the Postgres
driver/PGlite harness; use real Postgres for delivery/restart integration.
Assertions inspect returned bytes/frames and command receipts, not just a
mock validator call. These are proposed tests, not completed checks.

| Named D13 test | Setup and action | Expected denial |
| --- | --- | --- |
| revoked_membership_after_subscription_denies_next_frame | User belongs to A/workspace W; open status and conflicts watch plus resumable events; receive baseline; revoke membership, acknowledge barrier, then publish another event | ScopeDenied terminates each stream; no post-barrier data, buffered frame or cursor; idle watch also closes before another event |
| cross_tenant_key_guessing_denies_every_read_mode | A-only user supplies B destination/conflict/public id, forged A prefix, foreign workspace and numeric compatibility id; test get/snapshot/list/watch/events, null/deleted keys and destination list | ScopeDenied before data or marker; no foreign count, existence hint or receipt; forged shape grants nothing |
| stream_history_denies_revoked_or_foreign_reader | Seed old safe View entries in B; revoked B user and A-only user request after=0, later cursor, list pages, empty/filtered history and deleted View history; attempt raw aggregate/Stream routes | ScopeDenied before history/page/CaughtUp; raw history endpoints absent; previously issued cursor and atLeast receipt grant no access |
| http_cli_mcp_share_one_policy | Feed identical active/revoked/no-membership/diagnostic-role fixtures through real HTTP, CLI and MCP tool invocation, including expired sessions and foreign keys | Same policy outcome for the same principal/scope/action; unauthorized tools return typed denial, CLI nonzero, HTTP declared 401/403; no adapter can choose its own tenant |

Also require:

- provenance_round_trip: HTTP/CLI/sidecar/system commands persist the encoded
  identity with correct channel; audit reads principal/source/time after replay
  and worker restart; MCP attempts to send commands create no receipt/event.
- mcp_registration_is_views_only: tools/list equals the twelve-name allowlist;
  direct calls to command, forceProbe, generic RPC, stream and unknown tool
  names fail. This remains true when PR 3a adds a new Model command.
- session_identity_cannot_be_forged: payload/header claims cannot overwrite
  Principal or channel; cookie/bearer conflict, unbound launch token,
  anonymous stdio and absent enrollment deny.
- live_authorization_survives_context_restore: subscription context stores only
  JSON identity; durable delivery resolves the live gate and sees a membership
  update without resubscribing. Repeat after restart. Missing gate fails closed.
- revocation_flush_race: pause after successful permission lookup, revoke,
  acknowledge invalidation barrier, resume flush; buffered data is discarded.
- history_disclosure_budget: safe emitted View history excludes credential
  refs, local roots, raw Box snapshots and internal events; unknown/null scopes
  cannot become authorization bypasses.
- openapi_and_transport_contract: generated routes/errors match the Api;
  all published routes carry security metadata; safe history/SSE errors and
  bounded pagination behave as documented; no unguarded RPC route is mounted.

Keep package-scoped checks for implementation. This design-only lane runs
manifest generation, document/citation inspection and whitespace/JSON checks;
it does not claim the above suite passed or run repo-wide gates.

## 6. Role files, dependencies, and recommended decisions

Paths below are proposals under existing packages; no new workspace package.

| Package | Proposed role files and responsibility |
| --- | --- |
| documents/domain | root VaultSyncRequest.context.ts, Session.middleware.ts, VaultSyncAccess.service.ts, VaultSyncReadAuthorization.service.ts; schema contracts and typed rejections; aggregates/Sync/{VaultSyncStatus,OpenConflicts,DestinationList,OperationQueue}.view.ts; scoped key/value schemas beside their concepts |
| documents/use-cases | Model.ts and Api.ts composers; aggregates/Sync policies/sagas/projections and dispatch boundary contracts; no Postgres, HTTP or MCP hosting |
| documents/server | Session.ts, VaultSyncIdentityResolver.service.ts, VaultSyncAccess.ts, VaultSyncReadAuthorization.ts, VaultSyncHttp.ts, VaultSyncCli.ts, VaultSyncMcp.ts; live adapters, common preflight/delivery wrapper and Layer.ts composition |
| professional-desktop | server/main.ts HTTP/MCP mounts; src/runtime/Layer.ts app composition and authenticated compatibility adapter; remove old vault-sync write handlers at cutover |
| drivers/alchemy-postgres | existing Platform/event rows, encoded context/audit persistence, subscription restore/delivery hooks; no documents-specific authorization policy |

This follows `standards/ARCHITECTURE.md:1741-1751`: RequestContext and
middleware declarations live in domain; Model/Api in use-cases; hosting in
server. D9's broader "middleware contracts" language is refined by this
explicit role table. Do not duplicate Session in use-cases or add a shared
alchemy facade.

### Dependencies and ownership at the PR boundary

PR 3a supplies the domain aggregates, public id/key schemas, commands,
rejections, safe View DTOs/emitted events and validate contracts. It must agree
on destination/workspace ownership, the operation diagnostic audience, and
whether View list represents emitted-entry history. PR 3c does not rename
or redesign those aggregates independently.

PR 3b supplies the assembled Model's policies/sagas, Box/pass execution,
genesis/numeric mapping, legacy projections and single-writer cutover wiring.
Its exact PR boundary is not codified in PLAN.md's broad PR 3 row; confirm
these handoff symbols with its owner. PR 3c needs stable dispatch receipts,
sidecar-to-destination mapping, correlation propagation, driver provenance
persistence and subscription lifecycle hooks. Deployment cannot leave the old
RPC engine writing alongside the new Model. PR 3c can design and test Session
against InMemory before those integrations land, but cannot call Postgres
subscription or audit acceptance complete without them.

The existing driver PRs supply Platform and SendMeta preservation; shared
membership ownership supplies live grants and invalidation. These are
dependencies, not evidence that a login/membership service already exists.

### Recommendations and reversal paths

| Question | Recommended decision for PR 3c | Reversal |
| --- | --- | --- |
| How distinguish actor category from transport? | Keep existing SourceKind intact; context sourceKind is the transport domain, actorSourceKind reuses the existing value schema; document driver column meaning | Version the request codec and add a migration/upcaster for stored provenance; never rewrite original event provenance |
| How expose only Views from one Api? | Closed MCP tool table over that Api's read RPCs, using repo MCP tooling; do not call Ai.toMcp on the full Api | Replace registration when a pinned upstream release has an explicit allowlist, retaining tests and tool names |
| What supplies local/MCP identity and membership? | Require enrolled identities and current explicit org/workspace grants; reuse the launch token only as channel evidence | Swap the resolver/grant adapter for the eventual auth owner without changing the Api or public ids |
| What guarantees revocation during a read? | Common preflight, live per-delivery policy, invalidation barrier, durable scope binding; close idle streams | Replace the wrapper with native host support only after the same race/history tests pass |
| How handle forceProbe and old conflict ids? | Explicit HTTP/CLI refresh command; temporary scoped numeric-to-public-id adapter | Delete compatibility after clients migrate; keep the explicit refresh command unless product behavior changes |
| How bridge D17 correlation? | One beta.85-specific internal Telemetry.Correlation bridge with round-trip tests | Remove it when upstream offers a public dispatch correlation option; preserve stored correlation ids |

The three most important unresolved integration questions are:

1. **Who owns the live identity and membership authority?** Which existing
   enrollment maps the sidecar launch token, CLI operator and MCP credential
   to a real Principal, and which owner supplies active grants and invalidation?
   Recommend the narrow server resolver/access contracts above, fail closed
   until wired, and keep the adapter replaceable.
2. **Can the PR 3b delivery host supply live authorization after restore and
   enforce the revocation flush barrier?** Beta.85 only proves per-change
   validation of captured context. Recommend the mandatory integration spike
   and common wrapper fallback; withhold unsafe stream/history routes until
   that proof passes.
3. **What is the final PR 3a View/key and history contract?** Confirm ownership
   bindings through deletion, DestinationList audience, OperationQueue
   diagnostics permission and safe emitted history. Recommend explicit scoped
   DTOs/events and no raw streams; reversing those shapes needs a versioned
   public contract and matching security tests.

These recommendations are recorded here for the owning implementation lanes;
this design commit does not change the governing D0-D17 decisions.
