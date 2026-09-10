# Worktree conflict, removal receipt, and reap-report handoff — 2026-09-09

## Audit boundary

This audit used merged checkout
`3330f9881a50c96d3f2ec0fcad76f0f7a09027e4` and corpus/main
`52fcc8d1353db9481ef9edb6cc9619500f95568d`. The product tree matched main.

The bounded source graph was:

- `ConflictDerivation`, its direct constructors, `DerivedSignals`
  aggregation, `FleetCheckout` projection, renderer, and fleet tests;
- `WorktreeRemovalReceipt`, every production/test constructor, its renderer,
  schema codec test, and removal service;
- `WorktreeReapReport`, its sole production writer, direct fixtures, JSON
  command encoder, renderer, and retirement summarizer.

No product source, tests, canonical inventory, lifecycle state, dependencies,
generated files, or git references changed.

## ConflictDerivation: qualify with corrected 60/11 cardinality

Design:
`goals/boolean-creep/designs/r26-cli-commands-r-z-conflict-derivation.md`.

The Round 26 record found the correct four-field owner but its 60/4 legal count
is incomplete. The complete current carrier represents 60 coarse tuples and
supports exactly eleven.

Direct `ConflictDerivation` writers at
`packages/tooling/tool/cli/src/commands/Worktree/Fleet.service.ts:1095-1146`
produce not-live, probe-failed, clean, and conflict. Merge-tree exit 1 remains
conflict even when parsing stdout yields no path, so conflict has both empty and
nonempty path-presence rows. This gives five direct coarse tuples.

`DerivedSignals = PolicyDerivation & ConflictDerivation` at lines 1149-1192
is also a typed writer of all four conflict fields:

- `unmeasuredSignals` adds unknown/head-unknown/empty/false and
  unknown/target-unmaterialized/empty/false;
- for known head/target, it overwrites `probeFailed` with
  `policy.probeFailed || conflict.probeFailed`.

Policy probes run before and independently of the liveness/merge-tree conflict
classification. Their tolerant `runGitProbe` path maps command failure to a
failed policy reading without preventing the later conflict result. Therefore a
policy failure may pair aggregate `probeFailed: true` with not-live, clean,
conflict-empty, or conflict-nonempty. Conflict probe failure always yields true,
irrespective of the policy result, so it adds one flat tuple.

The exact supported table is:

| probeFailed | conflict | conflictReason | paths |
| --- | --- | --- | --- |
| false | unknown | head-unknown | empty |
| false | unknown | target-unmaterialized | empty |
| false | unknown | not-live | empty |
| true | unknown | not-live | empty |
| true | unknown | probe-failed | empty |
| false | clean | null | empty |
| true | clean | null | empty |
| false | conflict | null | empty |
| true | conflict | null | empty |
| false | conflict | null | nonempty |
| true | conflict | null | nonempty |

No other tuple has a writer. Head absence wins before target absence.
A conflict-probe failure forces unknown/probe-failed/empty and aggregate true.
Clean/conflict always use null reason. Unknown always uses one of the four
existing reasons and empty paths.

This exact table is 11 states. The four axes represent
`2 × 3 × 5 × 2 = 60` coarse tuples. The raw global E3 equivalence is false:
after aggregation, `probeFailed` can mean policy failure while conflict is
not-live, clean, or conflict. Parent metadata correction:
`representable=60`, `legal=11`, derived/internal, Tier 1, tagged-union.
Retain E1 writer evidence and replace the raw global E3 wording.

The target restores ownership:

- a private schema-backed conflict union reuses `FleetConflictStatus` with
  clean, conflict carrying the exact path array, and unknown carrying one
  `FleetUnknownReason`;
- conflict paths remain allowed to be empty;
- the conflict-local failed-probe observation is derived only from
  unknown/probe-failed;
- policy failure remains owned by policy derivation;
- `DerivedSignals` stores policy and conflict results separately instead of
  intersecting them and overwriting one shared Boolean;
- degraded coverage remains the OR of independent status/liveness/policy
  failures and the conflict probe-failed case.

The semantic conflict quotient has seven coarse values: four unknown reasons,
clean, conflict-empty, and conflict-nonempty. Seven is the target conflict
domain, not the current flat carrier's legal cardinality.

The public `FleetCheckout` and fleet JSON stay exact. The one boundary
projection emits the existing status string, nullable reason, and path array.
Unknown keeps its exact reason and empty paths; clean keeps null/empty;
conflict keeps null and the parsed array, including empty. Public flat schema
acceptance, `worktree fleet --json`, renderer output, reason precedence,
command ordering, and degraded counts do not change.

Coordinate with `worktree-policy-reading.md`: that design changes the upstream
policy probe record. This design keeps the later policy result distinct and
must not duplicate or absorb it.

## WorktreeRemovalReceipt: D1, 4/4

Do not design
`r26-cli-commands-r-z-worktree-removal-receipt-branch-deleted`. Reconcile it
as D1 with all four branch-presence/deleted pairs deliberately supported.

Production constructs false/Some for legacy and retained-branch removal and
true/Some after an authorized archive branch deletion at
`packages/tooling/tool/cli/src/commands/Worktree/Worktree.service.ts:701-709,837-850,868-1021`.
Detached removal supplies false/None.

More decisively, the renderer test at
`packages/tooling/tool/cli/test/worktree-command.test.ts:551-563` constructs
true/Some, copies it to true/None, and requires the latter to render
`branch deleted: (detached HEAD)`. The same test block explicitly covers
false/Some and false/None at lines 477-494. This is a supported consumer
contract rather than an unused defensive branch.

The arbitrary JSON codec property at
`worktree-command.test.ts:328-344` additionally preserves the exported schema
shape for every generated pair. It is supporting breadth evidence; the
explicit four renderer fixtures already establish D1.

Keep `WorktreeRemovalReceipt`, its Option-from-null branch encoding,
`branchDeleted`, constructors, direct codec behavior, and renderer exact.
A union that makes true/None unconstructible would break a tested supported
value. Cardinality correction: 4 representable, 4 supported. No design file
should exist.

This ruling does not alter the separate qualified
`worktree-removal-mode` request design. Request archive/delete behavior and
receipt rendering are different owners.

## WorktreeReapReport: withdraw as outside the net

Withdraw
`r26-cli-commands-r-z-worktree-reap-report-applied`; do not design or
reclassify it as D1.

`WorktreeReapReport` at
`packages/tooling/tool/cli/src/commands/Worktree/Reap.schemas.ts:165-181`
contains one Boolean member, `applied`. `retiredCount` is a required
`S.Int`. “Zero versus nonzero” is a predicate over a numerical payload, not
an actual Boolean, Option presence member, literal state, or sibling local.
The raw report therefore invents a second bit and falls outside the SPEC net.

The production writer at
`packages/tooling/tool/cli/src/commands/Worktree/Reap.service.ts:626-689`
does derive `retiredCount` by counting retired candidate rows and can only
retire during apply. That behavioral implication does not create a second
Boolean field on the report. Keep it as an ordinary cross-field semantic fact.

The report is a versioned `worktree-reap/v1` JSON contract emitted at
`Reap.command.ts:112-130`. Preserve `applied`, the exact integer count,
candidate rows, reclaimed/reclaimable bytes, warnings, defaults, renderer, and
all accepted encoded values. Do not add a report-mode literal, normalize count
values, or tighten the public codec.

The actual nested Boolean/presence owner is the already designed
`worktree-reap-candidate-retirement` cluster. It remains separate; report
count arithmetic does not expand that owner. Because this row is a scanner-net
boundary error, omit it from live canonical inventory and retain it only in raw
sweep history. No reap-report design file should exist.

## Verification requirements

Formal P3 should verify the conflict design against the exact eleven-row current
table and seven-state target quotient. Apply-time focused tests must preserve:

- all four unknown reasons and their existing precedence;
- clean, conflict-empty, and conflict-nonempty wire projections;
- independent policy failure combined with not-live, clean, and both conflict
  path-presence results;
- degraded coverage for either probe owner;
- existing fleet text/JSON output and permissive public `FleetCheckout`
  construction.

Receipt and reap require no implementation or tests. Their current explicit
fixtures and encoded behavior are preservation evidence for withdrawal.
