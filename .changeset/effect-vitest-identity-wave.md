---
"@beep/identity": patch
---

Remediate the @beep/identity test suite to the canonical Effect Vitest idioms: shared it.layer registry lookups, it.prop property registrations with fcRuns floors, assertSome/assertNone payload assertions and the instrumented @beep/test-runner runner. The PN local/prefix/escaped validate, escape and emit predicates are unchanged; the Arbitrary sample domains for SafePnLocal, SafePnPrefix and EscapedPnLocal expand from fixed literal lists to bounded grammar patterns, so Arbitrary.schema on those codecs now emits a wider grammar-valid distribution.
