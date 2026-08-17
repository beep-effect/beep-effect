I'll attack the MAP against the live contracts and the other packet artifacts — first the cited files, then the two source modules the claims rest on.The MAP's proof claims hang on repo contracts and serialization that the packet only names. Next I’ll check the live repository surface, indexes, and whether a canonical encoding actually exists.The port is still per-`logicalKey` only. Next I’ll check indexes, triage as-of, ClaimProjection, and whether “open lineages” can even be queried at matter scale.The first slice is not provable as written. Several of the MAP’s load-bearing sentences collapse against the live contracts they claim to reuse.

---

## 1. Byte-identical replay / first-slice proofs

### BLOCKING — No canonical serialization exists, and the live read poisons replay

MAP proof 1 (`MAP.md:29-31`) demands an identical **revision key and object** from the same request, policy revision, and authority cut. The digest ingredients are named in `BRIEF.md:32-35` and `research/03-view-composition-and-revision.md:33-35` (request, policy revision, authority-cut digest, ordered selections/abstentions). **No artifact specifies the encoding.** Missing, at minimum:

- Digest version prefix (the live identity encoder has one: `canonicalEncodingVersion = "v1"` in `LogicalEdgeIdentity.model.ts:30`, `380-392`)
- Field set of the authority-cut digest (ids only vs full `EdgeVersion`, including `fact: UnknownRecord` at `EdgeVersion.model.ts:117-119`)
- `DateTime` encoding (the table is epoch millis; the request type is `DateTime.Utc`)
- Sort keys for the cut, contention sets, `candidateIds`, and `SelectedBelief.reasons`
- Revision-object schema (what “byte-identical object” even hashes)

`ClaimProjection` is cited as the determinism precedent (`MAP.md:13`). That function proves **structural equality of a count + sorted fixture keys** (`ClaimProjection.ts:8`, `71-104`). It does not hash, does not serialize, and does not survive a later in-place column write. The MAP is using the wrong proof standard for the claim it makes.

Worse: **same-process replay already fails against live `readAsOf`.** `supersede` mutates `expiredAt` on the standing row (`EdgeAuthority.repo.ts:357-360`). `asOfWhere` still returns that row for an earlier `knownAt` (`expiredAt IS NULL OR expiredAt > knownAt`, `:138-145`), and `readAsOf` returns the raw row via `A.head` with **no `ORDER BY`** (`:421-426`). After a later supersession, a T1 replay yields the same semantic occupant with a **different** `expiredAt`. Triage already knows this and projects it away (`projectEdgeVersionAtKnownAt`, `ContradictionTriage.repo.ts:150-154`, used at `:659-663`). The MAP’s “extend `asOfWhere`” plan (`MAP.md:13`) copies the leak, not the fix.

Consequence for the three proofs as a suite (`MAP.md:29-35`): running proof 3 (write late authority, shift `knownAt`) **changes the bytes of proof 1’s T1 object**. The proofs are not independent under the live adapter.

### BLOCKING — “Reuse `LogicalEdgeIdentity`” computes the wrong grouping key

Ratified key = identity **minus** `evidenceScope`. Live `logicalEdgeKey` / `encodeLogicalEdgeIdentity` **include** `evidenceScope` as a mandatory component (`LogicalEdgeIdentity.model.ts:387`, class fields `:277-290`). Two lineages that differ only by scope are two `LogicalEdgeKey`s — that is the whole point of `research/01-live-contracts-and-drift.md:37-41`.

If the slice “reuses” `logicalEdgeKey` (`MAP.md:13`), proof 2 (`MAP.md:32-33`) fails: they will not group. If the slice instead blanks `evidenceScope` and rehashes, the contention key **collides with the real `LogicalEdgeKey` of the `evidenceScope = none` lineage** (same encoder, same `absentScopeMarker`, `:37`, `:319-322`). That alias is a foot-gun against `readAsOf(logicalKey)`. The MAP specifies neither a new encoder, a new version prefix, nor a brand. Symmetric endpoint ordering (`orderEndpoints`, `:341-347`) is also unstated; drop it and two presentations of one symmetric relation split the contention set.

### BLOCKING — Two-lineage expected outcome is not a criterion

Proof 2 says the two-lineage set “selects **or** abstains deterministically” (`MAP.md:32-33`). Under the slice policy (“sole-candidate”, `:26-27`) two candidates cannot select. The remaining choice is `policy-tie` vs `unresolved-contradiction`. Those are different reasons, different owners (triage vs view), and the MAP gives no rule for which fires when both could apply, or when two evidence-scoped lineages exist **without** a triage candidate. A test that accepts either result is not a proof.

`unresolved-contradiction` cannot be implemented from “triage read models untouched” (`MAP.md:13`, `:21`, `:38`) at matter scope. Live triage `list` is **org-only, paginated, max 100** (`ContradictionTriage.commands.ts:259-283`, `:196-202`; `ContradictionTriage.repo.ts:406-415`, `:670-701`). `ContradictionCandidateSummary` has no matter and no pair (`ContradictionTriage.ports.ts:142-174`). `ContradictionCandidate` itself has **no `matterScope`** (`Contradiction.model.ts:43-71`). There is no get-by-pair. The port is `list` / `get` / `getExpanded` / `review` / `submit` (`ContradictionTriage.ports.ts:385-406`). Matter-filtering requires paging the org queue and expanding every row. That is a triage-surface change, which the slice forbids.

### MAJOR — First slice does not prove Goal 1

Goal 1 ships the four-reason kit, the typed delta, and verdict-family SPEC edits (`MAP.md:12`). The slice excludes “the full policy vocabulary” and never mentions delta (`MAP.md:26-38`). `insufficient-evidence` and `scope-conflict` have no fixture. Goal 1 is written as if the slice delivers it.

---

## 2. Scope-wide read / matter scale

### BLOCKING — No pagination, no bound, no index; on-demand makes this the production path

The “one server-side addition” is “all open lineages for an org/matter at the two-axis cut” (`MAP.md:12`, `BRIEF.md:45-48`). There is no page size, cursor, memory cap, or response shape that is not the entire view.

Live indexes cannot serve that query:

- `epistemic_edge_asof_idx` is `(logical_key, valid_from, recorded_at)` (`packages/_internal/db-admin/drizzle/20260813143745_baseline-functions/migration.sql:41-42`)
- `epistemic_edge_version_org_id_btree_idx` was **dropped** in that same migration (`:6`)
- There is no `(org_id, matter_scope, …)` or temporal-org index

`RESEARCH.md:20-21` required the query **and a supporting index**. MAP/BRIEF/DECISIONS dropped the index.

This team already refused unbounded org lists on the adjacent surface: contradiction queue pages cap at 100. The belief view is a **strictly larger** read (every open lineage, not every contradiction) and, because A3 is on-demand-only, **every consumer request** does it. Paginated later is not free: a paged view is a different revision object than an all-sets digest. Size belongs in the slice or the revision contract is a lie.

### BLOCKING — “Open lineages” is the wrong predicate

`MAP.md:12` / `BRIEF.md:45-47` say “all **open** lineages … at the two-axis cut.” Live “open” is `validTo IS NULL AND expiredAt IS NULL` (`openHeadOf`, `EdgeAuthority.repo.ts:151-155`; `epistemic_edge_open_head_idx`). Historical `asOfWhere` is the half-open interval pair (`:138-145`). Implement “open” as the index predicate and:

- proof 3’s late-arriving row is excluded or over-included
- replay at an old `knownAt` returns current heads, not the T1 cut

The wording licenses the wrong SQL.

### MAJOR — Matter filter is undefined against optional `matterScope`

`LogicalEdgeIdentity.matterScope` is optional (`LogicalEdgeIdentity.model.ts:280-283`). SQL `NULL` is why the identity digest exists (`:6-8`). MAP/BRIEF never say whether a matter-X view includes `matterScope = none` org-wide edges. `eq(matter_scope, X)` silently drops them. An org-wide call (`matter` absent) has no `IS NULL` story at all. Two implementers will ship two different cuts and two different revision keys.

### MAJOR — The “one addition” is a port-contract break the MAP does not list

`EdgeAuthorityRepositoryShape` is **deliberately four operations**; omissions are the contract (`EdgeAuthority.ports.ts:25-40`, `:63-70`). `EdgeAuthorityOperation` is the closed kit `["record", "supersede", "readAsOf", "readLatest"]` (`EdgeAuthority.errors.ts:25`). A scope-wide read is a fifth operation, a new query schema, a kit widening, and (if honest) an as-of projection helper. None of that is in the Goal 1 deliverable list. `readLatest` still calls `DateTime.now` (`EdgeAuthority.repo.ts:438-440`); the MAP never forbids the engine from using it.

---

## 3. “Every policy input as-of queryable or excluded”

### MAJOR — Prose only; the slice already cannot obey it

Ratified in `BRIEF.md:60-62`, `DECISIONS.md:8-9`, copied as `MAP.md:44`. There is no mechanical device:

- no closed `PolicyInput` / as-of snapshot schema
- no type that forbids closing over `DateTime.now`, process caches, or non-temporal tables
- no lint/test obligation

A future v1 policy can break byte-identical replay and still type-check.

First-slice inputs already fail the sentence:

| Input | As-of? | Evidence |
| --- | --- | --- |
| Authority cut | Predicate yes; **payload no** | `expiredAt` leak above; no projection in MAP |
| Unresolved contradiction | Time axes exist; **matter/scope read does not** | org-paged list, no matter, no pair |
| Principal | Not a temporal fact | in the request digest (`BRIEF.md:33`) but unused by the slice policy |
| Policy revision | Immutable name, OK | if and only if revisions are retained and never edited in place |
| Verdict-family values Goal 1 says the view “consumes” (`BRIEF.md:39-40`) | not in the slice; several live surfaces are `createdAt <= knownAt` only (e.g. evidence verification in `ContradictionTriage.repo.ts:595`) | one-axis ≠ two-axis as-of |

`MAP.md:44` is an essay constraint. Nothing in Goal 1 makes it true.

---

## 4. Typed delta when the policy revision differs

### BLOCKING — The recompute claim does not hold as specified, and on-demand makes the obvious API impossible

`DECISIONS.md:49-50`: the delta “recomputes the prior revision at its original `validAt`/`knownAt`/**policy inputs**.”

`research/03-view-composition-and-revision.md:55`: “Every candidate is re-evaluated under **the named policy revision**” (singular).

Those are different functions.

- Follow DECISIONS: recompute A under P1 and B under P2. Set-diff is defined only if the join key is specified (it is not: contention key vs `edgeVersionId`). A policy-only flip is tagged `replaced` / `abstained` / `resumed` — the same tags as an authority change. The four-tag kit cannot say “ranking code changed.”
- Follow research/03: apply **one** policy to both cuts. That is a **counterfactual**, not the prior revision. The DECISIONS sentence is then false.

`BRIEF.md:36-37` only says the delta “derives from two recomputed revisions.” It does not pick an interpretation and does not specify the request as a **pair of request tuples**.

Under ratified on-demand-only (A3), a prior **revision key is not invertible**. Nothing stores `validAt`/`knownAt`/policy. An API of `(currentRequest, priorRevisionKey)` cannot recompute the prior. An API of two full requests works but is unstated; Goal 1 still lists “the typed delta” (`MAP.md:12`) while the slice proofs omit it (`MAP.md:26-35`). Shipping delta in Goal 1 without that request shape is a store, which A3 forbade.

So: when P1 ≠ P2, the claim does **not** hold unless you silently pick one of two contradictory rules and require the caller to resupply the entire prior request. None of that is in the MAP.

---

## 5. MAP vs BRIEF vs DECISIONS

### RATIFIED-CONFLICT — Verdict-family propagation time and locus

Operator amendment (`DECISIONS.md:8-9`, `BRIEF.md:39-43`): propagate ownership law **at graduation**, to **owning surfaces** (other epistemic SPECs / glossary).

MAP Goal 1 (`MAP.md:12`): propagate **at scaffold**, inside this packet, while claiming “Epistemic slice only; no external gates.”

That is not a restatement. Scaffold ≠ graduation. Editing other goals’ SPECs **is** an external gate. Not a reason to reopen A1; it is the MAP violating the amendment it pretends to implement.

### MAJOR — “Open lineages” vs two-axis cut (MAP/BRIEF vs research/live)

`MAP.md:12` and `BRIEF.md:45-47` both say “open lineages … at the two-axis cut.” `research/01-live-contracts-and-drift.md:15-18` and `research/03-view-composition-and-revision.md:61-64` correctly cite `asOfWhere`. The fat-marker and the research do not agree on the SQL.

### MAJOR — Index required in research, deleted in MAP/BRIEF/DECISIONS

`RESEARCH.md:20-21` vs `MAP.md:12-13` / `BRIEF.md:45-48` / `DECISIONS.md:5-7`.

### MAJOR — Byte-identical (slice) vs structural equality (composition row)

`MAP.md:29-31` vs `MAP.md:13` (`ClaimProjection` “structural equality”). Same document, two proof standards.

### MAJOR — Goal 1 vs slice vs appetite

BRIEF appetite (`BRIEF.md:17-20`): key + policy contract + on-demand engine + the one read.
MAP Goal 1 adds typed delta, four-reason kit, and cross-packet SPEC edits.
Slice then strips kit, delta, and triage work. Three different scopes, one slug.

### MINOR — Packet hygiene

- `README.md:37-41` still says “Align pending” after `DECISIONS.md` closed align the same day.
- `MAP.md:21` “KSA / triage / core” — KSA is undefined here (elsewhere it is knowledge-surface-automation, which does not belong).
- Explore decompose requires **inherited risks** (`.agents/skills/explore/SKILL.md:78`). MAP has constraints, not risks. Serialization, scan cost, triage pagination, and the expiredAt leak are risks the MAP refused to write down.

---

## Areas with no additional material findings

- **A2 key shape (identity minus `evidenceScope`, qualifiers in, versioned)** — not relitigated. The failure is that the MAP has no encoder that implements it.
- **A3 on-demand-only** — not relitigated. It makes the missing size story and the non-invertible delta key worse; it is not itself the defect.
- **Four-reason abstention kit as a vocabulary** — not relitigated. The slice simply does not prove it.
- **No-writes / no-`SUPERSEDES` / no wall-clock-in-digest** — internally consistent as no-gos. The live adapter still puts a post-cut `expiredAt` into any digest that hashes the raw row.

---

## What must be true before this MAP is ratifiable

1. Specify a **versioned canonical encoder** for `BeliefContentionKey` (not `logicalEdgeKey`), the authority-cut digest, and the revision object; include as-of projection of `expiredAt` (copy triage, do not copy `readAsOf`); specify sort keys. Then rewrite the three proofs so proof 3 cannot mutate proof 1’s bytes.
2. Replace “open lineages” with the half-open `asOfWhere` predicate. Define matter inclusion for `matterScope = none`. Add the supporting index `RESEARCH.md` already asked for, plus a hard size/pagination story that does not change the revision contract later.
3. Either drop `unresolved-contradiction` from the slice, or admit a **matter-scoped, unpaged (or internally complete) as-of triage read** — the current port cannot do it “untouched.”
4. Make as-of-or-excluded a **closed policy-input schema**, not a sentence.
5. Pick one delta rule (replay each revision under **its** policy vs counterfactual under **one** policy), name the join key, and make the request **two full request tuples**. Do not pretend a content-addressed key is enough under A3.
6. Put verdict-family SPEC edits back at **graduation / owning surfaces**, or drop them from Goal 1.
