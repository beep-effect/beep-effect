# Domain instrumented runner adoption

All 13 test files register through @beep/test-runner. Both package audits and
docgen pass after adoption; Node and Bun each pass all 163 tests. The packages
remain pure in-process subjects, with no new clock, provider or resource seam.
Two development dependencies add four generated TS references, four generated
Fallow allowances and 16 reviewed cache dependency edges. Commands, effective
configuration and qualification state are unchanged.

The owned-file detector reconciliation also closes four existing root Result
assertions missing from the older package ledger. assertSuccess preserves the
exact active-client, founder, patent-application and pre-filing literals. The
obsolete Result import is removed; no source behavior or schema changes.
