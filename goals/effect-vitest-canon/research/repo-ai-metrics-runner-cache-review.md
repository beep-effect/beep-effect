# Observability runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/repo-ai-metrics#audit`: `@beep/test-runner#audit`
- `@beep/repo-ai-metrics#build`: `@beep/test-runner#build`
- `@beep/repo-ai-metrics#check`: `@beep/test-runner#build`
- `@beep/repo-ai-metrics#coverage`: `@beep/test-runner#build`
- `@beep/repo-ai-metrics#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/repo-ai-metrics#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/repo-ai-metrics#test`: `@beep/test-runner#transit`
- `@beep/repo-ai-metrics#test:property`: `@beep/test-runner#transit`
