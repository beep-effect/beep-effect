# Observability runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/dock#audit`: `@beep/test-runner#audit`
- `@beep/dock#build`: `@beep/test-runner#build`
- `@beep/dock#check`: `@beep/test-runner#build`
- `@beep/dock#coverage`: `@beep/test-runner#build`
- `@beep/dock#doctest`: `@beep/test-runner#transit`
- `@beep/dock#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/dock#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/dock#test`: `@beep/test-runner#transit`
- `@beep/dock#test:integration`: `@beep/test-runner#build`
