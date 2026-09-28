# Observability runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/agents-client#audit`: `@beep/test-runner#audit`
- `@beep/agents-client#build`: `@beep/test-runner#build`
- `@beep/agents-client#check`: `@beep/test-runner#build`
- `@beep/agents-client#coverage`: `@beep/test-runner#build`
- `@beep/agents-client#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/agents-client#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/agents-client#test`: `@beep/test-runner#transit`
- `@beep/agents-client#test:integration`: `@beep/test-runner#build`
- `@beep/agents-client#test:property`: `@beep/test-runner#transit`
