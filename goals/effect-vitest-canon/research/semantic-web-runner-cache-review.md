# Observability runner dependency cache review

The new workspace development dependency adds test-runner
edges to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/semantic-web#audit`: `@beep/test-runner#audit`
- `@beep/semantic-web#build`: `@beep/test-runner#build`
- `@beep/semantic-web#check`: `@beep/test-runner#build`
- `@beep/semantic-web#coverage`: `@beep/test-runner#build`
- `@beep/semantic-web#doctest`: `@beep/test-runner#transit`
- `@beep/semantic-web#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/semantic-web#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/semantic-web#test`: `@beep/test-runner#transit`
- `@beep/semantic-web#test:property`: `@beep/test-runner#transit`
