# Data instrumented runner dependency review

The data wave adds @beep/test-runner as a development dependency. Its five test
files use instrumented it. The runner depends on Effect and fc-runs, without
application dependencies, so the new edge remains acyclic.

Cache policy reports five cached data tasks with configuration drift: build,
check, doctest, lint:deprecated-apis and test. Include the new runner dependency
in their transitive hashes and in the corresponding uncached task projections.
Accept only data dependency edges; preserve commands, cache flags, outputs,
global configuration, unrelated nodes, qualification scope, profile and epoch.
This configuration review does not grant runtime qualification. Confirm the
structural delta and rerun cache policy before publication.
