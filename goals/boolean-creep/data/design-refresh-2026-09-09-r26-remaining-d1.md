# Round 26 remaining D1 audit

Audited against source HEAD
`3330f9881a50c96d3f2ec0fcad76f0f7a09027e4` and corpus/main
`52fcc8d1353db9481ef9edb6cc9619500f95568d`. This pass resolves only the
remaining Docgen write decision and CreatePackage execution-summary proposal.
It is a qualification audit, not an independent P3 review or a census-complete
claim.

## `r26-tool-docgen-write-file-exists-overwritable`

Retain this discovery as a disqualified D1 census record. The carrier is real:
`writeFileToOutDir` receives a `Domain.File`, binds the disk observation
`exists`, and reads the file's stored `isOverwritable` field in the same write
decision at
`packages/tooling/tool/docgen/src/Core.ts:145-176`. The member name
`isOverwritable` denotes `file.isOverwritable`; it is an actual schema field,
not a callable predicate or an invented alias.

All four Boolean rows are supported:

| `exists` | `isOverwritable` | behavior and source proof |
| --- | --- | --- |
| false | false | Write a newly absent protected output. An absent `_config.yml` is constructed protected at `Core.ts:714-740`. |
| true | false | Preserve an existing protected output and return before directory creation or write at `Core.ts:160-163`. |
| false | true | Write a newly absent replaceable output. Examples, their entry point, their tsconfig, and module Markdown are constructed replaceable at `Core.ts:484-490,552-562,645-647,750-770`; examples are removed before regeneration at `Core.ts:197-204,565-575`. |
| true | true | Replace an existing replaceable output. Existing `_config.yml` content is read and returned for the same path with `isOverwritable: true` at `Core.ts:714-725`; the write path logs overwrite and continues at `Core.ts:165-176`. |

`Domain.File` declares and documents `isOverwritable` at
`packages/tooling/tool/docgen/src/Domain.ts:1035-1083`. Its constructor default
is false, and the encoded-shape fixture requires the explicit false key at
`packages/tooling/tool/docgen/test/SchemaParity.test.ts:31-43`. Disk existence
is observed later and is neither stored in `File` nor encoded. The two values
therefore remain independent even though one producer, `_config.yml`, chooses
overwrite policy from its earlier existence observation.

Proposed corrected row metadata:

- id: `r26-tool-docgen-write-file-exists-overwritable`
- file: `packages/tooling/tool/docgen/src/Core.ts`
- line: `152`
- symbol: `writeFileToOutDir`
- kind: `sibling-state`
- members: `[exists,isOverwritable]`
- status: `disqualified`
- disqualifier: D1 — disk existence is observed at write time while
  `isOverwritable` is an independently supported `Domain.File` policy field;
  all four rows are legitimate and the write function handles each without a
  coherence rejection.

No design is warranted. Replacing the pair with an exclusive state would
erase the legitimate absent/protected and absent/replaceable distinction or
duplicate filesystem state in `Domain.File`.

## `r26-cli-commands-a-c-create-package-execute-mutation-flags`

Retain this discovery as a disqualified D1 census record, while describing the
members as mutation facts rather than configuration flags. After plan
execution, four Boolean results coexist in `createPackageCommand`:

- `workspaceUpdated` is returned by `ensureRootWorkspaceEntry` at
  `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:903-924`
  and bound at line 1591. A covering workspace pattern returns false; an
  uncovered path whose JSONC edit changes the document writes and returns true.
- `identityUpdated` is bound at lines 1592-1594. For ordinary packages,
  `ensureIdentityPackageRegistration` returns the source-file change result at
  `CreatePackage/internal/IdentityRegistration.ts:87-107`; the underlying
  updater returns false for byte-identical source at
  `packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts:1304-1321`.
  Existing registration is an explicit supported case in the dry-run renderer
  at `CreatePackage.command.ts:1433-1437`. For labs, the sibling implementation
  computes and returns its independent `changed` result at
  `CreatePackage/internal/LabIdentitySegment.ts:345-359`.
- `retiredNameCleared` is bound at `CreatePackage.command.ts:1603-1605`.
  Its implication from `retiredNameReused` is already owned by
  `create-package-retired-name-reconciliation`; this audit does not duplicate
  that cluster. After existentially projecting the reuse fact away, both clear
  values remain supported and neither constrains the other three mutation
  facts.
- `lockfileRefreshed` is exactly `!skipLockfile` at lines 1606-1608. The public
  flag and default are at lines 1156-1159, so either value is supported without
  masking workspace, identity, or retired-registry mutations.

The aggregate summary reads the four facts with OR at
`CreatePackage.command.ts:1617-1624`, then renders each independently at lines
1626-1643. There is no equality, implication, mutual exclusion, priority
selection, or shared writer among these four values. Root workspace coverage,
current identity-registry text, retired-name authorization/removal outcome, and
the lockfile flag are distinct inputs. The command accepts repository fixtures
in which those inputs vary independently; no validation connects them.
Consequently the four-member projection has 16 representable and 16 supported
rows and remains D1.

The existing tests demonstrate the relevant crossings rather than a coupled
state machine: a previously uncovered top-level path appends a workspace at
`packages/tooling/tool/cli/test/create-package.test.ts:575-593`; an `apps/*`
glob suppresses that append at lines 841-890; the normal lockfile refresh is
asserted at lines 556-569; most mutation tests inject `--skip-lockfile` through
the test runner at lines 23-31; and retired-name refusal, authorized dry-run,
clear, and no-op behavior are covered at
`packages/tooling/tool/cli/test/create-package-lab.test.ts:813-880`.

Proposed corrected row metadata:

- id: `r26-cli-commands-a-c-create-package-execute-mutation-flags`
- file: `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts`
- line: `1591`
- symbol: `createPackageCommand.executeMutationFacts`
- kind: `sibling-state`
- members:
  `[workspaceUpdated,identityUpdated,retiredNameCleared,lockfileRefreshed]`
- status: `disqualified`
- disqualifier: D1 — independently produced and independently rendered
  repository-mutation facts; all 16 rows are supported. The hidden
  `retiredNameCleared => retiredNameReused` relation belongs only to the
  separately inventoried retired-name reconciliation cluster and does not
  reduce this four-fact projection.

No design is warranted. A 16-case state model would merely enumerate four
independent receipts. The qualified 4/3 retired-name owner remains unchanged,
and its `retiredNameCleared` member is removed once by that atomic migration;
the execution summary can consume the resulting cleared outcome without
creating a second owner or a second migration.

## Scope and verification

Only this handoff was added. No design, product source, test, canonical
inventory, lifecycle status, dependency, generated file, or git reference was
changed. The recommendations are bounded to these two raw Round 26 candidates;
formal P3 review remains pending.

`mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts`
passed with `design coverage OK: 162 qualified ids`. A scoped whitespace check
of this new handoff also passed.
