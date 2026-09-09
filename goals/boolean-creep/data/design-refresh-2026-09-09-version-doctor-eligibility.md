# Version-sync, worktree-doctor, and lint-predicate eligibility audit

## Scope

- Source checkout: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`.
- Corpus main: `52fcc8d1353db9481ef9edb6cc9619500f95568d`.
- Audited raw Round 26 candidates:
  - `r26-cli-commands-r-z-version-sync-report-has-drift`
  - `r26-cli-commands-r-z-worktree-doctor-clean-change-count`
- Re-audited existing designed records:
  - `r3-tooling-inline-schema-compile-arg-kind`
  - `r3-tooling-manual-runtime-receiver-kind`
- This task did not edit product source, tests, canonical inventory, statuses,
  dependencies, generated files, Git state, or existing designs.

## Eligibility decisions

None of the four findings is eligible for this campaign. No new design should
be created. The two raw Round 26 findings should not be admitted. The two
existing lint-rule records should be withdrawn from the canonical inventory
and their existing designs archived by the parent.

The binding net is a set of at least two Boolean-typed members in one carrier,
or sibling Boolean atoms/state fields in one module. A Boolean and a required
array or number do not form that net. Independently callable predicates also
do not become sibling state merely because one caller evaluates them in an
ordered expression.

| ID | Decision | Reason |
| --- | --- | --- |
| `r26-cli-commands-r-z-version-sync-report-has-drift` | Do not admit | `VersionSyncReport` has one Boolean member, `hasDrift`, and one required array, `categories`. Array content is neither a Boolean sibling nor optional/empty payload presence. |
| `r26-cli-commands-r-z-worktree-doctor-clean-change-count` | Do not admit | `clean` is Boolean and `changeCount` is a required finite number. Zero/nonzero is an invented predicate over a scalar, not a second Boolean member. The actual multi-Boolean doctor carrier is already recorded as D1 under `worktree-doctor-entry-facts`. |
| `r3-tooling-inline-schema-compile-arg-kind` | Withdraw and archive design | `isStaticSchemaReference` and `isNestedStaticSchemaCall` are independently callable predicate functions over an AST input. No object, schema, atom, ref, or sibling local stores both results. `reportMessage` stores only one local Boolean (`high`) and calls the other predicate later. |
| `r3-tooling-manual-runtime-receiver-kind` | Withdraw and archive design | `isEffectReceiver` and `isManagedRuntimeReceiver` are independently callable predicate functions over an AST receiver. Their results are not co-carried. `effectRunner` and `managedRuntimeRunner` return `Option<string>`, and `runnerLabel` composes those function results directly. |

## `VersionSyncReport`

### Carrier and legitimate constructors

`packages/tooling/tool/cli/src/commands/VersionSync/VersionSync.schemas.ts:346-355`
exports the schema class:

```ts
{
  categories: S.Array(VersionCategoryReport),
  hasDrift: S.Boolean,
}
```

Neither field has a constructor or decoding default. The class is exported by
`commands/VersionSync/index.ts:34` and the package's VersionSync subpath, but
there is no VersionSync report JSON encoder, persistence writer, or CLI JSON
mode. Its observed command boundary is human console output.

The production resolver is the sole product writer. It accumulates selected
category reports at
`VersionSync/internal/services/ResolverService.ts:54-131`, then constructs the
report at lines 133-136 with:

```ts
hasDrift: A.some(categories, category => category.status !== "ok")
```

This supports these semantic rows:

| Categories | `hasDrift` | Meaning/evidence |
| --- | --- | --- |
| Empty | `false` | Possible when selected Bun or Biome data is absent and no other category is selected; the resolver begins with an empty array at line 56 and conditionally appends at lines 59-131. |
| Nonempty, all `ok` | `false` | A normal in-sync report; the derived writer at lines 133-136 makes this explicit. |
| Nonempty, any `drift`, `unpinned`, or `error` | `true` | The same writer derives true from any non-`ok` status. Tests construct true reports with real drift-bearing category reports at `version-sync-effect.test.ts:344-355` and `417-435`. |

The production writer does not create `true` with an empty/all-`ok` array or
`false` with a non-`ok` category. That coherence is useful ordinary cleanup
evidence: a future non-campaign refactor could derive `hasDrift` at its readers
or model a refined report result. It is not a Boolean-creep cardinality proof,
because the supposed second member is the unbounded category array. Reducing
that array to `empty/nonempty` is also wrong: nonempty all-`ok` reports are
legitimate, and nonempty error reports can carry zero update items.

Readers preserve both independent uses of the category payload:

- `VersionSync.render.ts:114-134` renders every category and separately uses
  `hasDrift` to select the final instruction.
- `VersionSync/internal/Handler.ts:34-53` derives an item count from categories
  for the typed drift error, while `hasDrift` gates check/write effects.
- `VersionSync/internal/services/UpdateApplierService.ts:209-235` locates
  category-specific payloads for updates and does not treat array presence as
  the drift state.

### Correct disposition

Do not admit
`r26-cli-commands-r-z-version-sync-report-has-drift`. Preserve its raw sweep
record as historical evidence, with a withdrawal receipt stating that it is
outside the scanner net: one Boolean plus a required array whose content was
collapsed into an invented predicate. Do not encode the finding as D1, E3, or
an `option-literal`; none describes the actual carrier.

## `WorktreeDoctorEntry`

### Carrier and legitimate constructors

`packages/tooling/tool/cli/src/commands/Worktree/Worktree.command.ts:227-246`
defines the exported schema class. `clean` is one of seven Boolean observations;
`changeCount` is `S.Finite`. Only `unpushed` has constructor/decoding defaults.
`clean` and `changeCount` are both required.

The sole product inspector constructs each entry at lines 480-512. It obtains
the porcelain lines once, then writes:

```ts
clean: changes.length === 0,
changeCount: changes.length,
```

The public JSDoc constructor at lines 208-225 and the clean fixture at
`worktree-command.test.ts:416-432` establish `true/0`. The dirty fixture at
test lines 434-451 establishes `false/4`. The branch-label fixture at test
lines 454-473 also uses `true/0`.

The reader at `Worktree.command.ts:657-672` matches `clean`; its dirty arm
prints `changeCount`, and its clean arm prints `clean`. The doctor command at
lines 918 onward emits the report through the human renderer at lines 674-691.
There is no doctor JSON encoder or persistence boundary.

The equality is real, but it is between a Boolean and a number. Treating
`changeCount === 0` and `changeCount > 0` as another Boolean invents a member
that the source does not carry. It would also hide the legitimate dirty count
payload behind a fake two-bit cardinality calculation.

The actual Boolean members of `WorktreeDoctorEntry` remain independently
observed facts. The source and JSDoc explicitly permit a clean checkout with
missing bootstrap artifacts, and dirty/unpushed/locked/prunable/detached axes
vary separately. Canonical record `worktree-doctor-entry-facts` already gives
that carrier the correct D1 disposition.

### Correct disposition

Do not admit
`r26-cli-commands-r-z-worktree-doctor-clean-change-count`. Preserve its raw
sweep row only as historical evidence, with a withdrawal receipt stating that
the candidate is outside the net because it pairs one Boolean with a required
numeric scalar. Keep `worktree-doctor-entry-facts` as the carrier's canonical
D1 record. A regular cleanup may derive `clean` from `changeCount`, but that is
not a Boolean-creep design and should not be recast as `option-literal`.

## Lint-rule predicate records

### `r3-tooling-inline-schema-compile-arg-kind`

At the merged source SHA:

- `isStaticSchemaReference` is a function at
  `no-inline-schema-compile.ts:62-72`.
- `isNestedStaticSchemaCall` is a function at lines 147-164.
- `reportMessage` at lines 168-172 stores only the `high` result, branches on
  it, then invokes `isStaticSchemaReference(firstArg)` in the fallback ternary.
- The CallExpression visitor invokes `reportMessage` at lines 209-215. No
  classifier result survives that call or enters a data carrier.

The main `52fcc8d` semantic change strengthens the first predicate's
member-expression root check and rewrites nested-call classification. It does
not create co-carried Boolean state. The predicates remain mutually exclusive
for a given AST node because the nested predicate requires a schema
CallExpression while the static-reference predicate accepts an Identifier or
a recursively rooted MemberExpression. That mathematical relationship between
callable predicates is outside the declared scanner net.

The current design's proposed LiteralKit classifier could be a reasonable lint
rule cleanup, but its guard-deletion section confirms the scope defect: it
would delete one local Boolean, one `if`, and one later predicate call, not a
parallel Boolean carrier. Recommend removing the canonical record, archiving
`designs/r3-tooling-inline-schema-compile-arg-kind.md`, and preserving the
withdrawal receipt. No replacement campaign record is warranted.

### `r3-tooling-manual-runtime-receiver-kind`

At `no-manual-effect-runtime-in-tests.ts:178-213`:

- `isEffectReceiver` and `isManagedRuntimeReceiver` are functions over the
  current AST receiver.
- `effectRunner` and `managedRuntimeRunner` each call one predicate and return
  `Option<string>`.
- `runnerLabel` composes those optional function results with `O.orElse`.
- No schema, type, object, atom, ref, or sibling local carries both Boolean
  results.

The import-binding writers at lines 218-231 keep identifiers in distinct sets.
That proves receiver provenance and keeps diagnostics deterministic, but it
does not convert later predicate calls into a stored sibling-state carrier.
The current design proposes deleting the predicate functions and their
`Option` composition in favor of a literal classifier. That remains ordinary
classifier refactoring outside this campaign.

Recommend removing the canonical record, archiving
`designs/r3-tooling-manual-runtime-receiver-kind.md`, and preserving a
withdrawal receipt explaining the callable-predicate scope defect. No
replacement campaign record is warranted.

## Parent metadata actions

| ID | Inventory action | Design action |
| --- | --- | --- |
| `r26-cli-commands-r-z-version-sync-report-has-drift` | Do not admit; archive the raw proposal in a scope-withdrawal receipt | None exists; create none |
| `r26-cli-commands-r-z-worktree-doctor-clean-change-count` | Do not admit; archive the raw proposal in a scope-withdrawal receipt | None exists; create none |
| `r3-tooling-inline-schema-compile-arg-kind` | Remove the designed canonical record and retain a withdrawal receipt | Archive existing design unchanged |
| `r3-tooling-manual-runtime-receiver-kind` | Remove the designed canonical record and retain a withdrawal receipt | Archive existing design unchanged |

Any aggregate counts, PLAN sequencing references, or family dependency notes
that include the two lint-rule IDs must be recomputed by the parent after the
withdrawals. This audit intentionally does not mutate those shared files.

## Verification

- Confirmed checkout/source identities with `git rev-parse HEAD` and
  `git rev-parse origin/main`.
- Read every product writer and reader found by targeted searches for
  `VersionSyncReport`, `WorktreeDoctorEntry`, the two lint predicates, and
  their report/classifier helpers.
- Read the public constructor examples and supported fixtures cited above.
- Searched for JSON codecs, persistence writers, and additional constructors;
  neither report has a JSON/persistence boundary in its command flow.
- No real external services, repositories, or worktrees were touched.
- No design validator is required because this audit creates no design. The
  scoped Markdown diff is checked separately with `git diff --check`.
