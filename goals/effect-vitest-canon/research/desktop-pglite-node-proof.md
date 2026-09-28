# Desktop PGlite Node integration loader proof

Before the change, Node failed to import four suites because the sidecar's Bun
file import of PGlite initdb Wasm was executed as a Wasm module and attempted to
resolve package `env`. The saved pre-migration Pglite equivalence test reproduces
the same failure, attributing it independently of the runner migration.

The integration configuration now aliases only PGlite dist Wasm, data and archive
imports to Vite asset URLs. Bun sidecar source and compiled file imports are
unchanged. The initial broader dependency-inline experiment was unnecessary and
is removed.

The original integration command now passes all 30 enabled tests under Node and
Bun, with zero failed tests or suites. This retains native PGlite execution; no
mock database or test-body replacement is introduced. Provider/packaged sidecar
scenarios whose opt-in guards register no tests remain outside this result.

The full Desktop package audit and Docgen also pass after the configuration
change. The package source and all test bodies remain byte-for-byte unchanged.
