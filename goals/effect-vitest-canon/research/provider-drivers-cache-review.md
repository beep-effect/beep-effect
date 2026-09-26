# Provider driver runner dependency review

This wave adds the accepted instrumented test-runner development dependency
to the five provider drivers. The twelve recorded test files import its public
it registration; existing layer callbacks use the same instrumented registration.

Only the following dependency lists change in the reviewed cache projection:

- @beep/anthropic: audit, build, check, coverage, lint:deprecated-apis, package-test-typecheck, test, test:property.
- @beep/openai: audit, build, check, coverage, lint:deprecated-apis, package-test-typecheck, test, test:integration.
- @beep/openai-compat: audit, build, check, coverage, lint:deprecated-apis, package-test-typecheck, test, test:integration, test:property.
- @beep/venice-ai: audit, build, check, coverage, lint:deprecated-apis, package-test-typecheck, test, test:integration, test:integration:parallel, test:property.
- @beep/xai: audit, build, check, coverage, lint:deprecated-apis, package-test-typecheck, test, test:integration, test:property.

Preserve every computation identity, command, command digest, configuration,
profile, epoch, scope, source record, and unrelated node from main at
7581ead6c833ea0c935ae5afc98cc0636d3b3886. Each changed dependency list gains
only its corresponding test-runner task edge. No cache eligibility is widened
and this review does not qualify any previously unassessed tuple.
