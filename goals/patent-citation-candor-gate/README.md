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
3. [`PLAN.md`](./PLAN.md) - archived execution plan (two completed rungs).
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger
   (inherited from the exploration).
6. [`history/`](./history/) - evidence and closeouts, once they exist.

## Current Phase

Closed. PR #575 merged as `5e4df6be4a`; P0, P1, and the scoped P2 are complete.
The successor packet terminally resolved both former align questions. Every
current recorded event now enters the quantified set, and the only existing
candidate-acceptance implementation consults a law-neutral, tenant-bound shared
gate backed by a fail-closed candor adapter. The repository still has no
production candidate-acceptance composition root, so the successor proves the
contract and fixture acceptance boundary without claiming live product
protection that does not exist.

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
- **P0 gate-shape check (2026-08-05; resolved by successor).**
  [`research/01-gate-shape-check.md`](./research/01-gate-shape-check.md) — the
  two shapes the SPEC authorized were both unavailable. Its then-pending
  foundation-mediated recommendation is historical: the successor shipped the
  architecture-approved `shared/use-cases` port and terminally resolved the
  sign-off question.
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
| First db-admin migration + PGlite test + `AcceptedProofManifest` | `packages/_internal/db-admin/drizzle/20260813130540_baseline/`, `test/integration/LawPracticeCandorGateMigration.pglite.test.ts`, four manifest entries |
| Append-only guards proven, not just installed | The PGlite test asserts the exact constraint/trigger name sets, then that both an UPDATE and a DELETE against a recorded disposition are rejected |
| IDS fact families as presence-only facts | `packages/law-practice/domain/src/entities/IdsSubmissionFact/` — candidate window (never a compliance label), 1.17(p)/(v) fees, 1.97(e) statement + 1.98(a)(4) assertion, 1.98 content presence, office treatment as observed, own operative date per act |
| Filing-promotion consultation | **Resolved by successor** — `../candor-gate-followups-closeout/` ships the tenant-bound shared gate contract, protects the repository's fixture candidate-acceptance boundary, and supplies a fail-closed law adapter. No production acceptance runtime exists to compose. |

## Follow-On Resolution (2026-08-13)

[`../candor-gate-followups-closeout/`](../candor-gate-followups-closeout/) claimed
and terminally disposed every item from the former unowned list. No item remains
routed from this packet.

| Former follow-on | Successor disposition |
| --- | --- |
| Cross-slice filing-promotion consultation | Implemented at the only existing fixture candidate-acceptance boundary through tenant-bound `@beep/shared-use-cases/PromotionGate` and the law-practice server adapter; no nonexistent production composition root is claimed. |
| Examiner-observed quantified set | Implemented; every current recorded event gates until it has a human disposition. |
| ST.13 and USPTO-normalized identity | Primary authority disproved deterministic conversion; ST.13 requires a known non-U.S. office, rejects `US`, `XX`, and absent/non-string office values, and exact representations remain distinct. The successor migration refuses unresolved legacy rows. |
| Candor JSONB planner risk | Representative-volume PGlite proof uses the existing `org_id` index; no new physical index is justified. |
| Shared test Crypto layer | Census found five distinct semantics and only two hazardous identical fakes; promotion is explicitly rejected. |

The successor's `research/DECISIONS.md` and dedicated evidence receipts are the
current citation targets for these dispositions.

## Notes

- One packet, two strict rungs: rung 1 is the in-memory domain proof
  (deliberately not shippable protection); rung 2 is durability plus the
  slice's first db-admin migration. The successor later added the shared
  contract and fixture acceptance invocation; no live product path exists.
- Budget circuit-breaker: if rung 1 busts its week, drop
  `PatentFragmentLocator` entirely — never the observation-version binding or
  the fail-closed predicate.
- Gated criteria bind to the SPECs of `uspto-prosecution-read`
  (observation identity, quarantine producer), `citation-extraction-engine`
  (`CitationMention` handoff), and `agentic-professional-runtime`
  (release-capable gate vocabulary); they never block this goal's rungs.
