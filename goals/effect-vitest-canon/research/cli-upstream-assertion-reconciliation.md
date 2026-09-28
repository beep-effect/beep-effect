# Upstream assertion lineage reconciliation

Six historical EV006 records are reconciled through their actual migration
history and current coverage. They were not closed solely because the
detector no longer reports them. The original inventory entered the branch
in `955528adb46b8f62d311f5e06db2acfa9642aa08`; its source snapshot supplies
the scenario context where repeated `exit` assertions were ambiguous.

- `EV006:packages/tooling/tool/cli/test/ci-lane-timings.test.ts:305:expect@4#1`: Inline empty-population subject was named in 94a5bea54c532d0b21df20457bffbf4830e6f4f6; f1ac7e35 then replaces the same None expectation with assertNone. Fix reference `f1ac7e358e413e6dcc0b0e95ee52965b512f6a9f`.
- `EV006:packages/tooling/tool/cli/test/ci-lane-timings.test.ts:765:expect@6#1`: Same extra-context operation and any-failure predicate; upstream 6c412ed5 renamed the scenario for ratified context counts before canonicalization. Fix reference `8140304195f59af07c5ab19db3378ae7e21e3d71`.
- `EV006:packages/tooling/tool/cli/test/ci-lane-timings.test.ts:766:expect@6#1`: 6c412ed5a3a12ffc489ea0e56933264140343b70 updated the expected diagnostic with the ruleset model. 7dee42b8 preserves that supplied message after failure narrowing. Fix reference `7dee42b8d9c02137b47d0855d61ac251a76ecb8c`.
- `EV006:packages/tooling/tool/cli/test/quality-tasks.test.ts:3193:expect@10#1`: The same root lint-policy operation retains its success assertion; the upstream policy sequence change does not remove this assertion. Fix reference `8140304195f59af07c5ab19db3378ae7e21e3d71`.
- `EV006:packages/tooling/tool/cli/test/yeet-provenance-footer.test.ts:835:expect@6#1`: Upstream API replacement retired the Option warning. The same empty-registry scenario now asserts structured skipped/failure outcome and zero GitHub calls. Fix reference `b46636f74a41bdb68843363ace7d913cfc7ab5b5`.
- `EV006:packages/tooling/tool/cli/test/ci-lane.test.ts:1853:expect@8#1`: Upstream C3 Turbo migration removed the legacy doctest git-ls-files execution path and its failure test. Current full-plan and failed-inventory dependency tests cover the new routing; this is documented retirement, not a claim that the obsolete message still exists. Fix reference `e08b24b0042c0c1bbd274de49407e8bade354575`.

The retirement records explicitly distinguish changed upstream contracts
from mechanical assertion migrations. No obsolete behavior is restored,
no test is deleted by this reconciliation, and no original current operand
is rewritten. The live source receipts are retained in the private
`cli-upstream-assertion-reconciliation.json`.

One historical EV006 record remains open: the cheap-gates collect-all test
uses an `if (Exit.isSuccess(exit))` branch with `assert.fail`. Its failure
check is preserved, but canonical Boolean-helper migration remains to do.
The CLI ledger now contains 1,046 fixed, 7 exception and 2,404 open records.
Full verification of the preceding compound-assertion source batch passed:
audit 778.7 seconds and docgen 21.4 seconds.
