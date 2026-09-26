# NLP runner dependency review

The NLP test suite now imports the instrumented test runner. The workspace
manifest and lockfile add its development dependency; generated TypeScript
references and Fallow boundaries include that dependency.

The fresh cache census adds nine dependency edges for NLP: audit to runner
audit; build, check and coverage to runner build; doctest, deprecated API lint,
package test typecheck, test and property test to runner transit. Only these
nine dependency lists change in the qualification projection. Commands,
configuration, outputs, environment lists, qualification scope/epoch/profile,
global configuration, sources, and all other workspace nodes are preserved.
This records the declared graph change and does not promote qualification.
