# Observability runner dependency cache review

The new workspace development dependency adds test-runner
edges to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/epistemic-ui#audit`: `@beep/test-runner#audit`
- `@beep/epistemic-ui#build`: `@beep/test-runner#build`
- `@beep/epistemic-ui#check`: `@beep/test-runner#build`
- `@beep/epistemic-ui#coverage`: `@beep/test-runner#build`
- `@beep/epistemic-ui#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/epistemic-ui#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/epistemic-ui#test`: `@beep/test-runner#transit`
- `@beep/epistemic-ui#test:integration`: `@beep/test-runner#build`
