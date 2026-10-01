# Lint-command migration preparation

This records the preparation checkpoint. The subsequently applied migration
and its verification are documented in cli-lint-runtime-resource-proof.md.
The existing inventory selects lint-command.test.ts with 57 historical runtime
rows. The current file contains 65 runPromise boundaries in 66 tests. The
private draft converts all 65 direct registrations to public it.effect while
preserving every existing test option and effect body.

The combined resource draft moves the existing native services, FsUtils and
TSMorph service into one serial public fixture with a five-second hook timeout.
Each case uses the existing temporaryWorkingDirectory constructor and a fresh
TestConsole.make. No repository source was changed while the scheduler package
proof ran. The AST audit preserves 198 assertion trees, including custom
expectReportedExit calls; there are no assertion exclusions. A detector preview
reduces the 65 runtime findings to zero and retains the native-platform judgment.

The unmodified baseline passes all 66 tests on both Node and Bun, with zero
failures or skips and stable source hashes. Recorded times are 13.540 seconds
and 7.227 seconds respectively. The full scheduler package audit was active at
the time; workstation load and pressure are retained in the private receipts,
and these timings make no causal performance claim.

Extracting the actual temporaryWorkingDirectory constructor proves cwd
restoration and directory removal after success, body failure, interruption
and a chdir defect on both runtimes. This validates the reused resource helper,
not the whole migrated lint suite. The private draft still needs application,
actual-suite clock/console review, type checks, Node/Bun parity, historical
ledger reconciliation and full package proof. No lint-command rows are closed
by this preparation.
