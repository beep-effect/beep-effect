# Contradiction registration owns handlers through public layers

All six registration cases now build their handlers through independent one-test
`it.layer` suites. The fixture computes the source identity and verified anchor,
allocates a fresh captures object, and supplies the existing handler layer plus a
test-only fixture service. Each RPC client is acquired inside its original test.
The former dynamic body providers and the provider inside `sourceError` are gone.

The fixtures retain the original source strings, locators, workspace references,
anchor offsets, quotes, and RPC payloads. In particular the surrogate boundary,
cross-page anchor, quote mismatch, out-of-range anchor, split surrogate, and
foreign-workspace denial cases are unchanged. AST comparison preserves six test
titles and 57 assertion call expressions, including nested assertion expressions.
No assertion was removed or weakened.

A temporary runtime probe collected fixture captures by object identity. It
required six distinct objects, each initialized with zero resolver calls, while
all six original cases passed. The probe was removed afterward. Each case has
its own public layer boundary and retains the existing ten-second normal and
five-minute coverage/deep-sweep hook budget. No mutable capture object is shared
across cases, and the foreign-workspace case still requires zero resolver calls.

After removing the probe, final Node and Bun runs each passed all six cases.
Full Desktop package verification passed audit and docgen. Schema-first passed
with the existing registration exception reanchored by one line, preserving its
reason. The Effect/Vitest ratchet reported zero introduced findings, 200 resolved
against the retained baseline, and 4,801 live findings. Strict packet validation
passed the baseline, ledger, census, and existing timing schemas; this does not
claim final Desktop timing or ledger reconciliation is complete.
