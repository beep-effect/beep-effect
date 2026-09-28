# Desktop property registrations

Four direct Arbitrary.checkEffect/Effect.runSync registrations now use public
it.prop. The production schemas remain the generators: CosmosSpikeSize,
OntologySparqlQueryRequest, the two MCP request codecs, and the ten codecs in
schema-parity. The existing test titles and registration count are preserved.

The parity registration generates a record containing one value for each of
its original ten schemas and checks every codec in each trial. The MCP codec
registration similarly checks both original schemas per trial. Both retain
encodeResult, decodeUnknownResult, Result.getOrThrow failure behavior, and the
schema's own equivalence relation. The shared assertSchemaArbitraryDecodesToSelf
helper was considered but not substituted: decoding an arbitrary value directly
is a different law from these encode-then-decode round trips.

The spike law retains its conjunction of all three production count guards.
The execution-authority law retains its production request guard. A false guard
now fails the property assertion directly, replacing the outer Passed-result
assertion. Floors remain fcRuns(25) for parity, spike, and execution authority,
and fcRuns(10) for the MCP codec pair. No generator domain was narrowed.

The SchemaError case in failure-message now acquires its real error inside
it.effect instead of calling Effect.runSync in a synchronous test. Its input,
Effect.flip behavior, and message assertions are unchanged.

## Verification

Node and Bun each passed all 32 cases across the five edited files: nineteen
unit cases and thirteen integration cases. Full Desktop package verification
passed audit and docgen. AST comparison preserved all 32 test titles and all
312 assertion call expressions outside the four migrated property bodies and
the two property helper definitions. The property bodies were reviewed against
their original schema lists, predicates, codec operations, and equivalence laws;
the changed aggregate Passed assertion is not claimed textually unchanged.

Temporary per-registration probes confirmed the exact trial counts: an override
of one retained the original 25/10 floors, an override of 37 produced 37 trials
in all four registrations, and the CI floor/seed setting produced 400 trials
in each. Repeating seed 20260708 reproduced all four generated-input digests;
seed 20260709 changed each stream. The probes were removed in a finally block.

A separate negative control inverted only each property's expected Boolean
outcome. All four property registrations failed, two in the unit group and two
in integration, rather than silently returning an ignored checker result. Those
controls were also restored in a finally block.

Each negative control reported property falsification and a shrunk counterexample:
15 shrink steps for parity, one for spike counts, five for request validity, and
four for the MCP codec pair. Schema-first, Biome, and strict packet validation
passed. The syntax ratchet reported zero introduced findings, 240 resolved
against the retained baseline, and 4,766 live findings. Source/census changes
are scoped to these five files; fixed-row ledger closure remains part of the
final Desktop reconciliation.
