# Government drivers instrumented runner phase

All five admitted suites now import it from the public instrumented runner.
Existing layer registrations use that runner while retaining their isolated
fixtures and ten-second hook budgets. A token-level preservation check excludes
imports and accounts for the layer receiver only; every test body is unchanged.
Both packages add the runner development dependency, with generated lockfile,
TypeScript references and Fallow dependency allowances. test-utils remains used
for fcRuns.

Configured Node and Bun suites pass all 18 cases. Single command observations:
eCFR Node 5.825830 seconds, Bun 2.317902 seconds; GovInfo Node 5.127128 seconds,
Bun 2.518283 seconds. Each retains source hashes and workstation load/pressure.
Trace-enabled full suites pass, and temporary diagnostic probes in both packages
prove trace-off silence and trace-on case name, failure outcome and duration.
All probes are removed before the final detector scan. All three property
registrations again pass 400 runs with seed 20260708 after runner adoption.

Full package verification passes: eCFR audit 9.4 seconds/docgen 3.3 seconds;
GovInfo audit 9.3 seconds/docgen 4.2 seconds. The final detector has zero eCFR
findings and one native GovInfo platform candidate at its current import anchor.
The real checked-in OpenAPI and generated-source drift oracle must remain native;
a seeded memory fixture would replace its subject. Its explicit exception is
recorded during reconciliation. Hosted proof and review closure remain pending.
