# Instance

- id: `r2-tooling-no-native-runtime-strict-failure`
- source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:107`
- symbol: `NoNativeRuntimeRulesOptions` / `NoNativeRuntimeRulesSummary`
- members: `strictCheck`, `strictFailure`
- evidence class: E4 at `NoNativeRuntime.ts:693-703` — the sole summary
  writer derives strict failure only from strict mode plus a warning or error
  count.

# Current shape

`NoNativeRuntimeRulesOptions` stores boundary intent as `strictCheck`; the
returned schema-backed summary stores `strictFailure`. The Laws command reads
that result at `Laws.command.ts:589-591` to select the process exit. The test
helper and focused fixtures in `native-runtime.test.ts` also inspect the
boolean directly.

The merged source changed discovery, not the disposition invariant.
`NoNativeRuntime.ts:587-604` now delegates project creation and exact-glob
loading to `createRepoTsMorphProject`. The shared factory at
`internal/tsmorph/ProjectFactory.ts:34-52` loads compiler options without
enumerating tsconfig include directories, then adds only exact glob matches.
The runner still applies the same include-path override, ecosystem/exclusion
filter, path sort, diagnostic accumulation, and sole return derivation.

# Cardinality gap

Four bit combinations encode three legal scan outcomes: advisory, strict-clean, and strict-failure. A strict failure without strict mode is never produced.

# Target schema

Reuse `LawScanDisposition` from `internal/LawScan.ts`; do not author a second
identical literal family. Keep input `strictCheck`, replace summary
`strictFailure` with `disposition`, and derive the member from `strictCheck`
plus warning/error presence at the sole return boundary. Do not couple the
disposition domain to source-discovery strategy or to the independent warn/error
diagnostic severity.

# Migration inventory

- `NoNativeRuntime.ts:27` — retain `createRepoTsMorphProject` from the existing
  internal ts-morph barrel; the disposition migration needs no new project
  factory or production export.
- `NoNativeRuntime.ts:107-122` — retain the input toggle and its false defaults.
- `NoNativeRuntime.ts:192-219` — replace only the summary boolean schema with
  the shared disposition schema. Preserve all counts, arrays, defaults,
  diagnostics, and field order otherwise.
- `NoNativeRuntime.ts:584-604` — retain ecosystem/exclude filtering, the shared
  source-discovery factory, exact `includePaths ?? SOURCE_FILE_GLOBS`, and
  deterministic source-path sorting unchanged.
- `NoNativeRuntime.ts:693-703` — derive advisory, strict-clean, or
  strict-failure once while constructing the sole summary.
- `Laws.command.ts:589` — migrate the live NoNativeRuntime result reader to select only the strict-failure disposition and preserve its exact process-exit behavior. The EffectFn reader at lines 465-500 belongs to a different design.
- `test/native-runtime.test.ts:14-22,29-280` — replace direct boolean
  assertions and cover all three members across existing fixtures. Retain the
  merged inaccessible-docs regression at lines 29-63; it proves source
  discovery and strict-failure derivation compose without making discovery
  part of the disposition.

# Guard-deletion accounting

Delete the summary `strictFailure` field, its conjunction writer, the command's
boolean guard, and every focused test read of the result boolean. The input
toggle remains because it is operator intent, not redundant state. The
warning/error counts and diagnostic severity remain independent facts used by
rendering and tests; do not delete or derive them from the disposition.

# Encoded-side impact

None. The command renders individual fields as text and never serializes the
summary object. Repository searches found no JSON, persistence, MCP, RPC, or
other decode consumer. Its exported decoded TypeScript shape migrates
atomically with the command and supported test barrel consumers.

# Test impact

Retain all diagnostic, severity, allowlist, include/exclude, source ordering,
compiler-option, inaccessible-docs, and count assertions. Prove warning-bearing
advisory, strict-clean, and strict-failure outcomes, including explicit include
paths that scan zero files. Preserve the exact command failure text and confirm
only strict-failure exits unsuccessfully.

# Risk & sequencing

Tier 1E, in the same repo-CLI batch as the shared LawScan disposition. Import
the existing domain instead of duplicating it. The merged factory fixes source
discovery races and excluded-directory reads; changing or bypassing it could
alter counts and therefore the derived disposition. Keep that factory and its
regression test intact. Run full `@beep/repo-cli` package verification.
