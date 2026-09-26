# Capability backlog runner dependency review

The current wave accepts only nine Chalk task dependency lists gaining
@beep/test-runner through its development dependency: audit, build, check,
coverage, doctest, lint:deprecated-apis, package-test-typecheck, test and
test:property. Both existing Chalk test files use the public instrumented runner.

Preserve all computation identities, commands, command digests, configuration,
profile, epoch, scope, source records and other packages. No cache eligibility
is widened. The inherited main projection at 7581ead6c8 remains intact except
for these dependency lists. Later packages in this wave require their own
explicit extension of this receipt and scoped dependency comparison.
