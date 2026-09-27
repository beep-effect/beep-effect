# Disjoint branch and main cache review merge

Retain the branch dependency arrays reviewed in `goals/effect-vitest-canon/research/transport-sync-nlp-main-merge-cache-review.md`
and the independently reviewed main arrays. Three-way comparison confirms
disjoint changed computation sets and identical computation membership. Only
dependencies differ: all commands, configurations, source records, qualification
scope, profile, epoch and other metadata remain equal. No qualification is
promoted. Preserve main's existing HTML/NLP review at its original path and
record this lane-specific merged basis separately.

Branch computations:

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

Main computations:

- `@beep/firecrawl#audit`
- `@beep/firecrawl#build`
- `@beep/firecrawl#check`
- `@beep/firecrawl#coverage`
- `@beep/firecrawl#lint:deprecated-apis`
- `@beep/firecrawl#package-test-typecheck`
- `@beep/firecrawl#test`
- `@beep/firecrawl#test:integration`
- `@beep/firecrawl#test:integration:parallel`
- `@beep/firecrawl#test:property`
- `@beep/runpod#audit`
- `@beep/runpod#build`
- `@beep/runpod#check`
- `@beep/runpod#codegen`
- `@beep/runpod#coverage`
- `@beep/runpod#lint:deprecated-apis`
- `@beep/runpod#package-test-typecheck`
- `@beep/runpod#test`
- `@beep/runpod#test:integration`
- `@beep/runpod#test:integration:parallel`
- `@beep/runpod#test:property`
- `@beep/sanity#audit`
- `@beep/sanity#build`
- `@beep/sanity#check`
- `@beep/sanity#coverage`
- `@beep/sanity#lint:deprecated-apis`
- `@beep/sanity#package-test-typecheck`
- `@beep/sanity#test`
- `@beep/sanity#test:integration`
- `@beep/sanity#test:property`
