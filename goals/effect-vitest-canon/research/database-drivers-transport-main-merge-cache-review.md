# Disjoint branch and main cache review merge

Retain the branch dependency arrays reviewed in `goals/effect-vitest-canon/research/database-drivers-service-main-merge-cache-review.md`
and the independently reviewed main arrays. Three-way comparison confirms
disjoint changed computation sets and identical computation membership. Only
dependencies differ: all commands, configurations, source records, qualification
scope, profile, epoch and other metadata remain equal. No qualification is
promoted. Preserve main's existing HTML/NLP review at its original path and
record this lane-specific merged basis separately.

Branch computations:

- `@beep/drizzle#audit`
- `@beep/drizzle#build`
- `@beep/drizzle#check`
- `@beep/drizzle#coverage`
- `@beep/drizzle#lint:deprecated-apis`
- `@beep/drizzle#package-test-typecheck`
- `@beep/drizzle#test`
- `@beep/drizzle#test:integration`
- `@beep/drizzle#test:integration:serial`
- `@beep/drizzle#test:property`
- `@beep/duckdb#audit`
- `@beep/duckdb#build`
- `@beep/duckdb#check`
- `@beep/duckdb#coverage`
- `@beep/duckdb#lint:deprecated-apis`
- `@beep/duckdb#package-test-typecheck`
- `@beep/duckdb#test`
- `@beep/duckdb#test:property`
- `@beep/postgres#audit`
- `@beep/postgres#build`
- `@beep/postgres#check`
- `@beep/postgres#coverage`
- `@beep/postgres#lint:deprecated-apis`
- `@beep/postgres#package-test-typecheck`
- `@beep/postgres#test`
- `@beep/postgres#test:integration`
- `@beep/postgres#test:integration:serial`
- `@beep/postgres#test:property`

Main computations:

- `@beep/ai-sync#audit`
- `@beep/ai-sync#build`
- `@beep/ai-sync#check`
- `@beep/ai-sync#coverage`
- `@beep/ai-sync#lint:deprecated-apis`
- `@beep/ai-sync#package-test-typecheck`
- `@beep/ai-sync#test`
- `@beep/ai-sync#test:integration`
- `@beep/ai-sync#test:property`
- `@beep/api-transport#audit`
- `@beep/api-transport#build`
- `@beep/api-transport#check`
- `@beep/api-transport#coverage`
- `@beep/api-transport#doctest`
- `@beep/api-transport#lint:deprecated-apis`
- `@beep/api-transport#package-test-typecheck`
- `@beep/api-transport#test`
- `@beep/api-transport#test:integration`
- `@beep/api-transport#test:property`
