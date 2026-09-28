# Disjoint branch and main cache review merge

Retain the branch dependency arrays reviewed in `goals/effect-vitest-canon/research/repo-configs-runner-cache-review.md`
and the independently reviewed main arrays. Three-way comparison confirms
disjoint changed computation sets and identical computation membership. Only
dependencies differ: all commands, configurations, source records, qualification
scope, profile, epoch and other metadata remain equal. No qualification is
promoted. Preserve main's existing HTML/NLP review at its original path and
record this lane-specific merged basis separately.

Branch computations:

- `@beep/repo-configs#audit`
- `@beep/repo-configs#build`
- `@beep/repo-configs#check`
- `@beep/repo-configs#codegen`
- `@beep/repo-configs#coverage`
- `@beep/repo-configs#lint:deprecated-apis`
- `@beep/repo-configs#package-test-typecheck`
- `@beep/repo-configs#test`
- `@beep/repo-configs#test:property`

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
