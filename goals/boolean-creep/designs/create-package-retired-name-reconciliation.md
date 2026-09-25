# create-package-retired-name-reconciliation

Native P2 source/design refresh before R32, bound to merged source HEAD
`0be1f13d62fa00cb65e34ff69ec99043380f8d81` / same main. This preserves status `designed`
and cardinality 4/3. Tier 1: ordered Tier1E tooling batches with serial shared-file edits.
Independent P3 review and implementation acceptance remain pending.

Owner `createPackageCommand` at `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1399`,
with members `retiredNameReused`, `retiredNameCleared`.
Storage/exposure: derived/internal; target: literalkit.

The prior public [source-impact audit](../data/pre-r29-main-4f13d8-source-impact.md),
[source bindings](../data/pre-r29-main-4f13d8-source-bindings.json), and
[row/design map](../data/pre-r29-main-4f13d8-row-design-map.json) preserve the earlier baseline.
The [exact original design](../history/designs/2026-09-09-pre-r29-main-4f13d8/create-package-retired-name-reconciliation.md) is preserved.
Keep complete decoded exports, typed request diagnostics, public constructor and
helper input domains, encoded keys/defaults/omission and full independent payloads
as specified below. Paths beginning `src/` or `test/` are relative to
`packages/tooling/tool/cli/` unless the design states otherwise.

# Current shape

`ensureRetiredNameAllowed` reads the retired-name registry, rejects a retired
name without explicit reuse authorization, and returns whether this invocation
is a sanctioned reuse. Dry-run reports that fact without mutation. A real
create carries it across scaffolding and repo registration, then conditionally
removes the entry and records the removal function's Boolean result as
`retiredNameCleared` for the summary.

The removal helper returns false when the entry is already absent in an existing,
valid registry document and otherwise rewrites the schema-decoded registry with stable formatting. Its generic no-op
case is explicitly tested even though the ordinary command path establishes
membership earlier. The direct fixture does not demonstrate that outcome through the command.
However the command re-reads mutable filesystem state at removal, without a
lock or membership guarantee spanning the scaffold operations. A valid registry
from which the name has disappeared yields false. Preserve that documented
helper outcome rather than assuming the two Booleans are equivalent. A missing
registry file at removal instead fails; it is not the unchanged outcome.

# Cardinality gap

Two final observation bits expose four tuples and three are coherent:

| reused | cleared | outcome |
| --- | --- | --- |
| false | false | not reused |
| true | false | sanctioned reuse, registry already absent at removal |
| true | true | sanctioned reuse, registry entry removed |

False/true is unreachable. The pre-mutation sanctioned state is also needed to
render dry-run and gate removal; it is a lifecycle stage of the same owner, not
another final Boolean combination.

The neighboring `workspaceUpdated`, `identityUpdated`, sync changed-files, and
`lockfileRefreshed` results remain independent repo-mutation facts. They can
combine freely with retired-name reconciliation and do not belong in this
cluster.

# Target schema

Define a private `RetiredNameReconciliation` LiteralKit with `not-reused`,
`reuse-authorized`, `reuse-unchanged`, and `reuse-cleared`. The gate
returns `not-reused` or `reuse-authorized`; dry-run reads that stage. A real
create refines `reuse-authorized` to `reuse-unchanged` or `reuse-cleared` from
the existing removal result, while `not-reused` remains unchanged.

Use a named schema-derived subset for terminal outcomes (not-reused,
reuse-unchanged, reuse-cleared), and a separate derived admission subset
(not-reused, reuse-authorized), so the summary does not accept the intermediate
authorized state. Both derive from the one private LiteralKit domain; do not
copy parallel string lists or introduce unchecked casts. Annotate reusable
schemas and retain LiteralKit statics explicitly if annotations would erase
them. Keep runtime construction in the current module, not a new public API.

Use the existing retired registry schema and helper for the mutation. Do not
model unrelated execution flags, preserve a Boolean alias, or add stored state.
The authorized case records necessary sequencing before the final three-way
outcome; it does not expand the final 4/3 census table.

# Migration inventory

Source/main is `0be1f13d62fa00cb65e34ff69ec99043380f8d81`.
The lifecycle sites remain992–1006,1399,1456,1605–1607,1622,1631–1632.
Current public `CreatePackageScripts`1957–1960 exports app(dev,build,lab) and
package(kind,withStoriesTsconfig); the latter no longer accepts path arguments.
Preserve those broader helper input domains, current canonical `lint:laws`
audit output, stories overrides, real-app builder precedence and ecosystem
metadata → remaining app-kind → tool → library manifest selection. None is
retired-name guard deletion credit. Preserve current generated config bytes,
module-override absences and `syncTsconfigAtRoot`1597–1601 owner references.
The source's upstream script-policy changes do not change the reconciliation
owner's4/3 law and must not be reverted by shared command edits.

- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:992-1006`
  — return the initial reconciliation case from `ensureRetiredNameAllowed` while
  preserving the registry read, typed error mapping, refusal condition, and
  exact refusal message.
- `CreatePackage.command.ts:1398-1400` — replace `retiredNameReused` with the
  named reconciliation state at the same early gate.
- `CreatePackage.command.ts:1432-1468` — render the exact sanctioned-reuse
  dry-run line only for `reuse-authorized`; retain all other plan lines and the
  no-mutation return.
- `CreatePackage.command.ts:1589-1611` — after all existing scaffold,
  workspace, identity, and config-sync operations, refine the authorized case
  through `removeRetiredPackageName`; preserve registry removal before lockfile
  refresh and its typed failures.
- `CreatePackage.command.ts:1613-1651` — render the exact retired-entry removal
  summary only for `reuse-cleared`; preserve ordering relative to workspace,
  identity, lockfile, and sync summaries.
- `packages/tooling/tool/cli/src/commands/CreatePackage/internal/RetiredNameRegistry.ts:22-72`
  — no schema or byte change; retain decoded filtering, no-op behavior, two-space
  JSON, trailing newline, and read/encode/write error mapping.
- `packages/tooling/tool/cli/test/create-package-lab.test.ts:848-912` — retain
  refusal, dry-run authorization without mutation, actual removal, exact output,
  and recreated package assertions.
- `create-package-lab.test.ts:914-940` — retain the helper's explicit absent-name
  no-op and byte-stability test.

Targeted source and barrel search found no other reader or writer of either
command-local Boolean.

# Guard-deletion accounting

Delete `retiredNameReused`, `retiredNameCleared`, the dry-run conditional
spread, the removal ternary with false fallback, the summary OR term, and the
summary Boolean guard. Match the named lifecycle state instead. Keep the
registry membership check and reuse-consent guard because they enforce the
public destructive policy; keep the removal helper's length comparison because
its documented no-op result distinguishes the two sanctioned final outcomes.

# Encoded-side impact

None for the changed carrier. Both booleans are private transient command
locals. Preserve the public CLI flag, refusal error, dry-run and summary text,
registry path, registry JSON bytes and ordering, package files, and all repo
mutation results. Keep every remaining record's full name/rationale strings and
relative order; removal filters all matching names exactly as today. Initial
registry absence (including the current exists-error fallback) yields an empty
name set; initial read/decode failures retain the gate DomainError wrapper.
Removal still maps read/decode/encode/write failures separately and writes
only on a changed record count. It does not inherit the initial reader's
missing-file behavior. The target state is never encoded or persisted; the existing
registry remains the only persisted boundary and receives no schema migration.

# Test impact

Retain the complete retired-name command test: unauthorized real and dry-run
attempts fail before scaffolding, authorized dry-run reports reuse and leaves
the registry unchanged (the existing command fixture asserts name presence;
add exact byte comparison for the stronger obligation), and authorized real creation removes the entry and
prints the exact summary. Keep direct no-op removal coverage. Add a focused
state-level assertion, using a fixture-controlled valid registry changed between gate and removal,
that sanctioned/no-op suppresses the removed-entry summary while the package
creation and unrelated mutation summaries remain valid. Preserve failure ordering: earlier scaffold/format/workspace/identity/sync
failure prevents registry clearing; a removal failure prevents lockfile refresh
and summary; lockfile failure can occur after successful clearing, without
rollback. Add focused boundary coverage for these meaningful ordering cases
where existing fixtures permit it. No browser QA applies. This P2 audit ran no
package creation, test suite or registry mutation.

# Risk

Tier 1 internal derived lifecycle refactor. The payload-free domain is a
LiteralKit under the repository binding law; no tagged structs are warranted.
The gate must remain before every
create and dry-run, and registry clearing must remain after successful package
and repo mutations so an earlier failure does not erase retirement provenance.
Do not merge this owner with the independent execution-summary booleans or the
excluded raw command flags.

R28 locator repair: the named Booleans are sibling local values inside `createPackageCommand`. The old dotted suffix was descriptive; no such nested object is declared. The existing complete finite law, lifecycle, full independent payloads and guard accounting remain unchanged.

Landing: use the ordered Tier 1E internal tooling subsystem batches, not singleton PRs per Tier 1 record. Coordinate the complete TemplateContext, separate ScaffoldShape and retired-name lifecycle designs in the CreatePackage subsystem; apply shared command/template edits serially and count each actual deletion once. Superseded app-kind/lab rows are not additional work items.
