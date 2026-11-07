# PR 3c handoff: one vault-sync Api, live sessions, transports

Branch: `goals/vault-sync-api` (created from `goals/alchemy-vault-sync-api` at
checkpoint `287badb69ae`, a GPT-6.1 Sol checkpoint on top of `b26d09ed9cb` plus
merges of main and #2863). The Opus 5.5 fallback lane (Codex hit its usage
limit) finished the work in the commits after the checkpoint.

**Status: content-final for this lane's ownership.** All five gaps below are
closed in code and tests. Two items stay with other owners and are named under
"Seams" and "Holds": the single-writer mount (cutover lane) and the cache
baseline plus inherited Effect Vitest rows (orchestrator). Local commits only;
no push, PR, Yeet, readiness or monitor ran.

## What PR 3c contains

From the first pass (still true):

- Annotated request identity (`VaultSyncRequest`, v1 `RequestContext`) with
  principal, transport kind, actor kind, org/workspace, correlation and a
  non-secret session reference. No grant, token or service in the context.
- `Session` middleware on every exposed command and View; the shared policy
  resolves authoritative ownership independently of key spelling, compares it
  with the request scope and reads current grants. OperationQueue requires the
  diagnostics grant.
- One `VaultSyncApi` over `VaultSyncPassModel` with explicit lists, `streams: []`
  and `aggregates: []`. Generated HTTP endpoints with 403 documentation,
  OpenAPI, the CLI, and a closed twelve-tool Views-only MCP registration.
- The delivery combinator: key preflight, one frame per chunk, live
  authorization before each frame, and idle-stream end on revocation.
- DestinationList partitioned by `org:workspace` (pre-publication key break).

Closed by the fallback lane:

| Gap | Result | Files |
| --- | --- | --- |
| 1. Production identity and membership | Per-route `SessionResolver` adapters: launch token for HTTP (`http`), the gated RPC endpoint (`cli`) and MCP (`mcp`); a channel adapter for the desktop RPC surface (`sidecar`); the local operator for in-process CLI (`cli`). The route fixes the transport kind; headers prove only the token and carry a correlation id. Grants come from active, undeleted `shared_membership` rows joined to the workspace's org, read on every call and frame. Owner role carries diagnostics. No stub in a production Layer. | server `VaultSyncSession.ts`, `VaultSyncSession.repository.ts` |
| 2. Pass and probe initiators | `RequestVaultSync` and `ProbeDestination` destination commands with Session; the `VaultSyncRequests` policy starts `VaultSyncPass` under `destination/event/requestId`; the probe run executes only the BoxMirror probe activity. A paused destination refuses a pass, not a probe. | domain `VaultSyncRequest.command.ts`, `SyncDestination.aggregate.ts`; use-cases `VaultSyncRequests.policy.ts`, `Api.ts`, `VaultSyncPass.saga.ts`; server `VaultSyncPass.saga-handlers.ts`, `BoxMirror.ts` |
| 3. Desktop caller migration | `VaultSyncRpcsApiLive` implements the four `VaultSyncRpcs` over the protected Api with the legacy wire unchanged. Workspace maps to its destination through the authorized DestinationList. Conflict rows come from the legacy SQL read model, restricted to public ids the authorized OpenConflicts View returns; review resolves the numeric id through those rows and sends ReviewConflict. It never writes legacy tables. The desktop gets `makeVaultSyncTransportLayer` and the launch binding for the signed-in principal. | server `VaultSyncRpcs.api.ts`; desktop `server/VaultSyncTransport.ts` |
| 4. Remote CLI | `/vault-sync/rpc` serves the Api's RPC protocol with handlers forwarding each RPC to the protected delivery client, so watch/events pass the same gate. The raw Api fetch the checkpoint mounted is gone. `vaultSyncRemoteCli({ url, headers })` and `desktopVaultSyncRemoteCli(port)` read the launch token per call from `BEEP_DESKTOP_RPC_SESSION_TOKEN`, redacted. The in-process CLI uses `VaultSyncLocalOperatorLive`. | server `VaultSyncApi.ts`; use-cases `Api.ts`; desktop `server/VaultSyncTransport.ts` |
| 5. Revocation barrier over real transports | HTTP SSE watch: after the membership row is soft-deleted, a commit made right after the barrier never reaches the client and the stream ends with a typed `ScopeDenied` event. Idle SSE watch closes with the typed denial. The gated RPC watch (the remote CLI protocol over fetch) fails with `ScopeDenied` after exactly one frame and zero post-barrier frames. MCP: a tool read is allowed, then denied with `ScopeDenied` after revocation; command tool names fail. | server `test/VaultSyncApi.transport.test.ts` |

Decision files (2026-11-07): `api-identity-adapters` (supersedes the identity
hold), `api-gated-remote-cli`, `api-legacy-rpcs-through-api`,
`api-desktop-membership-provisioning`, `api-probe-via-pass-saga`, plus the
checkpoint's `sidecar-session-authority`. The SPEC Decision log projection was
regenerated with `goals decisions write` (drift 0).

## D13 security tests

All pass:

- Revoked membership after subscription: SSE watch, idle SSE watch, gated RPC
  watch, the in-process delivery gate with an upstream buffer, and the compat
  RPCs after revocation.
- Cross-tenant key guessing: foreign destination, unregistered key, foreign
  and mismatched DestinationList partitions, foreign workspace on the compat
  RPCs, foreign pass initiator, remote CLI with a foreign key.
- Stream history: foreign `events` over HTTP answers 403 before any page;
  revoked `list` answers 403 with `{ _tag: "ScopeDenied" }`; the in-process
  events read emits nothing before the denial.
- One policy over CLI, MCP and HTTP: the same adapters and policy deny the same
  principal and key across the generated HTTP endpoint, the generated CLI
  (in-process and remote), the MCP tool and the in-process client for every
  transport kind.

## Verification

- Tests: domain 47 (11 files), use-cases 76 (11 files), server 204 (22 files),
  desktop targeted 31 (7 files, sync, RPC auth, ontology MCP and the new
  transport test) plus the ontology MCP HTTP integration file (9).
- `quality package-verify` (full: lint, audit, docgen) passes for
  documents-domain, documents-use-cases, documents-server and
  professional-desktop.
- Coverage gate for the three documents packages: ok, no floor lowered. New
  source identities added with `--add-missing-files-only`. Measured
  statements/branches/functions/lines: domain 94.37/67.74/95.65/96.40,
  use-cases 100/100/100/100, server 94.05/78.53/90.55/95.22. The checkpoint's
  uncovered `BoxMirror.probe` got a test instead of a floor change.
- `laws entity-kit-freeze --check`: zero findings.
- Lane scoped scans (`research/pr3c-scoped-lints.py --base 5b8d9cee35`):
  schema-first zero introduced/parity/LiteralKit findings over 39 roots;
  effect-vitest zero new findings.
- No repo-wide gate, hosted CI, real Postgres, live Box or browser QA ran.

## Seams for the cutover lane (PR 3b part 2)

1. **Mount.** `RuntimeLive` still provides the legacy `VaultSyncHandlersLive`.
   The flip is a layer swap to `VaultSyncRpcsApiLive` plus
   `VaultSyncRpcOrganization` (org 1), `VaultSyncSidecarChannelLive`,
   `VaultSyncSessionLive`, `layerDesktopVaultSyncBinding(token)` and
   `VaultSyncMembershipLive`, over the hosted `VaultSyncPassModel` on the sidecar
   PGlite. Mount `makeVaultSyncTransportLayer({ token })` inside the served
   router in `server/main.ts`'s HTTP branch next to the ontology MCP layer. This
   is the single-writer activation and belongs to that lane with genesis.
2. **Membership rows.** The desktop migration bundle has no `shared_membership`
   table. Activation must add it and seed an active owner row for user 1 in
   org 1, or every adapter denies (fail closed, by design).
3. **Semantics change at the flip.** TriggerVaultSync and forceProbe answer with
   the status at acceptance; the pass completes in its saga. The panel already
   re-reads status through its reactivity keys.
4. **IPC mode.** An IPC sidecar serves no HTTP, so the remote CLI cannot reach
   it there; the in-process CLI is the path.

## Holds for the orchestrator

- **Cache baseline.** The server-only request
  (`cache-baseline-request-pr3c.json`, refreshed digest and review basis) is
  refused: "Unreviewed: //, @beep/documents-use-cases". Those are inherited
  from the PR 2b/3a/3b stack. Cache audit: eight configuration-drift rows,
  four each for documents-server and documents-use-cases. The lane did not
  re-review inherited subjects or hand-edit the baseline.
- **Inherited Effect Vitest rows.** The full `lint effect-vitest` scan reports
  eight rows not in the inventory, all in stack files this lane did not touch:
  seven in `LegacySync.projection.pglite.test.ts` (EV002 x6, EV010) and one in
  `VaultSyncPass.pglite.test.ts` (EV010). The inventory on this branch also
  lags main (a full `--write` re-keys unrelated rows), so the lane added only
  its own BoxMirror EV010 exception row with a reason and did not run a full
  rewrite.

## Outside owned files

`apps/professional-desktop/server/OntologyMcpTransport.ts` now exports
`desktopMcpSecurityMiddleware` and `ontologyMcpAllowedOrigins` so the vault-sync
MCP route authenticates the same way; behaviour is unchanged and the ontology
MCP integration test passes. `RpcSessionAuth.ts` adds
`DesktopRpcSessionTokenRequired` for the remote CLI.

## Stack fixes on `goals/vs-api` (2026-11-07)

Branch `goals/vs-api` was cut from `a6eee3aafb9`. It merges `goals/vs-saga`, so it
carries #2886's opaque `DestinationId`, hashed reservation keys and the 3b1 fixes.

- **Opaque ids in 3c code.** Every 3c fixture now uses a minted
  `documents_sync_destination_<cuid>` id. The security test's foreign-key HTTP
  guess now sends a well-formed foreign id, so the 403 comes from the scope
  check, not from id decoding.
- **D17 F5.** `RequestToken` (`^[A-Za-z0-9_-]{1,64}$`) is the schema of
  `requestId` on `RequestVaultSync`, `ProbeDestination` and both request events.
  A domain test rejects paths, spaces, empty strings and 65 characters.
- **D17 F6.** The session adapter keeps `x-correlation-id` only when it is a
  `RequestToken`. Otherwise it mints `corr_<time>_<random>`, which no longer
  includes `sessionRef` or a colon. The transport test shows a path-like header
  replaced by a minted token.
- **D17 F8.** The v1 context has a string `principalKey` (`User:<id>`, built by
  `principalKeyOf` for every principal kind). The adapter always derives it
  from the bound principal. `VaultSyncProvenance.pglite.test.ts` sends a
  Session-gated command through the Api over the real driver with
  `principalField: "principalKey"` and reads the event row: `principal =
  "User:5"`, `source_kind = "http"`. The 3b2 host must mount that mapping.
- **I14 correction restored.** `reviewCorrection({ record, item })` (a schema
  `Fn`) derives a corrective `moveItem`/`renameItem` for a reviewed remote move
  or rename of a tracked item that has a remote id. Its operation id is stable
  per conflict and its generation is the item's plus one. The legacy RPC review
  reads the item from the authorized status View and sends the correction.
  `ConflictReviews` queues it, gives the tracked item the corrective slot
  (`ReturnItemToPending` accepts an optional `type`), then closes the review.
  `VaultSyncRpcs.api.test.ts` reproduces the old engine. When the RPC is
  reverted to `correction: null`, it fails with `uploadFileVersion` instead of
  `moveItem`. A use-cases scenario covers rename, and domain tests cover the
  edit, untracked and no-remote-id cases.
- **Status completion signal.** A new streaming RPC, `WatchVaultSyncStatus`, is
  served by forwarding the gated `VaultSyncStatus.watch` delivery stream, so
  every frame is authorized live. Each frame is mapped to the legacy status
  shape. The desktop `vaultSyncStatusAtom` subscribes to it and keeps its
  reactivity key. The legacy handler answers one final frame. The server test
  denies the stream without membership, then sees the pending count go from 0
  to 1 after an item is observed. The desktop atom test sees the
  accepted-then-finished frames on one subscription.
- **Hygiene.** Template strings replace concatenation in the four View
  validators (a new biome rule after the main merge). The request events carry
  the same `schemaVersion` fallow-ignore as their siblings. `VaultSyncSession`'s
  scope has a separate conflict-scope helper, which keeps fallow cognitive at or
  below 8. The unused `desktopVaultSyncRequest` export is now module-private.
- **Cache policy.** The documents-server mcp-kit and shared-tables edges are
  recorded through `cache-baseline-request-pr3c-saga.json`, which supersedes the
  refused `cache-baseline-request-pr3c.json`. Policy reports 0 blocking findings.

Verification on this branch: package-verify (lint, audit, docgen) passes for
documents-domain, documents-use-cases, documents-server and professional-desktop.
The coverage gate is ok for the three documents packages: domain 56, use-cases 78
and server 196 tests under coverage. The desktop sync atoms test has 3 tests and the
other desktop tests pass. Fallow dead-code, health and audit exit 0. Effect Vitest
reports introduced=0. Entity-kit freeze reports 0 findings. tsconfig-sync reports no
drift. Docs oxlint is clean on the touched sources. The scoped schema-first scan
exits 0.
