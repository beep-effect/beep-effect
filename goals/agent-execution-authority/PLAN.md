# Agent Execution Authority Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Confirm the source hierarchy and re-verify the two spike findings still hold against current `main`. | Required facts and blockers recorded; both mechanisms re-confirmed or the discrepancy reported. |
| P1 Implement | pending | Land PRs 1–7 in order, each independently mergeable. | `SPEC.md` acceptance criteria met. |
| P2 Verify | pending | `bun run beep yeet verify` plus the acceptance suite. | Verification green or blockers documented. |
| P3 Yeet: PR to mergeable | pending | Drive each PR to mergeable through `bun run beep yeet publish`. | Hosted required checks green. |
| P4 Close | pending | Closeout reflection and packet-status flip. | Reflection exists; `bun run beep lint reflection-artifacts` passes. |

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

## Migration Registration Is Four Places

Missing the fourth is exactly how the bitemporal spike failed CI.

1. The migration SQL.
2. The target module **and** `packages/_internal/db-admin/src/targets.ts` — whose
   two `@example` docblocks (`:55`, `:81`) print the expected name list and are
   **executed** by docgen, so a stale list fails the build.
3. `bun run --cwd apps/professional-desktop codegen` for the bundled
   `Migrations.ts`, drift-gated by `codegen:check`.
4. An entry per new file in
   `packages/tooling/tool/cli/src/commands/Architecture/internal/AcceptedProofManifest.ts`.

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
