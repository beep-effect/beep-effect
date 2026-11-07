# PR 3c local API implementation handoff

Branch: `goals/alchemy-vault-sync-api`.
Base: requested saga head `68763f20fe2473180146999b6c8001604ac0c61e`.
Local merge of `origin/main`: `5b8d9cee3573c6d05bad89c4acb88a093e1db87a`.

**Status: HOLD, incomplete PR 3c.** This is a locally committed API/security
implementation, not a claim that the full assigned slice is ready for publication.
The orchestrator owns publication. No push, PR, Yeet publication, readiness,
monitoring, genesis, replay/diff, cutover or drizzle-write modification occurred.

## What landed

- Three requested decisions: one SessionResolver for verified identity and current
  grants; live delivery revocation; member Views versus diagnostic permissions.
- Annotated schemas and a v1 alchemy RequestContext for principal, transport source,
  actor category, org/workspace, correlation and non-secret session reference.
  The context contains no captured grant, bearer token or database service.
- Session middleware on every exposed command and View. The live policy resolves
  authoritative ownership independently of key spelling, checks it against request
  scope, then reads current grants. Missing context/resolver, wrong tenant,
  inactive membership and insufficient diagnostics grants deny uniformly.
- Session hosting provides the request context around dispatch and bridges the
  installed beta.85 Correlation service. A recording Platform test observes the
  resulting principal/source/scope JSON and correlation in SendMeta.
- One VaultSyncApi over VaultSyncPassModel. Its explicit public command list is
  ClaimDestinationName, RecordConflict, PauseDestination, ResumeDestination and
  ReviewConflict. Trusted confirm/register, lease, worker and completion commands
  remain unexposed. Aggregate and raw Stream history are disabled.
- Generated HTTP endpoints, 403 denial documentation, OpenAPI document and CLI
  constructor. The HTTP host uses a protected in-process delivery client.
- Closed MCP registration for exactly twelve get/snapshot/list tools across the
  four Views. It reuses beta.85's read-RPC-to-tool schema adapter on a fixed
  four-View projection of the same Api and the repository sanitizedToolkit.
  It never calls Ai.toMcp on the full Api, creates a second Domain.Api, registers
  a generic forwarding tool or registers command/watch/events tools.
- A delivery combinator preflights the key, rechunks upstream data to one frame,
  checks live authority before each frame (including history markers), and ends
  idle subscriptions through the resolver's typed revocation signal.
- DestinationList now partitions by org:workspace, using WorkspaceKey. The old
  org-only partition could disclose destinations from another workspace. This
  pre-publication key break is recorded; no desktop caller uses this alchemy View.
- mcp-kit dependency and generated server tsconfig/Fallow edges. Coverage source
  identities were added with add-missing-files-only; no existing floors lowered.

## Main files

| Responsibility | Files |
| --- | --- |
| Serializable identity and resolver contract | domain aggregates/VaultSync/Session.context.ts |
| Shared key/grant policy and middleware declaration | domain aggregates/VaultSync/Session.middleware.ts |
| Entry-point protection | five initiating command files and the four public View files |
| Workspace list partition | domain aggregates/VaultSync/Values.ts and DestinationList.view.ts |
| Single API and CLI | use-cases aggregates/VaultSync/Api.ts |
| Session/HTTP/OpenAPI/final delivery | server aggregates/Sync/VaultSyncApi.ts |
| Closed MCP registration | server aggregates/Sync/VaultSyncMcp.ts |
| Security and provenance tests | server test/VaultSyncApi.security.test.ts |
| Policy branch and validator tests | domain test/VaultSyncSession.test.ts |
| API allowlist test | use-cases test/vault-sync/api.test.ts |
| Scoped canonical lint adapter | research/pr3c-scoped-lints.py |

The domain-only and policy scenario tests were adjusted for WorkspaceKey.
There are no new entity-kit imports and no dependency on reference alchemy HEAD.

## Verification and limits

- Focused security suite: 10 passing tests. It covers cross-tenant key guessing,
  foreign history before any output, buffered-frame revocation, idle typed
  revocation, member diagnostic denial, identical policy across all four source
  kinds, exactly twelve closed MCP tools and SendMeta provenance/correlation.
- Transport tests exercise a real generated HTTP endpoint through a web handler,
  the generated CLI parser with an in-process Api client, and sanitized MCP
  registration through the existing in-process streamable HTTP conformance host.
  These use synthetic verified identities/grants. They do not prove production
  cookie/bearer verification, desktop enrollment or an external CLI RPC deployment.
- The buffered-frame test puts a buffer upstream of the delivery gate. Production
  hosts must not add a downstream buffer. The live grant owner must implement
  revocation notification/barrier semantics; a synthetic signal does not prove a
  production membership-commit barrier or browser/network buffer cancellation.
- Canonical schema-first scan: 23 touched TypeScript roots, 18 production files,
  zero introduced/parity/LiteralKit findings.
- Canonical Effect Vitest scan: the same 23 roots, zero findings. The committed
  adapter extends PR 3a's bounded source discovery to documents-server, retaining
  detector implementations and baseline semantics. Use --base 5b8d9cee35.
- Package verification: all three touched packages pass lint, audit/build/source and
  test checks, and docgen. The combined final run passed use-cases and server; its
  domain test typing failure was fixed and the domain verifier then passed separately.
- Full scoped coverage regression gate: PASS for all three packages, 46 domain tests,
  74 use-case tests and 180 server tests. Final measured lines/statements/branches/
  functions: domain 96.33/93.94/67.03/94.77; use-cases 100/100/100/100; server
  95.07/94.11/79.12/90.05. Add-missing-files-only wrote five new source identities.
  A before/after metric comparison found zero lowered existing package/file floors.
- Whitespace check and packet decision/research projections pass.
- Earlier formatting, docgen, test typing, canonical lint and View file-coverage
  failures were fixed. The final checks above supersede them.
- No repo-wide gates, hosted CI, live Box, real Postgres, browser QA, independent
  review or production authentication test ran.

## Cache baseline hold

The baseline file is exactly main's baseline after the local main merge.
The server-only reviewed request is committed as
`cache-baseline-request-pr3c.json`, with its hashed review basis.

The required recorder was attempted and refused:

> Baseline review does not cover the changed subjects. Unreviewed: //,
> @beep/alchemy-postgres, @beep/documents-use-cases.

The lane did not broaden its review to unrelated inherited subjects or hand-edit
the baseline. Cache audit has 12 blocking configuration-drift rows, four each for
alchemy-postgres, documents-use-cases and documents-server; the root source row
is advisory. This is no longer the old global drift episode. The orchestrator
must reconcile the stack's retained PR 2b/3b dependency reviews with main, then
refresh and apply this lane's server-only request. No qualification was granted.

## Remaining work before this can be called PR 3c complete

1. Implement and compose the host SessionResolver. Its resolve method must use
   the actual HTTP credential verifier, signed-in desktop enrollment, enrolled
   local CLI operator and configured MCP client identity. grants must read
   current active membership; scope must resolve authoritative destination,
   operation/conflict and workspace ownership, including absent keys. revoked
   must fail with ScopeDenied after live invalidation, with a tested commit barrier.
   There is deliberately no permissive default Layer.
2. Add public destination-scoped pass and connection-refresh initiators. The
   current saga starts explicitly; the API does not yet expose RequestVaultSync
   or RefreshDestinationConnection. Do not expose worker/internal commands as a
   shortcut, and do not hide a probe mutation inside an MCP read.
3. Wire desktop/sidecar callers from research/03 section 4 through the same Api.
   They currently still call VaultSyncEngine through VaultSyncOrchestrator.
   Resolve legacy numeric conflict IDs through an authoritative scoped mapping
   and adapt DTOs or record/implement the wire break. No caller migration is claimed.
4. Finish remote CLI hosting. The generated CLI uses the Api RPC protocol; the
   plain JSON HTTP/OpenAPI adapter is a distinct encoding. The CLI parser test
   uses the in-process Api client. Do not mount the unwrapped generic Api fetch
   beside the protected adapters: streaming final delivery must use the same gate.
5. Prove View subscriptions after driver context restoration in a hosted database
   runtime with its live resolver, and verify actual transport cancellation at
   the revocation barrier. The recording test proves initiating SendMeta only.
6. Clear the scoped cache baseline hold, run final acceptance and have the
   orchestrator publish. This handoff does not declare content-final.

## Findings outside owned files

The missing desktop principal/enrollment and membership-owner runtime are observed
hosting gaps, not proof that a launch token can authorize organization access.
No unrelated repair PR was opened because this assignment expressly prohibits PRs.
The existing legacy writer remains untouched, as required by the separate cutover
lane's ownership. Friction receipts are in OPPORTUNITIES.md.
