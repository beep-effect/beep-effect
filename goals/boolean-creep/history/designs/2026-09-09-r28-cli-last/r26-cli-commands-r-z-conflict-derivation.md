# Instance

- id: `r26-cli-commands-r-z-conflict-derivation`
- exact source SHA: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source SHA: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line:
  `packages/tooling/tool/cli/src/commands/Worktree/Fleet.service.ts:1088`
- symbol: `ConflictDerivation`
- members: `probeFailed`, `conflict`, `conflictReason`,
  `conflictPaths`
- evidence:
  - E4 at `Fleet.service.ts:1102-1106,1190` — a probe-failed reason
    implies a true probe-failure bit. The aggregate OR preserves that
    implication; its converse does not hold because policy failure can set
    the bit independently.
  - E1 at `Fleet.service.ts:1095-1129` — direct conflict-probe writers emit
    not-live, probe-failed, clean, or conflict. Each writer sets the status,
    nullable reason, path payload, and local probe result together.
  - E1 at `Fleet.service.ts:1152-1163` — the two pre-probe exits write
    unknown conflict status, their exact head/target reason, empty paths, and
    no probe failure.
  - E2 at
    `packages/tooling/tool/cli/src/commands/Worktree/Fleet.command.ts:60-68`
    — rendering treats conflict paths as the conflict payload, treats a reason
    as the unknown payload, and otherwise renders the status.

Formal P3 remains pending. The Round 26 raw record found the correct owner but
its 60/4 legal count omitted supported states and its E3 claim is valid only
before the later policy/conflict aggregation.

# Current shape

`ConflictDerivation` is a private structural record. Direct conflict probing
writes these outcomes:

- a checkout that is not live produces
  `false / unknown / not-live / []`;
- an absent or unsuccessful merge-tree probe produces
  `true / unknown / probe-failed / []`;
- merge-tree exit 0 produces `false / clean / null / []`;
- merge-tree exit 1 produces `false / conflict / null / paths`.

The exit-1 path array is deliberately not a nonempty contract.
`parseMergeTreeConflictNames(result.stdout)` may return an empty array, and
the branch still means conflict because exit code 1 is authoritative.

Two earlier exits bypass `conflictDerivation`.
`unmeasuredSignals` writes the `ConflictDerivation` field projection through
`DerivedSignals = PolicyDerivation & ConflictDerivation` for
`head-unknown` and `target-unmaterialized`. Both use empty paths and
`probeFailed: false`.

The same intersection then overloads `probeFailed`. For measured head and
target, `deriveSignals` writes
`policy.probeFailed || conflict.probeFailed`. Consequently the bit no longer
means only “the conflict probe failed”: a policy probe failure may pair
`probeFailed: true` with not-live, clean, or either conflict path-presence
row. Its only reader is the aggregate degraded-coverage calculation at
`Fleet.service.ts:1223-1228`.

The public `FleetCheckout` does not contain `probeFailed`. It stores only
`conflict`, nullable `conflictReason`, and `conflictPaths`, nested in the
fleet snapshot printed by `worktree fleet --json`. The target must preserve
that flat wire projection exactly.

# Cardinality gap

The current four fields have:

- two Boolean `probeFailed` values;
- three `FleetConflictStatus` literals;
- null plus four `FleetUnknownReason` literals;
- empty versus nonempty conflict-path presence.

That is `2 × 3 × 5 × 2 = 60` representable coarse tuples.

The complete current return graph supports eleven coarse projections:

| probeFailed | conflict | reason | paths | source |
| --- | --- | --- | --- | --- |
| false | unknown | head-unknown | empty | missing head |
| false | unknown | target-unmaterialized | empty | unavailable target |
| false | unknown | not-live | empty | non-live, policy probes succeed |
| true | unknown | not-live | empty | non-live, a policy probe fails |
| true | unknown | probe-failed | empty | conflict probe fails |
| false | clean | null | empty | clean, policy probes succeed |
| true | clean | null | empty | clean, a policy probe fails |
| false | conflict | null | empty | conflict exit with no parsed names |
| true | conflict | null | empty | same, plus policy probe failure |
| false | conflict | null | nonempty | named conflict paths |
| true | conflict | null | nonempty | same, plus policy probe failure |

The two true conflict rows do not mean the conflict probe failed. They mean an
independent policy probe failed and the flattened aggregate bit was overwritten
with the OR. The table does not assert that every operational Git failure is
easy to reproduce; the tolerant probes intentionally support one invocation
failing while the independent merge-tree invocation returns a result.

The semantic conflict state alone has seven coarse values: four unknown reasons,
clean, conflict with empty paths, and conflict with nonempty paths. The target
separates policy failure from that state instead of encoding the eleven-row
product in a large enum.

Parent metadata correction: retain 60 representable and change legal from 4 to
11 for the complete current carrier. Do not use 60/7 for the current flat
record; seven is the conflict-state quotient after the cross-owner aggregate bit
is removed.

# Target schema

Reuse the existing `FleetConflictStatus` LiteralKit as the discriminator owner:

```ts
const FleetConflictDerivation = FleetConflictStatus.toTaggedUnion("status")({
  clean: {},
  conflict: { paths: S.Array(S.String) },
  unknown: { reason: FleetUnknownReason },
}).pipe(
  $I.annoteSchema("FleetConflictDerivation", {
    description: "One derived fleet conflict reading before wire projection.",
  })
);
type FleetConflictDerivation = typeof FleetConflictDerivation.Type;
```

Keep the schema private to the fleet derivation service. The conflict case uses
`S.Array(S.String)`, not a nonempty refinement. The unknown case accepts all
four existing reasons. Derive the conflict-probe failure only with the schema
guard for the unknown case plus
`FleetUnknownReason.is["probe-failed"](reason)`; do not store a Boolean alias
inside the union.

Replace the structural intersection with separately owned state, for example a
record containing the existing `PolicyDerivation` fields and one
`conflictReading: FleetConflictDerivation`. The policy owner retains its
probe-failure observation. Aggregate degradation becomes policy probe failure
OR a probe-failed conflict case. Do not attach policy failure to the conflict
union or enumerate its cross-product.

# Migration inventory

- `Worktree.schemas.ts:812-900` — reuse `FleetConflictStatus` and
  `FleetUnknownReason`; do not create duplicate literal families or alter
  their exported values.
- `Worktree.schemas.ts:971-993` — keep the public `FleetCheckout` schema
  flat and byte-compatible: status string, nullable reason, and path array.
- `Fleet.service.ts:1088-1114` — replace the private record and three
  constants with schema-backed cases for not-live, probe-failed, and clean.
- `Fleet.service.ts:1117-1129` — map merge-tree exits exhaustively. Exit 0
  constructs clean; exit 1 constructs conflict with the parsed array even when
  it is empty; every other exit constructs probe-failed.
- `Fleet.service.ts:1132-1146` — preserve the liveness guard before invoking
  merge-tree, exact Git arguments, Option failure handling, and exit-code
  authority.
- `Fleet.service.ts:1149-1163` — replace
  `PolicyDerivation & ConflictDerivation` with separate ownership.
  `unmeasuredSignals` constructs unknown conflict cases for the exact supplied
  head/target reason and preserves the policy projection and reason precedence.
- `Fleet.service.ts:1166-1192` — preserve the head-unknown check before the
  target-unmaterialized check. Retain policy and conflict probe ordering. Store
  policy and conflict results separately instead of overwriting one
  `probeFailed` field with their OR.
- `Fleet.service.ts:1195-1228` — project the union exactly once into
  `FleetCheckout.conflict`, `conflictReason`, and `conflictPaths`.
  Compute degraded coverage from status/liveness failures, policy probe failure,
  and the conflict probe-failed case.
- `Fleet.command.ts:60-68,116-124` — keep the public row renderer and its
  current empty-path rendering. No presentation fallback becomes a new domain
  constraint.
- `Fleet.command.ts:307-326` — retain text/JSON selection, exact JSON failure,
  and the encoded `FleetSnapshot` structure.
- Coordinate with the existing `worktree-policy-reading` design. It replaces
  the upstream `PolicyReading` bag; this design keeps the later policy result
  distinct and must not duplicate or absorb that target.

# Guard-deletion accounting

Delete the four-field `ConflictDerivation` record, its repeated constants, and
the conflict-local `probeFailed` Boolean. Delete the
`PolicyDerivation & ConflictDerivation` intersection and the assignment that
overwrites both owners' `probeFailed` with an OR.

Delete nullable/status/path reconstruction branches inside the derivation
pipeline. One exhaustive projection at the `FleetCheckout` boundary owns the
legacy three wire fields. Use schema-derived union guards for the
probe-failed conflict case and for projection; do not add hand-written
`isConflict` or `hasConflictPaths` helpers.

Keep the final OR that determines checkout degradation, now over independently
owned policy failure and the conflict union case. It is a Boolean result
calculation, not a parallel state carrier.

# Encoded-side impact

The target is private Tier 1 state. The fleet wire shape remains unchanged:

- unknown encodes `conflict: "unknown"`, its exact existing reason, and
  `conflictPaths: []`;
- clean encodes `conflict: "clean"`, `conflictReason: null`, and
  `conflictPaths: []`;
- conflict encodes `conflict: "conflict"`, `conflictReason: null`, and the
  parsed path array unchanged, including an empty array.

`FleetCheckout`, `FleetSnapshot`, `worktree fleet --json`, text rendering,
field order, nulls, arrays, unknown-reason strings, target precedence, and
coverage counts do not change. No accepted public snapshot value is tightened:
the exported flat schema and direct constructors remain as permissive as they
are now.

# Test impact

Retain the live fleet tests for:

- unavailable target producing unknown/target-unmaterialized/empty paths;
- clean merge-tree output;
- named textual conflicts;
- target materialization and head precedence;
- zero degraded coverage for unmeasured target state.

Add focused derivation/projection coverage for:

- not-live;
- absent or nonzero merge-tree probe failure;
- exit 1 with empty stdout preserving conflict plus an empty path array;
- exit 1 with one and multiple NUL-delimited paths preserving order;
- a policy probe failure alongside clean, not-live, and conflict results,
  proving the external conflict fields remain exact while degraded coverage is
  true;
- all four unknown reasons, clean, conflict-empty, and conflict-nonempty
  projecting to the old `FleetCheckout` JSON fields.

Retain `fleetCheckoutLines` tests, `worktree fleet --json` tests, contested
path ranking, policy movement, and coverage accounting. Tests should exercise
the public service or an existing injected probe seam; do not export the
private union solely for testing.

# Risk and sequencing

Tier 1 internal migration with a wire-compatible projection. The main risks are
mistaking policy failure for conflict failure, requiring nonempty paths after
merge-tree exit 1, changing head/target reason precedence, or tightening the
public flat `FleetCheckout` schema.

Refresh the source graph immediately before implementation. Land in the same
Worktree batch as the already reviewed policy-reading design so its
`probeFailed` ownership is changed once. Run focused Worktree fleet tests,
full `@beep/repo-cli` package verification, and repository-required checks.
Formal P3 must verify the corrected 60/11 current cardinality and confirm
that the target's seven-state conflict quotient preserves all eleven current
internal projections' observable degradation and wire output.

# Qualification recommendation

Promote `r26-cli-commands-r-z-conflict-derivation` with the same four members,
cardinality 60/11, `storage=derived`, `exposure=internal`,
`targetShape=tagged-union`, and Tier 1. Replace the raw E3 note with the full
aggregation qualification above: conflict-local probe failure does match the
probe-failed reason, while the later aggregate bit may also reflect independent
policy failure.
