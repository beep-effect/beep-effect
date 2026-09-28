# Disjoint branch and main cache review merge

Retain the branch dependency arrays reviewed in `goals/effect-vitest-canon/research/cli-config-nlp-main-merge-cache-review.md`
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
