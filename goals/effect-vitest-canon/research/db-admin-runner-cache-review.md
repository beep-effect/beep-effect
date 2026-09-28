# Observability runner dependency cache review

The new workspace development dependency adds test-runner
edges to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/db-admin#audit`: `@beep/test-runner#audit`
- `@beep/db-admin#build`: `@beep/test-runner#build`
- `@beep/db-admin#check`: `@beep/test-runner#build`
- `@beep/db-admin#coverage`: `@beep/test-runner#build`
- `@beep/db-admin#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/db-admin#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/db-admin#test`: `@beep/test-runner#transit`
- `@beep/db-admin#test:integration`: `@beep/test-runner#build`
- `@beep/db-admin#test:integration:parallel`: `@beep/test-runner#build`
- `@beep/db-admin#test:property`: `@beep/test-runner#transit`
