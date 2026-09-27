# Observability runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/langextract#audit`: `@beep/test-runner#audit`
- `@beep/langextract#build`: `@beep/test-runner#build`
- `@beep/langextract#check`: `@beep/test-runner#build`
- `@beep/langextract#coverage`: `@beep/test-runner#build`
- `@beep/langextract#doctest`: `@beep/test-runner#transit`
- `@beep/langextract#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/langextract#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/langextract#test`: `@beep/test-runner#transit`
- `@beep/langextract#test:property`: `@beep/test-runner#transit`
