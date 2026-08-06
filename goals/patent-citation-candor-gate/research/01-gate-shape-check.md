# 01 — Gate Shape Architecture Check (P0)

- **Date:** 2026-08-05
- **Agent:** architecture-guardian
- **Branch:** `feat/patent-citation-candor-gate`
- **Scope:** SPEC decision 7 — which cross-slice shape carries the `CandorPolicy`
  verdict to the filing-promotion path. Read-only review; no source modified.

---

## 0. Two premises in the brief are wrong — correct them before costing

**0.1 There are no live `.events.ts` instances in the shared kernel.**
`packages/shared/domain/src/entities/Membership/` contains exactly `index.ts`,
`Membership.model.ts`, `Membership.values.ts`. No `Membership.events.ts`, no
`Enrollment.events.ts`. Those names appear only inside the illustrative
canonical-anchor tree in `standards/ARCHITECTURE.md:798,810` and the
`GLOSSARY.md:92` example. The only `*.events.ts` on disk repo-wide is
`packages/foundation/ui-system/dock/src/Dock.events.ts` — a foundation UI
package, not a slice, and not a domain-event contract.

`SPEC.md:141-142` already states this correctly ("no slice instance"). The SPEC
is right; the brief's "live instances exist" is not.

**0.2 Doctrine names *three* lawful cross-slice mechanisms, not two.**
`standards/ARCHITECTURE.md:632-636` names two, but that bullet is **stale**.
`standards/architecture/10-cross-slice-coordination.md:36-51` (§2a) and
`standards/architecture/DECISIONS.md:1095-1148` ratify a third on 2026-07-25:
**foundation-mediated port inversion**. `ARCHITECTURE.md` contains zero mentions
of it (`rg -n "port inversion|foundation-mediated" standards/ARCHITECTURE.md`
→ no match). The constitution was not updated when the decision landed.

This matters enormously here, because the ratifying decision rejects events
*specifically for this shape*:

> `DECISIONS.md:1142-1148` — "Events were rejected as the general answer, not
> merely as this instance's answer: a gate that must fail closed *before* an
> action runs is synchronous by nature, and an emitted event cannot express
> 'and do not proceed.'"

`10-cross-slice-coordination.md:44-48` — "This exists because events cannot
express a gate that must fail closed *before* an action runs. Where the
coordination is synchronous, product-neutral, and decides whether the consuming
slice proceeds, use the port."

The candor gate is verbatim that shape: synchronous, fail-closed, decides
whether the consuming slice proceeds.

---

## 1. Is there a live event DELIVERY mechanism?

**No. Schema-only is generous — there are no domain-event schemas either, and
no transport of any kind.**

| Probe | Result |
| --- | --- |
| `*.events.ts` in any slice | none (only `foundation/ui-system/dock/src/Dock.events.ts`) |
| `*.event-handlers.ts` anywhere | **zero files repo-wide** |
| `effect/unstable/eventlog` imports in any `src/` | **zero** — the only usage repo-wide is `packages/tooling/library/ai-metrics/test/eventlog-proof.test.ts:3-6`, an in-memory feasibility test in a tooling library |
| `PubSub` in product code | only `packages/drivers/obs/src/ObsProtocol.service.ts:239,320,468,472` — a driver-local sliding PubSub for OBS websocket protocol frames; drivers may not depend on slices (`ARCHITECTURE.md:639-640`) |
| Event bus / dispatcher / subscription registry service | none |
| Outbox | `packages/documents/domain/src/entities/SyncOperation/SyncOperation.model.ts:146` is a **DMS file-push outbox** (queued push operations to a document-management mirror), not a domain-event outbox. `SyncOperation.repository.ts` and `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1127` pump it FIFO for file sync only. Not reusable as event transport. |

**Verdict: no domain event has ever been defined, emitted, delivered, or
consumed in this repo.** `10-cross-slice-coordination.md:56` requires cross-slice
flow to go "through the shared event log / shared bus" — no shared event log and
no shared bus exists. The eventlog proof test uses `EventJournal.layerMemory`
(in-memory, non-durable) and hand-rolls its own scoped-layer helper at
`eventlog-proof.test.ts:8-11`, which is itself a signal the substrate is not
productized.

---

## 2. What would each option cost?

### Option A — emitted events

**A is a strict superset of B, not an alternative to it.** The more specific
doctrine is unambiguous: `10-cross-slice-coordination.md:28` — "The **event
contract** … lives in `shared/use-cases/<owning-slice>/events/` after that
package exists"; `:30` — consumers "import the same contract from the future
`@beep/shared-use-cases/public` subpath"; `:55` — a consumer "MUST NOT import
another slice's `*.events.ts` from anywhere except promoted `shared/use-cases`
contracts"; `:59` — "If a needed event isn't yet promoted … the right move is to
promote it in a PR that creates the package if needed."

So option A requires **everything in option B, plus transport**. Concretely:

1. **All of §B below** (the `packages/shared/use-cases` package, its promotion
   record, the `$SharedUseCasesId` identity composer, workspace/tsconfig/boundary
   registration, four first-CI governance gates).
2. `packages/shared/use-cases/src/law-practice/events/…` — the event contract
   built with `Event.make` from `effect/unstable/eventlog/Event`
   (`10-cross-slice-coordination.md:106-153` worked example).
3. **A shared event-log runtime that does not exist and has no lawful home.**
   Needs an `EventLog.layer` + `EventGroup` registry + `EventLog.Identity` +
   `EventLogEncryption` composition. It cannot live in `shared/use-cases`:
   `ARCHITECTURE.md:358` and `packages/shared/CLAUDE.md:45-47` bar that package
   from "transports, persistence, driver imports, or live Layers". It cannot live
   in a slice (both slices would import it). That leaves a **new
   `foundation/capability` package** — which the SPEC's Non-Goals
   (`SPEC.md:96-103`) forbid and which nothing in this goal scopes.
4. **Durable journal.** `EventJournal.layerMemory` is in-memory. A gate whose
   blocking verdict evaporates on restart is not fail-closed. Durable journal =
   a second db-admin migration lane on top of law-practice's first one, plus a
   Drizzle `EventJournal` adapter — entirely unscoped.
5. `packages/agents/server/src/…/*.event-handlers.ts` — the first event handler
   in the repo, plus `EventLog.group` registration on the agents side.
6. `packages/law-practice/server` emit site + `EventGroup` registration.
7. App-entrypoint wiring — see §2.D, which afflicts all three options.

**And after all of that, it still does not work.** An event says "this happened";
it cannot say "and do not proceed". Rung 2's acceptance criterion
(`SPEC.md:288-293`) requires "a blocked predicate blocks a real filing
candidate". `DECISIONS.md:1144-1146` names the two possible outcomes of forcing
this shape through events: "either lose the fail-closed property or reinvent
synchronous request/response over an event log."

**Cost: one new foundation package + one new shared package + a durable event
journal + a migration + the repo's first emit/handle path — and the fail-closed
property is lost at the end of it.**

### Option B — promoted contract in `packages/shared/use-cases`

**B is blocked by the promotion bar itself, on its face.**

`standards/architecture/02-shared-kernel.md:189` — "**Current consumers:** list
**≥2 packages currently importing this export by name**; one consumer is not yet
promotable." The candor gate has exactly one consumer: the agents-slice
promotion path. `ARCHITECTURE.md:352-356` — `shared/use-cases` "has no package
directory today because nothing has met that bar." Creating it for a
single-consumer contract does not clear the bar; it waives it.

Setting that aside, the mechanical cost:

- New leaf package files mirroring `packages/shared/tables`: `package.json`
  (with `beep.family`/`beep.kind`), `tsconfig.json`, `vitest.config.ts`,
  `docgen.json`, `README.md`, `CLAUDE.md`, `AGENTS.md`, `LICENSE`,
  `CHANGELOG.md`, `src/`, `test/`.
- **Root `package.json` workspaces edit** — shared packages are enumerated
  individually (`package.json:445-446`: `"packages/shared/domain"`,
  `"packages/shared/tables"`), not globbed. A new entry is required.
- `bun run beep tsconfig-sync` — root `tsconfig.json` alias + project references
  + `tsconfig.packages.json`.
- `bun run fallow:boundaries:write` — new allow-edges in
  `standards/fallow.boundaries.generated.jsonc`.
- **New identity composer `$SharedUseCasesId`** — absent today
  (`rg -n "SharedUseCases" packages/foundation/modeling/identity/src/` → no
  match; only `$SharedDomainId` at `packages/foundation/modeling/identity/src/packages.ts:442`).
  The doctrine's own worked example imports it
  (`10-cross-slice-coordination.md:109`), so the example does not currently
  compile.
- Promotion record per `02-shared-kernel.md:181-200` — including
  "**Coupling acceptors:** PR review sign-off from each consuming slice's owner".
- Changeset; the four first-CI governance gates for any new package shipping
  real `src/` TypeScript (tsconfig-sync, fallow-boundaries, fallow audit lane,
  `beep lint policy` per-export inventories).
- `SPEC.md:96-103` additionally requires an Exception Ledger entry plus owner
  sign-off before the package is created. The Exception Ledger is currently
  empty (`SPEC.md:341-343`).

**Cost: a new shared-kernel package created in explicit violation of its own
promotion bar, requiring a waived standard plus an Exception Ledger entry.**

### Option C — foundation-mediated port inversion (not in the brief; doctrine-sanctioned)

`10-cross-slice-coordination.md:36-51` + `DECISIONS.md:1095-1148`. Two landed
instances already run in production shape:

1. **`TierGate`** — port at `packages/foundation/capability/mcp-kit/src/TierGate.ts`,
   implemented by `packages/epistemic/server/src/GovernedTierGate/`
   (579 LOC across `.gate.ts` / `.layer.ts` / `index.ts`), consumed by
   `packages/ontology/server/src/tools/OntologyToolHandlers.ts`, bound at
   `apps/professional-desktop/server/OntologyMcpTransport.ts:17,171,220`.
   Coupling record at `packages/foundation/capability/mcp-kit/README.md:20`.
   Proven fail-closed by `apps/professional-desktop/test/integration/execution-authority.pglite.test.ts:231-234`
   and `ontology-mcp-http.test.ts:196-219`.
2. **`SourceTextResolver`** — port at `@beep/file-processing/SourceText`,
   provided by `@beep/workspace-server/SourceText`, consumed by
   `@beep/epistemic-server`, bound at the desktop runtime; coupling record at
   `packages/epistemic/server/README.md:22-28`. **This is the same port the SPEC
   already reuses for rung 1** (`SPEC.md:186-194`).

Cost:

- **One new `foundation/capability` package** for the product-neutral gate port
  (`*.service.ts` / `*.errors.ts` / `index.ts` per
  `ARCHITECTURE.md:651`). None of the nine existing capability packages is a
  semantic home — `mcp-kit` is MCP-dispatch-specific, `file-processing` is
  source-text-specific. Do **not** widen either; that is exactly the
  vague-home failure the specific-home-first table exists to catch.
- **No root `package.json` workspaces edit** — `packages/foundation/capability/*`
  is already globbed (`package.json:441`). This is strictly cheaper than B.
- New identity composer for the package (mirroring `$McpKitId`,
  `mcp-kit/src/TierGate.ts:24,35`).
- `tsconfig-sync`, `fallow:boundaries:write`, changeset, the four governance
  gates — same as B.
- README coupling records in **both** the implementing and consuming packages
  (`DECISIONS.md:1117-1120`), plus the app binding site.
- **No promotion record, no ≥2-consumer bar, no shared-kernel waiver, no
  transport, no journal, no migration.**
- Zero new dependency edges on the law-practice side: `packages/law-practice/use-cases/package.json:56`
  already depends on `@beep/mcp-kit`, i.e. this slice already consumes
  foundation/capability ports (`ARCHITECTURE.md:622-623` permits it).

Admission conditions (`DECISIONS.md:1106-1116`) against this gate:

| # | Condition | Status |
| --- | --- | --- |
| 1 | Port carries no product semantics | **Satisfiable** — the port is `evaluate(subjectRef) => Effect<Verdict>` with a `LiteralKit` `blocked`/`clear` verdict and an opaque reason. No "candor", "citation", "filing", or "disposition" in the port types. `TierGate`'s `ToolCallRequest`/`TierGateVerdict` did exactly this. |
| 2 | Lives in `foundation/*`, satisfies family admission | Satisfiable with the new capability package |
| 3 | Both slices import only foundation | **Already true** for law-practice |
| 4 | Layer bound at an application entrypoint | **⚠ See §2.D** |
| 5 | Neither slice names the other anywhere | Satisfiable |

### 2.D — The binding-site problem, common to A, B, and C

**No app composes both slices today.** `apps/professional-desktop/package.json:43-46`
depends on `@beep/agents-{client,domain,server,use-cases}` and **not** on
law-practice. `apps/practice-kg-mcp/package.json:41` depends on
`@beep/law-practice-server` and **not** on agents.

Worse: **the promotion path has no runtime at all.** `ProfessionalRuntimeSdk`
(`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.service.ts:28-45`)
has exactly one implementation — `makeInMemoryProfessionalRuntimeSdk`
(`ProfessionalRuntime.fixture-service.ts`, exported from `src/proof.ts`) —
consumed only by `packages/agents/use-cases/test/ProfessionalRuntime.test.ts`.
No `agents/server` implementation, no app wiring.

This is a **finding the SPEC should absorb now, not at rung 2**: rung 2's
criterion "a blocked predicate blocks a real filing candidate"
(`SPEC.md:288-293`) cannot be met against a runtime, because none exists. Under
option C this specifically strains admission condition 4 — "bound to the
consuming slice at an application entrypoint" — since the only available binding
site is a test harness. Either rung 2 additionally stands up an app-entrypoint
binding (new app-level dependency edge, allowed but unscoped), or the criterion
is rescoped to "the proof SDK's promotion path, exercised at the predicate
boundary" and the port binding is deferred with the record saying so.
`RuntimeApprovalDecision` is `LiteralKit(["pending"])`
(`ProfessionalRuntime.values.ts:139`) — single-member, cannot express
advancement — which the SPEC already acknowledges.

---

## 3. Binding recommendation

**Neither A nor B. Take C — foundation-mediated port inversion — and amend
SPEC decision 7 to name it.**

A and B are both bad, and they are bad in a specific way the brief did not
anticipate: they are not independent options. Under
`10-cross-slice-coordination.md:28,30,55,59`, a cross-slice emitted event's
contract *must* live in `shared/use-cases`, so **A = B + a durable event-log
transport that has no lawful home + a second migration lane + the repo's first
emit/subscribe path — and at the end of it the gate is no longer fail-closed**,
because an event cannot say "do not proceed" (`DECISIONS.md:1142-1148`). B on
its own is cheaper but fails the promotion bar on its face: `02-shared-kernel.md:189`
requires ≥2 current consumers by name and this gate has one, so B is not a
lawful shape, it is a waived standard plus an Exception Ledger entry. C is the
mechanism the repo **ratified on 2026-07-25 for exactly this case** — synchronous,
product-neutral, decides whether the consuming slice proceeds — with two landed
instances, one of which (`SourceTextResolver`) this very SPEC already consumes at
rung 1. Its cost is one small new `foundation/capability` package (no root
workspaces edit, since `packages/foundation/capability/*` is already globbed at
`package.json:441`), an identity composer, two README coupling records,
`tsconfig-sync` + `fallow:boundaries:write` + a changeset, and the four
first-CI governance gates. That single new package does breach the SPEC's "no new
packages" Non-Goal (`SPEC.md:96-99`), so it needs the same Exception Ledger entry
B would have needed — but it buys a lawful mechanism instead of a waived one, and
it is strictly smaller than either A or B. **Independently of the A/B/C choice,
rung 2's live-invocation criterion needs rescoping now: the filing-promotion path
has no runtime implementation and no app binds both slices, so "blocks a real
filing candidate" is currently unachievable as written.**

---

## 4. Rung-1 independence

**Yes — rung 1 is completely unaffected by the gate-shape choice. Proceed now.**

Every rung-1 surface is intra-slice or shared-kernel-identity:

- `packages/law-practice/domain/src/entities/` + `src/values/` — the slice's own
  domain. `values/` already holds 65 sibling value objects including
  `ApplicationNumber`, `PatentDocumentTriplet`, `DurableLocator`, and
  `CitingApplicationIdentity`, so `PatentFragmentLocator` and the
  application-identity union land beside established neighbours. `entities/`
  already holds `Claim`, `OfficeAction`, `PriorArtReference`. Correct placement,
  no routing question.
- `packages/shared/domain/src/identity/LawPractice.ts` — the two `EntityId`
  registrations follow `PriorArtReferenceId` at line 293. Identity-module-only
  edit; `shared/domain` is an active package with no new surface.
- `packages/law-practice/use-cases` — `CandorPolicy` `Context.Service` plus its
  test. Its requirement channel carries `SourceTextResolver`
  (`@beep/file-processing`, already a dependency at
  `packages/law-practice/use-cases/package.json:52`) and `Crypto.Crypto`,
  satisfied by the caller. Slice-isolated `Layer.succeed` fixture in the test.

None of these names the agents slice, imports across a slice boundary, or
depends on where the verdict is eventually consumed. The gate shape only decides
**who reads** the predicate, not what the predicate is. Rung 1 defines the
predicate.

---

## 5. Drift findings (ranked)

| # | Severity | Finding |
| --- | --- | --- |
| 1 | **Violation — doctrine inconsistency** | `standards/ARCHITECTURE.md:632-636` names two cross-slice mechanisms and was never updated when `DECISIONS.md:1095-1148` ratified a third on 2026-07-25. The constitution now contradicts both `10-cross-slice-coordination.md:36-51` and live landed code. This directly caused SPEC decision 7 to enumerate "exactly two". **Remedy:** add a clause to the `ARCHITECTURE.md:632-636` bullet pointing at §2a. Smallest compliant fix; own PR, not this goal's. |
| 2 | **Pre-existing drift** | `10-cross-slice-coordination.md:109` imports `$SharedUseCasesId` from `@beep/identity` in its worked example; that composer does not exist. The doctrine's canonical example does not compile. **Remedy:** annotate the example as post-promotion pseudocode, or add the composer when the package is created. |
| 3 | **Pre-existing drift (named by the SPEC, do not compound)** | `packages/law-practice/use-cases/package.json:50-51` depends on `@beep/epistemic-domain` and `@beep/epistemic-use-cases` — slice-to-slice, forbidden by `ARCHITECTURE.md:632-633`. `SPEC.md:66-67` correctly flags this as prior drift. Option C adds **zero** new slice-to-slice edges; A and B also add none, but neither reduces this. |
| 4 | **Pre-existing drift** | `packages/agents/use-cases/package.json:56-57` depends on `@beep/workspace-domain` and `@beep/workspace-use-cases` — same slice-to-slice class, in the consuming slice. Out of scope for this goal; note for the drift ledger. |
| 5 | **Cleanup-on-touch** | `standards/architecture/13-onboarding-the-minimum-viable-slice.md:153` and `ARCHITECTURE.md:984,1065` canonize `.events.ts` / `.event-handlers.ts` roles that have zero slice instances and zero transport. The role vocabulary promises a capability the repo does not have. Worth a doctrine note that these roles are aspirational until a shared event log lands. |
