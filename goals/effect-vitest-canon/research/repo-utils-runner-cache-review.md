# Repo-utils runner dependency review

Adding the test-only @beep/test-runner dependency adds 8 dependency
edges across existing repo-utils computations. Before and after live censuses
confirm unchanged commands and effective task configuration. All 13 owned
projection dependency multisets matched the before census; only the reviewed
dependency arrays are replaced, retaining every existing edge and duplicate.

Unrelated projection nodes, global configuration, source records, profile, epoch,
scope and qualification state are unchanged. No cache qualification is promoted.

Changed computations: audit, build, check, coverage, lint:deprecated-apis, package-test-typecheck, test, test:property.
