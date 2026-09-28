# Repository config runner dependency review

Adding the test-only `@beep/test-runner` dependency adds nine dependency edges
to existing repository-config computations. Their commands and configuration
remain unchanged. Five other reviewed repository-config computations retain
their existing dependencies.

Before and after live cache censuses establish each added edge. All fourteen
existing repository-config projection dependency multisets matched the before
census. The update replaces only those dependency arrays with the after census;
no prior edge or duplicate is dropped. Every unrelated projection node, global
configuration, source record, qualification state, profile and epoch is retained.
No cache qualification is promoted.

The changed computations are audit, build, check, codegen, coverage,
lint:deprecated-apis, package-test-typecheck, test and test:property. Runner
registration does not alter the production dependency graph or test subjects.
