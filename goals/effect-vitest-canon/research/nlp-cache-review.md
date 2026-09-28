# Observability runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/nlp-processing#audit`: `@beep/test-runner#audit`
- `@beep/nlp-processing#build`: `@beep/test-runner#build`
- `@beep/nlp-processing#check`: `@beep/test-runner#build`
- `@beep/nlp-processing#coverage`: `@beep/test-runner#build`
- `@beep/nlp-processing#doctest`: `@beep/test-runner#transit`
- `@beep/nlp-processing#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/nlp-processing#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/nlp-processing#test`: `@beep/test-runner#transit`
- `@beep/nlp-processing#test:property`: `@beep/test-runner#transit`
