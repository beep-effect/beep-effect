# P0 Contradiction-Triage Fixture Spike

Date: 2026-07-29

Verdict: **PASS**

## Executable evidence

Harness:
`packages/epistemic/server/test/integration/ContradictionTriage.p0.pglite.test.ts`

Exact command:

```sh
BEEP_TEST_DATABASE_DRIVER=pglite bun run --cwd packages/epistemic/server test:integration -- ContradictionTriage.p0.pglite.test.ts
```

Final result:

```text
Test Files  5 passed | 1 skipped (6)
Tests       32 passed (32)
Duration    4.99s
Exit        0
```

The command selects the repository's in-process PGlite lane with the bundled
`btree_gist` extension, applies the real db-admin migration chain, exercises the
real `EdgeAuthority` repository, persists fixture-only candidate/receipt/
disposition tables, shuts PGlite down, and reopens the same data directory.

## Gate assertions

| Assertion | Result | Executable proof |
| --- | --- | --- |
| Identity/anchor matching | PASS | Equal `LogicalEdgeIdentity` inputs produce one logical key; changing only the evidence scope produces a distinct key. |
| Symmetric-edge representation | PASS | Reversing the endpoints of a core `contradicts` identity produces the same logical key; reversing the exact belief-version pair produces the same candidate key. |
| Duplicate suppression | PASS | An exact repeated payload resolves to the same immutable candidate and appends a second receipt. A materially different payload under that identity fails as typed `CandidatePayloadConflict`. |
| Unresolved-conflict visibility | PASS | The fixture query applies both half-open valid time and transaction time, and a later disposition changes only later `knownAt` answers. |
| Candidate-to-approved transition | PASS | Before review, both authority facts remain unchanged. Approval executes the existing conflict-safe supersession path inside the disposition transaction, preserves the former version for historical reads, and persists the selected proposal id/digest. Rejection persists a separate `rejected` disposition. |
| Competing lineages | PASS | Superseding lineage A leaves incompatible lineage B open and queryable. |
| Revision ordering | PASS | A late older fact receives the next revision while remaining closed at the standing head; paired as-of reads deterministically recover the older and standing facts. |
| Restart boundary | PASS | Candidate, disposition, superseded history, competing head, and paired as-of answers survive a full PGlite close/reopen without remigration. |

## Model decisions fixed by the spike

- Candidate identity is the canonical exact belief-version pair plus typed
  match-basis kind and evidence digest.
- Match basis is bounded to `same-source-overlap` or
  `independent-evidence`; detector metadata is provenance, not identity.
- Exact repeats append receipts. A different immutable payload under an
  existing candidate identity is a typed conflict, never an overwrite.
- Proposals are persisted before review with stable `proposalId` and
  `proposalDigest`, an exact losing `BeliefVersionRef`, the full replacement
  fact, validity interval, and rationale.
- Public approval selects only `{ proposalId, proposalDigest }`; server code
  reloads the persisted proposal and derives authority-write fields.
- `ClaimDispositionStatus` remains unchanged. Absence means unresolved, and
  slice-local contradiction outcomes are only `rejected` or `superseded`.

## Initial diagnostic

The first execution failed before database assertions because the reversed
symmetric fixture spread a decoded `LogicalEdgeIdentity` (whose optional scopes
are `Option`) back into its encoded constructor (which expects nullable
scopes). Rebuilding the encoded fixture explicitly fixed that fixture-only
boundary error. The unchanged command then passed twice; the result above is
the final run after adding explicit detection-does-not-mutate-authority and
rejection assertions.
