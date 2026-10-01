# PR 1365 main integration

Main through `8a46aa3466` is merged. This includes the tsgo 0.47.2 update,
codec-statics registry retirement, and the stale-drift coverage regression test.

The SchemaUtils test conflict was limited to this branch's two `assertNone`
conversions inside the retired codec-statics suite. The upstream replacement
static-descriptor tests are retained; removed production APIs are not restored.

The inventory merge preserves historical rows and review dispositions. One
occurrence-matched row and eleven same-ID source metadata changes were reconciled;
one genuinely new upstream row was added. Twelve historical upstream-removed
rows remain available for campaign reconciliation. No global baseline refresh
was used to resolve the conflict.

The previous local full proof at `1710f6d3cf` failed only coverage: one uncovered
branch in EffectSchemaInventoryRender's truncated drift display. Upstream #1374
adds an exact 51st-column divergence case exercising that branch. This merge
includes it; coverage on the new head remains to be proved. The earlier proof's
passing lanes do not establish verification of the compiler/schema update.
