# Repository configuration assertion checkpoint

Seven admitted files use equivalent Effect-aware assertions: fourteen assertNone,
three assertSome with independently known string values, and twenty assertTrue
substitutions for existing Option/Exit/equality or Effect predicates. All operands,
expected values and polarity remain unchanged. No full expected Cause was
invented for predicate-only failure checks.

Inverse token comparison restores all original non-import source tokens across
thirty-seven substitutions. Reference identity checks, configuration payloads,
negative property-presence checks and policy strings remain intact. Existing
Arbitrary.checkEffect predicates still return true; their registrations, inputs
and run floors have not changed in this assertion phase.

Full `bun run beep quality package-verify @beep/repo-configs` passed: audit
8.8 seconds and docgen 4.0 seconds. Property registration is the next phase.
