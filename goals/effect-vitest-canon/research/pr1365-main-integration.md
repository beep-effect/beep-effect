# PR 1365 main integration

Main through `8a46aa3466` is merged. This includes the tsgo 0.47.2 update,
codec-statics registry retirement, and the stale-drift coverage regression test.

The SchemaUtils test conflict was limited to this branch's two `assertNone`
conversions inside the retired codec-statics suite. The upstream replacement
static-descriptor tests are retained; removed production APIs are not restored.

The inventory merge preserves historical rows and review dispositions. One
occurrence-matched row and eleven same-ID source metadata changes were reconciled;
one genuinely new upstream row was added. Of twelve old occurrence keys unmatched by the initial pairing, eleven were
same-ID metadata changes and one remains as historical campaign evidence. No global baseline refresh
was used to resolve the conflict.

The previous local full proof at `1710f6d3cf` failed only coverage: one uncovered
branch in EffectSchemaInventoryRender's truncated drift display. Upstream #1374
adds an exact 51st-column divergence case exercising that branch. This merge
includes it; coverage on the new head remains to be proved. The earlier proof's
passing lanes do not establish verification of the compiler/schema update.

Main through `50e9c4bc41` is also integrated. The two additional conflicts were
assertion-helper imports in Yeet tests: the merged imports retain both branches'
required helpers. The previous local proof was still queued when this new base
conflict arrived and was explicitly interrupted before changing its inputs.
Its queue wait is not a completed proof of either head.
