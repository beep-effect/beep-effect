# Agents domain and tables runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/agents-domain#audit`: `@beep/test-runner#audit`
- `@beep/agents-domain#build`: `@beep/test-runner#build`
- `@beep/agents-domain#check`: `@beep/test-runner#build`
- `@beep/agents-domain#coverage`: `@beep/test-runner#build`
- `@beep/agents-domain#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/agents-domain#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/agents-domain#test`: `@beep/test-runner#transit`
- `@beep/agents-domain#test:property`: `@beep/test-runner#transit`
- `@beep/agents-tables#audit`: `@beep/test-runner#audit`
- `@beep/agents-tables#build`: `@beep/test-runner#build`
- `@beep/agents-tables#check`: `@beep/test-runner#build`
- `@beep/agents-tables#coverage`: `@beep/test-runner#build`
- `@beep/agents-tables#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/agents-tables#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/agents-tables#test`: `@beep/test-runner#transit`
- `@beep/agents-tables#test:integration`: `@beep/test-runner#build`
