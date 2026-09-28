# Disjoint branch and main cache review merge

Retain the branch dependency arrays reviewed in `goals/effect-vitest-canon/research/media-drivers-cache-review.md`
and the independently reviewed main arrays. Three-way comparison confirms
disjoint changed computation sets and identical computation membership. Only
dependencies differ: all commands, configurations, source records, qualification
scope, profile, epoch and other metadata remain equal. No qualification is
promoted. Preserve main's existing HTML/NLP review at its original path and
record this lane-specific merged basis separately.

Branch computations:

- `@beep/exiftool#audit`
- `@beep/exiftool#build`
- `@beep/exiftool#check`
- `@beep/exiftool#coverage`
- `@beep/exiftool#lint:deprecated-apis`
- `@beep/exiftool#package-test-typecheck`
- `@beep/exiftool#test`
- `@beep/exiftool#test:integration`
- `@beep/exiftool#test:integration:parallel`
- `@beep/face-detection#audit`
- `@beep/face-detection#build`
- `@beep/face-detection#check`
- `@beep/face-detection#coverage`
- `@beep/face-detection#lint:deprecated-apis`
- `@beep/face-detection#package-test-typecheck`
- `@beep/face-detection#test`
- `@beep/face-detection#test:integration`
- `@beep/face-detection#test:property`

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
