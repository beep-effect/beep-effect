# Observability runner dependency cache review

The new workspace development dependency adds test-runner
edges to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/documents-tables#audit`: `@beep/test-runner#audit`
- `@beep/documents-tables#build`: `@beep/test-runner#build`
- `@beep/documents-tables#check`: `@beep/test-runner#build`
- `@beep/documents-tables#coverage`: `@beep/test-runner#build`
- `@beep/documents-tables#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/documents-tables#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/documents-tables#test`: `@beep/test-runner#transit`
- `@beep/documents-tables#test:integration`: `@beep/test-runner#build`
- `@beep/documents-tables#test:property`: `@beep/test-runner#transit`
