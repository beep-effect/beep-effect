# MCP kit runner dependency review

Accept only the ten MCP kit task dependency lists gaining @beep/test-runner
through its development dependency: audit, build, check, coverage, doctest,
lint:deprecated-apis, package-test-typecheck, test, test:integration and
test:property. The six originally inventoried test files use the instrumented
public runner. Additional files remain pending inventory reconciliation.

Preserve every computation identity, command, command digest, configuration,
profile, epoch, scope, source record and dependency list for other packages.
No production dependency is added and no cache eligibility is widened.
The baseline inherited from main at 7581ead6c8 retains its earlier Graph3D and
other reviewed changes. This receipt documents only the MCP kit additions.
