# Observability runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/libpff#audit`: `@beep/test-runner#audit`
- `@beep/libpff#build`: `@beep/test-runner#build`
- `@beep/libpff#check`: `@beep/test-runner#build`
- `@beep/libpff#coverage`: `@beep/test-runner#build`
- `@beep/libpff#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/libpff#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/libpff#test`: `@beep/test-runner#transit`
- `@beep/libpff#test:integration`: `@beep/test-runner#build`
- `@beep/libpff#test:integration:parallel`: `@beep/test-runner#build`
- `@beep/libpff#test:property`: `@beep/test-runner#transit`
