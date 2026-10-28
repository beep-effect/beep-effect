# Acceptance audit, 2026-10-28

## Scope and provenance

Recovery lane branches from `origin/main` at
`d3c684edea26987cea6384b296d86960b0bb5d1a`. The source checkout's three
untracked `sst-env.d.ts` files remain outside this change.

## Requirement evidence

| Requirement | Current evidence |
| --- | --- |
| Foundation package and moved vocabulary | `packages/foundation/modeling/epistemics/package.json` declares foundation/modeling, exact public subpaths and runtime-neutral dependencies. All four moved concepts, seven factories, intervals and Claim exports exist. |
| No shared kernel or slice dependency | Source import census has no `@beep/shared-*` or `@beep/epistemic-domain` import. The only slice-name text is a CanonicalJson documentation reference. |
| Second caller-owned id binding | `test/Factories.test.ts` exercises branded string ids; the slice binds numeric ids. `FactoryBinding.types.test.ts` checks decoded and encoded equality. Both package audits pass. |
| Caller-owned proposition key function | The audit found this missing. `makeClaimEnvelope` now requires `logicalKey`, and its schema rejects inconsistent keys; `Claim.test.ts` proves decode/encode rejection and unchanged valid-row round-trip. All six foundation test files pass (39 tests). |
| Valid and knowledge intervals | `EdgeVersion` composes shared interval fields; `EdgeVersionRowCompat.test.ts` compares decoded/re-encoded pre-extraction rows with open and closed ends. Included in passing domain audit. |
| Schema identifiers | `ValueSchemaIdentifiers.test.ts` matches the retained 258-line pre-extraction fixture. Included in passing domain audit. |
| Import migration | Targeted `rg` across apps, packages and scratchpad finds no external imports of the four moved value subpaths. Slice value directories contain bindings rather than transitional re-exports for those four concepts. |
| Authority values excluded | Original merge diff has no changes in ExecutionGrant, GrantSet, ExecutionRecord or ExecutionVerdict concept directories. They remain absent from foundation. `ExecutionAuthority.test.ts` passes within the domain audit. |
| Persistence and service behavior unchanged | Original merge changes to server/table production source consist of three import-path replacements. No SQL or migration change. Row compatibility test passes. |
| Foundation verification | `bun run beep quality package-verify @beep/epistemics`: audit 10.5s and docgen 3.3s, both pass after key-binding repair. |
| Domain verification | `bun run beep quality package-verify @beep/epistemic-domain`: audit 15.6s and docgen 9.2s, both pass. |
| Historical merge | REST PR #2017 confirms accepted head `62fdeb3680c711f6218655ae8ef8d35f6b0ae71d` and merge `ab6000add2e779508f5b76e6c774a872cf3e629a` at `2026-10-22T06:00:03Z`. |
| Historical readiness | Unsatisfied. Completion refresh observes required Docgen failure, pending/missing required contexts and a failed required-check merge-push suite. The declared verdict is absent. |
| Implementation repair readiness | #2315 merged as `559dcb6d2e777e6df3494560e91085ad25ca6631`; completion refresh verifies 15 required contexts and passing merge-time rule suite `4773338508`. Its interrupted monitor left the declared verdict absent. |
| Documentation closeout #2325 | Merged as `b9c9223f4c94c8d9ec599e383d38cb80933a38e6` with required contexts green; coverage passed afterward. Its genuine monitor verdict is negative because the PR had already merged. Completion remains unknown. |
| Final closeout readiness | Pending documentation-only #2334, exact-head hosted checks, retained readiness verdict before merge, review window and strict merge. The operator has held other merges. |

## Boundaries

The historical failure is preserved. A new final PR proves the revised work;
its merge cannot retroactively qualify #2017. No lifecycle status is flipped
from this audit or from a proposal alone.

## Local gate disposition

The publication cheap-gates wave and scoped policy replay each exceeded ten
minutes. Both owned processes were cancelled and exited 130. Package audits,
docgen, all 39 foundation tests, local lint and changed-file formatting passed.
The tool-produced content-final receipt explicitly skips `cheap-gates`,
`lint-policy`, `repo-sanity`, `check`, `docgen`, `fallow` and `coverage` under
the constrained-compute route. Implementation PR #2315 records those skips and requires exact-head
hosted checks before strict merge. Phase P4 stays in progress while merge verification is pending; the proposal is
prepared and the operative lifecycle remains active until completion refresh
verifies the merge.

## Review fixes

The active party-slice specification now includes the required slice-owned key
function in both its binding contract and acceptance criteria. The tutorial and
test binding use length-prefixed fields so separator-containing values cannot
collide. Regressions cover separator collisions and a proposition whose numeric
field is encoded as a string: the key uses the decoded number, and incorrect
keys fail in both codec directions.

## Hosted lint-policy remediation

The first complete hosted policy replay found two introduced issues: the claim
codec regressions crossed the schema-heavy-test threshold without a property
test, and setting every phase complete while lifecycle stayed active triggered
`phases-terminal-but-active`. Added schema-derived proposition/key round-trip
coverage with `Arbitrary.schema` and canonical `it.effect.prop`; kept P4 in progress
until verified completion. No advisory inventory exception or baseline increase
is used for either fix.

The second hosted replay caught the direct `Arbitrary.checkEffect` call under
the separate effect-vitest policy (`EV007`). Converted the registration to
`it.effect.prop` and replayed both test policies with the full package audit.
