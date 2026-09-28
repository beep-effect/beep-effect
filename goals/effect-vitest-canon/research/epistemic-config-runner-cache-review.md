# Observability runner dependency cache review

The new workspace development dependencies add test-runner and test-utils
edges to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/epistemic-config#audit`: `@beep/test-runner#audit`
- `@beep/epistemic-config#audit`: `@beep/test-utils#audit`
- `@beep/epistemic-config#build`: `@beep/test-runner#build`
- `@beep/epistemic-config#build`: `@beep/test-utils#build`
- `@beep/epistemic-config#check`: `@beep/test-runner#build`
- `@beep/epistemic-config#check`: `@beep/test-utils#build`
- `@beep/epistemic-config#coverage`: `@beep/test-runner#build`
- `@beep/epistemic-config#coverage`: `@beep/test-utils#build`
- `@beep/epistemic-config#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/epistemic-config#lint:deprecated-apis`: `@beep/test-utils#transit`
- `@beep/epistemic-config#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/epistemic-config#package-test-typecheck`: `@beep/test-utils#transit`
- `@beep/epistemic-config#test`: `@beep/test-runner#transit`
- `@beep/epistemic-config#test`: `@beep/test-utils#transit`
- `@beep/epistemic-config#test:integration`: `@beep/test-runner#build`
- `@beep/epistemic-config#test:integration`: `@beep/test-utils#build`
