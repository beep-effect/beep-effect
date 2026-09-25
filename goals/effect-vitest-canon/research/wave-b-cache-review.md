# Utils runner dependency review

Wave B adds @beep/test-runner as a development dependency of @beep/utils.
The test runner depends on fc-runs and Effect, without application dependencies;
this edge remains acyclic. All sixteen utils test files import its instrumented it.

The reviewed projection predates this dependency. Cache policy reports six
configuration-drift findings in utils: build, check, doctest,
lint:deprecated-apis, test and test:property. The runner must participate in
these tasks' transitive dependency hashing.

Accept only the utils dependency projection change. Preserve the identity/types
scope, existing profile and qualification-v2 epoch. Do not change commands,
cache flags, output declarations, global configuration, or the qualification
ledger. Compare the generated projection with the previous baseline and require
zero remaining cache-policy findings before publication.
