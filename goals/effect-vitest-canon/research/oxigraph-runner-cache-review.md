# Observability runner dependency cache review

The new workspace development dependency adds test-runner
edges to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/oxigraph#audit`: `@beep/test-runner#audit`
- `@beep/oxigraph#build`: `@beep/test-runner#build`
- `@beep/oxigraph#check`: `@beep/test-runner#build`
- `@beep/oxigraph#coverage`: `@beep/test-runner#build`
- `@beep/oxigraph#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/oxigraph#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/oxigraph#test`: `@beep/test-runner#transit`
