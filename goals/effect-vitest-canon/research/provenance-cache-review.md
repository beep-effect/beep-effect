# Provenance runner dependency review

Accept only the nine Provenance task dependency lists gaining @beep/test-runner
through its development dependency: audit, build, check, coverage, doctest,
lint:deprecated-apis, package-test-typecheck, test, and test:property.

Preserve every computation identity, command, command digest, configuration,
profile, epoch, scope, source record, and dependency list for other packages.
The three Provenance test files adopt the instrumented public runner. No
production dependency is added and no cache eligibility is widened.

The baseline was inherited from main at 7581ead6c8. Its earlier Graph3D and other
reviewed changes remain intact. This receipt documents only the additional
Provenance edges; it does not claim those earlier changes as Provenance work.
