# Disjoint branch and main cache review merge

Retain the branch dependency arrays reviewed in `goals/effect-vitest-canon/research/business-nlp-main-merge-cache-review.md`
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
