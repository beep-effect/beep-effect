# Observability runner dependency cache review

The new workspace development dependency adds reviewed test-runner or test-utils dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/repo-docgen#audit`: `@beep/test-runner#audit`
- `@beep/repo-docgen#audit`: `@beep/test-utils#audit`
- `@beep/repo-docgen#build`: `@beep/test-runner#build`
- `@beep/repo-docgen#build`: `@beep/test-utils#build`
- `@beep/repo-docgen#check`: `@beep/test-runner#build`
- `@beep/repo-docgen#check`: `@beep/test-utils#build`
- `@beep/repo-docgen#coverage`: `@beep/test-runner#build`
- `@beep/repo-docgen#coverage`: `@beep/test-utils#build`
- `@beep/repo-docgen#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/repo-docgen#lint:deprecated-apis`: `@beep/test-utils#transit`
- `@beep/repo-docgen#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/repo-docgen#package-test-typecheck`: `@beep/test-utils#transit`
- `@beep/repo-docgen#test`: `@beep/test-runner#transit`
- `@beep/repo-docgen#test`: `@beep/test-utils#transit`
- `@beep/repo-docgen#test:property`: `@beep/test-runner#transit`
- `@beep/repo-docgen#test:property`: `@beep/test-utils#transit`
