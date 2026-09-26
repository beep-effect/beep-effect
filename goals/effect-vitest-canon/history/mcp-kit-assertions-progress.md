# MCP kit assertion phase progress

Three Option assertions now use public assertSome/assertNone with the same
operands and expected values. The empty toolCallId decode Exit now uses
assertExitFailure with a complete Cause projection: typed failures retain
their SchemaError tag; all defect and interruption reasons are preserved.

The hard-gate missing-tool Result now asserts InvalidParams and the exact
message Tool 'hard_source_tool' not found, grounded in the installed McpServer
callTool implementation. The success Result asserts isError false and retains
the previous conditional payload assertion. Inputs and polarity are unchanged.

Full package verification passed after both steps; final audit took 7.2 seconds
and docgen 3.3 seconds. SanitizedToolkit interruption and registration-failure
Exit assertions remain to be reconciled before the assertion phase closes.
No production code changed.

## Remaining Exit assertions resolved

SanitizedToolkit now asserts a single interruption after normalizing only its
runtime-assigned fiber ID. All other cause reasons remain intact. A private
control accepted one interruption and rejected mixed typed failure, mixed
defect, and duplicate interruption; it is not a committed regression test.
The strict dynamic registration asserts the exact defect string from
wireToolSchemas and retains the original tool-name diagnostic assertion.
Full package verification passed: audit 7.2 seconds, docgen 3.3 seconds.

## Final detector reconciliation

The span parent assertion now uses assertSome with the same parent value. This
closes an overlooked assertion candidate; the earlier completion statement did
not cover it. The strict dynamic registration Effect.scoped is retained: it
closes the attempted Layer.build before inspecting its complete failure Exit.
It is a deliberate shorter lifetime, not a whole-test scope wrapper. Its
judgment candidate stays visible until the ledger records this disposition.
