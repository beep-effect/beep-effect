# Observability runner dependency cache review

The new workspace development dependency adds test-runner
edges to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/ontology-server#audit`: `@beep/test-runner#audit`
- `@beep/ontology-server#build`: `@beep/test-runner#build`
- `@beep/ontology-server#check`: `@beep/test-runner#build`
- `@beep/ontology-server#coverage`: `@beep/test-runner#build`
- `@beep/ontology-server#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/ontology-server#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/ontology-server#test`: `@beep/test-runner#transit`
- `@beep/ontology-server#test:integration`: `@beep/test-runner#build`
- `@beep/ontology-server#test:property`: `@beep/test-runner#transit`
