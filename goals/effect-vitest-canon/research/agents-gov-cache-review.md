# Observability runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/agents-use-cases#audit`: `@beep/test-runner#audit`
- `@beep/agents-use-cases#build`: `@beep/test-runner#build`
- `@beep/agents-use-cases#check`: `@beep/test-runner#build`
- `@beep/agents-use-cases#coverage`: `@beep/test-runner#build`
- `@beep/agents-use-cases#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/agents-use-cases#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/agents-use-cases#test`: `@beep/test-runner#transit`
- `@beep/agents-use-cases#test:property`: `@beep/test-runner#transit`
- `@beep/gov-legal-mcp#audit`: `@beep/test-runner#audit`
- `@beep/gov-legal-mcp#build`: `@beep/test-runner#build`
- `@beep/gov-legal-mcp#check`: `@beep/test-runner#build`
- `@beep/gov-legal-mcp#codegen`: `@beep/test-runner#codegen`
- `@beep/gov-legal-mcp#coverage`: `@beep/test-runner#build`
- `@beep/gov-legal-mcp#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/gov-legal-mcp#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/gov-legal-mcp#test`: `@beep/test-runner#transit`
- `@beep/gov-legal-mcp#test:integration`: `@beep/test-runner#build`
