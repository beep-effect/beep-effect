# Schema instrumented runner dependency review

Schema now imports instrumented it from @beep/test-runner in all 78 test files.
The runner is a development dependency with no application dependency cycle.

Accept only schema task dependency edges needed to include the runner in their
transitive input hashes. Cache policy identifies six cached computations: build,
check, doctest, lint:deprecated-apis, test and test:property. Corresponding uncached
schema tasks may receive the same dependency edges. Preserve task commands,
configuration, all unrelated nodes, global configuration, source hashes,
qualification scope, profile and epoch. This review does not grant additional
runtime qualification. Verify the structural delta and rerun cache policy.
