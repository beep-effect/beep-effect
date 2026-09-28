# Observability runner dependency cache review

The new workspace development dependency adds test-runner
edges to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/professional-desktop#audit`: `@beep/test-runner#audit`
- `@beep/professional-desktop#build`: `@beep/test-runner#build`
- `@beep/professional-desktop#check`: `@beep/test-runner#build`
- `@beep/professional-desktop#codegen`: `@beep/test-runner#codegen`
- `@beep/professional-desktop#coverage`: `@beep/test-runner#build`
- `@beep/professional-desktop#dev`: `@beep/test-runner#build`
- `@beep/professional-desktop#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/professional-desktop#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/professional-desktop#test`: `@beep/test-runner#transit`
- `@beep/professional-desktop#test:integration`: `@beep/test-runner#build`
- `@beep/professional-desktop#test:integration:parallel`: `@beep/test-runner#build`
- `@beep/professional-desktop#test:property`: `@beep/test-runner#transit`
