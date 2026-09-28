# Observability runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/tika#audit`: `@beep/test-runner#audit`
- `@beep/tika#build`: `@beep/test-runner#build`
- `@beep/tika#check`: `@beep/test-runner#build`
- `@beep/tika#coverage`: `@beep/test-runner#build`
- `@beep/tika#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/tika#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/tika#test`: `@beep/test-runner#transit`
- `@beep/tika#test:integration`: `@beep/test-runner#build`
- `@beep/tika#test:integration:parallel`: `@beep/test-runner#build`
- `@beep/tika#test:property`: `@beep/test-runner#transit`
