# Disjoint branch and main cache review merge

Retain the branch dependency arrays reviewed in `goals/effect-vitest-canon/research/leaves-checkpoint-main-cache-review.md`
and the independently reviewed main arrays. Three-way comparison confirms
disjoint changed computation sets and identical computation membership. Only
dependencies differ: all commands, configurations, source records, qualification
scope, profile, epoch and other metadata remain equal. No qualification is
promoted. Preserve main's existing HTML/NLP review at its original path and
record this lane-specific merged basis separately.

Branch computations:

- `@beep/brand#audit`
- `@beep/brand#build`
- `@beep/brand#check`
- `@beep/brand#coverage`
- `@beep/brand#lint:deprecated-apis`
- `@beep/brand#package-test-typecheck`
- `@beep/brand#test`
- `@beep/brand#test:integration`
- `@beep/chalk#audit`
- `@beep/chalk#build`
- `@beep/chalk#check`
- `@beep/chalk#coverage`
- `@beep/chalk#doctest`
- `@beep/chalk#lint:deprecated-apis`
- `@beep/chalk#package-test-typecheck`
- `@beep/chalk#test`
- `@beep/chalk#test:property`
- `@beep/ciops#audit`
- `@beep/ciops#build`
- `@beep/ciops#check`
- `@beep/ciops#dev`
- `@beep/ciops#lint:deprecated-apis`
- `@beep/ciops#package-test-typecheck`
- `@beep/ciops#test`
- `@beep/discord#audit`
- `@beep/discord#build`
- `@beep/discord#check`
- `@beep/discord#coverage`
- `@beep/discord#lint:deprecated-apis`
- `@beep/discord#package-test-typecheck`
- `@beep/discord#test`
- `@beep/discord#test:integration`
- `@beep/discord#test:property`

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
