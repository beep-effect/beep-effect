# Instance

- id: `docgen-runpod-template-search-mode`
- file:line: `packages/tooling/tool/cli/src/commands/Docgen/internal/QualityWorkerRunpodEval.ts:275`
- symbol: `RunDocgenQualityWorkerRunpodEvalOptions`
- members: `allowPublicTemplateSearch`, `skipTemplateSearch`
- evidence: E2 at `Docgen.command.ts:952-966` — the boundary rejects both
  true; downstream template acquisition interprets the surviving mode.

# Current shape

Two optional booleans represent four pairs; legal behavior is default search,
skip search, or allow public search. Other Runpod
options are independent.

# Cardinality gap

Four pairs are representable and three modes are legal; both selected is
invalid.

# Target schema

Add a named `RunpodTemplateSearchMode` LiteralKit with `default | skip |
allow-public`. Replace the two fields in
`RunDocgenQualityWorkerRunpodEvalOptions` with `templateSearchMode`, defaulting
only at the CLI adapter. Preserve command-specific conflict validation before
constructing the options. Reuse the literal in every acquisition helper; do
not add boolean projection helpers.

# Migration inventory

- `QualityWorkerRunpodEval.ts:270-315` — add the named mode and replace the
  option fields.
- Search all template discovery/acquisition reads in that module and match the
  literal once at the decision boundary.
- `Docgen.command.ts:952-966` and its handler — preserve both flags and exact
  conflict error, then construct one literal.
- `packages/tooling/tool/cli/test/docgen.test.ts:3644` — migrate the only live direct `runDocgenQualityWorkerRunpodEval` options constructor outside `Docgen.command.ts`; its omitted flags become the explicit `default` template-search mode.
- Migrate all direct Runpod eval fixtures, examples, and exported decoded
  option consumers atomically.

# Guard-deletion accounting

Delete the stored optional pair, downstream defaulting/presence tests, and
their mutual-exclusion burden. The raw `skip && allowPublic` rejection survives
only at the CLI compatibility boundary.

# Encoded-side impact

none (internal Runpod orchestration options); CLI spellings and generated
quality report schemas remain unchanged.

# Test impact

Cover all four raw pairs, all three literal modes, exact conflict text, and
template selection behavior with/without explicit template id. Run focused
Docgen/Runpod tests and full repo-CLI verification.

# Risk and sequencing

Land in Tier 1E after re-reading PR #958 overlap. Preserve confirmation,
provider/model, packet-limit, readiness, telemetry, and keep-pod behavior.
