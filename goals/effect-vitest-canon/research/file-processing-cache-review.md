# Observability runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/file-processing#audit`: `@beep/test-runner#audit`
- `@beep/file-processing#build`: `@beep/test-runner#build`
- `@beep/file-processing#check`: `@beep/test-runner#build`
- `@beep/file-processing#coverage`: `@beep/test-runner#build`
- `@beep/file-processing#doctest`: `@beep/test-runner#transit`
- `@beep/file-processing#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/file-processing#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/file-processing#test`: `@beep/test-runner#transit`
- `@beep/file-processing#test:integration`: `@beep/test-runner#build`
- `@beep/file-processing#test:property`: `@beep/test-runner#transit`
