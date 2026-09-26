# Database driver runner dependency review

Accept only the 28 existing DuckDB, Drizzle and Postgres task dependency lists
gaining their declared @beep/test-runner edges. The three manifests add only
that development dependency. Every computation identity, command, command
digest, effective configuration, profile, epoch, scope and source record stays
unchanged; all other packages retain their baseline nodes byte-for-byte at the
JSON value level. Existing duplicate dependency edges are preserved.

This refresh grants no task qualification and enables no additional reuse.
The prior reviewed main changes remain covered by html-main-cache-review.md.

Reviewed computations:

- `@beep/drizzle#audit`: add `@beep/test-runner#audit`
- `@beep/drizzle#build`: add `@beep/test-runner#build`
- `@beep/drizzle#check`: add `@beep/test-runner#build`
- `@beep/drizzle#coverage`: add `@beep/test-runner#build`
- `@beep/drizzle#lint:deprecated-apis`: add `@beep/test-runner#transit`
- `@beep/drizzle#package-test-typecheck`: add `@beep/test-runner#transit`
- `@beep/drizzle#test`: add `@beep/test-runner#transit`
- `@beep/drizzle#test:integration`: add `@beep/test-runner#build`
- `@beep/drizzle#test:integration:serial`: add `@beep/test-runner#build`
- `@beep/drizzle#test:property`: add `@beep/test-runner#transit`
- `@beep/duckdb#audit`: add `@beep/test-runner#audit`
- `@beep/duckdb#build`: add `@beep/test-runner#build`
- `@beep/duckdb#check`: add `@beep/test-runner#build`
- `@beep/duckdb#coverage`: add `@beep/test-runner#build`
- `@beep/duckdb#lint:deprecated-apis`: add `@beep/test-runner#transit`
- `@beep/duckdb#package-test-typecheck`: add `@beep/test-runner#transit`
- `@beep/duckdb#test`: add `@beep/test-runner#transit`
- `@beep/duckdb#test:property`: add `@beep/test-runner#transit`
- `@beep/postgres#audit`: add `@beep/test-runner#audit`
- `@beep/postgres#build`: add `@beep/test-runner#build`
- `@beep/postgres#check`: add `@beep/test-runner#build`
- `@beep/postgres#coverage`: add `@beep/test-runner#build`
- `@beep/postgres#lint:deprecated-apis`: add `@beep/test-runner#transit`
- `@beep/postgres#package-test-typecheck`: add `@beep/test-runner#transit`
- `@beep/postgres#test`: add `@beep/test-runner#transit`
- `@beep/postgres#test:integration`: add `@beep/test-runner#build`
- `@beep/postgres#test:integration:serial`: add `@beep/test-runner#build`
- `@beep/postgres#test:property`: add `@beep/test-runner#transit`
