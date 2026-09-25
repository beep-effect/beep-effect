# xai-sse-done-payload P2 audit

Source HEAD: dc852c92efdd7d259e3983ec30cd19cb9b4fd65d.
Outcome: retained E3/E2, cardinality 4/2, derived/internal/tagged-union/Tier 1.
No product edits, tests, implementation, dry census, or independent P3 credit.
The proposed inventory row resets historical reviewed status to designed for this
substantive P2 refresh and fixes its stale E3 anchor and misleading terminal
wording. This supplies no independent P3 credit. Parent controls integration.

Meaningful corrections: keep kind kit private without a new public kind/type export;
runtime import required for match; use the private unreconstructed LiteralKit directly
and attach match after union annotations; no stop-on-DONE change; cover actual four-route
SSE fixture and adapter error/order behavior; remove invented comment-deletion
credit; substantiate root-export/private internal codec exposure with consumer search.

Commands: graft grep XAiServerSentEvent (whole graph); scoped parseSseData /
parseStreamEvent search; scoped mapMembers/toTaggedUnion and statics-helper search;
repository-wide rg XAiServerSentEvent/@beep/xai plus targeted numbered source reads.
First Graft scope packages/integrations/xai was wrong and returned no hits;
corrected immediately to packages/drivers/xai. No inference drawn from failed query.
The missing guessed separate adapter-test path was resolved by inventorying test
files; existing XAi.service.test.ts is the actual harness. All relevant source
reads bind to hashes below. No Graft graph wiring was edited.

Qualification proof: optional data at models:386 and boolean done at 387 allow
four presence/bit categories; successful writer at service:589/592 produces only
(done,absent) or (data,present); adapter:201-210 assumes that relationship.
JSON null is present data. Invalid JSON fails before event creation. The schema
is exported, but no persisted/wire event encoder was found beyond local tests.

## SHA-256 input bindings

- `goals/boolean-creep/GOAL.md`: `560a143a9a389f361a14c08d15818ab7fb988be6b85f4f403ee17cb64f2d188d`
- `goals/boolean-creep/SPEC.md`: `9df7ebe63b9c7c1e253892ff1b36600baa8b22f7c6598617e7e8995575ad5087`
- `goals/boolean-creep/DECISIONS.md`: `e6851a394568acf774d51b2d840635b8f4fbee200dd346d26bc82dbef624ea8d`
- `goals/boolean-creep/history/designs/2026-09-22-pre-refresh-xai-sse-done-payload.md`: `5752f91abbf5ba3f0677fcdbe68a3888233de65ec8bbb2f6029bb34f3e3d451b`
- `goals/boolean-creep/history/inventory/2026-09-22-post-phoenix-pre-sse-refresh.jsonl`: `3754e84cd4e85b46332468a60bab86c96a5e63ba513552a7b608c5dbd9f186e1`
- `packages/drivers/xai/src/XAi.models.ts`: `1f2d223ead2bc1d501dadee3153095a7d3d05d0fb32d7f5b9a5390cd579073d6`
- `packages/drivers/xai/src/XAi.service.ts`: `fe94aeac166efae741d048358f2555af0d33729bf498f7ff1606cc09ee95fd44`
- `packages/drivers/xai/src/XAiLanguageModel.service.ts`: `611bef1966ebaeedfec9b36e1659d305b8678980cc72c1d671468ecf2d93ca98`
- `packages/drivers/xai/src/index.ts`: `6610717811ff8f87a8472608f082808ad09b71017fee8506c97e23c476f1848d`
- `packages/drivers/xai/package.json`: `557a98a3424526719c18ed086d91857e137cf7885fd11876fdae2a2cf4d82d06`
- `packages/drivers/xai/test/XAi.service.test.ts`: `210e679a932c984b98109135f95b0fa65d17ae4ef6c43571167c7d6206665c75`
- `packages/foundation/modeling/schema/src/SchemaUtils/withLiteralKitStatics.ts`: `8359e2c68161e01fba2e93bbac6f5fc522cf869ca3c0fa6a20703509d883c707`
- `.repos/effect/packages/effect/src/Schema.ts`: `d72af65f80ee760c51b403fe2859ecf5a9c81b1697db99b71c9f52185bfa7325`

## Proposal SHA-256

- `proposed-design.md`: `820b897e4eda999220877ecfdffadc498b92fe372c8e1660919ad16c6ecc06a8`
- `proposed-row.json`: `f2d92e67e58e40cbb754ab37be2ce39341451462d6f16470f671730f35413ae3`

Parent integration: input digests verified before installing the refreshed design and stable-ID row. The before-inventory and before-design bindings above now name preserved archives. The inventory snapshot includes the already-integrated Phoenix refresh; these two owners were unchanged in it.
