# Pretext runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/pretext#audit`: `@beep/test-runner#audit`
- `@beep/pretext#build`: `@beep/test-runner#build`
- `@beep/pretext#check`: `@beep/test-runner#build`
- `@beep/pretext#coverage`: `@beep/test-runner#build`
- `@beep/pretext#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/pretext#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/pretext#test`: `@beep/test-runner#transit`
- `@beep/pretext#test:integration`: `@beep/test-runner#build`
