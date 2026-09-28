# Observability runner dependency cache review

The new workspace development dependency adds test-runner
edges to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/n3#audit`: `@beep/test-runner#audit`
- `@beep/n3#build`: `@beep/test-runner#build`
- `@beep/n3#check`: `@beep/test-runner#build`
- `@beep/n3#coverage`: `@beep/test-runner#build`
- `@beep/n3#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/n3#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/n3#test`: `@beep/test-runner#transit`
