# Desktop chat metric isolation

The chat happy-path contract now runs in a public layer that provides its
existing stack and a fresh MetricRegistry. The registry is allocated when the
layer is acquired and inherited by the program's child fibers. It is not a reset
of the shared default registry. The registry's Map representation follows the
installed Effect API and the reference checkout's metric isolation tests.

The original completion-counter and duration-histogram IDs, predicates and
positive-count assertions remain unchanged. An AST comparison preserves all 68
original assertion calls and 17 literal test titles in this file. The native
contract's streaming blocks, timeline, usage record and property domains remain.

A controlled negative test seeded the default registry with those metric IDs,
then redirected only the tested stream's telemetry into another registry. The
old happy-path assertion still passed from polluted global metrics. The isolated
version failed at the missing completion metric, proving that telemetry from
another context no longer satisfies this test. Both temporary mutations are
removed from the published source. This demonstrates a test isolation defect,
not a production telemetry defect.

The full Desktop package audit and Docgen pass. Node passes all 19 chat contract
tests, and the repository Effect/Vitest ratchet reports zero introduced findings.
The remaining chat-file migrations and package ledger reconciliation remain open.
