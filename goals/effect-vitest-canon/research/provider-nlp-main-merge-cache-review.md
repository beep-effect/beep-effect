# Disjoint branch and main cache review merge

Retain the branch dependency arrays reviewed in `goals/effect-vitest-canon/research/provider-drivers-cache-review.md`
and the independently reviewed main arrays. Three-way comparison confirms
disjoint changed computation sets and identical computation membership. Only
dependencies differ: all commands, configurations, source records, qualification
scope, profile, epoch and other metadata remain equal. No qualification is
promoted. Preserve main's existing HTML/NLP review at its original path and
record this lane-specific merged basis separately.

Branch computations:

- `@beep/anthropic#audit`
- `@beep/anthropic#build`
- `@beep/anthropic#check`
- `@beep/anthropic#coverage`
- `@beep/anthropic#lint:deprecated-apis`
- `@beep/anthropic#package-test-typecheck`
- `@beep/anthropic#test`
- `@beep/anthropic#test:property`
- `@beep/openai#audit`
- `@beep/openai#build`
- `@beep/openai#check`
- `@beep/openai#coverage`
- `@beep/openai#lint:deprecated-apis`
- `@beep/openai#package-test-typecheck`
- `@beep/openai#test`
- `@beep/openai#test:integration`
- `@beep/openai-compat#audit`
- `@beep/openai-compat#build`
- `@beep/openai-compat#check`
- `@beep/openai-compat#coverage`
- `@beep/openai-compat#lint:deprecated-apis`
- `@beep/openai-compat#package-test-typecheck`
- `@beep/openai-compat#test`
- `@beep/openai-compat#test:integration`
- `@beep/openai-compat#test:property`
- `@beep/venice-ai#audit`
- `@beep/venice-ai#build`
- `@beep/venice-ai#check`
- `@beep/venice-ai#coverage`
- `@beep/venice-ai#lint:deprecated-apis`
- `@beep/venice-ai#package-test-typecheck`
- `@beep/venice-ai#test`
- `@beep/venice-ai#test:integration`
- `@beep/venice-ai#test:integration:parallel`
- `@beep/venice-ai#test:property`
- `@beep/xai#audit`
- `@beep/xai#build`
- `@beep/xai#check`
- `@beep/xai#coverage`
- `@beep/xai#lint:deprecated-apis`
- `@beep/xai#package-test-typecheck`
- `@beep/xai#test`
- `@beep/xai#test:integration`
- `@beep/xai#test:property`

Main computations:

- `@beep/nlp#audit`
- `@beep/nlp#build`
- `@beep/nlp#check`
- `@beep/nlp#coverage`
- `@beep/nlp#doctest`
- `@beep/nlp#lint:deprecated-apis`
- `@beep/nlp#package-test-typecheck`
- `@beep/nlp#test`
- `@beep/nlp#test:property`
