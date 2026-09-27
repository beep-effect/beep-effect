# Observability runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/epistemic-tables#audit`: `@beep/test-runner#audit`
- `@beep/epistemic-tables#build`: `@beep/test-runner#build`
- `@beep/epistemic-tables#check`: `@beep/test-runner#build`
- `@beep/epistemic-tables#coverage`: `@beep/test-runner#build`
- `@beep/epistemic-tables#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/epistemic-tables#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/epistemic-tables#test`: `@beep/test-runner#transit`
- `@beep/epistemic-tables#test:integration`: `@beep/test-runner#build`
- `@beep/epistemic-tables#test:property`: `@beep/test-runner#transit`
