# Observability runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/workspace-domain#audit`: `@beep/test-runner#audit`
- `@beep/workspace-domain#build`: `@beep/test-runner#build`
- `@beep/workspace-domain#check`: `@beep/test-runner#build`
- `@beep/workspace-domain#coverage`: `@beep/test-runner#build`
- `@beep/workspace-domain#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/workspace-domain#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/workspace-domain#test`: `@beep/test-runner#transit`
- `@beep/workspace-domain#test:property`: `@beep/test-runner#transit`
- `@beep/workspace-tables#audit`: `@beep/test-runner#audit`
- `@beep/workspace-tables#build`: `@beep/test-runner#build`
- `@beep/workspace-tables#check`: `@beep/test-runner#build`
- `@beep/workspace-tables#coverage`: `@beep/test-runner#build`
- `@beep/workspace-tables#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/workspace-tables#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/workspace-tables#test`: `@beep/test-runner#transit`
- `@beep/workspace-tables#test:integration`: `@beep/test-runner#build`
- `@beep/workspace-tables#test:property`: `@beep/test-runner#transit`
- `@beep/workspace-use-cases#audit`: `@beep/test-runner#audit`
- `@beep/workspace-use-cases#build`: `@beep/test-runner#build`
- `@beep/workspace-use-cases#check`: `@beep/test-runner#build`
- `@beep/workspace-use-cases#coverage`: `@beep/test-runner#build`
- `@beep/workspace-use-cases#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/workspace-use-cases#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/workspace-use-cases#test`: `@beep/test-runner#transit`
- `@beep/workspace-use-cases#test:integration`: `@beep/test-runner#build`
- `@beep/workspace-use-cases#test:property`: `@beep/test-runner#transit`
