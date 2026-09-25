# Venice SSE P2 audit — 2026-09-22

Exact source HEAD: `dc852c92efdd7d259e3983ec30cd19cb9b4fd65d`. Scope: one design and proposed inventory row; private proposal only. No tracked writes or implementation.

## Findings repaired

1. Stale declaration/writer anchors refreshed to 636 and 1886.
2. Runtime `.match` requires value import; prior design incorrectly retained only type import.
3. Old terminal wording could induce early termination; actual DONE is emitted then skipped by adapter with continued upstream consumption.
4. Framing is assembled blocks, not isolated physical lines; preserve incremental decoding, flush, multiline/CRLF and indices.
5. Explicit error preservation and primitive/null JSON obligations added; missing-data defensive error alone is deleted.
6. Test map expanded honestly: no adapter suite currently exists, and new cases are obligations, not claimed executed tests.
7. Shared helper correction communicated by sibling audit: use local unannotated LiteralKit for mapMembers and attach toTaggedUnion after final annotation, avoiding statics loss and unnecessary kind exports.
8. Proposed historical reviewed row resets to designed because this is substantive P2 correction, no P3 credit. Qualification remains 4/2 derived internal tagged-union Tier 1.

## Evidence and proof

Read current GOAL/SPEC/DECISIONS and schema-first/Graft skills. Graft symbol search locates all event references in two source files and one test; broader package/app import search confirms no extra event consumer. Current local FileInfo.ts:145 supplies LiteralKit.mapMembers/Tuple.evolve/toTaggedUnion precedent. Local Effect Schema.ts:6030-6160 verifies cases and match helpers.

A bounded bun -e probe assembled LiteralKit data/done classes using S.tag/S.Unknown and verified `.cases` constructors fill tags, null payload remains data, and decode of missing data key returns Failure (exit 0). This proves helper behavior only, not compilation of proposed product edits. No package files touched; no package verification claimed.

## Input SHA-256

- `goals/boolean-creep/GOAL.md`: `560a143a9a389f361a14c08d15818ab7fb988be6b85f4f403ee17cb64f2d188d`
- `goals/boolean-creep/SPEC.md`: `9df7ebe63b9c7c1e253892ff1b36600baa8b22f7c6598617e7e8995575ad5087`
- `goals/boolean-creep/DECISIONS.md`: `e6851a394568acf774d51b2d840635b8f4fbee200dd346d26bc82dbef624ea8d`
- `goals/boolean-creep/history/designs/2026-09-22-pre-refresh-venice-sse-done-payload.md`: `4f124d75f092874b38426e5cd877272cd905091eedabfa75e8370521cd9b82eb`
- `goals/boolean-creep/history/inventory/2026-09-22-post-phoenix-pre-sse-refresh.jsonl`: `3754e84cd4e85b46332468a60bab86c96a5e63ba513552a7b608c5dbd9f186e1`
- `packages/drivers/venice-ai/src/VeniceAI.service.ts`: `0d3eb813bf472eaa0cc316fae5f4e9b687bb0c495d88461206e3c5415ea60bfa`
- `packages/drivers/venice-ai/src/VeniceAiLanguageModel.service.ts`: `054b3871287e822852a87adb76bec12cf6fa411cb6b1a7e543f3b4d49b1610fe`
- `packages/drivers/venice-ai/src/index.ts`: `1a80cfba61703695b2fe2ce0c3b433ce15fef9c21658dc012c42223a6c11e827`
- `packages/drivers/venice-ai/test/VeniceAI.service.test.ts`: `79467d23f1a27410d2d64696ceec9a058da21772df38a5f68509abe0509f80d6`
- `packages/drivers/venice-ai/package.json`: `37478aee8c5232da50eb1344fa2b85395e5ad32f7d008c09e1907dc54b61f5e2`
- `packages/foundation/modeling/schema/src/FileInfo.ts`: `58c61de01adf480bbeb307c78d4120b3e68ce5f49ae58c62b776140b56293763`
- `.repos/effect/packages/effect/src/Schema.ts`: `d72af65f80ee760c51b403fe2859ecf5a9c81b1697db99b71c9f52185bfa7325`
- `bun.lock`: `86468ca897163c9a31896a088a2869804f8e0e3e1d198f8e1893876922a6b48e`

Inventory row input SHA-256 (exact line excluding newline): `7fe2f9f0bae469d003a4250769fe7d04cb365c26d1250ce4b80863782053e25b`.

Parent integration: input digests verified before installing the refreshed design and stable-ID row. The before-inventory and before-design bindings above now name preserved archives. The inventory snapshot includes the already-integrated Phoenix refresh; these two owners were unchanged in it.
