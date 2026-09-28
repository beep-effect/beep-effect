# Agents and Gov Legal MCP runner integration

Use the instrumented runner in all seven test files; convert the five standalone
Gov Legal MCP layer registrations to it.layer so nested tests are instrumented.
Retain all existing test registrations, total deadlines and concurrency. Add
two runner development dependencies, generated TypeScript/Fallow references,
and only seventeen reviewed owned cache dependency edges.

Both package audits and docgen pass. Node and Bun each pass 65 tests, unchanged
from the baseline count (33 Agents Use Cases, 32 Gov Legal MCP). The real
filesystem test and following support code are byte-identical to the previous
head. Native crypto, scoped temporary cleanup and checked-in artifact byte
comparison remain. Contextual timing receipts retain source hashes, runtime,
load and pressure without causal performance claims.
