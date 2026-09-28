# Chat UI suites own shared mock and DOM cleanup serially

The shared Vitest configuration enables concurrent tests. Chat UI's four suites
share the hoisted toast mock and a file-wide afterEach that calls both cleanup
and clearAllMocks. One case could therefore clean another case's DOM or mock
state while that case awaited a toast. Each suite now explicitly declares
`concurrent: false`. No test body, title, timeout, operand, assertion, or mock
implementation changed.

A temporary lifecycle probe incremented an active-case counter before each case,
allowed a short scheduling window, required exactly one active case, and
decremented after each case. The original file failed ten of eleven cases under
this probe; the serial suites passed all eleven. This demonstrates overlapping
case lifetimes in the original configuration and their removal. It does not
claim a naturally occurring toast failure was reproduced. The probe was removed.

A reverse comparison removing only the four suite options exactly reproduced
the original file. The direct Vitest vi import remains necessary for hoisted
module mocks and retains its previously reviewed exception.

After removing the probe, all eleven Node tests passed. Full Desktop package
verification passed (audit and docgen), as did schema-first checks, the
Effect/Vitest ratchet (zero introduced findings), and strict inventory/census/
ledger validation. Desktop-wide ledger closure remains pending.
