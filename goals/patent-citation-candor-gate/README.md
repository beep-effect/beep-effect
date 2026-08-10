# Patent Citation Candor Gate

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Make every AI-discovered patent-reference occurrence a source-versioned,
evidence-grounded `PatentCitationEvent`, and block filing promotion until each
current one carries an attorney `CandorDisposition` bound to its exact
observation version — converting the duty of candor (37 CFR 1.56) from an
ambient risk into an explicit, auditable, fail-closed gate that never computes
legal judgment.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/patent-citation-candor-gate/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth (decision log included).
3. [`PLAN.md`](./PLAN.md) - active execution plan (two rungs).
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger
   (inherited from the exploration).
6. [`history/`](./history/) - evidence and closeouts, once they exist.

## Current Phase

Closed. PR #575 merged as `5e4df6be4a`. The gate ships fail-closed with both rungs
proven; the cross-slice consultation and its `foundation/capability` gate port are
deferred with `research/01-gate-shape-check.md` as standing evidence, and the
"widening the quantified gate set" align question stays parked. P0, P1, and the scoped P2 are complete. The owner rulings recorded as
`SPEC.md` decisions 10 and 11 kept rung 2 to the half that needs no cross-slice
decision: durable ports, repository and layers, the slice's first db-admin
migration with append-only guards, and the IDS fact records. The cross-slice
consultation and its `foundation/capability` gate port are deferred with
`research/01-gate-shape-check.md` as the standing evidence.

## Latest Evidence

- **P2 durability green (2026-08-05).** The law-practice slice's first
  db-admin migration (`20260806031625_law_practice_candor_gate`) installs
  append-only triggers on all three tables; the PGlite proof pins the exact
  constraint and trigger names and shows both an UPDATE and a DELETE against a
  recorded disposition rejected. `migrations:check` is clean and the desktop
  migration bundle is re-synced.
- **P1 rung-1 proof green (2026-08-05).** `CandorPolicy.test.ts` — 19
  scenarios, written failing first, now passing over in-memory/test-only
  layers with real SHA-256 digests and live `verifyTextAnchor`
  re-verification. `check`, `lint`, and `test` are green in
  `@beep/law-practice-domain`, `@beep/law-practice-use-cases`,
  `@beep/law-practice-tables`, `@beep/law-practice-server`,
  `@beep/shared-domain`, and `@beep/db-admin`.
- **P0 gate-shape check (2026-08-05).**
  [`research/01-gate-shape-check.md`](./research/01-gate-shape-check.md) — the
  two shapes the SPEC authorized are both unavailable; foundation-mediated
  port inversion is recommended and awaits owner sign-off.
- **P0 surface re-verification (2026-08-05).**
  [`research/02-surface-reverification.md`](./research/02-surface-reverification.md)
  — every SOURCES.md §4 surface confirmed current; two drift notes recorded.

Graduated 2026-08-04 from
[`explorations/patent-citation-candor-gate`](../../explorations/patent-citation-candor-gate/README.md)
(BRIEF approved same day after a three-lens adversarial review + four PR #557
review refinements; four-point definition-of-ready passed at decompose).

## Inherited Blocker (cleared 2026-08-06)

`Lint Policy` was red on PR #575 through ten pre-existing
`effect-governance-terse-effect` findings in
`packages/tooling/tool/cli/src/commands/{Yeet/internal,Knowledge}` — files absent from
this goal's diff, last modified by #563 and #569, and failing on `main`'s own head too.
Because it is a *required* check the PR could not reach mergeable while they stood, so on
owner ruling they were repaired inside this PR rather than deferred: two by
`beep laws terse-effect --write`, eight by hand. `repo-cli`'s own suite stays green at
1075 tests and `bun run beep lint policy` exits 0. Recorded as a deliberate,
owner-directed scope widening — see the SPEC's "no unrelated refactors" criterion.

## Criterion-to-Proof Map

| SPEC criterion | Where it is proven |
| --- | --- |
| Entities + application-identity union in design order, both judgment slots, tagged discovery union, receipt grounding, explicit staleness/quarantine, disposition lifecycle | `packages/law-practice/domain/src/entities/{PatentCitationEvent,CandorDisposition}/`, `src/values/{CitingApplicationIdentity,ObservationVersionRef}/`; round-tripped through arbitrary-generated encoded form by `test/LawPracticeDomain.test.ts` |
| `CandorPolicy` contract owns the derived, fail-closed predicate with no stored closure | `packages/law-practice/use-cases/src/CandorPolicy/` — blocked-ness is derived by `CandorGateVerdict.isBlocked`, never a stored field |
| `CandorPolicy.test.ts` failing first then green, covering every listed scenario | `packages/law-practice/use-cases/test/CandorPolicy.test.ts` — 19 scenarios, real SHA-256, live `verifyTextAnchor` |
| Test runs slice-isolated | Same file: in-memory `CandorRecordReader` + `Layer.succeed` `SourceTextResolver` fixture + a Web Crypto test layer; no other slice booted, no app runtime layer, no dependency added |
| Durable append-and-read-only ports → repo/layer | Port: `packages/law-practice/use-cases/src/CandorRecord/CandorRecord.ports.ts` (six members, no update and no delete). Drizzle repo + layers: `packages/law-practice/server/src/CandorRecord/` — insert and select only, rows re-decoded through the entity schemas rather than trusted |
| First db-admin migration + PGlite test + `AcceptedProofManifest` | `packages/_internal/db-admin/drizzle/20260806031625_law_practice_candor_gate/`, `test/integration/LawPracticeCandorGateMigration.pglite.test.ts`, four manifest entries |
| Append-only guards proven, not just installed | The PGlite test asserts the exact constraint/trigger name sets, then that both an UPDATE and a DELETE against a recorded disposition are rejected |
| IDS fact families as presence-only facts | `packages/law-practice/domain/src/entities/IdsSubmissionFact/` — candidate window (never a compliance label), 1.17(p)/(v) fees, 1.97(e) statement + 1.98(a)(4) assertion, 1.98 content presence, office treatment as observed, own operative date per act |
| Live filing-promotion consultation | **Deferred** — SPEC decisions 10 and 11; see `research/01-gate-shape-check.md` |

## Unowned Follow-Ons (audited 2026-08-10)

This packet is closed, so nothing below is scheduled. The audit that produced this
list checked every active goal and exploration: **no packet owns any of the five.**
For these five local follow-ons, this section is the citation target: a future
packet claims an item by naming it here rather than rediscovering it. This routing
choice does not extend speed-loop closeout decision 55 beyond the earlier
grilled-but-unshipped widgets retained in that packet.

Two are already normative elsewhere and are listed for routing only:

1. **Cross-slice filing-promotion consultation + its `foundation/capability` gate
   port.** Recorded in SPEC decisions 10 and 11, the Criterion-to-Proof map above,
   and the SPEC's pending Exception Ledger row, with
   [`research/01-gate-shape-check.md`](./research/01-gate-shape-check.md) as
   standing evidence. Unowned, not unrecorded.
2. **Widening the quantified gate set** so examiner-observed events gate in their
   own right. Parked by SPEC decision 4 and named-not-graduated in
   `explorations/patent-citation-candor-gate/MAP.md`. Unowned, not unrecorded.

Three lived only in the 2026-08-05 reflection until this audit and would have been
lost with it:

3. **No ST.13 ↔ USPTO-normalized conversion on `CitingApplicationIdentity`,** so a
   filing recorded under both representations gates twice. This is deliberate —
   translating an eight-digit USPTO number to ST.13 needs USPTO's
   series-code-to-year table, and inventing one would fabricate legal identity. The
   reflection assigns it to "the reference-reconciliation follow-on"; **that packet
   does not exist.** Whoever mints it inherits this.
4. **The Drizzle repository filters by jsonb equality on the encoded citing
   application, and `citing_application` carries no dedicated index.** Every read
   also constrains `org_id`, whose index can narrow the scan to one tenant before
   PostgreSQL applies the JSONB predicate; the tables also carry unique
   `public_id` indexes. No representative-volume `EXPLAIN` proves a table scan.
   Capture that evidence before deciding whether a generated column or expression
   index is justified.
5. **No shared `Crypto.Crypto` test layer in `@beep/test-utils`,** so every proof
   reaching `verifyTextAnchor` supplies its own via `BunCrypto.layer`,
   `NodeCrypto.layer`, or a hand-roll. Sharper than the reflection's version: the
   only *real* Web-Crypto hand-roll is
   `packages/law-practice/use-cases/test/CandorPolicy.test.ts`, so promoting a real
   layer would deduplicate exactly one site — but the identity-stub shape
   (`digest: (_algorithm, data) => Effect.succeed(data)`,
   `randomBytes: (size) => new Uint8Array(size).fill(1)`) repeats verbatim in only
   two files: `EntityKernel.test.ts` and
   `ContradictionTriage.observability.test.ts`. The nearby ThreadStore crypto
   layers exercise different success and failure behavior. A shared identity stub
   would therefore deduplicate two sites; this audit does not claim that it has
   earned promotion.

## Notes

- One packet, two strict rungs: rung 1 is the in-memory domain proof
  (deliberately not shippable protection); rung 2 (durability + the slice's
  first db-admin migration + live promotion-path invocation) is where risk
  retirement lands.
- Budget circuit-breaker: if rung 1 busts its week, drop
  `PatentFragmentLocator` entirely — never the observation-version binding or
  the fail-closed predicate.
- Gated criteria bind to the SPECs of `uspto-prosecution-read`
  (observation identity, quarantine producer), `citation-extraction-engine`
  (`CitationMention` handoff), and `agentic-professional-runtime`
  (release-capable gate vocabulary); they never block this goal's rungs.
