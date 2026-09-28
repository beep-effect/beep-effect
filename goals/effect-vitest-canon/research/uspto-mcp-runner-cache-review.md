# Observability runner dependency cache review

The new workspace development dependency adds test-runner
edges to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/uspto-mcp#audit`: `@beep/test-runner#audit`
- `@beep/uspto-mcp#build`: `@beep/test-runner#build`
- `@beep/uspto-mcp#check`: `@beep/test-runner#build`
- `@beep/uspto-mcp#coverage`: `@beep/test-runner#build`
- `@beep/uspto-mcp#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/uspto-mcp#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/uspto-mcp#test`: `@beep/test-runner#transit`
- `@beep/uspto-mcp#test:integration`: `@beep/test-runner#build`
- `@beep/uspto-mcp#test:property`: `@beep/test-runner#transit`
