# Observability runner dependency cache review

The new workspace development dependencies add test-runner and test-utils
edges to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/editor#audit`: `@beep/test-runner#audit`
- `@beep/editor#audit`: `@beep/test-utils#audit`
- `@beep/editor#build`: `@beep/test-runner#build`
- `@beep/editor#build`: `@beep/test-utils#build`
- `@beep/editor#check`: `@beep/test-runner#build`
- `@beep/editor#check`: `@beep/test-utils#build`
- `@beep/editor#coverage`: `@beep/test-runner#build`
- `@beep/editor#coverage`: `@beep/test-utils#build`
- `@beep/editor#doctest`: `@beep/test-runner#transit`
- `@beep/editor#doctest`: `@beep/test-utils#transit`
- `@beep/editor#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/editor#lint:deprecated-apis`: `@beep/test-utils#transit`
- `@beep/editor#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/editor#package-test-typecheck`: `@beep/test-utils#transit`
- `@beep/editor#test`: `@beep/test-runner#transit`
- `@beep/editor#test`: `@beep/test-utils#transit`
- `@beep/editor#test:integration`: `@beep/test-runner#build`
- `@beep/editor#test:integration`: `@beep/test-utils#build`
- `@beep/editor#test:property`: `@beep/test-runner#transit`
- `@beep/editor#test:property`: `@beep/test-utils#transit`
