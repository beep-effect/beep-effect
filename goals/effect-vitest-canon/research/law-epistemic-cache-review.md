# Observability runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/epistemic-domain#audit`: `@beep/test-runner#audit`
- `@beep/epistemic-domain#build`: `@beep/test-runner#build`
- `@beep/epistemic-domain#check`: `@beep/test-runner#build`
- `@beep/epistemic-domain#coverage`: `@beep/test-runner#build`
- `@beep/epistemic-domain#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/epistemic-domain#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/epistemic-domain#test`: `@beep/test-runner#transit`
- `@beep/epistemic-domain#test:property`: `@beep/test-runner#transit`
- `@beep/law-practice-domain#audit`: `@beep/test-runner#audit`
- `@beep/law-practice-domain#build`: `@beep/test-runner#build`
- `@beep/law-practice-domain#check`: `@beep/test-runner#build`
- `@beep/law-practice-domain#coverage`: `@beep/test-runner#build`
- `@beep/law-practice-domain#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/law-practice-domain#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/law-practice-domain#test`: `@beep/test-runner#transit`
- `@beep/law-practice-domain#test:property`: `@beep/test-runner#transit`
