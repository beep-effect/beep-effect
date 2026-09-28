# Consolidated batch property phase

OnePassword CLI adds a native effect property over schema-derived references.
Its injected runner returns a synthetic non-ASCII prefix plus the reference;
the property compares the exact redacted contents, TextEncoder UTF-8 byte count,
reference and resolved status. The existing ASCII case, codec laws, opaque-cause
exclusions and 50-run floors remain unchanged. The new property's floor is also
50. Both properties pass with 400 runs and seed 20260708. The seven-test package
suite, audit and docgen pass. A temporary code-unit expected-length oracle fails
on the synthetic Unicode domain and source is restored byte-for-byte; this is
an oracle-discrimination control, not a production mutation test.

M365 MCP retains its Some/non-failure observations and adds exact equality of
the successful handler result to the existing GraphSite fixture. A temporary
wrong-site mock result fails the new oracle and is restored byte-for-byte.
Its original schema-derived property passes at 400 runs with seed 20260708;
the 20-test package suite, audit and docgen pass. Shared Tables retains its
existing exact metadata examples; no new property gap was established.
