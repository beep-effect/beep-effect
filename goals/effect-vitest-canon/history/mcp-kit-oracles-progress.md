# MCP kit stronger-oracle progress

Four refusal cases now count handler execution in a fresh per-test Ref and
assert zero executions. The approved destructive-call case is the positive
control and asserts one execution. Original returned-value, audit, and
settlement assertions remain.

Minimal and balanced field projections now assert exact retained values,
in addition to the original key, budget, omission, and tier checks.
Full package verification passed: audit 7.0 seconds, docgen 3.3 seconds.
The hard-gated composition absence/acquisition/handler oracle remains pending.

## Hard-gate absence oracle completed

Each credential fixture now owns independent acquisition and execution Refs.
The counters are created when its suite fixture is constructed, before layer
acquisition, so the absent case can observe a layer that never builds.
The absent-credential case asserts no tool registration, zero acquisition, zero
execution, and the original exact missing-tool failure. The present case
asserts registration, one acquisition, zero executions before dispatch, and
one execution afterward, retaining the successful result checks.
Full package verification passed: audit 6.7 seconds, docgen 3.0 seconds.
