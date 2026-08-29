# Agent Execution Authority Plan

## Status

Status: `complete`

All seven PRs have landed. PR 1 (#458) shipped the grant and record schemas plus
the `frozen-grant-set` law; PR 2 (#463) shipped `@beep/epistemic-config`, the
`OntologyMcpConfig` split, and the MCP entrypoint cleanup; PR 3 (#467) shipped
the append-only ledger tables, migration, port, and Drizzle adapter; PR 4
(#471) shipped `recordOutcome`/`TierGateSettlement` on the tier gate and
`EgressDenied` in `@beep/api-transport`; PR 5 (#481) shipped `GovernedTierGateLive`
with the run store, swapped in at the MCP transport; PR 6 (#485) shipped the governed
egress `Fetch` and `ontology_publish_provenance`; PR 7 shipped the composed
fixture acceptance suite and this packet's closeout.

**PR 6 corrections to this plan, recorded.** The blocking check passed, and
measuring it falsified the mechanism this plan and the README assumed:

1. *"`provideContext` replaces the fiber context"* is false — it merges
   (`updateContext(self, Context.merge(context))`), with the provided context
   winning on key collisions and request-only services surviving. The policy
   `Fetch` therefore reaches handlers in every placement tested, not only when
   provided into the toolkit's graph.
2. *The recommended placement works for a different reason than stated.*
   `HttpClient.layerMergedContext` captures the client layer's own build
   context and merges it at execute time, so the override rides with the
   `HttpClient` and reaches handlers whose context never contains `Fetch`.
3. *The hazard is inverted.* Request-time context takes **precedence**, so a
   per-request `Fetch` displaces the composition-root one. No middleware or
   request-scoped layer in a governed transport may provide that reference.
4. *"The policy fetch writes its own typed refusal to the ledger"* is
   implemented, but it cannot write into the **session's** chain: `Fetch` is a
   plain promise-returning function with no fiber, so it cannot read
   `CurrentMcpCaller`. Egress decisions are chained into their own run and
   correlate to session rows by time.

Evidence: [`history/pr6-fetch-reach-spike.md`](./history/pr6-fetch-reach-spike.md).

**PR 5 corrections to this plan, recorded.** Two instructions below were wrong
and are superseded by what landed:

1. *"Run store keyed by `clientId`"* — and SPEC decision 10's identical
   wording — is not implementable over HTTP: `RpcServer`'s HTTP protocol mints
   `clientId` per request, so it names one protocol exchange, not one session.
   Keying on it opened a new run per dispatch and reduced every chain to a
   lone genesis row. The run keys on the transport's session identifier
   instead — `mcp-session-id`, surfaced through a new
   `McpCallerIdentity.sessionId` read in `sanitizedToolkit` before the handler
   context is replaced. Decision 10's intent (a run is an MCP session) stands;
   only the named mechanism changed. Transports issuing no session id (stdio)
   fall back to `clientId`, where the connection is the session.
2. *"Wire eviction to the client lifecycle"* — no such seam exists, and the
   expiry-based sweep written first was worse than none: evicting an expired
   run let that same session re-freeze fresh grants on its next dispatch, so
   the TTL bounded nothing. Runs are now never evicted, which is what makes
   `grant-expired` permanent for the session that earned it. Growth is one
   small entry per MCP session. A lifecycle-bound release stays a candidate
   for the chat-egress widening and needs new `mcp-kit` surface.

A third correction is not a plan deviation but a doctrine one: per-reason
refusal guidance was reaching the agent through `OntologyTierGateRefusal`,
against decision 13. Every governed refusal now carries one constant string.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Confirm the source hierarchy and re-verify the two spike findings still hold against current `main`. | Required facts and blockers recorded; both mechanisms re-confirmed or the discrepancy reported. |
| P1 Implement | complete | Land PRs 1–7 in order, each independently mergeable. | `SPEC.md` acceptance criteria met. |
| P2 Verify | complete | `bun run beep yeet verify` plus the acceptance suite. | Verification green or blockers documented. |
| P3 Yeet: PR to mergeable | complete | Drive each PR to mergeable through `bun run beep yeet publish`. | Hosted required checks green. |
| P4 Close | complete | Closeout reflection and packet-status flip. | Reflection exists; `bun run beep lint reflection-artifacts` passes. |

## Build Sequence

Each PR is independently landable through
`bun run beep yeet publish --message "…"`. The spike (increment 0) is already
done — both mechanisms proven 2026-07-25, throwaway files deleted.

### PR 1 — grant and record schemas in `epistemic/domain`

*One-way door.* `Sink` as `(class, audience, destination)`. `audience` as a
`LiteralKit` with `local-workspace` and `external-network`. `GrantSet` as a
`Draft`/`Frozen` tagged union copying `Turn.model.ts:161-186`, so
`addGrant(run.grants, g)` does not compile. `DenialReason` as a bounded
`LiteralKit`. Decision and outcome record schemas.

The freeze idiom to copy is
`TurnItemTag.mapMembers(Tuple.evolve([...])).pipe(S.toTaggedUnion("itemType"))`
at `packages/workspace/domain/src/entities/Turn/Turn.model.ts:164-190`.

`S.Class` always exposes `.make`, so seal `FrozenGrantSet` with a digest
(`sha256(canonicalEncode({ grants, policyRevision, frozenAt }))`, re-verified on
read) plus a `beep lint` law banning `FrozenGrantSet.make` outside its module —
the `NoNativeRuntime.ts` mechanism exists for exactly this.

*Proves:* expired / wrong-sink / wrong-audience / wrong-revision each produce a
**distinct** typed reason; fail-closed default for unknown operations; dtslint
exhaustiveness.

Get `audience`, `sink`, and `policyRevision` right here — adding a `LiteralKit`
member later is cheap, removing one is not.

### PR 2 — `packages/epistemic/config` + entrypoint cleanup

*Reversible.* Canonical slice-config shape: `ServerConfig.ts`, `Layer.ts`,
`TestLayer.ts`, with `/server` and `/test` subpaths. Destination allowlist,
audience map, pinned policy revision. The `TestLayer` carrying fixture grants is
a deliverable, not an afterthought — the acceptance test needs deterministic
grants.

Cleanup-on-touch: migrate `apps/professional-desktop/server/main.ts:53-56` off
`Effect.runSync(Config.boolean(...))` onto typed config in the same PR, per
`06-configuration-boundaries.md`.

### PR 3 — ledger tables, migration, port, adapter, verifier

*One-way door.* Two insert-only tables, `epistemic_execution_decision` and
`epistemic_execution_outcome`, bound by `UNIQUE (decision_record_hash)` on the
outcome table. Non-`BaseEntity` rows. Chain per run: `UNIQUE (run_id, seq)`.

Ship the plpgsql `BEFORE UPDATE` / `BEFORE DELETE` guards. The spike proved
plpgsql is present in PGlite with no `extensions:` registration in `Pglite.ts`
(unlike `btree_gist`), that the triggers do block both statements while `INSERT`
still works, and that the splitter trap is narrower than feared.

Placement follows `03-driver-boundaries.md:151-153`: port in
`epistemic/use-cases` beside `ClaimGate.ports.ts`, Drizzle adapter in
`epistemic/server`, table in `epistemic/tables`. Do **not** copy
`apps/professional-desktop/src/chat/UsageRecordSink.ts`, which puts an epistemic
product repository in app code — that is known drift, recorded but not fixed
here.

**Fork resolved at PR 3 (2026-07-26): raw `pgTable`.** The SPEC's Persistence
section was already normative ("Non-`BaseEntity` rows", WorkItem precedent
named) and decision 4 rejected mutable rows explicitly; option (b) would have
shipped `row_version`/`updated_at`/`updated_by_principal` as schema lies on rows
that must never mutate, purely for idiom consistency. A third option surfaced
during exploration — `EntitySchema.ClassFactory` without `BaseEntity` fed to
`pgTableFrom`, keeping `.definition` metadata with zero forced columns — and was
rejected because it has zero product usage anywhere (proven only by a JSDoc
example), and a one-way door is the wrong place to pioneer machinery. The
no-payload descriptor walk adapts to drizzle column metadata (exact column set +
no jsonb/json/bytea + bounded literals), proving the identical property. The PR 1
record schemas are their own row codecs: encoded form is already the flat wire
projection, so the converters are `S.encode`/`S.decode` and nothing else.

*Proves:* `.pglite.test.ts`, `{ concurrent: false }` — append N, verify, tamper
via raw SQL and assert verification fails **at the tampered index**, assert the
trigger rejects a direct UPDATE and DELETE.

### PR 4 — two foundation additions

*Reversible, no behavior change.* `recordOutcome` on `TierGateShape` in
`mcp-kit`, called by `dispatchWithTierGate` via `Effect.onExit`, taking a bounded
settlement literal (`completed` / `failed` / `interrupted`) rather than an
`Exit` — so no payload can reach the ledger by construction.
`fromApprovedToolsPolicy` returns `recordOutcome: () => Effect.void`.

`EgressDenied` as a reason-free tagged error in `@beep/api-transport`. This uses
the package as vocabulary, not as the `transformClient` enforcement seam the
exploration rejected.

Both packages get consumer records in their READMEs naming the producer/consumer
pair and the app-entrypoint binding.

**Blast radius is small but includes two docblocks.** The only `TierGateShape`
implementors are `apps/professional-desktop/server/OntologyMcpTransport.ts` and
`mcp-kit`'s own tests; the only `dispatchWithTierGate` call site is
`packages/ontology/server/src/tools/OntologyToolHandlers.ts`. But `TierGate.ts`
constructs the shape inside `@example` blocks at `:253` (`const shape:
TierGateShape = {...}`) and `:293` (`TierGate.of({ evaluate })`), and **docgen
executes examples** — so a new required member breaks the build until both are
updated. Same trap class as the `targets.ts` docblocks.

### PR 5 — `GovernedTierGateLive` + run store, wired at the MCP transport

*Reversible — revert one layer entry.* `epistemic/server` implements
`TierGateShape`; swap `fromApprovedToolsPolicy` at
`apps/professional-desktop/server/OntologyMcpTransport.ts:111`. Provide
`PgliteDrizzleLive` and the epistemic config into the MCP branch —
`main.ts:78-79` already documents relying on layer memoization, and
`PgliteDrizzleLive` is a module-level const, so this yields one shared PGlite
rather than two.

Run store keyed by `clientId`, freezing the grant set on the session's first
dispatch and reusing it thereafter. Because `clientId` arrives per request at
`SanitizedSpan.ts:255-259`, the store is a plain build-time service — no
per-request context propagation, so `SanitizedSpan.ts:226/264`'s context erasure
does not apply. Run lifetime is bounded by the client session, so wire eviction
to the client lifecycle.

Write-ahead and fail-closed land here: no decision row, no action.

*Proves:* two rows for an allowed dispatch and **one** for a refused one (no
execution, no outcome — `dispatchWithTierGate` never runs `onApproved` on the
refused branch); the handler reads its own decision row; injected decision-write
failure ⇒ the mutation does not run and the workspace file is unchanged.

### PR 6 — policy `Fetch` + `ontology_publish_provenance`

*Reversible.* **Re-read this scope before landing it** — it adds an
agent-controllable outbound POST of workspace content to a product holding
privileged material.

The tool and its control ship together; never the sink before the control. The
tool is registered only when the destination allowlist is non-empty, mirroring
the `mutationsEnabled` gating at `OntologyMcpTransport.ts:117`. The handler
requires `HttpClient.HttpClient` and never self-provides it, or the policy
`Fetch` reference will not apply.

The policy fetch writes its own typed refusal to the ledger and rejects with
`EgressDenied`; `HttpClient` wraps it as `TransportError` carrying that cause;
the ontology handler matches the cause and returns a typed refusal through the
existing `failureMode: "return"` envelope.

**Blocking check for this PR:** demonstrate a request issued from *inside a real
tool handler* reaching the policy fetch. The spike proved the mechanism for a
directly-provided effect, not through a running server. If this cannot pass,
stop and report.

### PR 7 — the composed fixture

*Reversible.* On one MCP session: tool 1 reads workspace content carrying an
injected instruction, tool 2 attempts an outbound POST to the injected
destination, and the grant set frozen at session open denies it. Plus the full
acceptance suite from `SPEC.md`.

**What landed, and one thing this section got wrong.** The suite is
`apps/professional-desktop/test/integration/execution-authority.pglite.test.ts`,
`{ concurrent: false }`, against the real Drizzle ledger over PGlite rather than
a probe — the canary property is only honestly provable against rows that were
actually serialized into Postgres. The MCP HTTP bootstrap moved to
`test/integration/support/ontology-mcp-harness.ts` so both app suites share one
server.

The wrong part is "the grant set frozen at session open denies it." The frozen
grant set *allows* the operation — the gate's question is whether this session
may invoke `ontology_publish_provenance`, and it may. The **egress boundary**
denies the destination. So the fixture asserts on two chains from two runs, and
a version of it that asserted only the session's chain would pass for the wrong
reason.

The suite proves only what the per-PR suites did not: the composed fixture, the
payload proof, and the per-path cost bound. Everything else in `SPEC.md`'s
acceptance list is discharged by an existing test, and the README now carries the
criterion-to-proof map naming which one. Re-proving PR 3's tamper test and PR 5's
row-count tests at app level would have duplicated coverage and added the slowest
job in the app package.

The cost bound is asserted structurally, in before/after row-count deltas rather
than wall time — a timing assertion would join the repo's known CI timeout flake
class and fail for reasons unrelated to the property, and absolute totals would
lie under an in-process retry. It covers **both** paths, because they do not cost
the same: a tier-only dispatch moves the ledger by 2 rows (decision, outcome),
while an allowed publish moves it by 4, since governed egress writes and settles
its own decision. An earlier draft asserted only the tier-only figure and stated it as the
general bound, which understated the packet's own target path.

**An adversarial review rejected the first draft of this suite on four counts,
all upheld.** The most serious: the canary test passed for the wrong reason — a
nullable `payload TEXT` column added to the migration would have serialized as
`payload: null` through `SELECT *` and survived, because the descriptor test in
`epistemic/tables` inspects the Drizzle projection rather than the physical table.
The suite now pins the exact column set from `information_schema.columns`, which
is the assertion that actually discharges the no-payload guarantee. The review
also caught that the harness extraction had silently replaced
`NodeHttpServer.layer(…, { host: "127.0.0.1", port: 0 })` with `layerTest`, whose
implementation passes only `{ port: 0 }` — binding all interfaces and exposing a
socket-mode MCP server guarded solely by a source-visible fixed token, shipped
under the words "pure move."

## Migration Registration Is Four Places

Verified against the merged bitemporal precedent (#452, `d117ecf26d`), which is
the concrete example to mirror:

1. The raw SQL:
   `packages/_internal/db-admin/drizzle/<timestamp>_epistemic_execution_ledger/migration.sql`
   (precedent: `20260726000000_epistemic_bitemporal_edge/migration.sql`).
2. The target module (precedent:
   `packages/_internal/db-admin/src/migrations/EpistemicEdge.ts:32-47`,
   `DbAdminMigrationTarget.make({ name, schemaName, tables, drizzleSchema })`).
3. The registry `packages/_internal/db-admin/src/targets.ts` — import,
   re-export, and `DbAdminMigrationTargets` array entry — whose two `@example`
   docblocks (`:55`, `:81`) print the expected name list and are **executed**
   by docgen, so a stale list fails the build.
4. The desktop runtime bundle `apps/professional-desktop/src/runtime/Migrations.ts`
   via `bun run --cwd apps/professional-desktop codegen`, drift-gated by
   `codegen:check` — the sidecar embeds the SQL at boot so production never
   depends on `_internal/db-admin`.

Plus the migration proof test (precedent:
`packages/_internal/db-admin/test/integration/EpistemicEdgeMigration.pglite.test.ts`),
which pins the **exact constraint-name list** — load-bearing because the
repository layer maps constraint violations by name, never by message prose.

*(Correction 2026-07-26: an earlier version of this section listed
`AcceptedProofManifest.ts` as the fourth place. That manifest gates only the
architecture-lab proof corpus — `roleBasePath` resolves exclusively to
architecture-lab/db-admin proof roles — and new epistemic files never register
there.)*

## Effect v4 Notes

- **`FiberRef` does not exist** in `effect@4.0.0-beta.101`. `Context.Reference`
  is its replacement: `Reference<Shape> extends Service<never, Shape>`, so
  reading one contributes nothing to `R`. Rewrite anything phrased as
  `FiberRef.locally`.
- A `Context.Service` requirement would be **fail-open by construction** — it
  infects every driver and test layer until someone provides a permissive layer
  at the root. This is a mechanical argument, not a stylistic one.
- **Do not export the run handle.** `CurrentMcpCaller` is exported
  (`McpCaller.ts:44`), so any caller can forge an identity. Export the
  operations; keep the handle module-private.
- **plpgsql splitter rule:** `LegacyStatementBoundary`
  (`PostgresDrizzle.service.ts:22-23`) splits on `;` + newline followed by
  `ALTER|BEGIN|COMMENT|CREATE|DELETE|DROP|GRANT|INSERT|REVOKE|SET|TRUNCATE|UPDATE|WITH`.
  A plain multi-line function body survives — `END` and `$fn$` are not boundary
  keywords. The real rule is **no `;` + newline + boundary keyword inside the
  body**, not "keep it on one line."

## P3 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained` /
`complete`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo **tooling**,
   the **implementation**, and the **goal/prompt**. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Verify with `bun run beep yeet verify`, never bare `vitest`.

## Verification Commands

```sh
bun run beep yeet verify
bun run --cwd apps/professional-desktop codegen:check
test "$(wc -m < goals/agent-execution-authority/GOAL.md)" -le 4000
jq . goals/agent-execution-authority/ops/manifest.json
git diff --check -- goals/agent-execution-authority
```
