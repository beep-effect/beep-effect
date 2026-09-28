# Observability runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/wink#audit`: `@beep/test-runner#audit`
- `@beep/wink#build`: `@beep/test-runner#build`
- `@beep/wink#check`: `@beep/test-runner#build`
- `@beep/wink#coverage`: `@beep/test-runner#build`
- `@beep/wink#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/wink#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/wink#test`: `@beep/test-runner#transit`
- `@beep/wink#test:integration`: `@beep/test-runner#build`
- `@beep/wink#test:property`: `@beep/test-runner#transit`
