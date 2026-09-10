# Fallback, retirement, and Docgen coverage design audit

Audited against frozen source
`7440cb8c4302ce64b87860069a464bafbf65f576` and corpus main
`9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`. Upstream `origin/main` is now
`52fcc8d1353db9481ef9edb6cc9619500f95568d`; source citations and caller graphs
must be refreshed after that merge before implementation.

## Turbo eligibility correction

Withdraw `r3-tooling-envconfig-turbo-spawn-kind` out of the inventory net and
archive its existing design. It is not an admitted D1 record because functions
are not independent flag values. Both proposed members are declarations at
`packages/tooling/tool/cli/src/internal/cli/EnvConfig.ts:264-285`. The only
bound result is `directTurbo` at line 571; line 572 calls `isOpRunTurbo` inline
rather than carrying a second Boolean. `turboEnvExtendsAmbient` at lines
519-522 is another callable predicate, not a co-produced value. No writer,
return object, tuple, schema, or local state carries either proposed pair or
triple. The three command behaviors remain legitimate but fall outside the
census because they are control flow over callable classifiers.

The earlier CLI handoff was corrected accordingly. The design file was restored
to its pre-audit contents and retained only so the parent can archive it with
the inventory transition.

## Corrected canonical metadata

### `receipt-fallback-draft-occupancy`

- Source: `packages/agents/client/src/Chat.atoms.ts:1017`
- Symbol: `reconcileReceiptFallbacks.draftRestoration`
- Members: `[currentDraftOccupied,draftToRestore]`
- Evidence: E4 at `Chat.atoms.ts:1017-1031`
- Cardinality: 4 representable / 3 legal
- Storage/exposure/tier: stored / internal / Tier 1
- Target: tagged union carrying `StreamingTurn` on the selected case

The valid states are available, occupied, and selected with the exact fallback
turn. Both-present is unreachable because `currentDraftOccupied` is immutable
and the lazy `O.orElse`/`O.getOrElse` chain writes `draftToRestore` only when
both prior Options are None. The raw option-literal target is insufficient:
the selected `StreamingTurn.userContent` is required at lines 1046-1048.

The design uses `available | occupied | selected { turn }`, deletes both local
Options and their presence wall, and preserves serial fallback traversal,
first-candidate selection, later-candidate retention, object-identity decision
lookup, receipt-status behavior, concurrent draft updates, appended fallbacks,
exact document payload, retained order, and one revision increment. The state
is transient; the existing `StreamingTurn` schema and encoding do not change.
The focused behavior owner is covered at
`packages/agents/client/test/run-turn-reconciliation.test.ts:357-405,608-725`.

### `create-package-retired-name-reconciliation`

- Source: `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1393`
- Symbol: `createPackageCommand.retiredNameReconciliation`
- Members: `[retiredNameReused,retiredNameCleared]`
- Evidence: E4 at `CreatePackage.command.ts:1599-1601`
- Cardinality: 4 representable / 3 legal
- Storage/exposure/tier: derived / internal / Tier 1
- Target: tagged lifecycle union

The final coherent rows are not-reused false/false, sanctioned reuse with an
already-absent entry true/false, and sanctioned reuse with successful removal
true/true. False/true is impossible because registry removal is called only
behind `retiredNameReused`. The removal helper's documented false/no-op return
at `CreatePackage/internal/RetiredNameRegistry.ts:27-72` is retained rather
than strengthening the relation to equality. The dry-run authorized state
occurs before a clearing result exists and is modeled as a lifecycle stage.

The target four-value LiteralKit covers not-reused, reuse-authorized,
reuse-unchanged, and reuse-cleared. It preserves the early refusal and exact message, dry-run reuse
line without mutation, scaffold and repo-mutation order, schema-decoded
registry rewrite, two-space JSON and trailing newline, removal-before-lockfile
ordering, and exact summary text. Direct tests at
`create-package-lab.test.ts:805-894` prove refusal, authorized dry-run, actual
removal, and the helper no-op. `workspaceUpdated`, `identityUpdated`, sync
changed-files, and `lockfileRefreshed` remain independent and are excluded from
this owner.

### `package-inventory-docgen-coverage`

- Source: `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1312`
- Symbol: `PackageInventory.docgenCoverage`
- Members: `[hasDocgenConfig,enforceDescriptions,enforceExamples,enforceVersion]`
- Evidence: E4 at `JSDocDocumentationInventory.ts:1271-1272,1311-1316`
- Cardinality: 16 representable / 10 legal
- Storage/exposure/tier: derived / persisted / Tier 2
- Target: tagged union with exact legacy artifact projection

The completed `r26-docgen-coverage-implication-correction1.jsonl` receipt is
correct. The ten cases are missing-package FFFF, missing-config FFFT, and eight
configured rows with the three independent enforcement toggles. Six
has-config-false rows with descriptions or examples true are unreachable.
Missing package and missing config stay distinct because version enforcement
defaults on only for the latter.

The target uses `missing-package | missing-config | configured { three
independent toggles }`. Before `formatJsonc`, it projects to the exact current
four-key object so `standards/jsdoc-documentation.inventory.jsonc` and CI
artifacts remain byte-stable; no tag reaches persisted output. The Markdown
writer and aggregate totals do not read this object. The design preserves
topological package order, source/exclude defaults, missing-workspace sentinel,
filesystem and JSONC errors, all eight configured policies, formatting, and
generated metadata. Primary artifact tests are
`quality-artifact-generators.test.ts:171-233` and the inventory fixture helper
at `jsdoc-inventory-detector-fixes.test.ts:158-172`.

## Files changed

- `goals/boolean-creep/designs/receipt-fallback-draft-occupancy.md`
- `goals/boolean-creep/designs/create-package-retired-name-reconciliation.md`
- `goals/boolean-creep/designs/package-inventory-docgen-coverage.md`
- `goals/boolean-creep/data/design-refresh-2026-09-09-cli-fence-spawn-proof.md`
- `goals/boolean-creep/data/design-refresh-2026-09-09-fallback-retirement-coverage.md`

`goals/boolean-creep/designs/r3-tooling-envconfig-turbo-spawn-kind.md` was
restored unchanged for parent archival. No product source, tests, inventory,
lifecycle state, dependencies, generated files, or git references were changed.
Independent P3 review remains pending.

## Verification

`mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts` passed
with `design coverage OK: 166 qualified ids`. Direct required-section checks
passed for all three not-yet-admitted designs, and scoped `git diff --check`
passed for every file changed in this audit.
