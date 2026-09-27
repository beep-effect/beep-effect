# Disjoint branch and main cache review merge

Retain the branch dependency arrays reviewed in `goals/effect-vitest-canon/research/cli-config-service-main-merge-cache-review.md`
and the independently reviewed main arrays. Three-way comparison confirms
disjoint changed computation sets and identical computation membership. Only
dependencies differ: all commands, configurations, source records, qualification
scope, profile, epoch and other metadata remain equal. No qualification is
promoted. Preserve main's existing HTML/NLP review at its original path and
record this lane-specific merged basis separately.

Branch computations:

- `@beep/ai-provider-cli#audit`
- `@beep/ai-provider-cli#build`
- `@beep/ai-provider-cli#check`
- `@beep/ai-provider-cli#coverage`
- `@beep/ai-provider-cli#lint:deprecated-apis`
- `@beep/ai-provider-cli#package-test-typecheck`
- `@beep/ai-provider-cli#test`
- `@beep/ai-provider-cli#test:integration`
- `@beep/ai-provider-cli#test:property`
- `@beep/architecture-lab-config#audit`
- `@beep/architecture-lab-config#build`
- `@beep/architecture-lab-config#check`
- `@beep/architecture-lab-config#coverage`
- `@beep/architecture-lab-config#lint:deprecated-apis`
- `@beep/architecture-lab-config#package-test-typecheck`
- `@beep/architecture-lab-config#test`
- `@beep/architecture-lab-config#test:integration`
- `@beep/architecture-lab-config#test:property`

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
