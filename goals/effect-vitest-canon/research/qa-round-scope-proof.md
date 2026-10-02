# QA round pipeline — private migration qualification

Status: migration qualified privately; human lens review remains open.

The candidate preserves 29 test registrations and all 46 original assertions. Promise-wrapped effect tests now use the instrumented runner. The temporary-directory helper receives the suite layer, and five FFmpeg stubs use public test layers. Its existing acquire/use/release lifetime and fatal cleanup reporting are preserved. FFmpeg operations other than the supplied probe remain unreachable.

The suite uses Memory filesystem plus Node path semantics. Fixtures create their own round layouts, manifests, event logs, artifacts and judge templates; the collector-handle case reads a synthetic stored handle rather than starting a collector. The test console for the exact-output assertion is created for that operation, avoiding instrumentation and preceding-test log history.

CI=true qualification: Node 29 passed in 2.44s; Bun 29 passed in 1.26s; typecheck exit 0. The first attempt had one console-history failure and a nested-generator diagnostic; callback-local console creation resolved both.

Memory controls check that each allocated directory exists through FileSystem and does not exist through node:fs. Node and Bun each pass all 29 tests with those controls. Replacing Memory with native filesystem causes 21 failures; eight tests still pass, including failure-only tests that can absorb the injected assertion defect. This mutation is not credited as proof of error specificity for those tests.

Pending: inspect and harden negative-result assertions to identify the intended error; finish lens review and formatting; reconcile ledger/baseline without erasing history; apply and run package proof. No new completed-goal credit is claimed yet.

## Error-specificity hardening completed privately

Six negative tests now use Effect.flip and require the expected QaCommandError tag and message. They cover absent rounds, invalid round number, missing collector handle, invalid session directory, missing inventory, and a transcript without parseable inventory. Four messages are matched exactly; path-bearing failures match their specific contract text. Unrelated setup defects propagate instead of satisfying a generic failed Exit check.

Injecting an unrelated setup defect makes all six hardened tests fail; the same injected defect makes all six old assertions pass. Final formatted candidate qualification: Node 29 passed (4.07s), Bun 29 passed (3.01s), typecheck exit 0. Candidate: qa-round-pipeline.final.next.ts. Applied ledger/baseline reconciliation and package proof remain pending.

## Applied eight-file batch, 2026-10-01

This candidate is now applied in the authoritative inventory-next worktree. Full `bun run beep quality package-verify @beep/repo-cli` completed exit 0: audit 676.6 seconds, docgen 24.4 seconds. Applied CI=true eight-suite proof passes 218/218 tests on Node 22.22.3 (31.01 seconds) and Bun 1.4.2 (16.57 seconds). These are focused correctness timings, not controlled package performance comparisons or hosted proof. Formatting preserves the seven prepared candidate body ASTs. Source commit and ledger reconciliation follow this proof checkpoint; historical private-only statements above describe their original qualification stage.
