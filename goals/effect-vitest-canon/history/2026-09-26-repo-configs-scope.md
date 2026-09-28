# Repository configuration scope checkpoint

Five admitted test files now use canonical scope/runtime ownership. Compiler
cases share only the original native platform services through a bounded harness
layer. The diagnostic project directory belongs to its test scope. The command
helper retains its shorter child scope, concurrent stdout/stderr/exit draining,
sequential version-command comparison and existing fifteen-second case deadline.
Governance layers now have explicit ten-second hook caps. Native checkout reads
and compiler-visible files remain native.

Ordinary effectful decoder cases use native Effect tests and direct Effect.exit
with identical invalid inputs. Pure synchronous decoder subjects remain plain
synchronous tests. Runtime and Promise adapters were removed without changing
the independent expected logging object or its equality assertion.

Preservation checks cover eighty assertions modulo the intended runtime adapters,
ten untouched manual properties in the touched files, twenty-seven test names
and deadlines, and exact policy source/regex fixture strings. Compiler helper
and fixture-writing bodies remain token-identical. Other files are unchanged.

Full `bun run beep quality package-verify @beep/repo-configs` passed: audit
10.1 seconds and docgen 4.4 seconds. Assertion-family changes, property
registrations, flake review and observability remain separate later phases.
