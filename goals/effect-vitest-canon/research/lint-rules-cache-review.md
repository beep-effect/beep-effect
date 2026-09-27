# Lint-rules schema and runner dependency cache review

The new workspace development dependency adds exactly one schema and one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/lint-rules#audit`: `@beep/schema#audit, @beep/test-runner#audit`
- `@beep/lint-rules#build`: `@beep/schema#build, @beep/test-runner#build`
- `@beep/lint-rules#check`: `@beep/schema#build, @beep/test-runner#build`
- `@beep/lint-rules#coverage`: `@beep/schema#build, @beep/test-runner#build`
- `@beep/lint-rules#lint:deprecated-apis`: `@beep/schema#transit, @beep/test-runner#transit`
- `@beep/lint-rules#package-test-typecheck`: `@beep/schema#transit, @beep/test-runner#transit`
- `@beep/lint-rules#test`: `@beep/schema#transit, @beep/test-runner#transit`
- `@beep/lint-rules#test:property`: `@beep/schema#transit, @beep/test-runner#transit`
