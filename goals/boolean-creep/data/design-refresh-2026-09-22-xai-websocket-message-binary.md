# XAI WebSocket P2 audit — 2026-09-22

Exact HEAD: `f137beedb270a071d4aa2ecc1dd52a9d233044d1`. Assigned owner only; no tracked changes. Full inventory and exact input row were snapshotted privately before source inspection in input-inventory.jsonl and input-row.json. Prior design preserved as input-design.md.

## Qualification and scope

Retain E3/E1, 12/3, derived internal tagged-union Tier 1. Declaration remains models469. Callback proof is service703-719, with binary literal at 705-709 and text literal at 713-718. Documented omitted-isBinary text constructors remain models458-461 and 520. Three optional-Boolean states times two presence axes yields twelve; evidenced tuples remain true/bytes, false/text, absent/text. Optional data is intentionally orthogonal and remains Option in the text member. The net is the historically admitted flag/payload owner; this does not broaden scanner policy.

This envelope is constructed by the driver; it is not an SDK wire mirror. The ws RawData/isBinary callback signature is external (installed @types/ws135,205) and remains unchanged. Close/error fields are outside the qualified three-member message cluster. Their permitted fields, codecs and writer objects remain unchanged. Search of source/tests/apps yields no other event consumer or persistence/serialization boundary.

## Substantive corrections

- Add explicit nested schema assembly, private kind kit, actual constructor-using nested runtime export, outer Base.mapMembers and annotate-before-toTaggedUnion helper ordering.
- Fix runtime schema imports; the prior service import is type-only.
- Preserve malformed JSON fallback, all JSON primitive values, empty text/bytes, binary content classification, synchronous queue ordering, close-before-end and nonterminating established socket error events.
- Cover raw data conversions, connect-error vs established-error distinction, cleanup/listener lifecycle and untouched outbound methods.
- Update current fixture anchors (106,316,372,383,434); require a public-service ws mock harness rather than making callback coverage conditional or exporting a test-only parser.
- Remove unsupported blanket patch-changeset instruction; canonical landing rules determine it later.
- Keep status designed (already designed); no independent P3/census/implementation credit.

## Bounded proof

A bun -e probe using installed effect/Schema and SchemaUtils.withNoneDefault decoded and re-encoded the proposed optional text data field. Output: omitted => None / own key false; explicit undefined => Some / own key true; null => Some / own key true. Exit 0. This is helper-level proof only; no proposed product implementation or package verification was run. Prior-turn source reading already verified local toTaggedUnion cases/match and required S.Unknown keys. Graft and exact search map the current three-file event surface.

## Input SHA-256

- `goals/boolean-creep/GOAL.md`: `560a143a9a389f361a14c08d15818ab7fb988be6b85f4f403ee17cb64f2d188d`
- `goals/boolean-creep/SPEC.md`: `9df7ebe63b9c7c1e253892ff1b36600baa8b22f7c6598617e7e8995575ad5087`
- `goals/boolean-creep/DECISIONS.md`: `e6851a394568acf774d51b2d840635b8f4fbee200dd346d26bc82dbef624ea8d`
- `packages/drivers/xai/src/XAi.models.ts`: `1f2d223ead2bc1d501dadee3153095a7d3d05d0fb32d7f5b9a5390cd579073d6`
- `packages/drivers/xai/src/XAi.service.ts`: `fe94aeac166efae741d048358f2555af0d33729bf498f7ff1606cc09ee95fd44`
- `packages/drivers/xai/src/index.ts`: `6610717811ff8f87a8472608f082808ad09b71017fee8506c97e23c476f1848d`
- `packages/drivers/xai/test/XAi.service.test.ts`: `210e679a932c984b98109135f95b0fa65d17ae4ef6c43571167c7d6206665c75`
- `packages/drivers/xai/package.json`: `557a98a3424526719c18ed086d91857e137cf7885fd11876fdae2a2cf4d82d06`
- `packages/foundation/modeling/schema/src/SchemaUtils/withLiteralKitStatics.ts`: `8359e2c68161e01fba2e93bbac6f5fc522cf869ca3c0fa6a20703509d883c707`
- `node_modules/@types/ws/index.d.ts`: `1ba59c8bbeed2cb75b239bb12041582fa3e8ef32f8d0bd0ec802e38442d3f317`
- `bun.lock`: `acba0f05d1f3c47cb1a67598f992b80a8b4b96dada74c267d810c2fb1e1e4794`
- Private `input-inventory.jsonl`: `de0477d42e7c44de5d1f41e869565bce230d2378542f9ed4d1785bf28f69cf38`
- Private `input-row.json`: `25a559921a524003de2b41e9bb93c65010ef6e975ce42cb8b15d1fba7487e8d2`
- Private `input-design.md`: `cb8005a9d4c6516bc749aa153eef279e06c5992ba0ef9322dccf18a6af662d56`

Parent integration: input hashes verified; starting inventory preserved at `history/inventory/2026-09-22-pre-knowledge-websocket-refresh.jsonl`. No implementation or independent-review credit.
