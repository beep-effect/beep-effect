# Disjoint branch and main cache review merge

Retain the branch dependency arrays reviewed in `goals/effect-vitest-canon/research/business-drivers-service-main-merge-cache-review.md`
and the independently reviewed main arrays. Three-way comparison confirms
disjoint changed computation sets and identical computation membership. Only
dependencies differ: all commands, configurations, source records, qualification
scope, profile, epoch and other metadata remain equal. No qualification is
promoted. Preserve main's existing HTML/NLP review at its original path and
record this lane-specific merged basis separately.

Branch computations:

- `@beep/freshbooks#audit`
- `@beep/freshbooks#build`
- `@beep/freshbooks#check`
- `@beep/freshbooks#coverage`
- `@beep/freshbooks#lint:deprecated-apis`
- `@beep/freshbooks#package-test-typecheck`
- `@beep/freshbooks#test`
- `@beep/freshbooks#test:integration`
- `@beep/hubspot#audit`
- `@beep/hubspot#build`
- `@beep/hubspot#check`
- `@beep/hubspot#coverage`
- `@beep/hubspot#lint:deprecated-apis`
- `@beep/hubspot#package-test-typecheck`
- `@beep/hubspot#test`
- `@beep/hubspot#test:integration`
- `@beep/hubspot#test:property`
- `@beep/m365#audit`
- `@beep/m365#build`
- `@beep/m365#check`
- `@beep/m365#coverage`
- `@beep/m365#lint:deprecated-apis`
- `@beep/m365#package-test-typecheck`
- `@beep/m365#test`
- `@beep/m365#test:integration`
- `@beep/m365#test:integration:parallel`
- `@beep/m365#test:property`
- `@beep/uspto#audit`
- `@beep/uspto#build`
- `@beep/uspto#check`
- `@beep/uspto#coverage`
- `@beep/uspto#lint:deprecated-apis`
- `@beep/uspto#package-test-typecheck`
- `@beep/uspto#test`
- `@beep/uspto#test:integration`
- `@beep/uspto#test:property`

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
