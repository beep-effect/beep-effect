# Observability runner dependency cache review

The new workspace development dependency adds test-runner
edges to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/shacl#audit`: `@beep/test-runner#audit`
- `@beep/shacl#build`: `@beep/test-runner#build`
- `@beep/shacl#check`: `@beep/test-runner#build`
- `@beep/shacl#coverage`: `@beep/test-runner#build`
- `@beep/shacl#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/shacl#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/shacl#test`: `@beep/test-runner#transit`
