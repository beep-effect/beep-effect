# create-package-retired-name-reconciliation

Native P2 design refresh before R29, bound to merged source HEAD
`f03850b762e41217b5a0c26f26041daee490a070` / main
`4f13d83e13d61275a57004050ffc62a90d86c014`. This preserves status `designed`
and cardinality 4/3. Tier 1: ordered Tier1E tooling batches with serial shared-file edits.
Independent P3 review and implementation acceptance remain pending.

Owner `createPackageCommand` at `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1399`,
with members `retiredNameReused`, `retiredNameCleared`.
Storage/exposure: derived/internal; target: literalkit.

The full public [source-impact audit](../data/pre-r29-main-4f13d8-source-impact.md),
[source bindings](../data/pre-r29-main-4f13d8-source-bindings.json), and
[row/design map](../data/pre-r29-main-4f13d8-row-design-map.json) bind this proposal.
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

The removal helper returns false when the entry is already absent and otherwise
rewrites the schema-decoded registry with stable formatting. Its generic no-op
case is explicitly tested even though the ordinary command path establishes
membership earlier. The design therefore preserves a sanctioned-reuse/no-op
outcome rather than assuming the two booleans are equivalent.

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

Use the existing retired registry schema and helper for the mutation. Do not
model unrelated execution flags, preserve a Boolean alias, or add stored state.
The authorized case records necessary sequencing before the final three-way
outcome; it does not expand the final 4/3 census table.

# Migration inventory

The post-merge source introduces `CreatePackageScripts` at
CreatePackage.command.ts:1961-1964, exported by CreatePackage/index.ts:14.
This lifecycle change preserves its full app/package helper signatures and
canonical script outputs. Shared command edits must retain app/lab script kind
selection at 1772-1777, the kind/stories package writer at 1925-1944 and the
ecosystem → remaining app-kind → tool → library selection at 2014-2038.
Runtime-proof still uses a package-shaped manifest with canonical app-kind
scripts. None of these public helper Boolean parameters is removed by the
retired-name lifecycle migration. Preserve the broader direct helper contract
and new equality fixtures at create-package.test.ts:274-332 alongside the
unchanged registry consent, no-op, removal and summary ordering.

- `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:988-1006`
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
- `packages/tooling/tool/cli/test/create-package-lab.test.ts:805-867` — retain
  refusal, dry-run authorization without mutation, actual removal, exact output,
  and recreated package assertions.
- `create-package-lab.test.ts:869-894` — retain the helper's explicit absent-name
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
mutation results. The target state is never encoded or persisted; the existing
registry remains the only persisted boundary and receives no schema migration.

# Test impact

Retain the complete retired-name command test: unauthorized real and dry-run
attempts fail before scaffolding, authorized dry-run reports reuse and leaves
the registry byte-identical, and authorized real creation removes the entry and
prints the exact summary. Keep direct no-op removal coverage. Add a focused
state-level assertion, using an injected or fixture-controlled removal result,
that sanctioned/no-op suppresses the removed-entry summary while the package
creation and unrelated mutation summaries remain valid. No browser QA applies.

# Risk

Tier 1 internal derived lifecycle refactor. The payload-free domain is a
LiteralKit under the repository binding law; no tagged structs are warranted.
The gate must remain before every
create and dry-run, and registry clearing must remain after successful package
and repo mutations so an earlier failure does not erase retirement provenance.
Do not merge this owner with the independent execution-summary booleans or the
excluded raw command flags.

R28 locator repair: the named Booleans are sibling local values inside `createPackageCommand`. The old dotted suffix was descriptive; no such nested object is declared. The existing complete finite law, lifecycle, numeric payloads and guard accounting remain unchanged.

Landing: use the ordered Tier 1E internal tooling subsystem batches, not singleton PRs per Tier 1 record. Coordinate the complete TemplateContext, separate ScaffoldShape and retired-name lifecycle designs in the CreatePackage subsystem; apply shared command/template edits serially and count each actual deletion once. Superseded app-kind/lab rows are not additional work items.
