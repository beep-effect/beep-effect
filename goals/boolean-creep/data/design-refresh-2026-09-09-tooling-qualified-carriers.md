# Tooling qualified-carrier audit

Audited against merged source
`3330f9881a50c96d3f2ec0fcad76f0f7a09027e4` and corpus/main
`52fcc8d1353db9481ef9edb6cc9619500f95568d`. This pass applies the same
carrier boundary that withdrew the Turbo record: callable predicates and
schema guards are not themselves sibling Boolean values. A qualifying record
must have an actual tuple, object, schema, or simultaneously bound local values
at the cited observation boundary.

## Retain: actual sibling values

### `r3-tooling-docker-tag-kind-flags`

**Recommendation:** retain unchanged as 4/3, E2, derived/internal/Tier 1.

`buildDockerReport` declares both `isUnpinnedTag` and `isMajorOnly` locals
beside one another for each image at
`packages/tooling/tool/cli/src/commands/VersionSync/internal/resolvers/DockerResolver.ts:428-429`.
The first drives aggregate `hasUnpinned` at lines 431-433 and the unresolved
latest fallback at 446-457; the second drives the unresolved major-only
fallback at 458-468. They coexist for the same `img.tag`, so this is an actual
local pair rather than two callable definitions. The existing member names
match the declarations. The legal kinds remain latest, major-only, and pinned;
the `LatestDockerTag` and digits-only `MajorOnlyDockerTag` guards are disjoint.

The existing design may refresh its SHA and lines during implementation, but
its carrier, cardinality, and private `DockerTagKind` LiteralKit target are
sound. `img.latest` is an independent resolution payload and must remain out of
the kind cluster.

### `r3-tooling-ecosystem-polarity-specifier-call`

**Recommendation:** retain unchanged as 4/3, E1, derived/internal/Tier 1.

The runtime import scan declares `isDynamicImport` and `isRequire` together for
the same call-expression node at
`packages/tooling/tool/cli/src/commands/Lint/EcosystemPolarity.ts:272-274`.
Their NOR guard at lines 275-277 rejects ordinary calls before the shared
literal-specifier reader at 279-284. Both are actual callback locals and the
existing member names are exact. One expression node cannot simultaneously be
an `ImportKeyword` and an identifier named `require`, so dynamic-import,
require, and other remain the three legal states.

The existing private `RuntimeImportCallKind` LiteralKit design is therefore a
valid replacement. Static import/export declaration scanning at lines 255-265
is a separate producer path and does not add a Boolean member.

### `r3-tooling-registration-deletion-note-phase`

**Recommendation:** retain unchanged as 4/3, E4, derived/internal/Tier 1.

The pending-changeset file loop declares both
`hasDeletionNoteBasename` and `isCanonicalDeletionNote` at
`packages/tooling/tool/cli/src/internal/cli/RegistrationGeometry/RegistrationGeometry.probes.ts:189-196`.
The second is explicitly gated by the first. The two bound values are then read
at lines 197-199 to skip the canonical note or record a named residue. These
are real co-carried locals with exact inventory member names. Canonical without
the deletion-note basename is unreachable; other, named-residue, and canonical
remain the three legal phases.

The existing private `PendingChangesetFileDisposition` LiteralKit design is
sound. Package-name content matching remains an independent fallback for
ordinary changeset files.

## Withdraw out of net: callable classifiers, no value carrier

The following records should be removed from the inventory net rather than
changed to D1. Their existing design files remain untouched for parent archival.

### `r3-tooling-quality-repo-wide-step-gates`

`shouldRunRepoWideSteps` and `shouldRunLintRepoWideSteps` are function
declarations at
`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:780-782`. No caller
binds both results. The first function is invoked separately for three
`enabled` properties at lines 2323-2333. The second is invoked in lint guards
at lines 2581-2590 and 2618-2627. Although the functions encode related scope
policies over similar argument arrays, no pair of Boolean values exists in a
single carrier or local observation. Withdraw out of net; do not admit as D1.

### `r3-tooling-architecture-export-subpath-kind`

All four members are private predicate functions declared at
`packages/tooling/tool/cli/src/commands/Architecture/OperationPlanPackageJson.ts:15-21`.
`packageExportEntrypointFor` invokes them one at a time in an early-return
chain at lines 23-40. It never binds, stores, returns, or passes a four-Boolean
record. The five rendering branches are legitimate control flow, but the
claimed 16-state sibling carrier is invented. Withdraw out of net.

### `r3-tooling-docgen-quality-companion-kinds`

`isSchemaCompanionTypeAlias`, `isCompanionNamespace`, and
`isSchemaCompanionInterface` are predicate functions declared at
`packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.subjects.ts:274-289`.
`effectiveMissingRequiredTags` calls them inline as three operands of one
condition at lines 318-336. It carries only `missingTags`; no three-Boolean
tuple or locals exist. Declaration-kind exclusivity may justify a future
classifier cleanup, but it is outside the Boolean-carrier census. Withdraw out
of net.

### `r3-tooling-schema-first-tagged-error-factory-kind`

Both proposed members are predicate functions at
`packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstDetectors.ts:1071-1077`.
`taggedErrorDeclarationCall` invokes them inline in an OR expression at lines
1079-1094 and returns only `Option<CallExpression>`. No namespaced/named-import
Boolean values coexist. The Option result is already the actual carried
outcome, so the proposed pair is out of net.

### `r3-tooling-codegen-source-test-filename`

`isTypeScriptSourceFileName` and `isTypeScriptTestFileName` are schema-derived
guard functions declared at
`packages/tooling/tool/cli/src/commands/Codegen/Codegen.command.ts:92-93`.
The walker calls the source guard in the file branch at line 187 and, only
after that succeeds, calls the test guard in an early return at line 189. It
does not bind their results as sibling values. The source guard also serves the
independent `toImportPath` reader at lines 117-122. Withdraw the claimed pair
out of net; retain the branded filename schemas and guards.

### `r3-tooling-coverage-scope-input-kind`

`isGlobalCoverageInput` and `isCoverageNoopInput` are classifier functions at
`packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts:539-551`.
`fullReasonForFile` calls the global classifier at lines 577-580, then handles
labs and repository-fixture exceptions before calling the noop classifier at
595-597. No invocation produces both results, and no pair survives the early
return or intervening precedence rules. The path policies remain valid, but
their proposed Boolean carrier does not exist. Withdraw out of net.

### `r3-tooling-quality-root-audit-head-kind`

`isRootAuditMode` and `isGithubCheckMode` are schema guard functions declared
at `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:281,292`.
`parseRootAuditSelection` calls them sequentially in early-return branches at
lines 323-345 and returns the existing `RootAuditSelectionState`; it never
binds a pair. The disjoint literal domains describe parser control flow rather
than sibling state. Withdraw out of net. The returned mode/args carrier remains
the actual state owner and is outside this record.

### `r3-tooling-docgen-local-full-reason-input-kind`

The proposed members refer to generic predicate functions `isExactFile` and
`hasPrefix`, declared at
`packages/tooling/tool/cli/src/commands/Docgen/internal/Local.ts:165-169`.
They are also reused independently by package-local input classification at
lines 356-359. `fullReasonForFile` calls them in separate early-return branches
at lines 361-380 and returns `Option<DocgenLocalFullReason>`; no exact/prefix
Boolean locals or pair exist. The Option is already the actual carried
outcome. Withdraw out of net.

## Adjudication table

| ID | Actual declared carrier | Recommendation |
| --- | --- | --- |
| `r3-tooling-docker-tag-kind-flags` | two sibling Boolean locals | retain 4/3 |
| `r3-tooling-ecosystem-polarity-specifier-call` | two sibling Boolean locals | retain 4/3 |
| `r3-tooling-registration-deletion-note-phase` | two sibling Boolean locals | retain 4/3 |
| `r3-tooling-quality-repo-wide-step-gates` | two functions, separately invoked | withdraw out of net |
| `r3-tooling-architecture-export-subpath-kind` | four functions, inline early-return calls | withdraw out of net |
| `r3-tooling-docgen-quality-companion-kinds` | three functions, inline condition calls | withdraw out of net |
| `r3-tooling-schema-first-tagged-error-factory-kind` | two functions, inline OR | withdraw out of net |
| `r3-tooling-codegen-source-test-filename` | two schema guard functions | withdraw out of net |
| `r3-tooling-coverage-scope-input-kind` | two functions, separated by precedence branches | withdraw out of net |
| `r3-tooling-quality-root-audit-head-kind` | two schema guard functions | withdraw out of net |
| `r3-tooling-docgen-local-full-reason-input-kind` | generic predicate functions | withdraw out of net |

No member renames are needed for the three retained records. The eight
withdrawn records do not have replacement Boolean member names because no
co-carried Boolean values exist. Their returned values or surrounding control
flow remain legitimate source behavior and require no migration under this
packet.

## Scope and verification

Only this handoff was written. No design, product source, test, inventory,
lifecycle status, dependency, generated file, or git reference was changed.
`mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts` passed
with `design coverage OK: 169 qualified ids`, and scoped `git diff --check`
passed for this handoff. Independent P3 review remains pending.
