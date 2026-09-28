# Observability runner dependency cache review

The new workspace development dependency adds test-runner
edges to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/lejeune-bolt-workbench#audit`: `@beep/test-runner#audit`
- `@beep/lejeune-bolt-workbench#build`: `@beep/test-runner#build`
- `@beep/lejeune-bolt-workbench#check`: `@beep/test-runner#build`
- `@beep/lejeune-bolt-workbench#dev`: `@beep/test-runner#build`
- `@beep/lejeune-bolt-workbench#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/lejeune-bolt-workbench#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/lejeune-bolt-workbench#test`: `@beep/test-runner#transit`
