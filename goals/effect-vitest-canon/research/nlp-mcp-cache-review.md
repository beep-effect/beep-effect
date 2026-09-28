# Observability runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/nlp-mcp#audit`: `@beep/test-runner#audit`
- `@beep/nlp-mcp#build`: `@beep/test-runner#build`
- `@beep/nlp-mcp#check`: `@beep/test-runner#build`
- `@beep/nlp-mcp#coverage`: `@beep/test-runner#build`
- `@beep/nlp-mcp#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/nlp-mcp#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/nlp-mcp#test`: `@beep/test-runner#transit`
- `@beep/nlp-mcp#test:integration`: `@beep/test-runner#build`
- `@beep/nlp-mcp#test:integration:parallel`: `@beep/test-runner#build`
- `@beep/nlp-mcp#test:property`: `@beep/test-runner#transit`
