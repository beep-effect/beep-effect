# Phoenix runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/phoenix#audit`: `@beep/test-runner#audit`
- `@beep/phoenix#build`: `@beep/test-runner#build`
- `@beep/phoenix#check`: `@beep/test-runner#build`
- `@beep/phoenix#coverage`: `@beep/test-runner#build`
- `@beep/phoenix#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/phoenix#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/phoenix#test`: `@beep/test-runner#transit`
- `@beep/phoenix#test:integration`: `@beep/test-runner#build`
- `@beep/phoenix#test:property`: `@beep/test-runner#transit`
