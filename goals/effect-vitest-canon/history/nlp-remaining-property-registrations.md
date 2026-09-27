# NLP remaining native property registrations

Ten native checkEffect wrappers now register through public it.prop: five Kind
laws, two Handoff laws, and one each for core models, graph schemas, and pattern
schemas. Existing explicit fcRuns(25) and fcRuns(50) options are unchanged;
omitted options now use fcRuns(100). PatternCore retains its existing five-way
tuple and maxDiscards of 20,000, including the reason documented on main.

An AST comparison confirms unchanged arbitrary expressions, predicates,
existing options, and all surrounding code. The CoreModels test import moves
from vitest to @effect/vitest to expose the public property registration.
Full package verification passed: audit 9.3 seconds and docgen 4.5 seconds.

This completes migration of the existing native checkEffect registration sites,
not the property lens: graph payload and generative law gaps remain. Runtime
boundaries inside the preserved round-trip predicates still await migration,
as do runner instrumentation, flake review, and final ledger reconciliation.
