# Observability runner dependency cache review

The new workspace development dependency adds test-runner
edges to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/documents-use-cases#audit`: `@beep/test-runner#audit`
- `@beep/documents-use-cases#build`: `@beep/test-runner#build`
- `@beep/documents-use-cases#check`: `@beep/test-runner#build`
- `@beep/documents-use-cases#coverage`: `@beep/test-runner#build`
- `@beep/documents-use-cases#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/documents-use-cases#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/documents-use-cases#test`: `@beep/test-runner#transit`
- `@beep/documents-use-cases#test:integration`: `@beep/test-runner#build`
