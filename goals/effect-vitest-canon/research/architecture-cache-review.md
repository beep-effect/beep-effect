# Observability runner dependency cache review

The new workspace development dependency adds only the declared test-runner and Domain test-utils dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/architecture-lab-client#audit`: `@beep/test-runner#audit`
- `@beep/architecture-lab-client#build`: `@beep/test-runner#build`
- `@beep/architecture-lab-client#check`: `@beep/test-runner#build`
- `@beep/architecture-lab-client#coverage`: `@beep/test-runner#build`
- `@beep/architecture-lab-client#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/architecture-lab-client#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/architecture-lab-client#test`: `@beep/test-runner#transit`
- `@beep/architecture-lab-client#test:integration`: `@beep/test-runner#build`
- `@beep/architecture-lab-domain#audit`: `@beep/test-runner#audit, @beep/test-utils#audit`
- `@beep/architecture-lab-domain#build`: `@beep/test-runner#build, @beep/test-utils#build`
- `@beep/architecture-lab-domain#check`: `@beep/test-runner#build, @beep/test-utils#build`
- `@beep/architecture-lab-domain#coverage`: `@beep/test-runner#build, @beep/test-utils#build`
- `@beep/architecture-lab-domain#lint:deprecated-apis`: `@beep/test-runner#transit, @beep/test-utils#transit`
- `@beep/architecture-lab-domain#package-test-typecheck`: `@beep/test-runner#transit, @beep/test-utils#transit`
- `@beep/architecture-lab-domain#test`: `@beep/test-runner#transit, @beep/test-utils#transit`
- `@beep/architecture-lab-domain#test:integration`: `@beep/test-runner#build, @beep/test-utils#build`
- `@beep/architecture-lab-domain#test:property`: `@beep/test-runner#transit, @beep/test-utils#transit`
- `@beep/architecture-lab-server#audit`: `@beep/test-runner#audit`
- `@beep/architecture-lab-server#build`: `@beep/test-runner#build`
- `@beep/architecture-lab-server#check`: `@beep/test-runner#build`
- `@beep/architecture-lab-server#coverage`: `@beep/test-runner#build`
- `@beep/architecture-lab-server#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/architecture-lab-server#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/architecture-lab-server#test`: `@beep/test-runner#transit`
- `@beep/architecture-lab-server#test:integration`: `@beep/test-runner#build`
- `@beep/architecture-lab-server#test:integration:parallel`: `@beep/test-runner#build`
- `@beep/architecture-lab-server#test:property`: `@beep/test-runner#transit`
- `@beep/architecture-lab-tables#audit`: `@beep/test-runner#audit`
- `@beep/architecture-lab-tables#build`: `@beep/test-runner#build`
- `@beep/architecture-lab-tables#check`: `@beep/test-runner#build`
- `@beep/architecture-lab-tables#coverage`: `@beep/test-runner#build`
- `@beep/architecture-lab-tables#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/architecture-lab-tables#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/architecture-lab-tables#test`: `@beep/test-runner#transit`
- `@beep/architecture-lab-tables#test:integration`: `@beep/test-runner#build`
- `@beep/architecture-lab-tables#test:property`: `@beep/test-runner#transit`
- `@beep/architecture-lab-ui#audit`: `@beep/test-runner#audit`
- `@beep/architecture-lab-ui#build`: `@beep/test-runner#build`
- `@beep/architecture-lab-ui#check`: `@beep/test-runner#build`
- `@beep/architecture-lab-ui#coverage`: `@beep/test-runner#build`
- `@beep/architecture-lab-ui#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/architecture-lab-ui#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/architecture-lab-ui#test`: `@beep/test-runner#transit`
- `@beep/architecture-lab-ui#test:integration`: `@beep/test-runner#build`
- `@beep/architecture-lab-ui#test:property`: `@beep/test-runner#transit`
- `@beep/architecture-lab-use-cases#audit`: `@beep/test-runner#audit`
- `@beep/architecture-lab-use-cases#build`: `@beep/test-runner#build`
- `@beep/architecture-lab-use-cases#check`: `@beep/test-runner#build`
- `@beep/architecture-lab-use-cases#coverage`: `@beep/test-runner#build`
- `@beep/architecture-lab-use-cases#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/architecture-lab-use-cases#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/architecture-lab-use-cases#test`: `@beep/test-runner#transit`
- `@beep/architecture-lab-use-cases#test:integration`: `@beep/test-runner#build`
- `@beep/architecture-lab-use-cases#test:property`: `@beep/test-runner#transit`
