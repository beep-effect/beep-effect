# Observability runner dependency cache review

The new workspace development dependency adds test-runner
edges to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/ontology-client#audit`: `@beep/test-runner#audit`
- `@beep/ontology-client#build`: `@beep/test-runner#build`
- `@beep/ontology-client#check`: `@beep/test-runner#build`
- `@beep/ontology-client#coverage`: `@beep/test-runner#build`
- `@beep/ontology-client#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/ontology-client#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/ontology-client#test`: `@beep/test-runner#transit`
- `@beep/ontology-client#test:integration`: `@beep/test-runner#build`
