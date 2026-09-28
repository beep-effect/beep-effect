# Observability runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/oip-web#audit`: `@beep/test-runner#audit`
- `@beep/oip-web#build`: `@beep/test-runner#build`
- `@beep/oip-web#check`: `@beep/test-runner#build`
- `@beep/oip-web#coverage`: `@beep/test-runner#build`
- `@beep/oip-web#dev`: `@beep/test-runner#build`
- `@beep/oip-web#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/oip-web#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/oip-web#test`: `@beep/test-runner#transit`
- `@beep/oip-web#test:property`: `@beep/test-runner#transit`
