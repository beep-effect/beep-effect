# Phoenix instrumented runner checkpoint

Both suites now import it from @beep/test-runner. The import-only token check
preserves every body, property input, schema, run floor, isolated layer and
deadline. No logger-subject exception is needed. Added the development
dependency, lockfile entry, generated TypeScript references and Fallow boundary
entries, plus a package changeset. No production source changed.

Package audit/docgen pass in 8.7/3.1 seconds. Node/Bun tracing-off and Node
tracing-on each pass all thirty cases with stable source hashes. A temporary
controlled failing Effect case confirms start, actual case name, failure end
and duration through TestConsole; tracing-off emits no lifecycle diagnostics.
The probe is removed. Timings retain host pressure/load and are unnormalized.
Final inventory, cache projection and publication proof remain.
