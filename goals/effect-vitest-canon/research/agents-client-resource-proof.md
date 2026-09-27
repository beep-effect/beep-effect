# Agents Client resource proof

The provider tests now use three independent native registry layers with the
original transport initialValues and serial module-state ownership. Dynamic
chat-client registries register disposal through acquire/release in the native
Effect test scope. Public scoped AtomRegistry mounts register releases at
acquisition, replacing cleanup statements that assertions could bypass.

The defect and uncertain-receipt helpers each retain an explicit shorter scope;
resources end when each helper invocation ends. The two idle-retention cases
close their mount scope before the original native sleep and keep the owning
registry alive through the retained-value assertion. Registry disposal follows
that assertion. Receipt attempts, intervals and test deadlines are unchanged.

AST conservation preserves all 69 assertion expressions and 19 registrations
in the four touched files. Client implementations, RPC test handlers and clients,
initialValues, sleep durations and timeout inputs remain unchanged. Full package
verification passes audit (11.9 s) and docgen (6.2 s).

Temporary probes observe 25 actual registry acquisitions across the normal
19-test run. Every registry is disposed and every observed mount is released
at teardown. An intentional assertion failure in the defect helper still leaves
zero active mounts and a disposed registry with the new scopes. Running the
same failure against the original code leaves six observed mounts active and
the registry undisposed. All temporary instrumentation and mutations were
restored.

The probe also sees internal Atom mounts, so zero mounts immediately before
registry disposal is not a valid oracle: disposal itself releases those internal
lifetimes. The evidence checks completion of teardown and retains pre-disposal
counts as diagnostics. Console output is suppressed by this test environment;
private file receipts capture the probe results without changing production.
The final probe inserts observations after complete declaration spans, avoiding
comment-sensitive statement indexing in its temporary instrumentation.

Draft-storage isolation, assertion migration, positive idle-eviction controls,
completion witnesses and runner instrumentation remain pending. This resource
phase does not claim the Agents Client batch is complete.
