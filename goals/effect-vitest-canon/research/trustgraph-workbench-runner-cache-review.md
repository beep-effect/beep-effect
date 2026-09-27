# Observability runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/trustgraph-workbench#audit`: `@beep/test-runner#audit`
- `@beep/trustgraph-workbench#build`: `@beep/test-runner#build`
- `@beep/trustgraph-workbench#check`: `@beep/test-runner#build`
- `@beep/trustgraph-workbench#dev`: `@beep/test-runner#build`
- `@beep/trustgraph-workbench#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/trustgraph-workbench#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/trustgraph-workbench#test`: `@beep/test-runner#transit`
