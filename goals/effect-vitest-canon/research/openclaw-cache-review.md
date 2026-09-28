# Observability runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/openclaw#audit`: `@beep/test-runner#audit`
- `@beep/openclaw#build`: `@beep/test-runner#build`
- `@beep/openclaw#check`: `@beep/test-runner#build`
- `@beep/openclaw#coverage`: `@beep/test-runner#build`
- `@beep/openclaw#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/openclaw#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/openclaw#test`: `@beep/test-runner#transit`
- `@beep/openclaw#test:integration`: `@beep/test-runner#build`
- `@beep/openclaw#test:integration:parallel`: `@beep/test-runner#build`
