# Observability runner dependency cache review

The new workspace development dependency adds test-runner
edges to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/box#audit`: `@beep/test-runner#audit`
- `@beep/box#build`: `@beep/test-runner#build`
- `@beep/box#check`: `@beep/test-runner#build`
- `@beep/box#codegen`: `@beep/test-runner#codegen`
- `@beep/box#coverage`: `@beep/test-runner#build`
- `@beep/box#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/box#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/box#test`: `@beep/test-runner#transit`
- `@beep/box#test:integration`: `@beep/test-runner#build`
- `@beep/box#test:integration:parallel`: `@beep/test-runner#build`
- `@beep/box#test:property`: `@beep/test-runner#transit`
