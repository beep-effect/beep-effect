# Observability runner dependency cache review

The new workspace development dependency adds test-runner and test-utils
edges to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/pacer#audit`: `@beep/test-runner#audit`
- `@beep/pacer#audit`: `@beep/test-utils#audit`
- `@beep/pacer#build`: `@beep/test-runner#build`
- `@beep/pacer#build`: `@beep/test-utils#build`
- `@beep/pacer#check`: `@beep/test-runner#build`
- `@beep/pacer#check`: `@beep/test-utils#build`
- `@beep/pacer#coverage`: `@beep/test-runner#build`
- `@beep/pacer#coverage`: `@beep/test-utils#build`
- `@beep/pacer#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/pacer#lint:deprecated-apis`: `@beep/test-utils#transit`
- `@beep/pacer#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/pacer#package-test-typecheck`: `@beep/test-utils#transit`
- `@beep/pacer#test`: `@beep/test-runner#transit`
- `@beep/pacer#test`: `@beep/test-utils#transit`
- `@beep/pacer#test:integration`: `@beep/test-runner#build`
- `@beep/pacer#test:integration`: `@beep/test-utils#build`
- `@beep/pacer#test:property`: `@beep/test-runner#transit`
- `@beep/pacer#test:property`: `@beep/test-utils#transit`
