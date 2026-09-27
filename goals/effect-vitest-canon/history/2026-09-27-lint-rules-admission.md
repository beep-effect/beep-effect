# Lint rules admission

This wave selects nine existing admitted files in the tooling policy-pack
package. There are four registered suites and five local helper/fixture files.
The native Biome and oxlint subprocesses, temporary fixture files, actual rule
registry and root configuration are test subjects that must be preserved.

All 66 tests pass before edits on configured Node and Bun launchers, with stable
source hashes and load/pressure retained. Single command observations are
14.891117 seconds and 7.576918 seconds respectively; they do not prove a speedup.
Full package audit (13.4 seconds) and docgen (2.1 seconds) pass.

Current main already contains four native schema-derived properties and several
canonical Effect imports from the upstream compiler migrations. Those changes
are preserved and will receive upstream attribution rather than duplicate credit.
The remaining work follows scope, assertions, property-oracle review, flake and
observability order. No production rule implementation is in scope.
