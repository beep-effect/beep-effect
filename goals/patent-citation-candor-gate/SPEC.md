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
  dispositioned.
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
- No new packages: everything lands in existing law-practice packages.

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
  `CandorPolicy.test.ts`.
- Rung 2: `packages/law-practice/tables`, `packages/law-practice/server`, the
  db-admin migration lane (law-practice's first migration + PGlite migration
  test + `AcceptedProofManifest` entries), and the filing-promotion path's
  lawful consultation of the predicate.
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
- No `CitationMention` adapter until `citation-extraction-engine` lands its
  semantic union (gated criterion).
- Disposition vocabulary stays minimal at rung 1; the full judgment
  vocabulary (including the dual Rule 56 / 1.98(c) cumulativeness judgments)
  is rung-2 shaping detail — but both judgment slots stay representable from
  rung 1 (decision 2).
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

- [ ] `PatentCitationEvent`, `CandorDisposition`, and the application-identity
      union land in `law-practice/domain` in design order (schema first), with
      LiteralKit actor/judgment domains, both judgment slots (Rule 56 vs
      litigation-frame) representable, the tagged discovery-provenance
      union, `SourceTextIdentity` composition, receipt-based grounding, and
      the two separately-triggered explicit states (staleness, quarantine)
      that never rewrite evidence.
- [ ] `CandorPolicy` `Context.Service` contract in `law-practice/use-cases`
      owns the derived, fail-closed predicate with no stored closure state.
- [ ] `CandorPolicy.test.ts` — written failing first, then green — proves:
      promotion blocked until an attorney disposition covers the AI event's
      exact observation version; a newer observation of the same source
      re-blocks; the superseded event stops blocking only once the newer
      event is dispositioned; quarantined and possible-duplicate fixtures
      stay uncovered; examiner-observed events record without gating.
- [ ] The test runs slice-isolated: in-memory/test-only layers, no other
      slice booted, no app runtime Layer.

Rung 2 — durability + live gate:

- [ ] Durable storage for events, dispositions, and append-only IDS fact
      records via ports → repo/layer on the `ExecutionLedger` precedent.
- [ ] The law-practice slice's first db-admin migration with its PGlite
      migration test, both registered in `AcceptedProofManifest`.
- [ ] Fact families recorded as presence-only facts: submission acts with
      1.97 candidate-window facts, 1.17(p)/1.17(v) fee facts, 1.97(e)
      statement presence/type + the 1.98(a)(4) written assertion, 1.98
      content-presence facts, office-treatment states as observed, and
      supplemental submissions as independent append-only records each with
      its own operative date (37 CFR 1.97(i); MPEP 609.05(a)).
- [ ] The filing-promotion path consults `CandorPolicy` through the lawful
      cross-slice shape chosen at implementation, so a blocked predicate
      blocks a real filing candidate.

Gated criteria (activate when the owning goal lands; never block this goal):

- [ ] GATED on `uspto-prosecution-read`: bind the USPTO observation identity
      (parser/vocabulary versions, checksums, freshness) and consume the live
      quarantine producer.
- [ ] GATED on `citation-extraction-engine`: the `CitationMention` handoff
      into event discovery-provenance.
- [ ] GATED on `agentic-professional-runtime`: compose a release-capable gate
      decision vocabulary when one exists.

Always binding (both rungs):

- [ ] No unrelated refactors or formatting churn.

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
| None | N/A | N/A | N/A | N/A |
