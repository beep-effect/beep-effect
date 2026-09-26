# MCP kit migration preparation

The package depends on Identity and Schema, whose prerequisite migration waves
have landed. An isolated sibling lane starts at main7581ead6c8. The existing
inventory covers seven files and six actionable judgments. All seven files
have changed since the frozen audit; five additional files require later
reconciliation. Existing reviewed inventory is the starting point; no historical
source acceptance is presented as current coverage.

Fresh Node and Bun baseline reports and resource contexts are retained under
timings/mcp-kit-preparation. No tests or production code have been changed.
The next step is to reconcile the inventoried files and preserve hard-gate
layer-build decisions, soft credential reads at call time, and per-test tracer
state before proceeding through scope, assertions, properties, flake, and runner.
