# r28-cli-quality-test-lane-resolved-selection

Native P2 refresh bound to HEAD `e7b1e907726421c7d2a2e1cdd140280df47f2353` and immutable main
`bed30c6adf3beed7de8538209fbdc84d26a3b8ce`, compared with main
`3657f8f97f7135c53c3c0b9fa99aa19093c3e5ee`. Prepared by Codex
`gpt-6-astra` / `xhigh` under the user's current AGENTS instructions.
Status remains `designed`; cardinality remains 4/3. Tier 1: ordered Tier1E subsystem batch, with serial shared-file edits.
This document supplies no implementation or independent P3 approval.
Short source paths are relative to `packages/tooling/tool/cli/src/commands/Quality/`;
`src/` and `test/` paths are relative to the CLI package.

## Current shape

`parseTestLaneSelection`, `Tasks.ts:307–321`, returns the actual object at316–320
with Boolean `unit`/`integration` and full required `args: ReadonlyArray<string>`.
Its first Boolean remains at317. The named `TestLaneSelectionState` at232–236
also serves the independent raw accumulator: false/false at263–267 is legitimate,
and the reducer308–314 independently consumes each selector. Retain that raw
contract and its D1 owner; this qualification belongs only to the normalized
return. It is neither a predicate nor an anonymous parameter bag.

New exported `parseTestLaneSelectionForTesting` at323–339 aliases the parser
and exposes its complete decoded result. Upstream removed `rootUnitTestSteps`
and `rootTestSteps`; `rootStepsFor` at2774–2789 now returns no static plan for
test/coverage. The remaining runtime consumer is `runRootTestTask` at3153–3200.

## Cardinality gap

| Input selectors | unit | integration | Resolved mode |
| --- | --- | --- | --- |
| unit only | true | false | unit |
| integration only | false | true | integration |
| neither or both | true | true | all |

The final `hasLane` and default assignments at315–318 exclude false/false.
Four representable pairs, three legal outputs; the required argument array is
not a further finite axis. The new direct fixtures at
`test/quality-tasks.test.ts:6179–6197` explicitly cover all three outputs plus
no-selector default and preserved payload order. The raw false/false state
remains valid before normalization.

## Target schema

Keep the previously proposed private `internal/TestLaneSelection.schemas.ts`
role: `RootTestLaneMode = LiteralKit(["unit", "integration", "all"])`, same-name
derived type and an annotated `S.Class` for the resolved result with required
`mode: RootTestLaneMode` and `args: S.Array(S.String)`. Run the architecture
workflow before creating this proposed implementation file. No file is created
in P2. Use repo identity, schema annotations and titled exported examples.
No defaults, nonempty-array restriction, extra Option or compatibility flags.

Keep the raw reducer unchanged. Replace only its final normalization with one
mode: unit-only/unit, integration-only/integration, neither-or-both/all. Return
the new class using the exact ordered argument array. Use kit-derived guards
at runtime; do not retain a stored Boolean pair beside the mode. The new testing
alias at339 returns this same class rather than projecting the old bag.

Keep the schema out of wildcard-exported `Quality.schemas.ts` (`index.ts:49`)
and do not extend package exports. Its inferred decoded shape is nevertheless
observable through the existing Tasks export and testing alias; it must be
migrated and documented. Expose schema symbols through the existing source-only
Quality test facade if direct schema tests need them, without a production
barrel or an additional test adapter.

## Migration inventory

| Source / consumer | Required change |
| --- | --- |
| `Tasks.ts:232–236,263–267,308–314` | Retain the named raw accumulator including false/false and independent selectors. |
| `Tasks.ts:294–300,307–321` | Remove only one leading passthrough delimiter, consume exact --unit/--integration tokens, and retain every other string in original order. Replace the successful return type and two fields with the resolved class/mode. |
| `Tasks.ts:323–339` | Keep the exported alias and argument API; update its result example/documentation and all decoded result assertions. Do not preserve the old two-flag return through a compatibility adapter. |
| `Tasks.ts:3153–3164` | Unit mode/all enable the existing test:unit step with script test and boundedRootTurboArgs(args). Collect its failures before integration; they do not suppress integration. |
| `Tasks.ts:3164–3199` | Integration mode/all keep workspace discovery, explicit-scope suppression of unsplit discovery, parallel then optional unsplit steps, scoped SQL resource acquisition and serial step. Preserve parallel-before-serial and unit-before-integration failure order. |
| `Tasks.ts:3202–3219` | Preserve runtime routing and all other task routes. |
| `Tasks.ts:2774–2825` | Keep the upstream empty static plan for test/coverage and both exported rootQualityStepsForTesting call forms. No test/coverage plan is rebuilt here. |
| New private schema role; `src/test/Quality.test-kit.ts:58` | Tasks wildcard already exposes the new testing alias. Any explicit schema test exports use this source-only facade, package source imports use @beep aliases, and package exports49/63/66/68 stay unchanged. |
| `test/quality-tasks.test.ts:21,6179–6197` | Direct alias import and complete expected decoded objects migrate atomically. Preserve each exact args payload and default. |

Exhaustive package source/test search finds the parser definition, the alias,
one runtime call at3157 and the direct test suite. The removed static helpers
are historical consumers, not current migration sites. This claim combines
Graft discovery with exact source/text inspection rather than absent graph edges.

## Guard-deletion accounting

Delete two resolved fields/fallback assignments317–318 and the redundant
`hasLane` local315, replacing them with one finite mode classification.
Migrate exactly two current runtime member reads: `lanes.unit`3159 and
`lanes.integration`3164. Do not claim the three reads in upstream-deleted static
helpers as campaign deletions. The alias's expected objects are decoded API
migration, not extra runtime guard deletion.

Keep independent raw fields, optional-step enabled arguments, unsplit-filter
presence3177, explicit scope3166, all concurrency controls, workspace discovery,
SQL acquisition/finalization and failure aggregation. No coverage or proof-reuse
guard belongs to this record despite the shared Tasks.ts file.

## Encoded-side impact

No resolved mode currently enters a file, wire payload, command argument or
scheduler receipt. The existing exported testing alias does expose the decoded
return and changes from flags to mode; update its documentation and callers.
Do not describe it as unobservable. Preserve complete QualityTaskStep fields,
labels, task names, environment, cwd, ordered args, SQL credentials transport,
resource lifetimes and diagnostic order. Do not inspect or emit credentials.

Raw strings stay fully supported: repeated/both selector orders, empty strings,
unrecognized flags, selectors, later delimiters and concurrency arguments all
retain their current handling. Neither selector still resolves to all. Static
root test/coverage plans remain empty, matching the new public contract.

## Test impact

Migrate all new direct parser fixtures6179–6197 to modes and exact argument
arrays; add both orders, repetitions and passthrough edge cases through the
existing alias. Do not reject the raw false/false accumulator. Keep the static
plan test at2864–2874 asserting no test/coverage steps. Removed static integration
plan fixtures must not be restored as if they represented execution.

Use existing runtime spawner/SQL harnesses to verify unit failure still permits
integration, parallel failure still permits serial, explicit scope suppresses
unsplit discovery, serial SQL releases on failure, and final failure ordering
stays exact. Existing SQL child/resource fixtures at5467–5569 and workspace
integration filtering at5904 onward remain. Assert complete command/env/args,
not only labels, for all three runtime modes. Preserve labs filtering in the
actual runtime/coverage helper tests rather than obsolete shadow plans.

Implementation runs focused Quality task tests and required repo-CLI package
verification, then the ordered Tier1E Yeet gates. P2 ran no product tests.

## Risk

The return remains qualified and unchanged at its original source lines. The
material refresh is the new decoded testing export and removal of stale static
consumers. A partial migration could leave the alias's return documentation or
runtime selection wrong, or revive a plan the CLI does not use. Land the schema,
parser, alias example, runtime reads and tests together; serialize shared-file
edits with coverage/proof reuse. Independent P3 approval remains pending.
