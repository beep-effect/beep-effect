# Pretext unused helper dependency cache review

Removing the unused test-utils development dependency removes exactly one test-utils dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/pretext#audit`: `@beep/test-utils#audit`
- `@beep/pretext#build`: `@beep/test-utils#build`
- `@beep/pretext#check`: `@beep/test-utils#build`
- `@beep/pretext#coverage`: `@beep/test-utils#build`
- `@beep/pretext#lint:deprecated-apis`: `@beep/test-utils#transit`
- `@beep/pretext#package-test-typecheck`: `@beep/test-utils#transit`
- `@beep/pretext#test`: `@beep/test-utils#transit`
- `@beep/pretext#test:integration`: `@beep/test-utils#build`
