# Observability runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/observability#audit`: `@beep/test-runner#audit`
- `@beep/observability#build`: `@beep/test-runner#build`
- `@beep/observability#check`: `@beep/test-runner#build`
- `@beep/observability#coverage`: `@beep/test-runner#build`
- `@beep/observability#doctest`: `@beep/test-runner#transit`
- `@beep/observability#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/observability#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/observability#test`: `@beep/test-runner#transit`
- `@beep/observability#test:property`: `@beep/test-runner#transit`
