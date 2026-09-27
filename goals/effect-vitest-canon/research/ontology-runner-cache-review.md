# Observability runner dependency cache review

The new workspace development dependency adds test-runner
edges to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/ontology#audit`: `@beep/test-runner#audit`
- `@beep/ontology#build`: `@beep/test-runner#build`
- `@beep/ontology#check`: `@beep/test-runner#build`
- `@beep/ontology#coverage`: `@beep/test-runner#build`
- `@beep/ontology#doctest`: `@beep/test-runner#transit`
- `@beep/ontology#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/ontology#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/ontology#test`: `@beep/test-runner#transit`
- `@beep/ontology#test:integration`: `@beep/test-runner#build`
- `@beep/ontology#test:property`: `@beep/test-runner#transit`
