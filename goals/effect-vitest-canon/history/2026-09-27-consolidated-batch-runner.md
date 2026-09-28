# Consolidated batch runner and diagnostics

All five admitted suites now use the instrumented public runner; standalone
layer registrations use it.layer so nested Effect tests receive the wrapper.
The original TestEnv, local tracer and captured attribute assertions remain.
M365 emits only static protocol-stage names and numeric request IDs through
Effect logging. The watchdog captures the last stage with tracing disabled;
console lifecycle output remains opt-in. No raw arguments or credentials are
logged.

A controlled omission of the tools/list request produces TestHang carrying the
completed discover stage and pending requestId=2 in both trace-off and trace-on
runs. Source is restored exactly. The trace-enabled complete M365 suite passes.
All three package audits and docgen pass. Final configured Node/Bun runs pass
with stable source hashes: OnePassword CLI seven tests, Shared Tables four,
and M365 MCP 23. Original property floors remain intact.

Generated TypeScript references, Fallow boundaries and lockfile reflect the
three test-only runner dependencies. The cache receipt accepts only 25 owned
runner dependency-list additions and preserves all other qualification state.
Cache audit passes. Existing MCP-kit lock metadata normalizes to the manifest's
workspace:^ protocol without a version change. Fresh full proof remains due.
