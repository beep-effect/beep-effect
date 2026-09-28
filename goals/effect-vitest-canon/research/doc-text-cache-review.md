# Observability runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/doc-text#audit`: `@beep/test-runner#audit`
- `@beep/doc-text#build`: `@beep/test-runner#build`
- `@beep/doc-text#check`: `@beep/test-runner#build`
- `@beep/doc-text#coverage`: `@beep/test-runner#build`
- `@beep/doc-text#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/doc-text#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/doc-text#test`: `@beep/test-runner#transit`
- `@beep/doc-text#test:integration`: `@beep/test-runner#build`
- `@beep/doc-text#test:property`: `@beep/test-runner#transit`
