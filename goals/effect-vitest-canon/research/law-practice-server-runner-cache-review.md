# Observability runner dependency cache review

The new workspace development dependency adds test-runner
edges to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/law-practice-server#audit`: `@beep/test-runner#audit`
- `@beep/law-practice-server#build`: `@beep/test-runner#build`
- `@beep/law-practice-server#check`: `@beep/test-runner#build`
- `@beep/law-practice-server#coverage`: `@beep/test-runner#build`
- `@beep/law-practice-server#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/law-practice-server#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/law-practice-server#test`: `@beep/test-runner#transit`
