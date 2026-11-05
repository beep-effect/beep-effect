# Git W7 hosted Check repair

Hosted Check run 41654332172, job 125982250657, failed on head
`631da83988` with Effect 4.1.2 TS377171 (`yieldInCallArgument`) diagnostics
in the two Git W7 test suites. Both files were inherited unchanged from
main `31e2ac20f3`; fetching main found no upstream repair.

Lift the effect results into local constants before assertions and string
trimming. Preserve effect order, assertions, fixture isolation and all tested
behavior. No production code, diagnostic setting or suppression changes.
Reversal is an ordinary revert of this test-only repair.

Verification:

- `bun run beep quality package-verify @beep/git --quick`: lint and check pass.
- From `packages/drivers/git`, `bunx vitest run test/GitW7Kit.test.ts
  test/integration/GitW7Kit.int.test.ts`: both files, all 27 tests pass.
- Real-repository tests use their existing temporary fixture repositories;
  they do not operate on the implementation checkout.

The complete hosted Check job still requires a new-head result. These focused
checks do not prove the entire citation goal or other hosted jobs.
