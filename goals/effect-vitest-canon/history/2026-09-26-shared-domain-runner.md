# Shared-domain instrumented runner checkpoint

All eight registered suites now import it from @beep/test-runner. StaticProbes
remains a support module. The nine-file token comparison excludes imports only
and confirms every test body, property registration, assertion, layer option
and deadline is unchanged from the flake checkpoint. No logger-subject case
needs a native-runner exception in this package.

Added the development dependency, lockfile entry and generated TypeScript
references using beep tsconfig-sync. The changeset accompanies this manifest
change. Package audit/docgen pass in 8.0/3.8 seconds. Configured Node and Bun
with CI unset and BEEP_TEST_TRACE=0 each pass all 116 cases; Node trace-on also
passes all 116. All three timing runs retain stable source hashes and record
workstation load and pressure without normalized performance claims.

A temporary deliberately failing probe used the public runner and captured its
TestConsole output after completion. Trace-off emitted no lifecycle; trace-on
recorded start, the actual case name, failure outcome and duration. The probe
used an independent unequal-string expectation and it.effect.fails, and was
removed after both expected outcomes. Existing test files were not changed by
the probe. Final inventory, cache projection and publication proof remain.
