# Disjoint branch and main cache review merge

Retain the branch dependency arrays reviewed in `goals/effect-vitest-canon/research/acp-cache-review.md`
and the independently reviewed main arrays. Three-way comparison confirms
disjoint changed computation sets and identical computation membership. Only
dependencies differ: all commands, configurations, source records, qualification
scope, profile, epoch and other metadata remain equal. No qualification is
promoted. Preserve main's existing HTML/NLP review at its original path and
record this lane-specific merged basis separately.

Branch computations:

- `@beep/acp#audit`
- `@beep/acp#build`
- `@beep/acp#check`
- `@beep/acp#codegen`
- `@beep/acp#coverage`
- `@beep/acp#lint:deprecated-apis`
- `@beep/acp#package-test-typecheck`
- `@beep/acp#test`
- `@beep/acp#test:integration`
- `@beep/acp#test:integration:parallel`
- `@beep/acp#test:property`

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
