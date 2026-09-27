# Disjoint branch and main cache review merge

Retain the branch dependency arrays reviewed in `goals/effect-vitest-canon/research/observability-service-main-merge-cache-review.md`
and the independently reviewed main arrays. Three-way comparison confirms
disjoint changed computation sets and identical computation membership. Only
dependencies differ: all commands, configurations, source records, qualification
scope, profile, epoch and other metadata remain equal. No qualification is
promoted. Preserve main's existing HTML/NLP review at its original path and
record this lane-specific merged basis separately.

Branch computations:

- `@beep/observability#audit`
- `@beep/observability#build`
- `@beep/observability#check`
- `@beep/observability#coverage`
- `@beep/observability#doctest`
- `@beep/observability#lint:deprecated-apis`
- `@beep/observability#package-test-typecheck`
- `@beep/observability#test`
- `@beep/observability#test:property`

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
