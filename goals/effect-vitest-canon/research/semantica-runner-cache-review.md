# Observability runner dependency cache review

The new workspace development dependency adds test-runner and test-utils
edges to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/semantica#audit`: `@beep/test-runner#audit`
- `@beep/semantica#audit`: `@beep/test-utils#audit`
- `@beep/semantica#build`: `@beep/test-runner#build`
- `@beep/semantica#build`: `@beep/test-utils#build`
- `@beep/semantica#check`: `@beep/test-runner#build`
- `@beep/semantica#check`: `@beep/test-utils#build`
- `@beep/semantica#dev`: `@beep/test-runner#build`
- `@beep/semantica#dev`: `@beep/test-utils#build`
- `@beep/semantica#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/semantica#lint:deprecated-apis`: `@beep/test-utils#transit`
- `@beep/semantica#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/semantica#package-test-typecheck`: `@beep/test-utils#transit`
- `@beep/semantica#test`: `@beep/test-runner#transit`
- `@beep/semantica#test`: `@beep/test-utils#transit`
