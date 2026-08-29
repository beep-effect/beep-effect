# Patent Citation Candor Gate Spec

## Objective

Convert the duty of candor (37 CFR 1.56) from an ambient, manual exposure into
an explicit, auditable gate in the law-practice slice:

- Every AI-discovered patent-reference occurrence for a filing's references is
  recorded as a source-versioned, evidence-grounded `PatentCitationEvent`
  (examiner occurrences are recorded alongside but do not gate in this goal).
- Attorney judgment exists only as a `CandorDisposition` record bound to the
  exact event and its exact observation version — no legal judgment is ever
  computed by the system.
- Filing promotion is blocked by a derived, fail-closed `CandorPolicy`
  predicate until every current AI-discovered event is covered; a newer
  observation version of a source re-blocks until the newer event is itself
  dispositioned. Blocked-vs-released is owned and proven in law-practice at
  the predicate boundary; advancing a candidate through the agents runtime's
  own decision vocabulary is gated on `agentic-professional-runtime`.
- Rung 1 proves the domain (schemas + service contract + failing-then-green
  `CandorPolicy.test.ts` over in-memory/test-only storage). Rung 2 retires the
  risk: durable storage on the `ExecutionLedger` precedent, the slice's first
  db-admin migration, and the live filing-promotion path actually consulting
  the predicate.

## Decision Log (binding — from the graduated exploration)

Full grill log with rationale:
[`explorations/patent-citation-candor-gate/DECISIONS.md`](../../explorations/patent-citation-candor-gate/DECISIONS.md).
Normative here:

1. **Design order** — schema → `Context.Service` contract → implementation
   (standing repo law; rung 1 follows it end to end).
2. **Hard fact/judgment split** — append-only fact records own the
   1.97/1.98/supplemental mechanics; `CandorDisposition` holds ONLY the dated,
   scoped attorney judgment referencing exact facts and observation version,
   and keeps two distinct judgment slots (Rule 56 vs litigation-frame)
   representable from rung 1 without deriving either.
3. **Derived gate, no stored closure** — no "duty satisfied" state exists
   anywhere; the predicate is recomputed from events + dispositions; stale,
   quarantined, and possible-duplicate events count as undisposed (fail
   closed).
4. **Predicate semantics** — coverage requires a disposition bound to the
   exact observation version AND that version being current for its source; a
   superseded event stops blocking only once the newer event is itself
   dispositioned; examiner events record without gating (widening the
   quantified set is a later align question).
   **Scope clarification (2026-08-06, post-merge):** "record without gating"
   constrains what *initiates* gating — a source with no AI-discovered event
   never blocks — and does NOT mean an examiner-observed event can never be the
   subject of a judgment. When an examiner-observed observation supersedes an
   AI-discovered one, it becomes the current observation of that source, so the
   group is cleared by dispositioning that examiner-observed head. Whether the
   AI finding's history is discharged by the arrival of an examiner record is a
   legal question the predicate must never compute, so it blocks until a human
   decides. Narrowing the head lookup to AI-discovered events would leave zero
   unsuperseded heads and trip `ambiguous-lineage` with no way to clear it —
   verified by mutation. Pinned in both directions by `CandorPolicy.test.ts` >
   "an examiner-observed head is dispositionable". This clarifies decision 4's
   scope and does not widen the quantified set; that align question stays
   parked.
5. **Application identity** — a law-owned union accepting the USPTO
   eight-digit normalized form (driver shape mirrored, never imported) and
   the live WIPO ST.13 `ApplicationNumber`, with explicit conversion — never
   `OfficeAction`'s free-text `applicationNumber`, never a `PatentAsset`
   fixture key, and never ST.13-only.
6. **`PatentFragmentLocator` home** — law-practice value object beside
   `Claim`/`PatentDocumentTriplet`/`DurableLocator`, composing verified
   anchors; rung-1 optional slot at most, dropped first if rung 1 busts its
   budget.
7. **Cross-slice law** — slice-to-slice imports are forbidden; epistemic's
   `EvidenceSpan` is NOT embedded (foundation's receipt suffices);
   `RuntimeApprovalGate` is composed read-only through a doctrine-sanctioned
   shape: `standards/ARCHITECTURE.md:632-636` names exactly two — emitted
   events (preferred here) or a contract promoted into `shared/use-cases`
   through the normal promotion gate. App-level entrypoint composition is
   wiring only and must never own cross-slice orchestration
   (`standards/ARCHITECTURE.md` God-Layer rejection test). Decompose narrowed
   the BRIEF's wider list to these two; the final binding pick lands at P0
   with an `architecture-guardian` check. The existing law-practice →
   epistemic dependencies are prior drift this goal must not compound.
8. **Core-first rungs** — rung 1 domain proof, rung 2 durability + fact
   records + live invocation; nothing sequenced between them.
9. **P0 gate-shape finding (2026-08-05) — decision 7's two options are both
   unavailable; a third, ratified shape is recommended and awaits owner
   sign-off.** Evidence:
   [`research/01-gate-shape-check.md`](./research/01-gate-shape-check.md).
   - Decision 7 read `standards/ARCHITECTURE.md:632-636` correctly, but that
     bullet is stale. `standards/architecture/10-cross-slice-coordination.md:36-51`
     and `standards/architecture/DECISIONS.md:1095-1148` ratified a third
     mechanism on 2026-07-25 — **foundation-mediated port inversion** — and
     that ratifying decision rejects events *specifically* for a gate that
     must fail closed before an action runs, which is exactly this gate.
   - **Emitted events are not viable.** No domain event has ever been defined,
     emitted, delivered, or consumed in this repo: zero slice `*.events.ts`,
     zero `*.event-handlers.ts`, no shared event log, no bus. Worse, the
     doctrine requires a cross-slice event contract to live in
     `shared/use-cases` anyway, so this option is a strict superset of the
     other — plus a durable journal with no lawful home — and at the end an
     event still cannot say "do not proceed".
   - **The promoted contract fails its own promotion bar.**
     `standards/architecture/02-shared-kernel.md:189` requires ≥2 packages
     currently importing the export by name; this gate has one consumer.
     Creating `packages/shared/use-cases` here waives the bar rather than
     clearing it.
   - **Recommended: foundation-mediated port inversion**, with two landed
     precedents — `TierGate` (`packages/foundation/capability/mcp-kit/src/TierGate.ts`)
     and `SourceTextResolver`, the port this SPEC already consumes at rung 1.
     It needs a product-neutral gate port in a new `foundation/capability`
     package, which breaches the Non-Goal below and therefore requires an
     Exception Ledger entry plus owner sign-off before P2 writes it.
   - **Rung 1 is unaffected by this choice and is complete** — the shape
     decides who reads the predicate, not what the predicate is.
10. **Owner ruling on decision 9 (2026-08-05): durability now, gate shape
    deferred.** Rung 2 in this goal is the half that needs no cross-slice
    decision — durable append-and-read-only ports, repository and layer on the
    `ExecutionLedger` precedent, the slice's first db-admin migration with
    append-only guards, its PGlite migration test, `AcceptedProofManifest`
    entries, and the append-only IDS fact records. The cross-slice
    consultation and the `foundation/capability` gate-port package are
    deferred to a follow-up, with `research/01-gate-shape-check.md` as the
    standing evidence. The Exception Ledger entry stays PENDING and is not
    exercised by this goal.
11. **Owner ruling on the live-gate criterion (2026-08-05): rescope to the
    predicate boundary.** Both directions are asserted at the `CandorPolicy`
    predicate boundary; the app-entrypoint binding and the agents-slice
    promotion-path consultation are recorded as deferred rather than claimed.
    This goal never asserts a live gate it cannot prove.

## Non-Goals

- No computed legal judgment, ever: Rule 56 materiality, Therasense but-for
  materiality or its egregious-misconduct exception, cumulativeness, intent,
  1.98(c)/(d) copy-exception applicability, cancelled/withdrawn-claim
  excusal, or duty satisfaction inferred from the absence of recorded events.
- No inference of examiner reliance, approval, or materiality from IDS
  markings; `considered`/not/partially states, initials, stamps, dates, and
  stated reasons are recorded exactly as observed.
- No stored "duty satisfied" state in any form.
- No grouped/manifest dispositions (single-event binding only; returns via
  its own align question with practice evidence).
- No continuing-application matrix (MPEP 609.02) and no 1.97(e)
  certification predicates.
- No migration, rewrite, or deprecation of `PriorArtReference`; no
  generalizing its `officeActionFixtureKey` into face-list presence,
  applicant-submission, or model-relevance claims; and no reuse of
  donor-shaped `CitationBase` — actor, face-list presence, office-action
  reliance, and model similarity stay separate fields (T2-F2).
- No reference-reconciliation engine, no as-of citation timeline projection,
  no practice-kg-mcp surface changes.
- No forking or pre-implementing the SPECs of `citation-extraction-engine`,
  `citation-verified-span-substrate`, or `uspto-prosecution-read`.
- No changes to the `RuntimeApprovalGate` contract or the agents slice's
  decision/lifecycle vocabularies.
- No new packages: everything lands in existing law-practice packages. The
  single bounded exception is decision 7's promoted-contract gate shape,
  which would have to create `packages/shared/use-cases`
  (`standards/ARCHITECTURE.md:352-356` — no package directory today);
  picking it at P0 requires an Exception Ledger entry plus owner sign-off
  before the package is created, and the promotion record of
  `standards/ARCHITECTURE.md:366-375`. Emitted events stay preferred
  precisely because they need none of that.
- No new source-text resolution service and no source custody inside
  law-practice: the existing `SourceTextResolver` port is reused as-is.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards (`standards/ARCHITECTURE.md`
   cross-slice and driver-boundary rules bind the gate composition).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/law-practice/domain` — `PatentCitationEvent`, `CandorDisposition`
  entities; the application-identity union value; the optional
  `PatentFragmentLocator` value (rung-1 optional).
- `packages/shared/domain` — identity module only: the two new EntityId
  registrations (`PatentCitationEventId`, `CandorDispositionId`) in
  `src/identity/LawPractice.ts`, following the `PriorArtReferenceId`
  precedent (every law-practice entity takes its id from there).
- `packages/law-practice/use-cases` — `CandorPolicy` `Context.Service` and
  `CandorPolicy.test.ts`; the contract carries the existing
  `SourceTextResolver` port (`@beep/file-processing/SourceText`) and
  `Crypto.Crypto` in its requirement channel, satisfied by the caller —
  never by a layer this slice owns.
- Rung 2: `packages/law-practice/tables`, `packages/law-practice/server`, the
  db-admin migration lane (law-practice's first migration + PGlite migration
  test + `AcceptedProofManifest` entries), and the filing-promotion path's
  lawful consultation of the predicate. That path has no writable consumer
  on disk today: `RuntimeApprovalGate`/`RuntimeCandidateDraft` live only in
  `packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts`
  with no caller anywhere in `packages/` or `apps/`; no product slice emits
  domain events yet (`.events.ts`/`.event-handlers.ts` are canonical roles
  at `standards/ARCHITECTURE.md:984,1065` with no slice instance); and
  `packages/shared/use-cases` does not exist
  (`standards/ARCHITECTURE.md:352-356`). The consuming surface is therefore
  a P0 output, not a pre-authorized edit: the shape P0 picks must name the
  exact files it writes, and "a real filing candidate" means the promotion
  path of record — today the agents first-proof SDK's
  `RuntimeCandidateDraft` — never a law-practice test double. Under emitted
  events that consumer edit is read-only subscription in the slice owning
  the promotion path plus app-level wiring, never a change to the
  `RuntimeApprovalGate` contract or the agents decision/lifecycle
  vocabularies.
- This packet's own files under `goals/patent-citation-candor-gate/`.

## Constraints

- Effect v4 + schema-first repo law throughout: `LiteralKit` for every
  string-literal vocabulary, `Effect.fn`/`Effect.fnUntraced` for effect
  generators, effect collection modules over native `Set`/`Map`, tests
  through `@beep/*` aliases with `it.effect`.
- The gate composition is read-only and must take a doctrine-sanctioned
  cross-slice shape (decision 7); a direct `law-practice/use-cases` →
  `agents/use-cases` import is forbidden.
- Quarantine has no live producer at rung 1: prove the predicate's quarantine
  branch against hand-constructed fixtures; the live producer is gated on
  `uspto-prosecution-read` landing raw-preserving unknown-code failures.
- Possible duplicates are treated as undisposed, never resolved — the
  reconciliation inbox is a named follow-on, not this goal.
- A persisted `TextAnchorVerificationReceipt` is not live proof;
  re-verification via `verifyTextAnchor` is required before any "current"
  claim, and "current" is defined against source-version identity, never
  receipt existence.
- Version currency is declared, never inferred: an observation stays current
  until another event explicitly supersedes it by naming the exact prior
  observation version. Arrival order, ingestion order, and observation
  timestamps never establish currency — `SourceTextIdentity` carries digests
  and pinned extractor/normalization versions but no revision order, parent
  relation, or head marker. Lineage is written once and the head is derived,
  never stored as an `isCurrent` flag (the `EdgeVersion.supersedesId`
  posture — pattern only, never imported; slice-to-slice imports stay
  forbidden). Absent, ambiguous, or forked lineage — including two
  unsuperseded observations of one source and any replayed or out-of-order
  arrival — fails closed: those events count as undisposed and the predicate
  never repairs or infers the link.
- Canonical source text for that re-verification resolves through the
  existing `SourceTextResolver` port
  (`packages/foundation/capability/file-processing/src/SourceText/index.ts`);
  `law-practice/use-cases` already depends on `@beep/file-processing` and
  `standards/ARCHITECTURE.md:622-623` permits the edge. Rung 1 supplies a
  `Layer.succeed(SourceTextResolver, ...)` fixture layer, keeping the test
  slice-isolated; the live layer is wired at the app entrypoint, never
  inside law-practice. A source that fails to resolve, mismatches its
  digest, or fails `verifyTextAnchor` yields an undisposed event — fail
  closed, never a skipped check.
- No `CitationMention` adapter until `citation-extraction-engine` lands its
  semantic union (gated criterion).
- Disposition vocabulary stays minimal at rung 1; the full judgment
  vocabulary (including the dual Rule 56 / 1.98(c) cumulativeness judgments)
  is rung-2 shaping detail — but both judgment slots stay representable from
  rung 1 (decision 2). The disposition-lifecycle domain is not judgment
  vocabulary and is not what "minimal" constrains: because a recorded
  disposition is never edited, supersession and withdrawal must be
  representable from rung 1.
- Disposition authorship is recorded; practitioner authority is not
  enforced. The author is the `Principal` every entity already carries
  (`createdByPrincipal`, `packages/shared/domain/src/entity/ProductEntity.ts`),
  a union discriminating `User` / `Agent` / `ServiceAccount` / `System`.
  Fail closed on that discriminator: only a `User`-kind principal's
  disposition covers an event, so an agent can never dispose its own
  AI-discovered finding. Proving the human holds practitioner authority is
  out of scope — no attorney/practitioner role exists anywhere in the repo
  (`Membership.Role` is `owner`/`member`), the nearest authority substrate
  is epistemic's agent-grant `FrozenGrantSet` (a forbidden cross-slice
  reach), and an authorization service is a named follow-on, not this goal.
  Both rungs therefore carry an explicit trust boundary: the gate proves
  that a human principal disposed the exact observation version, never that
  the human was authorized to.
- 1.97 window arithmetic derives a *candidate* window only — surface the
  controlling dates and edge cases (certificate of mailing / Priority Mail
  Express, weekend-or-DC-holiday shift, withdrawn closing action,
  same-day-as-closing filing); never label timing compliance.
- Cite which source version (CFR capture vs MPEP revision) each fact state
  was modeled from; never build version-resolution machinery.
- Budget circuit-breaker: if rung 1 busts its week, drop
  `PatentFragmentLocator` entirely — never the observation-version binding or
  the fail-closed predicate.

## Acceptance Criteria

Rung 1 — domain proof:

- [x] `PatentCitationEvent`, `CandorDisposition`, and the application-identity
      union land in `law-practice/domain` in design order (schema first), with
      LiteralKit actor/judgment domains, both judgment slots (Rule 56 vs
      litigation-frame) representable, the tagged discovery-provenance
      union, `SourceTextIdentity` composition, receipt-based grounding, the
      two separately-triggered explicit states (staleness, quarantine)
      that never rewrite evidence, and a LiteralKit disposition-lifecycle
      domain (`active` / `superseded` / `withdrawn`) plus a supersedes
      reference, so revising or withdrawing a judgment is representable
      without editing a recorded disposition (precedents:
      `ClaimDispositionStatus`, `EdgeVersion.supersedesId`).
- [x] `CandorPolicy` `Context.Service` contract in `law-practice/use-cases`
      owns the derived, fail-closed predicate with no stored closure state.
- [x] `CandorPolicy.test.ts` — written failing first, then green — proves:
      promotion blocked until an attorney disposition covers the AI event's
      exact observation version, and released — the predicate reports
      promotion no longer candor-blocked — once every current AI-discovered
      event is covered; two simultaneously current AI-discovered events on
      different references both gate, so disposing one leaves promotion
      blocked and only disposing both releases it; a newer observation of
      the same source re-blocks; the superseded event stops blocking only
      once the newer event is dispositioned; an out-of-order fixture (the
      superseding observation ingested before the one it supersedes) and a
      replay of an already-superseded observation change no head and
      release nothing; two unsuperseded observations of one source stay
      uncovered; a superseded or withdrawn disposition stops covering its
      event, so that event blocks again (fail closed); a disposition whose
      recorded `createdByPrincipal` is an `Agent` or `System` principal
      never covers its event (authorship trust boundary); an event whose
      source text fails to resolve or fails `verifyTextAnchor` stays
      uncovered; quarantined and possible-duplicate fixtures stay
      uncovered; examiner-observed events record without gating.
- [x] The test runs slice-isolated: in-memory/test-only layers, no other
      slice booted, no app runtime Layer.

Rung 2 — durability + live gate:

- [x] Durable storage for events, dispositions, and IDS fact records via
      ports → repo/layer on the `ExecutionLedger` precedent. All three
      surfaces are append-and-read-only — the ports expose no update and no
      delete (`ExecutionLedger.ports.ts`, `ClaimDisposition.ports.ts`) — so
      a disposition is revised or withdrawn only by appending a superseding
      record, never by overwriting what was decided at filing time.
- [x] The law-practice slice's first db-admin migration with its PGlite
      migration test, both registered in `AcceptedProofManifest`. The
      migration installs `BEFORE UPDATE OR DELETE` / `BEFORE TRUNCATE`
      append-only guards on the disposition and fact tables (precedent:
      `20260730043536_epistemic_evidence_verification/migration.sql`), and
      the PGlite test asserts that both an UPDATE and a DELETE against a
      recorded disposition are rejected.
- [x] Fact families recorded as presence-only facts: submission acts with
      1.97 candidate-window facts, 1.17(p)/1.17(v) fee facts, 1.97(e)
      statement presence/type + the 1.98(a)(4) written assertion, 1.98
      content-presence facts, office-treatment states as observed, and
      supplemental submissions as independent append-only records each with
      its own operative date (37 CFR 1.97(i); MPEP 609.05(a)).
- [ ] The filing-promotion path consults `CandorPolicy` through the lawful
      cross-slice shape chosen at implementation, so a blocked predicate
      blocks a real filing candidate and a fully dispositioned one stops
      blocking it — both directions asserted at the predicate boundary,
      since the agents slice's single-member `RuntimeApprovalDecision`
      (`pending`) cannot express advancement and this goal never widens it.

      **P0 feasibility finding (2026-08-05): this criterion is not achievable
      as written and needs rescoping before P2 attempts it.** "A real filing
      candidate" was defined as the promotion path of record, but that path
      has no runtime: `ProfessionalRuntimeSdk` has exactly one implementation
      (`ProfessionalRuntime.fixture-service.ts`, in-memory), consumed only by
      `packages/agents/use-cases/test/ProfessionalRuntime.test.ts`, with no
      `agents/server` implementation and no app wiring. No app composes both
      slices: `apps/professional-desktop` depends on the agents slice and not
      law-practice; `apps/practice-kg-mcp` depends on law-practice and not
      agents. Either P2 additionally stands up an app-entrypoint binding (a
      new app-level dependency edge, lawful but unscoped by this SPEC), or
      the criterion is rescoped to the proof SDK's promotion path asserted at
      the predicate boundary, with the deferred binding recorded. Evidence:
      [`research/01-gate-shape-check.md`](./research/01-gate-shape-check.md)
      §2.D.

      **Resolved by decisions 10 and 11: this criterion is DEFERRED out of
      this goal.** Both predicate directions are proven at the boundary by
      `CandorPolicy.test.ts`; the cross-slice consultation, its gate-port
      package, and the app-entrypoint binding move to a follow-up together,
      so nothing here claims a live gate the repo cannot currently run.

Gated criteria (activate when the owning goal lands; never block this goal):

- [ ] GATED on `uspto-prosecution-read`: bind the USPTO observation identity
      (parser/vocabulary versions, checksums, retrieval time, freshness,
      cursor/upstream identity) as the authoritative lineage behind declared
      supersession, consume the live quarantine producer, and wire a live
      `SourceTextResolver` layer for prosecution documents at the app
      entrypoint.
- [ ] GATED on `citation-extraction-engine`: the `CitationMention` handoff
      into event discovery-provenance.
- [ ] GATED on `agentic-professional-runtime`: when a release-capable gate
      decision vocabulary lands there, extend the read-only composition so a
      candor-cleared candidate can advance through it; candidate advancement
      past `pending` is outside this goal's outcome until then.

Always binding (both rungs):

- [x] No unrelated refactors or formatting churn, with ONE owner-approved
      exception. Owner ruling 2026-08-06: clear the 10 pre-existing
      `effect-governance-terse-effect` findings in
      `packages/tooling/tool/cli/src/commands/{Yeet/internal,Knowledge}` inside
      this PR rather than in a separate one. Those findings are inherited — the
      files are absent from this goal's diff, were last modified by #563 and
      #569, and `main`'s own head fails the same `Lint Policy` check — but it is
      a required check, so the PR cannot reach mergeable without them. Recorded
      as a deliberate, owner-directed scope widening rather than drift.
      Otherwise audited 2026-08-06: the diff
      is 75 files, and every path outside `goals/patent-citation-candor-gate/`,
      `packages/law-practice/`, `packages/shared/domain/src/identity/LawPractice`,
      and `packages/_internal/db-admin/` is either machine-generated or
      gate-required, none discretionary —
      `apps/professional-desktop/src/runtime/Migrations.gen.ts`, `goals/INDEX.md`,
      `tsconfig.json`, and `standards/fallow.boundaries.generated.jsonc` are
      regenerated by their own commands (`codegen`, `goals index --write`,
      `tsconfig-sync`, `fallow:boundaries:write`); `.changeset/` satisfies
      `quality:changeset-status`; `standards/schema-first.inventory.jsonc`
      satisfies `lint:schema-first` for the new test files; `bun.lock` follows the
      three required workspace deps; and `AcceptedProofManifest.ts` is named by the
      rung-2 criterion above. The legacy `@example` migration in five touched files
      was compelled by the JSDoc cleanup-on-touch gate, which obligates migrating
      every legacy carrier in any file whose documentation is touched.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/patent-citation-candor-gate/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/patent-citation-candor-gate/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/patent-citation-candor-gate` | Passes |
| Rung-1 proof | `CandorPolicy.test.ts` green in the law-practice use-cases test lane | Passes (after first failing) |
| Rung-2 migration proof | PGlite migration test + `AcceptedProofManifest` entries | Passes |
| Repo quality gate | `bun run beep yeet verify` / publish path | Green |
| Reflections | `bun run beep lint reflection-artifacts` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope — in particular anything
  drifting toward a Non-Goal (computed judgment, stored closure, widened
  agents vocabulary, new cross-slice edge).
- The lawful cross-slice gate shape cannot be satisfied without violating
  `standards/ARCHITECTURE.md` — stop and surface the conflict rather than
  adding a forbidden import.
- Verification requires credentials, cost, destructive side effects, or
  policy approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| **PENDING SIGN-OFF** — one new `foundation/capability` package holding a product-neutral gate port | Rung 2 only; the port carries no candor, citation, filing, or disposition semantics | Unassigned — requires repo owner | Decision 9: the two shapes decision 7 authorized are unavailable (events have no transport and cannot fail closed; the promoted contract fails the ≥2-consumer promotion bar). Foundation-mediated port inversion is the mechanism the repo ratified 2026-07-25 for exactly this synchronous fail-closed case, and is strictly smaller than either alternative. | Not applicable — the package is the lawful home. Withdraw the exception only if the gate stops needing a cross-slice consumer. |
