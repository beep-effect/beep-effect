# Observability runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/infra#audit`: `@beep/test-runner#audit`
- `@beep/infra#build`: `@beep/test-runner#build`
- `@beep/infra#check`: `@beep/test-runner#build`
- `@beep/infra#coverage`: `@beep/test-runner#build`
- `@beep/infra#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/infra#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/infra#test`: `@beep/test-runner#transit`
