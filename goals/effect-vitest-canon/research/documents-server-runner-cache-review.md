# Observability runner dependency cache review

The new workspace development dependency adds test-runner
edges to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/documents-server#audit`: `@beep/test-runner#audit`
- `@beep/documents-server#build`: `@beep/test-runner#build`
- `@beep/documents-server#check`: `@beep/test-runner#build`
- `@beep/documents-server#coverage`: `@beep/test-runner#build`
- `@beep/documents-server#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/documents-server#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/documents-server#test`: `@beep/test-runner#transit`
- `@beep/documents-server#test:integration`: `@beep/test-runner#build`
- `@beep/documents-server#test:integration:parallel`: `@beep/test-runner#build`
