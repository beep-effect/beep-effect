# Observability runner dependency cache review

The new workspace development dependency adds test-runner
edges to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/rdf#audit`: `@beep/test-runner#audit`
- `@beep/rdf#build`: `@beep/test-runner#build`
- `@beep/rdf#check`: `@beep/test-runner#build`
- `@beep/rdf#coverage`: `@beep/test-runner#build`
- `@beep/rdf#doctest`: `@beep/test-runner#transit`
- `@beep/rdf#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/rdf#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/rdf#test`: `@beep/test-runner#transit`
- `@beep/rdf#test:property`: `@beep/test-runner#transit`
