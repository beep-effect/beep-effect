<!-- P0 evidence. Produced 2026-08-06 by an Opus 5 subagent (p0-handoff) under
goals/legal-position-relator-runtime GOAL.md P0; orchestrated per SPEC decision 3.
Verifies all four rung-2 handoff shapes + the sibling deferral precedent against
main @ 8fbbf1ef63. The Assessment section is evidence, not the binding decision;
the binding P0 pick lives in ../SPEC.md decision log entry 13. -->

# P0 evidence — rung-2 cross-slice candidate handoff

Repo: `/home/elpresidank/YeeBois/projects/beep-effect18`, branch
`feat/legal-position-relator-runtime`, HEAD `8fbbf1ef63`. Read-only pass; no
repo file edited.

SPEC section under verification: `goals/legal-position-relator-runtime/SPEC.md:327`
("### Rung-2 cross-slice handoff (P0 output, not a pre-authorized edit)"),
running to :429.

**Headline:** every disqualifying trail in the SPEC still stands. Two claims need
a correction of phrasing (not of conclusion), and one new finding cuts against
shape 3 harder than the SPEC does. The "third consumer" question in shape 4
resolves *against* tripping the removal condition, but shape 4 still needs an
amended Exception Ledger row because the existing row's Scope column does not
cover triage.

---

## A. Shape 1 — emitted events (claimed unavailable)

### A1. File-role census — CORRECTION to the SPEC's phrasing

The SPEC says "Zero slice `*.events.ts`, `*.event-handlers.ts`, or
`*.processes.ts` in `packages/**/src`". Live count:

| Role | Count under `packages/**/src` | Files |
| --- | --- | --- |
| `*.events.ts` | **1** | `packages/foundation/ui-system/dock/src/Dock.events.ts` |
| `*.event-handlers.ts` | 0 | — |
| `*.processes.ts` | 0 | — |

The one hit is **not** a counterexample. `Dock.events.ts:1-6` self-describes as
"Schema-first domain algebra for the Dockview greenfield POC", and its exports
are `S.Class` panel-lifecycle records (`PanelOpenedEvent` at :29) in
`foundation/ui-system` — a foundation UI package, not a product slice, and not a
cross-slice event contract. **Zero *slice* packages carry any of the three
roles.** The conclusion holds; the sentence should read "zero slice
`*.events.ts` … (the single repo-wide `*.events.ts` is
`foundation/ui-system/dock`, a UI POC, not a slice contract)".

No slice event bus, dispatcher, or process manager exists either. A repo-wide
search for `EventBus|EventDispatcher|ProcessManager|eventLog|PubSub\.` under
`packages/**/src` returns only `packages/drivers/obs/*` (OBS websocket protocol)
and `packages/tooling/tool/cli/src/commands/Qa/*` (QA session plumbing). Neither
is a slice event transport.

### A2. The event-contract home does not exist

`standards/architecture/10-cross-slice-coordination.md` — SPEC's `:24-30` is
**line-accurate**:

- :24-26 — "Cross-slice event flow goes through shared contracts only after
  promotion. There is no `shared/use-cases` package today; a promotion PR
  creates it when a real contract clears the bar."
- :28 — "The **event contract** (tag, payload schema, error schema, primary-key
  derivation, metadata) lives in `shared/use-cases/<owning-slice>/events/`
  **after that package exists**."
- :30 — "Consuming slices (`billing`) import the same contract from the future
  `@beep/shared-use-cases/public` subpath and never from `@beep/iam-use-cases`."

Independently corroborated by `standards/architecture/DECISIONS.md:993-998`
(2026-06-21, "Remove Placeholder Shared-Kernel Packages"): "The current
`packages/shared` inventory is only the packages with real surfaces:
`shared/domain` and `shared/tables`. … `shared/use-cases` in particular does not
exist yet because no contract-only cross-slice surface has met the promotion
bar."

### A3. `packages/shared/` inventory — confirmed

`ls packages/shared/` → `AGENTS.md`, `CLAUDE.md`, `README.md`, `domain/`,
`tables/`. Only the two package directories, exactly as claimed.

**Verdict A: disqualifying evidence STANDS.** Shape 1 is a strict superset of
shape 2's cost — it needs the non-existent `shared/use-cases` package *plus* an
event transport that does not exist anywhere in the repo.

---

## B. Shape 2 — promoted `shared/use-cases` contract

`standards/architecture/02-shared-kernel.md:189` — line number **exact**.
Verbatim:

```
- **Current consumers:** <list ≥2 packages currently importing this export by name; one consumer is not yet promotable>
```

Surrounding rule (`:181-200`, "Appendix: Promotion record schema"):

- :183 — "A promotion record is a fillable section in the affected `shared/*`
  package's `README.md`. One section per promoted export."
- The full required field set is :187-197: Date promoted, Shared product
  semantics, **Current consumers**, Rejected homes (owning slice + foundation),
  Surface, Runtime limits (":194 — one of: 'no live Layers', **'contract-only'
  (required for future `shared/use-cases`)**, 'live Layers permitted under §X'"),
  Coupling acceptors (PR sign-off from *each* consuming slice's owner),
  Removal trigger.
- :200 — "Records are checked at PR review (see lint spec
  `lint:promotion-records` referenced in `07-non-slice-families.md`)."

`10-cross-slice-coordination.md:32` re-binds the same bar to event contracts
specifically: "Promotion bar is the same as any other `shared/*` export: a
promotion record per `02-shared-kernel.md` Appendix."

Live consumer count for a triage-submit contract: **one** (law-practice). The
bar needs ≥2 *currently* importing by name.

**Verdict B: disqualifying evidence STANDS.** Picking shape 2 waives the ≥2 bar
rather than clearing it, and additionally creates a package (with identity
composer, workspace registration, tsconfig reference, README promotion record —
per DECISIONS :1004-1007). The sibling goal reached the identical conclusion
independently at `goals/patent-citation-candor-gate/SPEC.md:101-105`.

---

## C. Shape 3 — foundation-mediated port inversion

### C1. `10-cross-slice-coordination.md:36-51` (§2a) — line-accurate

- :36 — "### 2a. Foundation-mediated port inversion"
- :38-43 — "Event promotion is not the only lawful cross-slice mechanism. A
  slice may also implement a `foundation`-owned port that another slice
  consumes, with the two bound at an application entrypoint and neither slice
  naming the other. Ratified 2026-07-25 — see `DECISIONS.md` … for the five
  admission conditions and the README-record requirement."
- :45-51 — "This exists because events cannot express a gate that must fail
  closed *before* an action runs. Where the coordination is synchronous,
  product-neutral, and decides whether the consuming slice proceeds, use the
  port. **Where it is a product fact one slice publishes and others react to,
  use an event contract per §2.** Reach for the port only when the contract
  genuinely carries no product semantics; 'it was easier than promoting an
  event' is not an admission condition."

The bolded sentence at :47-49 is the routing rule that a candidate handoff
lands on: a submitted contradiction candidate *is* a product fact one slice
publishes. §2a routes that to events, not to the port.

### C2. `DECISIONS.md:1095-1148` — line-accurate

Header at :1095 "## 2026-07-25: Foundation-Mediated Port Inversion Is A Legal
Cross-Slice Mechanism", Status Active (:1097).

Decision (:1101-1104): "A slice may implement a `foundation`-owned port that
another slice consumes, without either slice importing the other. This is a
third legal cross-slice mechanism alongside emitted events and the future
`shared/use-cases` contract package."

**All five admission conditions verbatim (:1106-1115)** — "It is admitted only
when **all** of the following hold:"

1. (:1108) "The port carries no product semantics — its types name no slice's
   language."
2. (:1109-1110) "The port lives in `foundation/*` and satisfies that family's
   own admission rules."
3. (:1111) "Both slices import only `foundation`, never each other."
4. (:1112-1113) "The implementing slice's Layer is bound to the consuming slice
   at an application entrypoint, per `ARCHITECTURE.md` app-entrypoint
   composition."
5. (:1114-1115) "Neither slice names the other in code, package manifests, or
   project references."

**README-record requirement (:1117-1120) verbatim:**

> The implementing and consuming packages each record the coupling in their
> package README, naming the producer/consumer pair and the binding site. The
> README record is the durable proof of the specific coupling; this entry is the
> general rule.

Failure clause (:1122-1123): "If any condition fails, the coupling is a
slice-boundary breach and must go through events or contract promotion instead."

**Ratifying rationale sentence (:1142-1148) verbatim:**

> Events were rejected as the general answer, not merely as this instance's
> answer: a gate that must fail closed *before* an action runs is synchronous by
> nature, and **an emitted event cannot express "and do not proceed."** Forcing
> this shape through events would either lose the fail-closed property or
> reinvent synchronous request/response over an event log. Recording the rule
> now is cheaper than reversing it later, since a ban would require rewriting
> every such binding.

### C3. The two landed precedents

**Precedent 1 — `TierGate`** (the only one named inside DECISIONS, at
:1131-1134): "the agent-execution-authority work: `ontology/server` consumes
`@beep/mcp-kit`'s `TierGate`, `epistemic/server` implements it, and the desktop
entrypoint binds them. `ontology` cannot learn that `epistemic` exists, and
`epistemic` cannot learn that `ontology` does."

- Port file confirmed present: `packages/foundation/capability/mcp-kit/src/TierGate.ts`
- README record: `packages/foundation/capability/mcp-kit/README.md:20` — a table
  row naming producer/consumer and the binding site
  `apps/professional-desktop/server/OntologyMcpTransport.ts`, and explicitly
  labelling itself "This is foundation-mediated port inversion".

**Precedent 2 — `SourceTextResolver`** (NOT named in DECISIONS; named in the
sibling SPEC at `goals/patent-citation-candor-gate/SPEC.md:106-108`):

- Port home: `packages/foundation/capability/file-processing/src/SourceText/index.ts`
  (published as `@beep/file-processing/SourceText`).
- Implementer: `packages/workspace/server/src/SourceText/WorkspaceSourceTextResolver.ts`.
- README records **both sides**:
  - `packages/workspace/server/README.md:5-14` — "`@beep/workspace-server/SourceText`
    implements the product-neutral `@beep/file-processing/SourceText` resolver
    over `WorkspaceVaultStore`. … `@beep/epistemic-server` is the initial
    consumer; the professional desktop runtime is the application binding site".
  - `packages/epistemic/server/README.md:22-28` — "## Foundation-mediated
    source-text coupling / `@beep/epistemic-server` consumes the product-neutral
    `@beep/file-processing/SourceText` resolver port. The initial provider is
    `@beep/workspace-server/SourceText`; the professional desktop runtime is the
    binding site…".

**Slice consumption confirmed** —
`packages/law-practice/use-cases/src/CandorPolicy/CandorPolicy.ports.ts:14`:

```ts
import type { SourceTextResolver } from "@beep/file-processing/SourceText";
```

Type-only import, exactly as the SPEC states.

### C4. NEW FINDING — the README-record requirement is currently unmet for this slice

`packages/law-practice/use-cases` is a live **consumer** of the
`SourceTextResolver` port (C3 above), but its README carries **no coupling
record**. The file is 21 lines total; its only mention of the port's package is
`:14`, and that is an ingestion-dependency sentence ("Live Layers that resolve
the ingestion (`@beep/file-processing` + `@beep/langextract`) … live in
`@beep/law-practice-server`"), not a record "naming the producer/consumer pair
and the binding site" as :1117-1120 requires. `packages/law-practice/server/README.md`
has zero mentions of source-text or file-processing at all. Both recorded READMEs
(workspace/server, epistemic/server) still name `@beep/epistemic-server` as "the
initial consumer" and do not know law-practice exists.

Consequence for the decision: shape 3 is not a free reuse of an
already-compliant precedent. Picking it inherits an existing unmet README-record
obligation *and* adds two more (producer + consumer) for the new port.

### C5. Honest assessment of admission condition 1

**Condition 1 does not hold** for a port carrying triage-candidate vocabulary.

The condition is absolute in its wording: "its types name no slice's language."
The submit surface's four epistemic fields (F below) are
`ContradictionAssessment`, `ContradictionMatchBasis`, `ContradictionBeliefPair`,
`ContradictionReceiptKey` — all from
`@beep/epistemic-domain/values/Contradiction`. That *is* the epistemic slice's
language, by name. A port typed against them names it. The compare-point is
instructive: `TierGate` names tiers and dispatch outcomes (MCP-host vocabulary
owned by the foundation package itself), and `SourceTextResolver` names locators,
digests, and extractor versions (file-processing vocabulary) — neither borrows a
*product slice's* nouns. A `ContradictionCandidateSink` would.

The only way to satisfy condition 1 is to genericize the payload to an opaque
blob, at which point the port stops being a typed handoff and the type safety
that motivated the handoff is gone — and §2a:49-51 forecloses that manoeuvre
directly ("Reach for the port only when the contract genuinely carries no
product semantics").

**The SPEC's second objection is also correct and independent.** The ratifying
rationale (:1142-1148) is scoped to a synchronous gate that must fail closed
before an action runs — "an emitted event cannot express 'and do not proceed'".
A contradiction-candidate submission is an asynchronous data submission: nothing
is gated, nothing must refuse to proceed, and the law-practice side does not
await a permit. The rationale does not transfer. Worse, §2a:47-49 affirmatively
routes this shape elsewhere: "Where it is a product fact one slice publishes and
others react to, use an event contract per §2."

**Verdict C: available in principle, but admission FAILS on condition 1, the
ratifying rationale does not transfer, the §2a routing rule points away from it,
and the precedent it would lean on has an unmet README-record obligation.**

---

## D. Shape 4 — extending the slice's documented bounded exception

### D1. The two README exception records

`packages/law-practice/use-cases/README.md:18-21` (SPEC cites `:18-22`; the file
is **21 lines**, so the record ends at :21 — minor off-by-one in the SPEC):

> This is the slice's documented cross-slice bounded exception: importing
> `@beep/epistemic-*` is sanctioned at the use-cases tier per the spike SPEC
> Exception Ledger and `DECISIONS.md`. The law-practice DOMAIN tier stays clean —
> no epistemic dependency there.

Also load-bearing from the same file, :12-16 — "This tier owns CONTRACTS ONLY:
typed `Context.Service` ports with no implementation bodies and no live Layers."
That constrains where a submit call may live (server tier, not here).

`packages/law-practice/server/README.md:15-19` (SPEC cites `:15-21`; the
exception record proper is :15-19, and :21-23 is a *separate* note):

> The review loop depends on the epistemic admission services, so this tier
> provides `EpistemicServerLive` at the merge boundary. The cross-slice
> `@beep/epistemic-*` dependency is the slice's documented bounded exception (per
> the spike SPEC Exception Ledger + `DECISIONS.md`); the law-practice DOMAIN tier
> stays clean.

:21-23 (the separate, self-flagged debt): "Claims-batch persistence temporarily
imports `@beep/epistemic-tables` to write the bundle PGlite substrate; revisit
when intake P4-proper lands `ClaimGate` persistence."

### D2. Package manifests — both SPEC line citations EXACT

`packages/law-practice/use-cases/package.json` (`dependencies` opens :51):

```
52:    "@beep/epistemic-domain": "workspace:^",
53:    "@beep/epistemic-use-cases": "workspace:^",
```

`packages/law-practice/server/package.json` (`dependencies` opens :45):

```
47:    "@beep/epistemic-domain": "workspace:^",
48:    "@beep/epistemic-server": "workspace:^",
49:    "@beep/epistemic-tables": "workspace:^",
50:    "@beep/epistemic-use-cases": "workspace:^",
```

Four packages including `@beep/epistemic-tables`, exactly as claimed. The
`@beep/epistemic-use-cases` declaration on the server tier is what makes the
`/server` subpath (and therefore `ContradictionTriageRepository.submit`)
reachable **with no new package edge**.

The `epistemic-tables` edge is separately banned by
`10-cross-slice-coordination.md:57`: "A slice MUST NOT read another slice's
tables, projections, or read models to recover an event it could have subscribed
to. Reading another slice's tables is a slice-to-slice coupling per
`01-hexagonal-vertical-slices.md`."

### D3. The load-bearing Exception Ledger row — `goals/law-practice-office-action-spike/SPEC.md:258`

Line number **EXACT**. Table header at :256-257. Full row verbatim:

> | Direct cross-slice composition of the epistemic gate/projection | `law-practice-use-cases` + `law-practice-server` import the epistemic mechanism's public surface: `@beep/epistemic-use-cases` (`ClaimGate`/`ClaimLifecycle`/`ClaimProjection`), the entailed mechanism types from `@beep/epistemic-domain` (`CandidateClaim`, `Evidence`, `ClaimProjectionView`), and `@beep/epistemic-server/layer` (`EpistemicServerLive`) to drive the loop | law-practice slice | Doctrine routes cross-slice integration through `shared/use-cases` or events (`01-hexagonal-vertical-slices.md:71-74`), but a full shared contract for a one-fixture spike is premature; the bounded exception is the deliberate, documented choice per `standards/architecture/DECISIONS.md` (2026-06-18). The domain tier stays clean (foundation + shared-kernel only). | Extract a `shared/use-cases` contract (or emitted event) when a third consumer of the epistemic boundary appears. |

### D4. Domain-tier commitment — `goals/law-practice-office-action-spike/SPEC.md:207`

Line **EXACT**. It is the "No slice leakage" row of the Verification Matrix:

> | No slice leakage | `rg -n 'from "@beep/epistemic-(domain\|use-cases\|server)' packages/law-practice/**/src` — every hit resolves to a canonical public subpath (root, `/values`, `/ClaimGate`, `/ClaimLifecycle`, `/ClaimProjection`, `/layer`); zero `/internal/*` | No internal imports; `packages/law-practice/domain/src` has zero hits |

Live re-verification: `packages/law-practice/domain/src` has **0** `@beep/epistemic`
hits. Commitment holds today.

### D5. Is a triage handoff a "third consumer"? — assessment

**Answer: No, on the counting unit the ledger row's own cited authority
defines — but the row's Scope column still has to be widened.**

The row's Rationale column cites `standards/architecture/DECISIONS.md`
(2026-06-18) as the governing decision. That entry is at **:945-984**
("## 2026-06-18: Cross-Slice Consumption Of The Epistemic Boundary", Status
Active), and it is where the phrase "third consumer" originates. Its third
bullet, :965-970, verbatim:

> - **Mechanism** — the gate, projection, and transition services and their live
>   Layers — stays in the owning slice. The consuming slice composes it at the
>   use-cases/server tier via a documented **bounded exception** recorded in the
>   consumer packet's Exception Ledger, until a third consumer justifies
>   extracting a `shared/use-cases` contract (or emitted event) per
>   `01-hexagonal-vertical-slices.md:71-74`.

The counting unit is fixed by :955-956: "**A consuming vertical** (e.g.
`law-practice`) crosses the boundary **by tier**". So one consuming *vertical*
crossing at two tiers (use-cases **and** server) is explicitly **one** consumer,
not two — the two-tier composition is what "by tier" describes.

**Who the consumers are today.** Repo-wide, the packages declaring any
`@beep/epistemic-*` dependency (excluding the epistemic slice itself):

| Package | Counts as a consumer? |
| --- | --- |
| `packages/law-practice/use-cases` + `packages/law-practice/server` | **Consumer #1** — one consuming vertical crossing by tier |
| `apps/professional-desktop` | No — application entrypoint / composition root; app-entrypoint composition is explicitly blessed (DECISIONS :1112-1113, ARCHITECTURE app-entrypoint composition) |
| `packages/_internal/db-admin` | No — internal tooling, `@beep/epistemic-tables` only, for migrations |

**law-practice is the only consuming product slice — consumer #1. There is no
consumer #2, so there cannot be a #3.** A triage handoff landing in
law-practice/server is the same vertical adding a second use case.

The alternative package-counting reading (use-cases = 1, server = 2, triage = 3)
**also fails to trip the condition**, because the triage handoff would land in
those same two packages and introduce no third consuming package. Under both
readings the removal condition is not mechanically tripped.

**The real residual cost, which the SPEC under-states in the other direction.**
The row's *Scope* column is an enumeration, not a general licence: it names
`ClaimGate`/`ClaimLifecycle`/`ClaimProjection`, `CandidateClaim`, `Evidence`,
`ClaimProjectionView`, and `EpistemicServerLive`. `ContradictionTriage` and
`SubmitContradictionCandidate` are **not** in that enumeration. So shape 4 adds
no package edge and does not trip the removal condition, but it **does** require
an amended or new Exception Ledger row widening the Scope, in this goal's packet,
with owner sign-off — the same instrument the sibling left PENDING.

**Verdict D: the SPEC's framing ("closer to the event that trips the removal
condition than to something the exception covers") is too pessimistic on the
removal condition and too optimistic on coverage. Correct reading: the removal
condition is NOT tripped, and the exception as written does NOT cover triage.
The gap is closed by an amended ledger row, not by extraction.**

---

## E. The sibling deferral precedent

`goals/patent-citation-candor-gate/SPEC.md` — both entries found by phrase;
current line numbers **:114** and **:124** (the SPEC's `:114-128` citation is
accurate as a range).

**Entry 10, :114-123, verbatim:**

> 10. **Owner ruling on decision 9 (2026-08-05): durability now, gate shape
>     deferred.** Rung 2 in this goal is the half that needs no cross-slice
>     decision — durable append-and-read-only ports, repository and layer on the
>     `ExecutionLedger` precedent, the slice's first db-admin migration with
>     append-only guards, its PGlite migration test, `AcceptedProofManifest`
>     entries, and the append-only IDS fact records. The cross-slice
>     consultation and the `foundation/capability` gate-port package are
>     deferred to a follow-up, with `research/01-gate-shape-check.md` as the
>     standing evidence. The Exception Ledger entry stays PENDING and is not
>     exercised by this goal.

**Entry 11, :124-128, verbatim:**

> 11. **Owner ruling on the live-gate criterion (2026-08-05): rescope to the
>     predicate boundary.** Both directions are asserted at the `CandorPolicy`
>     predicate boundary; the app-entrypoint binding and the agents-slice
>     promotion-path consultation are recorded as deferred rather than claimed.
>     This goal never asserts a live gate it cannot prove.

**Exception Ledger — present, PENDING, unexercised.** Header at :443, table at
:445-447. The single row at **:447** opens:

> | **PENDING SIGN-OFF** — one new `foundation/capability` package holding a
> product-neutral gate port | Rung 2 only; the port carries no candor, citation,
> filing, or disposition semantics | **Unassigned — requires repo owner** |
> Decision 9: the two shapes decision 7 authorized are unavailable (events have
> no transport and cannot fail closed; the promoted contract fails the
> ≥2-consumer promotion bar). Foundation-mediated port inversion is the mechanism
> the repo ratified 2026-07-25 for exactly this synchronous fail-closed case, and
> is strictly smaller than either alternative. | Not applicable — the package is
> the lawful home. Withdraw the exception only if the gate stops needing a
> cross-slice consumer. |

Owner column is literally "Unassigned — requires repo owner"; entry 10 states it
"stays PENDING and is not exercised by this goal". **Confirmed unexercised.**

Two further sibling facts that matter here:

- :101-105 independently re-derives shape 2's disqualification ("`02-shared-kernel.md:189`
  requires ≥2 packages currently importing the export by name; this gate has one
  consumer. Creating `packages/shared/use-cases` here waives the bar rather than
  clearing it.").
- :106-111 **recommended** port inversion for its case, naming both precedents —
  and then the owner **deferred it anyway** at :114-123. That is the shape of the
  precedent: even where shape 3 was the recommended pick, the ruling was defer +
  standing evidence + PENDING ledger, not exercise.
- :163-164 non-goal: "No new source-text resolution service and no source custody
  inside law-practice: the existing `SourceTextResolver` port is reused as-is."

---

## F. The submit surface

All under `packages/epistemic/use-cases/src/ContradictionTriage/`
(7 files: `.commands.ts`, `.errors.ts`, `.ports.ts`, `.rpc.ts`, `.service.ts`,
`index.ts`, `server.ts`).

### F1. RPC — four endpoints, no submit (CONFIRMED)

`ContradictionTriage.rpc.ts`: `ListContradictionCandidates` (:499),
`GetContradictionCandidate` (:518), `ReviewContradictionCandidate` (:537),
`GetEvidenceSourcePage` (:556), grouped by `RpcGroup.make` at :575. A
case-insensitive search for `submit` in the file returns **zero hits**.

### F2. Service facade — no submit (CONFIRMED)

`ContradictionTriage.service.ts:40-56` — `ContradictionTriageService` declares
exactly four methods: `getCandidate` (:43), `getEvidenceSourcePage` (:46),
`listCandidates` (:49), `reviewCandidate` (:52). Zero `submit` hits in the file.
SPEC's `:40-56` citation is exact.

### F3. `SubmitContradictionCandidate` — eleven fields, four epistemic (CONFIRMED)

Class at **:125** (`export class SubmitContradictionCandidate extends S.Class<…>`),
built from `SubmitContradictionCandidateSchema` (:80) over
`SubmitContradictionCandidateStruct` at **:34-75**. Both SPEC citations exact.

| # | Field | Line | Source | Epistemic? |
| --- | --- | --- | --- | --- |
| 1 | `assessment` | :38 | `@beep/epistemic-domain/values/Contradiction` | **YES** |
| 2 | `matchBasis` | :41 | `@beep/epistemic-domain/values/Contradiction` | **YES** |
| 3 | `orgId` | :44 | `@beep/shared-domain/identity/Shared` (`Shared.OrganizationId`) | no |
| 4 | `pair` | :47 | `@beep/epistemic-domain/values/Contradiction` (`ContradictionBeliefPair`) | **YES** |
| 5 | `receiptKey` | :50 | `@beep/epistemic-domain/values/Contradiction` | **YES** |
| 6 | `recordedAt` | :53 | `@beep/schema/EntitySchema` (`DateTimeFromMillis`) | no |
| 7 | `receivedBy` | :56 | `@beep/shared-domain/entity/Principal` | no |
| 8 | `source` | :59 | `@beep/shared-domain/entity/SourceKind` | no |
| 9 | `schemaVersion` | :62 | `@beep/schema/SemanticVersion` | no |
| 10 | `validFrom` | :65 | `@beep/schema/EntitySchema` | no |
| 11 | `validTo` | :68 | `@beep/schema/EntitySchema` + `S.OptionFromNullOr` | no |

Ratio **4 / 11**, exactly as the SPEC states. The epistemic import block is
`:9-17` (SPEC citation exact) and pulls seven symbols, of which four are used by
this struct.

Precision note: `SourceTextIdentity` is imported from `@beep/provenance` at :19
but is **not** one of the eleven fields (used elsewhere in the file). The SPEC's
"shared-kernel / `@beep/schema` types the slice already imports" is accurate as
to family for all seven non-epistemic fields.

### F4. Repository port — five operations at `:374-395` (CONFIRMED)

`ContradictionTriage.ports.ts`, `interface ContradictionTriageRepositoryShape`:
`get` (:375), `getExpanded` (:378), `list` (:381), `review` (:384), `submit`
(:392-394). SPEC's `:374-395` is exact.

`submit` signature:

```ts
readonly submit: (
  command: SubmitContradictionCandidate
) => Effect.Effect<ContradictionSubmission, ContradictionRepositoryUnavailable | ContradictionSubmissionConflict>;
```

### F5. Exports map — no `./ContradictionTriage` subpath (CONFIRMED)

`packages/epistemic/use-cases/package.json` `exports`:

```json
{ ".": "./src/index.ts", "./public": "./src/public.ts", "./server": "./src/server.ts",
  "./ClaimDisposition": "…", "./ClaimGate": "…", "./ClaimLifecycle": "…",
  "./ClaimProjection": "…", "./EdgeAuthority": "…", "./ExecutionLedger": "…",
  "./internal/*": null, "./package.json": "./package.json" }
```

No `./ContradictionTriage`, unlike `./ClaimGate` / `./EdgeAuthority` /
`./ExecutionLedger`. `./internal/*` is hard-nulled.

Reachability, verified end to end:

- `src/server.ts:67` `export * as ContradictionTriage from "./ContradictionTriage/server.ts";`
  and `:74` `export * from "./ContradictionTriage/server.ts";` →
  `ContradictionTriage/server.ts` re-exports `.commands.ts` (:14), `.errors.ts`
  (:21), `.ports.ts` (:28), `.service.ts` (:35). **This is the only route to
  `SubmitContradictionCandidate` and `ContradictionTriageRepository`.**
- `src/public.ts:37`/`:44` → `ContradictionTriage/index.ts`, which exports only
  the client-safe set: `ContradictionCandidatePageLimit`,
  `ContradictionDispositionFilter`, `ContradictionReviewDecision`,
  `GetContradictionCandidate`, `ReviewContradictionCandidate` (:14-20), three
  read models (:27-31), and the RPC declarations (:38). **No submit.**
- `src/index.ts:31` `export * from "./public.ts";` — the root is the public
  surface indirectly, so the SPEC's claim holds (via `public.ts`, not by a direct
  `ContradictionTriage/index.ts` re-export).

**Verdict F: every claim confirmed. Any submitting caller is an in-process
server-tier caller importing `@beep/epistemic-use-cases/server`, by
construction.**

---

## G. Drift baseline — 13 sites across 4 files (CONFIRMED EXACT)

`packages/law-practice/use-cases/src` — **6 sites, 2 files**:

| File:line | Import |
| --- | --- |
| `OfficeActionReview/OfficeActionReview.service.ts:15` | `{ CandidateClaim, Evidence } from "@beep/epistemic-domain"` |
| `OfficeActionReview/OfficeActionReview.service.ts:16` | `{ projectClaims } from "@beep/epistemic-use-cases/ClaimProjection"` |
| `OfficeActionReview/OfficeActionReview.service.ts:28` | `type { ClaimGateShape } from "@beep/epistemic-use-cases/ClaimGate"` |
| `OfficeActionReview/OfficeActionReview.service.ts:29` | `type { ClaimTransitionShape } from "@beep/epistemic-use-cases/ClaimLifecycle"` |
| `OfficeActionReview/OfficeActionReview.ports.ts:13` | `{ CandidateClaim, Evidence } from "@beep/epistemic-domain"` |
| `OfficeActionReview/OfficeActionReview.ports.ts:22` | `type { ClaimProjectionView } from "@beep/epistemic-domain/values"` |

`packages/law-practice/server/src` — **7 sites, 2 files**:

| File:line | Import |
| --- | --- |
| `PracticeKg.claims.ts:8` | `{ CandidateClaim } from "@beep/epistemic-domain/entities/CandidateClaim"` |
| `PracticeKg.claims.ts:9` | `{ Evidence } from "@beep/epistemic-domain/entities/Evidence"` |
| `PracticeKg.claims.ts:10` | `* as CandidateClaimTable from "@beep/epistemic-tables/entities/CandidateClaim"` |
| `PracticeKg.claims.ts:11` | `* as EvidenceTable from "@beep/epistemic-tables/entities/Evidence"` |
| `Layer.ts:16` | `{ EpistemicServerLive } from "@beep/epistemic-server/layer"` |
| `Layer.ts:17` | `{ ClaimGate } from "@beep/epistemic-use-cases/ClaimGate"` |
| `Layer.ts:18` | `{ ClaimTransition } from "@beep/epistemic-use-cases/ClaimLifecycle"` |

**Total 13 / 4 files — the SPEC's number is exact and current.**
`packages/law-practice/domain/src`: **0** hits (commitment intact).

Two of the thirteen (`PracticeKg.claims.ts:10-11`) are the separately-banned
cross-slice *table* reads (`10-cross-slice-coordination.md:57`), self-flagged as
temporary at `packages/law-practice/server/README.md:21-23`. Every other hit
resolves to a canonical public subpath; zero `/internal/*`.

---

## H. `standards/ARCHITECTURE.md:632-636` — doctrinally stale (CONFIRMED)

Line-accurate, verbatim :632-636:

> - Slice-to-slice direct imports across `domain`, `use-cases`, `server`,
>   `tables`, `client`, or `ui` packages of *different* slices are forbidden.
>   Cross-slice integration goes through emitted events or, if a real contract has
>   been promoted, the future `shared/use-cases` package. This is the same family
>   of acyclic ceiling that drivers respect among themselves, applied to slices.

**Two mechanisms only.** No mention of foundation-mediated port inversion
anywhere in the surrounding dependency-ceiling list (:620-640). The identical
two-mechanism framing also appears at
`01-hexagonal-vertical-slices.md:71-74` — which is the citation the office-action
Exception Ledger row's Rationale column uses. Both are pre-2026-07-25 baselines
and must be cited only alongside `10-cross-slice-coordination.md:36-51` and
`DECISIONS.md:1095-1148`.

---

# Assessment

## Shape-by-shape

### Shape 1 — emitted events

**Disqualifying evidence: STANDS (phrasing needs a footnote).** Zero *slice*
event/handler/process files; the single repo-wide `*.events.ts` is
`foundation/ui-system/dock`, a UI POC. No bus, dispatcher, or process manager
anywhere. The contract home `shared/use-cases` does not exist
(`10-…:24-26`, `DECISIONS:993-998`).

**Would bind:** create `packages/shared/use-cases` (package.json, tsconfig
reference, workspace registration, generated identity composer, README promotion
record) + `shared/use-cases/epistemic/events/<Event>.ts` + an event transport
that does not exist + an emitter in `packages/law-practice/server/src` + a
handler in `packages/epistemic/server/src`.

**Pro/con:** The only mechanism whose semantics actually fit an async
publish-and-react handoff — §2a:47-49 routes exactly this shape to events, so
doctrinally it is the *right* answer. But it is a strict superset of shape 2's
cost (same package creation, plus a transport), it fails the same ≥2 promotion
bar, and building a cross-slice event transport is a repo-scale initiative that
would swallow this goal whole. Not viable inside rung 2.

### Shape 2 — promoted `shared/use-cases` contract

**Disqualifying evidence: STANDS.** `02-shared-kernel.md:189` requires ≥2
packages *currently* importing by name; a triage-submit contract has exactly one
(law-practice). The sibling reached the identical conclusion at its `:101-105`.

**Would bind:** create `packages/shared/use-cases` with a full promotion record
(:187-197 field set, including "Coupling acceptors: PR review sign-off from each
consuming slice's owner") + the contract module + rewiring
`packages/epistemic/use-cases/src/ContradictionTriage/ContradictionTriage.ports.ts`
to consume it.

**Pro/con:** Clears the doctrine permanently and creates the package the repo has
been deferring since 2026-06-21, so a future third consumer costs nothing. But it
waives the bar it is supposed to clear, on a one-consumer surface, in a goal
whose subject is legal positions and relators — and a promotion record whose
"Current consumers" line reads "1" is a self-documenting violation that
`lint:promotion-records` exists to catch. Wrong goal to do it in.

### Shape 3 — foundation-mediated port inversion

**Disqualifying evidence: STANDS, and is stronger than the SPEC states.** Three
independent problems: (a) admission condition 1 fails — a triage port's types
name `ContradictionAssessment`/`MatchBasis`/`BeliefPair`/`ReceiptKey`, which is
the epistemic slice's language, and genericizing to an opaque payload is
foreclosed by §2a:49-51; (b) the ratifying rationale is scoped to a synchronous
fail-closed gate ("an emitted event cannot express 'and do not proceed'",
DECISIONS:1144) and does not transfer to an async submission, while §2a:47-49
affirmatively routes async product facts to events; (c) **new** — the precedent
this slice already consumes (`SourceTextResolver` at `CandorPolicy.ports.ts:14`)
has **no README coupling record on the law-practice side**, so the :1117-1120
requirement is already unmet and shape 3 would inherit that debt plus two new
records.

**Would bind:** a new (or extended) `foundation/capability` package + port
module; `packages/law-practice/server/src` consuming the port; a new
implementation in `packages/epistemic/server/src`; an application binding in
`apps/professional-desktop`; README coupling records in **both** packages; plus
retroactively fixing the missing law-practice `SourceTextResolver` record.

**Pro/con:** It is the repo's newest ratified mechanism with two landed
precedents, one already inside this slice, and it adds no slice-to-slice package
edge. But it is admitted "only when **all**" five conditions hold, and condition
1 does not — and DECISIONS:1122-1123 is explicit that "if any condition fails,
the coupling is a slice-boundary breach". Picking it means arguing a triage
vocabulary is product-neutral, which it is not.

### Shape 4 — extend the slice's documented bounded exception

**Evidence: partially reframed.** The SPEC says a triage handoff is "closer to
the event that *trips* the removal condition than to something the exception
covers". Half right. On the removal condition it is **wrong**: the counting unit
per `DECISIONS:955-956` + `:965-970` is a consuming *vertical* crossing "by
tier", law-practice is the only consuming product slice (`apps/professional-desktop`
is a blessed composition root, `_internal/db-admin` is tooling), so law-practice
is consumer #1 and no #3 exists — and the package-counting reading fails to trip
it too, since triage lands in the same two packages. On coverage it is **right**:
the row's Scope column enumerates `ClaimGate`/`ClaimLifecycle`/`ClaimProjection`,
`CandidateClaim`, `Evidence`, `ClaimProjectionView`, `EpistemicServerLive` —
`ContradictionTriage` is not among them.

**Would bind:** consumer is `packages/law-practice/server` (not use-cases — that
tier is "CONTRACTS ONLY" per its README:12-16, and `submit` is server-only).
Files: a new law-practice server module calling
`ContradictionTriageRepository.submit` via `@beep/epistemic-use-cases/server`;
`packages/law-practice/server/src/Layer.ts` (already wires `EpistemicServerLive`);
`packages/law-practice/server/README.md` (widen the exception record);
`goals/legal-position-relator-runtime/SPEC.md` (new/amended Exception Ledger row
widening Scope beyond gate/projection, with owner sign-off). **No package.json
change — `@beep/epistemic-use-cases` is already declared at server
package.json:50, so no new package edge.**

**Pro/con:** Cheapest by a wide margin, adds no package edge, keeps the domain
tier clean, and stays inside the mechanism the repo already blessed for exactly
this slice pair. The cost is honest but real: it deepens a drift the SPEC itself
calls "real and wide" (13 sites / 4 files), it needs an amended ledger row plus
owner sign-off, and each such widening makes the eventual extraction more
expensive. It also cannot be done silently — the Scope enumeration would have to
name ContradictionTriage explicitly.

### Shape 5 — defer, with recorded standing evidence (the sibling precedent)

**Precedent: directly on point and binding-by-analogy.** The sibling goal
recommended shape 3 at `goals/patent-citation-candor-gate/SPEC.md:106-111` and
the owner **still deferred** at :114-123: "The cross-slice consultation and the
`foundation/capability` gate-port package are deferred to a follow-up, with
`research/01-gate-shape-check.md` as the standing evidence. The Exception Ledger
entry stays PENDING and is not exercised by this goal." Its ledger row at :447 is
"**PENDING SIGN-OFF**", Owner "Unassigned — requires repo owner", confirmed
unexercised. Entry 11 (:124-128) adds the governing principle: "This goal never
asserts a live gate it cannot prove."

**Would bind:** `goals/legal-position-relator-runtime/SPEC.md` decision log (the
ruling + the pick deferred), this evidence file promoted into the packet's
`research/`, and an Exception Ledger entry left PENDING. Rung 2 still lands its
law-side half — durable position/relator records and a law-owned outbound port
contract with no cross-slice binding.

**Pro/con:** Costs nothing architecturally, preserves every option, and matches a
five-day-old owner ruling on the structurally identical question in the sibling
packet. The cost is that rung 2 ships a handoff-shaped port with no live
consumer, which is exactly the "durability now, shape deferred" split the sibling
already validated — and the SPEC's own binding constraint ("This goal never
claims a live handoff it cannot prove") points the same way.

## Recommendation

**1st — Shape 5 (defer), with a law-owned outbound port left unbound.** The
sibling ruling of 2026-08-05 is the same question, same slice pair, same week,
and resolved to defer even where shape 3 was recommended. Rung 2's law-side value
(durable positions, relators, correction contract) does not depend on the binding
existing. Record the standing evidence, leave the ledger entry PENDING, name the
follow-up.

**2nd — Shape 4 (extend the bounded exception, server tier only).** If the
orchestrator wants a live handoff inside this goal, this is the only shape that
does not create a package, waive a promotion bar, or fail an admission condition.
It requires: consumer in `packages/law-practice/server` only; an amended
Exception Ledger row explicitly naming `ContradictionTriage` in its Scope; an
updated `packages/law-practice/server/README.md`; and owner sign-off. It must not
be done by silently reading the existing row as already covering triage — it does
not.

**Not recommended: shapes 1, 2, 3**, each for the reasons above; shape 3 in
particular should not be picked without an explicit owner ruling that triage
vocabulary is product-neutral, which the evidence does not support.

**The orchestrator and `architecture-guardian` make the binding call — this is
evidence, not a decision.**

## Corrections the SPEC should absorb regardless of the pick

1. `:337-339` — "Zero slice `*.events.ts`" should note the single repo-wide hit
   is `packages/foundation/ui-system/dock/src/Dock.events.ts` (UI POC, not a
   slice contract). Conclusion unchanged.
2. `:361` — `packages/law-practice/use-cases/README.md:18-22` → **:18-21** (file
   is 21 lines).
3. `:361-362` — `packages/law-practice/server/README.md:15-21` → the exception
   record is **:15-19**; :21-23 is a separate `epistemic-tables` note.
4. `:369-372` — the removal-condition reading should be corrected: per
   `DECISIONS:955-956` + `:965-970` the counting unit is a consuming *vertical*,
   law-practice is consumer #1, and a triage handoff does not trip the condition.
   The actual blocker is the Scope enumeration, which does not cover triage.
5. **New, unrecorded:** `packages/law-practice/use-cases` consumes the
   `SourceTextResolver` port at `CandorPolicy.ports.ts:14` with no README
   coupling record, so `DECISIONS:1117-1120` is currently unmet for this slice.
   Worth a friction receipt in the packet ledger independent of this decision.
