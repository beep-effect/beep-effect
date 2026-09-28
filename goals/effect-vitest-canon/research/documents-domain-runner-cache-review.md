# Observability runner dependency cache review

The new workspace development dependency adds test-runner
edges to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/documents-domain#audit`: `@beep/test-runner#audit`
- `@beep/documents-domain#build`: `@beep/test-runner#build`
- `@beep/documents-domain#check`: `@beep/test-runner#build`
- `@beep/documents-domain#coverage`: `@beep/test-runner#build`
- `@beep/documents-domain#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/documents-domain#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/documents-domain#test`: `@beep/test-runner#transit`
- `@beep/documents-domain#test:integration`: `@beep/test-runner#build`
