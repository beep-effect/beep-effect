# Observability runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/agents-server#audit`: `@beep/test-runner#audit`
- `@beep/agents-server#build`: `@beep/test-runner#build`
- `@beep/agents-server#check`: `@beep/test-runner#build`
- `@beep/agents-server#coverage`: `@beep/test-runner#build`
- `@beep/agents-server#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/agents-server#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/agents-server#test`: `@beep/test-runner#transit`
- `@beep/agents-server#test:integration`: `@beep/test-runner#build`
- `@beep/agents-server#test:property`: `@beep/test-runner#transit`
- `@beep/architecture-lab-proof#audit`: `@beep/test-runner#audit`
- `@beep/architecture-lab-proof#build`: `@beep/test-runner#build`
- `@beep/architecture-lab-proof#check`: `@beep/test-runner#build`
- `@beep/architecture-lab-proof#coverage`: `@beep/test-runner#build`
- `@beep/architecture-lab-proof#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/architecture-lab-proof#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/architecture-lab-proof#test`: `@beep/test-runner#transit`
- `@beep/architecture-lab-proof#test:integration`: `@beep/test-runner#build`
- `@beep/architecture-lab-proof#test:property`: `@beep/test-runner#transit`
