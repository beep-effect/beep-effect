# LiteralKit main integration

Base: `b26ed3a81d55eeb0f2aca6008e07dc9b98890197` (PR #1338).

The upstream keyed LiteralKit API is retained. Two conflicting test files
preserve complete AST tokens after reversing only the API renames: the doctor
finding-kind enumeration uses `literals`, and the remote-read cache enum uses
its literal key. HttpStatus tests follow the upstream removal of that concept.

The inventory was merged by historical ID without a whole-baseline refresh.
Upstream replaced 21 identities. The one overlapping delete/modify is the
same tsconfig-sync runtime call after removal of the retired Yaml fixture
entry; the main identity moves from line 828 to 827. No new exception or fixed
status was assigned. The merged ratchet passes: 1,208 files, 2,852 findings,
zero introduced and 2,167 resolved.

CLI and schema test-type artifacts have exit code zero and empty diagnostics.
Seven affected CLI files pass 166 tests on Node (46.33 seconds). The same 166 tests pass on Bun (15.73 seconds). FileTypeChecker passes 20 tests on Node (3.76 seconds) and Bun (2.27
seconds). This focused proof does not claim full package or hosted readiness.
Historical ledger reconciliation for upstream-retired test subjects remains
part of the ongoing goal work.
