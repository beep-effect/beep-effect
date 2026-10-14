# Codex research-gate critique — local-first-projection-sync (2026-06-29)

## Blocking

### B1 — FalkorDB license hazard is omitted
**Claim:** "`ElectricSQL = Apache-2.0`; `Yjs = MIT`; `Zero = own protocol` — all are clean-license but **explicit no-gos for the current appetite** (sync-engine scope), so the license question is moot until a multi-device roadmap revives them." (`RESEARCH.md`, "Licensing gravity — reimplement, never copy")

**Claim:** "the app write path must emit one typed refresh event that **both** the UI projection and any future FalkorDB projection consume." (`RESEARCH.md`, "Authority / projection / offline boundary")

**Problem:** The licensing section inventories ElectricSQL, PowerSync, Yjs, Zero, and TalentScore, but not FalkorDB, even though the proposal repeatedly names FalkorDB as a future projection consumer. FalkorDB is not a neutral omitted detail: its upstream repository declares SSPLv1 (`https://github.com/FalkorDB/FalkorDB/blob/master/LICENSE.txt`). That may be acceptable for a local sidecar or internal dev service, but it is a license/commercial-distribution question that should be explicit before the research says the "license question is moot."

**Fix:** Add a FalkorDB licensing row. State whether this wedge introduces no FalkorDB runtime, only a refresh event, and require legal/architecture review before bundling, hosting, or distributing a FalkorDB-backed projection.

### B2 — Existing PGlite / SQL / Atom reactivity route is not evaluated
**Claim:** "the build-it path (per-user registry + streaming RPC over the existing transport) is the right size; every buy-it sync engine assumes a shared Postgres + multi-device fan-out that is an explicit no-go at one user." (`RESEARCH.md`, "Net external read")

**Claim:** "`@effect/atom-react` (v4.0.0-beta.91) + `effect/reactivity` `Atom` are wired in `apps/professional-desktop/src/runtime/ProfessionalAtomRuntime.ts` ... The client side that consumes the subscription stream and invalidates UI projections is the existing Atom runtime." (`RESEARCH.md`, "Client projection-refresh substrate — ALREADY EXISTS")

**Problem:** The research jumps from "Atom runtime exists" to "custom hub is right-sized" without comparing the repo's existing reactive-query path. Local proof:

```text
$ rg -n "reactiveMailbox|reactive:" node_modules/effect/dist/sql/SqlClient.d.ts
40: * Use the Reactivity service from @effect/experimental to create a reactive
43:    readonly reactive: <A, E, R>(keys: ..., effect: Effect.Effect<A, E, R>) => Stream.Stream<A, E, R>;
48:    readonly reactiveMailbox: <A, E, R>(keys: ..., effect: Effect.Effect<A, E, R>) => Effect.Effect<Queue.Dequeue<A, E>, never, R | Scope.Scope>;

$ rg -n "listen|notify|SqlClient" packages/drivers/pglite/src/PgliteClient.service.ts node_modules/@effect/sql-pglite/src/PgliteClient.ts
packages/drivers/pglite/src/PgliteClient.service.ts:26: * `dumpDataDir`, `listen`/`notify`) beyond the generic SQL client surface.
packages/drivers/pglite/src/PgliteClient.service.ts:123:): Layer.Layer<PgliteClientValue | Pg.PgClient | SqlClient.SqlClient, PgliteError> => {
node_modules/@effect/sql-pglite/src/PgliteClient.ts:61: * PGlite-backed PostgreSQL client service, extending `SqlClient` with access to the PGlite instance, JSON fragments, LISTEN/NOTIFY...
node_modules/@effect/sql-pglite/src/PgliteClient.ts:71:  readonly listen: (channel: string) => Stream.Stream<string, SqlError>
node_modules/@effect/sql-pglite/src/PgliteClient.ts:72:  readonly notify: (channel: string, payload: string) => Effect.Effect<void, SqlError>

$ rg -n "reactivityKeys|Reactivity\\.mutation|invalidateUnsafe" packages/agents/client/src/Chat.atoms.ts
140:  ChatClient.query(
144:      reactivityKeys: [THREADS_KEY, workspaceThreadsKey(workspaceId)],
181:  ChatClient.query("GetTimeline", { threadId }, { reactivityKeys: [timelineKey(threadId)] })
200:    const thread = yield* Reactivity.mutation(client("CreateThread", input), [
494:    yield* Reactivity.mutation(
529:          reactivity.invalidateUnsafe(turnKeys);
```

This does not prove a hub is unnecessary. It does prove the current PGlite/UI projection already has repo-native invalidation primitives that may narrow the hub to cross-window/server-originated invalidation only. Without that comparison, the "net-new hub" conclusion may overbuild the first slice.

**Fix:** Add a comparison table for: existing Atom RPC invalidation, `SqlClient.reactive` / `reactiveMailbox`, `PgliteClient.listen` / `notify`, and custom `EventStreamHub`. Name the event sources each path covers and the exact reason the hub is still required.

### B3 — "Drop-in / few files" understates integration complexity
**Claim:** "A `SubscribeProjectionEvents` streaming RPC whose handler returns a queue-backed-stream is therefore a drop-in addition to the existing RPC surface — no new transport/serialization/scope machinery." (`RESEARCH.md`, "Effect RPC supports streaming responses / server push as first-class")

**Claim:** "A `Mailbox.toStream()`-backed subscription RPC reuses all of it — attaching is a few files, standing up a standalone transport packet is duplication." (`research/eventstreamhub-projection-fanout-and-attach-vs-standalone.md`, "The load-bearing DECISION — attach vs standalone")

**Problem:** Existing transport is real, but the research itself still defers the subscription RPC home: "Subscription **RPC contract** placement — `@beep/agents-use-cases` ... vs `@beep/workspace-use-cases` — is an **UNRESOLVED** slice-ownership call..." (`RESEARCH.md`, "Routing cautions"). The "drop-in" wording also hides work that will decide correctness: user/session identity, event schema and authorization, Queue capacity/backpressure policy, post-commit hook placement across Drizzle and in-memory ThreadStore implementations, subscription finalizer tests, multi-window Tauri identity, stale/reconnect behavior, and observability.

**Fix:** Replace the "drop-in / few files" claim with an explicit implementation checklist and a rough effort estimate. Keep "transport exists" as the proven fact, but treat connection lifecycle and invalidation semantics as design work.

## Advisory

### A1 — False inventory: FalkorDB appears in repo source, not only docs/env
**Claim:** "FalkorDB driver / client code — **NOT FOUND** as code: no `packages/drivers/falkordb`, no FalkorDB client in any `src`. FalkorDB appears only in `docs/`, `standards/`, and `.env.example` as architecture/vision." (`RESEARCH.md`, "Genuine gaps — NOT FOUND in repo src")

**Problem:** The driver/client absence is mostly right, but the absolute "appears only in docs/standards/.env.example" statement is false. Repo checks:

```text
$ ls packages/drivers/falkordb packages/tooling/tool/cli/src/commands/Graphiti/internal
ls: cannot access 'packages/drivers/falkordb': No such file or directory
packages/tooling/tool/cli/src/commands/Graphiti/internal:
ProxyConfig.ts
ProxyOps.ts
ProxyRuntime.ts
ProxyServices.ts

$ rg -n "falkordb|FALKOR|FalkorDB|GRAPH\\.QUERY" packages/tooling/tool/cli/src packages/drivers apps packages --glob '**/src/**/*.{ts,tsx}'
packages/tooling/tool/cli/src/commands/Graphiti/internal/ProxyOps.ts:83:const GRAPHITI_FALKOR_SERVICE = "falkordb";
packages/tooling/tool/cli/src/commands/Graphiti/internal/ProxyOps.ts:84:const GRAPHITI_BROWSER_SERVICE = "falkordb-browser";
packages/tooling/tool/cli/src/commands/Graphiti/internal/ProxyOps.ts:233:      "GRAPHITI_PROXY_FALKOR_CONTAINER",
packages/tooling/tool/cli/src/commands/Graphiti/internal/ProxyOps.ts:234:      envValue("FALKOR_CONTAINER", "graphiti-mcp-falkordb-1")
packages/tooling/tool/cli/src/commands/Graphiti/internal/ProxyOps.ts:743:  yield* requireOutputContains(composeText, "/var/lib/falkordb/data", "docker-compose.yml data mount");
packages/tooling/tool/cli/src/commands/Graphiti/internal/ProxyConfig.ts:205:  const falkorContainer = yield* Config.option(Config.string("GRAPHITI_PROXY_FALKOR_CONTAINER"));
```

This does not mean a reusable FalkorDB projection client exists. It means the inventory missed repo-owned Graphiti/FalkorDB operational precedent.

**Fix:** Rewrite the gap as: "No domain/projection FalkorDB driver found; repo does contain Graphiti MCP/FalkorDB proxy orchestration under `packages/tooling/tool/cli/src/commands/Graphiti/internal`."

### A2 — Raw research still contains a false SynchronizedRef citation
**Claim:** "The concurrency primitives the shape needs already ship and are already used in this repo: `SynchronizedRef` and `MutableHashMap` appear in `packages/foundation/capability/nlp/src/Graph/*`, `packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts`, and `packages/foundation/modeling/schema/test/MutableHashMap.test.ts`." (`research/eventstreamhub-projection-fanout-and-attach-vs-standalone.md`, "Effect-native primitives the shape maps onto")

**Problem:** The synthesis corrected this by saying `SynchronizedRef` is not used in repo `src`, but the raw research remains linked from `RESEARCH.md` and still asserts the false citation. Repo check:

```text
$ rg -n "SynchronizedRef" packages apps --glob '**/src/**/*.{ts,tsx}'
# exit 1, no matches
```

**Fix:** Amend the raw research note to say only `MutableHashMap` is in-repo-proven; `SynchronizedRef` exists in Effect v4 but has no current repo usage.

### A3 — PowerSync release fact is stale in raw research
**Claim:** "PowerSync Service v1.22.0 shipped 2026-06-04; SOC 2 + HIPAA reached Jan 2026." (`research/eventstreamhub-projection-fanout-and-attach-vs-standalone.md`, "Alternative 2 — PowerSync")

**Problem:** The official PowerSync release feed now shows newer service releases after v1.22.0, including v1.23.0 on 2026-06-20 and v1.23.1 on 2026-06-25 (`https://releases.powersync.com/announcements/powersync-service`). The synthesized `RESEARCH.md` avoids the exact version, but the linked raw file and source list are stale as of 2026-06-29.

**Fix:** Either remove exact release numbers from raw research or refresh them to the latest available release date when the packet graduates.

### A4 — Zero "multi-quarter platform commitment" is unsupported
**Claim:** "Rocicorp Zero — query-driven (own ZQL, own `zero-cache` server, own protocol, rebase-on-conflict), reached 1.0 June 2026, treated as a 'multi-quarter platform commitment'." (`RESEARCH.md`, "Sync engines")

**Problem:** The ZQL / `zero-cache` / protocol facts are cited, but "treated as a multi-quarter platform commitment" is not attributed to a specific source. It reads like an implementation-risk inference, not a fact.

**Fix:** Reword as an explicit inference: "Because Zero introduces ZQL, `zero-cache`, and a dedicated protocol, adopting it would likely be a platform commitment." If the phrase comes from a source, cite that source directly.

### A5 — External prior-art scan misses lighter local-first state/sync options
**Claim:** "Sync engines (the buy-it alternatives — all over-scoped for one user)." (`RESEARCH.md`, "External Landscape")

**Problem:** The comparison set covers ElectricSQL, PowerSync, Zero, and Yjs, but omits several local-first state/sync approaches that are closer to the current problem than full multi-user replication engines: LiveStore, Jazz, InstantDB, TanStack DB/live queries, and PGlite-oriented reactive stores. Zero's own docs discuss other sync tools such as ElectricSQL, LiveStore, Jazz, InstantDB, and PowerSync (`https://zero.rocicorp.dev/docs/when-to-use`), and Electric positions its stack with PGlite sync / TanStack DB integration (`https://electric-sql.com/products/postgres-sync`). These may still be rejected, but the packet should show the rejection rather than narrowing the landscape too early.

**Fix:** Add a short "lighter local-first/state-store alternatives" subsection. For each, state whether it solves cross-window server push, client-local reactive query invalidation, or multi-device sync.

## Confirmed sound

- `ChatRpcs` streaming is real: `SendMessageRpc` and `EditMessageRpc` have `stream: true` in `packages/agents/use-cases/src/processes/Chat/Chat.rpc.ts`, and `ChatRpcs` is the `RpcGroup`.
- The desktop transport claim is grounded: `apps/professional-desktop/src/transport/IpcChatClient.ts` uses `RpcClient.layerProtocolSocket()` with ndjson serialization over the Tauri IPC socket, and `apps/professional-desktop/server/main.ts` already serves `ChatRpcs` over HTTP or stdio RPC protocols.
- `@beep/workspace-server` exists and exports the Thread server namespace plus `WorkspaceServerLive`; `ThreadStore` is a real use-case port with Drizzle and in-memory implementations.
- Effect v4 beta drift for `Mailbox` is correctly handled in the synthesis: `node_modules/effect/dist` has `Queue.d.ts` and `Stream.fromQueue`, and no `Mailbox.*` module.
- The repo-absence checks for `EventStreamHub`, `notifyUser`, `PubSub` usage, and `SynchronizedRef` usage in `packages/**/src` and `apps/**/src` are sound, aside from the separate FalkorDB absolute-inventory issue above.
- The scope precedent from `goals/desktop-chat-surface/SPEC.md` is cited accurately: no collaboration / multi-user presence, Atom reactivity patterns, app-local live Layer, and no God Layers.
