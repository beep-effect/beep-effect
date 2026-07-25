# S2 — Logical Edge Identity + Bounded Endpoint Model

**Date:** 2026-07-25
**Spike:** P0 / S2 of `goals/epistemic-bitemporal-edge-core`
**Contract:** `ops/handoffs/p0-spike-contract.md` § "S2 — Logical identity + bounded endpoint model"

## Verdict

**PASS.** The no-overlap partition key is explicit, deterministic, and proven safe on
executable fixtures: equivalent presentations of one fact collapse to a single key
(symmetric endpoint orderings, qualifier permutations) and distinct facts never merge
(asymmetric orderings, different qualifier values, different matter/evidence scope,
including `none` vs `some`). The bounded endpoint model is enforced at the DB level with
a kind discriminator, per-kind columns, an exactly-one CHECK, and real FKs for claim and
evidence endpoints. No stop condition fired.

## Logical edge identity — design

The identity components (SPEC constraint): source endpoint, target endpoint, relation,
organization scope + optional matter scope, predicate qualifiers, optional evidence
scope. Two representations are stored together:

1. **Component columns** on `spike_edge_version` (queryable, evidence-inspectable):
   `source_kind` + per-kind ref, `target_kind` + per-kind ref, `relation`, `org_scope`,
   `matter_scope`, `qualifiers` (jsonb), `evidence_scope`.
2. **A derived digest column `logical_key text NOT NULL`** — sha256 of a canonical
   encoding — which is the partition key every uniqueness/exclusion backstop operates on.

Why the digest is the partition key rather than a multi-column constraint:

- **The NULL hole.** `matter_scope` and `evidence_scope` are optional. Under a
  multi-column `EXCLUDE (... matter_scope WITH = ...)`, `NULL` never equals `NULL`, so
  every row with an absent scope would silently escape no-overlap enforcement. The
  digest encodes absence as a dedicated `<none>` marker, closing the hole (and a fixture
  proves a literal `"<none>"` scope value cannot collide with true absence).
- **One lockable identity.** The S5 concurrency rule locks and versions per logical
  key; a single text column gives `FOR UPDATE`, the partial unique open-head index, and
  the exclusion constraint the same partition without composite-key drift.
- **A two-element exclusion constraint.** `(logical_key WITH =, int8range(...) WITH &&)`
  keeps the GiST index small and the constraint readable.

Canonicalization rules (prototyped in
`packages/drivers/pglite/test/integration/spike/EpistemicBitemporalIdentity.test.ts`):

- Fixed component order under a `v1` prefix, joined with `|`.
- Endpoints encode as `kind:ref`; **symmetric relations normalize endpoint order**
  (lexicographically smaller endpoint first) before digesting, so `A contradicts B` and
  `B contradicts A` are one fact. Asymmetric relations do not normalize.
- Qualifiers encode as `key=value` entries **sorted by key**, so insertion order can
  never split one fact into two.
- Optional scopes encode as `some:<value>` / `<none>`.

Digest integrity is application-side (the DB cannot recompute sha256 cheaply and should
not): the component columns stay on the row precisely so P1's repository can verify or
recompute the digest, and `UNIQUE (logical_key, version)` plus the open-head index make
silent divergence detectable. P1 lifts the prototype into a schema-first
`LogicalEdgeIdentity` value object; the symmetry flag moves to the relation literal
domain.

## Adversarial fixture map (every claim is executable)

| Claim | Fixture | Result |
| --- | --- | --- |
| Deterministic digest | `is deterministic for identical identities` | pass |
| Symmetric orderings collapse | `collapses both endpoint orderings of a symmetric relation to one key` | pass |
| Asymmetric orderings stay distinct | `keeps the two orderings of an asymmetric relation distinct` | pass |
| Qualifier permutations collapse | `collapses qualifier insertion-order permutations to one key` | pass |
| Distinct qualifier values partition | `partitions distinct qualifier values apart` | pass |
| Matter scope partitions (incl. none/some) | `partitions matter scope apart, including none vs some` | pass |
| Evidence scope partitions | `partitions evidence scope apart` | pass |
| Relation + endpoint kind partition | `partitions relations and endpoint kinds apart` | pass |
| Absent-scope marker cannot collide | `never lets a scope value collide with the absent-scope marker` | pass |

Run log: [`vitest-identity.log`](./vitest-identity.log) — 9/9. The DB half of partition
safety (no-overlap enforced **per logical key**, different keys never interfere) is
proven by the S3 suite: `btree_gist loads and a gist exclusion constraint rejects
overlap by name` inserts a same-range row under a different key green before the
same-key overlap probe rejects.

## Bounded endpoint model — decided

Three candidate encodings were weighed:

- **(a) CHOSEN — kind discriminator + per-kind columns + exactly-one CHECK.**
  `source_kind` ∈ `('claim','evidence','entity','observation')` with
  `source_claim_id`/`source_evidence_id` as real FKs and
  `source_entity_ref`/`source_observation_ref` as typed opaque refs (mirrored for
  target). The CHECK enforces the kind column and exactly its matching ref column.
  Dangling claim/evidence endpoints are rejected **by the database**, not just the
  service.
- (b) Generic `(kind, id)` pair — rejected: no per-kind FK is possible, weakening the
  ratified lineage-FK class of backstops to app-only enforcement.
- (c) jsonb endpoint blob (EvidenceSpan precedent) — rejected: no FK, no index
  selectivity, invisible to `pg_constraint`.

DB proof (S3 suite, each rejection asserted by constraint name):

| Rejection | Constraint | Fixture |
| --- | --- | --- |
| Dangling claim endpoint | `spike_edge_source_claim_fk` | `dangling claim endpoint is rejected by the endpoint foreign key` |
| Arbitrary kind (`'banana'`) | `spike_edge_source_bounded` | `arbitrary endpoint kind is rejected by the bounded-endpoint CHECK` |
| Kind/column mismatch | `spike_edge_source_bounded` | `endpoint kind/column mismatch is rejected by the bounded-endpoint CHECK` |

**Recorded P1 design point:** `entity` and `observation` endpoints have no local table
yet, so their columns are typed opaque refs with app-side validation; the FK columns are
added when those tables exist. The schema-level rejection of arbitrary endpoints is a
`S.toTaggedUnion`-style endpoint union in `@beep/epistemic-domain` (P1).

## How to run

```sh
cd packages/drivers/pglite
npx vitest run test/integration/spike/EpistemicBitemporalIdentity.test.ts
npx vitest run test/integration/spike/EpistemicBitemporalSpike.pglite.test.ts
```
