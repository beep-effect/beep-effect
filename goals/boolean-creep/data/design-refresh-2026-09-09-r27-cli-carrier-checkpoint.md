# R27 CLI and docgen carrier checkpoint

Source HEAD: `8f266b878445ca8a7f751f9248da428a4dde39a1`.
Corpus `origin/main`: `663904610cce2a38c06b0619a8c414646b69361c`.
This is source adjudication of immutable raw census reports, not independent
P3 review, a design approval, or a source implementation. Original proposed dispositions
below have not been admitted to the canonical inventory.

## Docgen and internal-root: four out-of-net proposals

| Raw id | Source proof | Disposition |
| --- | --- | --- |
| `r27-tool-docgen-get-markdown-config-yml-exists-overwritable` | `packages/tooling/tool/docgen/src/Core.ts:714` declares local `exists`; `:726` and `:740` put `isOverwritable` in a separate `Domain.File.new` argument. The function does not return or declare one carrier with both fields. | Reject out of net. Do not combine a filesystem observation with a later constructor option or duplicate the separate `writeFile` census owner. |
| `r27-cli-internal-root-exclusive-mode-flags` | `packages/tooling/tool/cli/src/internal/artifacts/GeneratedFileDrift.ts:49-53` is `assertExclusiveModeFlags(input: { write: boolean; check: boolean; onConflict: Effect... })`. | Reject excluded anonymous function flag parameters. The real 4/3 validation does not override the campaign's explicit scope exclusion; the historical withdrawal remains correct. |
| `r27-cli-internal-root-cli-flag-toggles` | `packages/tooling/tool/cli/src/internal/cli/Flags.ts:42-43` is a factory for a `Flag` descriptor; `:67` stores that descriptor. | Reject non-Boolean command handles. Actual parsed named Command carriers are separate census owners. Do not invent four Boolean sibling state values from names of shared flag builders. |
| `r27-cli-internal-root-enforce-ratchet-present` | `packages/tooling/tool/cli/src/internal/ratchet/RatchetLifecycle.ts:67-75` is an anonymous function input whose nested regression item has one Boolean `present`, required `lines`, and required generic `error`. | Reject: excluded input carrier and fewer than two real Boolean/presence/literal axes. Required array or generic payload truthiness is not an additional member. |

Both primary execution receipts completed with exit zero, end-turn, valid reports
and explicit assigned-root coverage. Their raw records remain unchanged. Neither
report admits a qualified or disqualified record.

Docgen's footer calls three seed carriers “not booleans.” This does not withdraw
them: `DocgenProofManifestVerification` has a real literal domain and optional
reason, and `docgenCommand` has real optional file/text input pairs. The existing
named Command owners and their intentional overlay precedence remain eligible.

## A-C: actual data versus an unsupported qualification

`packages/tooling/tool/cli/src/commands/Codex/Findings.packet.ts:75-202`
builds a `PacketDocument`; `contents` is the JSON serialization of an instantiated
manifest object at `:83`. The capability pair at `:95-96`, completion-gate triple
at `:99-102`, and sanitation triple at `:163-166` are fixed policy metadata.
The latter's only writer emits `(false,true,false)`. An exhaustive indexed search
for `trackedRawFindingContent` found only that writer; `renderPacketDocuments`
calls the manifest producer at `:759`.

The raw sanitation 8/4 claim has no four-case producer or actual presence payload
proof at its cited owner. Do not admit it as qualified. Retain all three instantiated metadata objects as D1 census records. Their fixed
policy assertions do not establish one state variable or an E1-E4 gap. The
capability writer is true/true; completionGate is true/true/false; sanitation is
false/true/false. Do not assert every hypothetical tuple is a supported packet
policy, invent optional payload axes, or infer a state machine solely from these
fixed configuration values. These real serialized objects are distinct from
excluded anonymous function flag parameter declarations.

The fourth A-C row describes a real `pkg` object. In
`packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts`,
`generateEcosystemPackageJson` at `:1690` has a generic `BaseManifest extends object`,
but the actual sole call at `:2021` supplies `baseManifestFor(...)` from `:2003`.
That builder explicitly supplies `private: true` at `:1739`; the spread at `:1704`
therefore co-carries it with `sideEffects: false` at `:1706`. The canonical package
JSON encoder consumes the result at `:1731`. This supports a D2 npm configuration
mirror, correcting the raw D1 label. Do not reject an actual instantiated field
merely because the generic parameter's minimal constraint is `object`. The actual package object is admitted as D2 after declaration-kind and source
anchor correction.

## L-Q: one confirmed qualification and three census records

`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1632-1646` owns real
local Booleans `reusable` and `activeReuse`. The second is the conjunction of
the first and the optional proof session's active mode; the reader distinguishes
miss, shadow hit and active reuse. Active reuse bypasses execution and records
the existing reused lane result. The complete producer/session-mode, fixture,
migration and guard-deletion proof is now integrated as a derived/internal 4/3
LiteralKit design in `data/r27-normalize-and-proof-reuse-integration.json`.

The named local observations in
`packages/tooling/tool/cli/src/commands/Quality/internal/FallowCiContract.ts:296-301`
are real independent facts: envelope-path text and delegated lane execution.
They are forwarded to diagnostics at `:314-315`; a workflow may include both.
The raw D1 proposal is eligible and distinct from the existing named
FallowCiContractDiagnosticOptions input. Admit the actual local observation pair.

`effectTsgoReadmeParser` at
`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:355-358` supplies
actual `ignoreAttributes` and `trimValues` options to the external XML parser.
The raw D2 classification is appropriate, with object-literal kind rather than
type-literal. The temporary smoke configuration at `:2624-2633` likewise supplies
`composite`, `incremental`, and `noEmit` to the TypeScript compiler via JSON;
correct the raw D1 to D2 and kind to object-literal. The independent existing
synthetic-config template is a different declaration, not a reason to drop this
owner. Admit both external option objects with the corrected D2/kind metadata.
The same external compiler-config rationale corrects the existing
`test-tsgo-synthetic-compiler-options` D1 record to D2; preserve its old row in
history. The footer's seed-line/type drift remains under its separate audit.

## Remaining primary reports

The R-Z report completed with one D1 proposal for the actual
`SyncDataTargetSelection` `all`/`includeAuthenticated` pair. The real class is at
`SyncDataToTs.command.ts:61-65`. The all arm filters according to the independent
flag at `:119-134`; the direct-target arm at `:136` intentionally ignores it.
Both include values are supported with either valid selection, so all four
projected Boolean tuples are legal. Admit this D1 cluster. The existing qualified
`all`/`targetId` cluster and its design explicitly preserve this independent flag;
independent clusters may share an input under SPEC.

The Yeet report completed with one qualification for
`portfolioIndexPublishDisposition`. Its declaration at PortfolioIndexGuard.ts:136-142 is an excluded anonymous
function flag parameter; the raw qualification is rejected. The CLI seed-drift
and request-boundary audits complete the footer adjudications, with exact
archives and independent correction evidence linked in the R27 reconciliation.

The D-K normalization pair is adjudicated separately in
`design-refresh-2026-09-09-r27-cli-normalize-carriers.md`. Preserve the distinction
between a permissive public request normalized by its service and the persisted
manifest of the normalized operation.
