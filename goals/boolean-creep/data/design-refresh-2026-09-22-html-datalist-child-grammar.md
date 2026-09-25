# Datalist P2 audit — 2026-09-22

Source HEAD `f137beedb270a071d4aa2ecc1dd52a9d233044d1`. Private inventory and design snapshots taken before inspection. No tracked changes or product edits.

## Result

Retain 4/3 E4 derived internal LiteralKit Tier1. Status already designed, stays designed. Exact owner is datalist callback1894-1910; optionMode1895, mixed1896-1906, sole reader1907. SignificantText1761 is separate shared preprocessing, not a third member. Callback receives original direct children and sequenceTags filtered only for script/template. No schema narrowing is authorized.

## Corrections

- Refresh shifted owner/evidence/consumer/test anchors.
- Repair the recipe's annotated LiteralKit helper retention with private Base plus SchemaUtils.withLiteralKitStatics; prevent gratuitous public or cross-grammar domains.
- Replace imprecise foreign-only child-model failure statement: its acceptance depends on effective tokens; div-only is the verified negative witness. Preserve inspectChildModel independently.
- Bind exact current public diagnostics and nested issue ordering with executed probes, preserving valid and invalid constructed AST inputs and distinct conform Failure.
- Keep parser behavior outside these proofs: no assumed parser repairs or domain rejections. No parser exists at the initially guessed paths; those Graft queries were misses, not evidence of domain behavior.

## Probes and limits

First probe failed before execution because Text was mistakenly imported from Html.model. Corrected import is @beep/html/Html.nodes, as existing fixtures show. Corrected eight-case probe exited0 and nested-path/conform probe exited0; their outputs are transcribed in proposed-design.md. No product tests, package verification, semantic equivalence of an implementation, independent P3 or census credit claimed. GOAL/SPEC/schema skill and Graft routing reused from this session. Full package verification remains a future implementation obligation.

## Input SHA-256

- `packages/foundation/modeling/html/src/Html.conformance.ts`: `7a9ca39b11ca3f85d426f826392150d4874d2a34c63c1b0f689906f676e3eac2`
- `packages/foundation/modeling/html/src/Html.model.ts`: `5428e2ac37c33acb85fb917fb7fefefe8b57c640eec97a122c47d2405f40f4bc`
- `packages/foundation/modeling/html/src/Html.nodes.ts`: `bf1664dc3b7b7f97902931c58fb24efc3e4ab784ac7ad7fc295e163c78fb1c8f`
- `packages/foundation/modeling/html/src/Html.attributes.ts`: `7a815ef355d229d005ffc62f836e1ed222865d7cd92380615a69a371f9be0956`
- `packages/foundation/modeling/html/src/Html.ts`: `1b5930ab143cc927004c2b187252942296dc1fe81a958f83a09fa15f80978507`
- `packages/foundation/modeling/html/src/Html.policy.ts`: `4af40842772dcc9b62430f626d37ba060a4b65e99b518aca958b761133136a91`
- `packages/foundation/modeling/html/src/Html.serialize.ts`: `83aefea28353387811da26bc4f3e2bb07ad101689ac2a8a93906f47173cc0c4d`
- `packages/foundation/modeling/html/src/index.ts`: `95dedf64877863567cd2ded17968a5e55b644c85e230d5eb4a7c2ceec4d2eace`
- `packages/foundation/modeling/html/test/Html.coverage-matrix.test.ts`: `0db5336ab1f8da499653009fb5c550dda7c2073ebd10fee2cfa2e224c3743008`
- `packages/foundation/modeling/html/test/Html.conformance-hardening.test.ts`: `58f42d7b9fe570a355184e09c105487027834ea5254fb017749ccb09982a9ce1`
- `packages/foundation/modeling/schema/src/SchemaUtils/withLiteralKitStatics.ts`: `8359e2c68161e01fba2e93bbac6f5fc522cf869ca3c0fa6a20703509d883c707`
- `goals/boolean-creep/GOAL.md`: `560a143a9a389f361a14c08d15818ab7fb988be6b85f4f403ee17cb64f2d188d`
- `goals/boolean-creep/SPEC.md`: `9df7ebe63b9c7c1e253892ff1b36600baa8b22f7c6598617e7e8995575ad5087`
- `goals/boolean-creep/DECISIONS.md`: `e6851a394568acf774d51b2d840635b8f4fbee200dd346d26bc82dbef624ea8d`
- `bun.lock`: `acba0f05d1f3c47cb1a67598f992b80a8b4b96dada74c267d810c2fb1e1e4794`
- Private `input-inventory.jsonl`: `22189fe9ecc326fadf0bb1d0743b903e297894acfb8aadd853b4f4a9e8826917`
- Private `input-row.json`: `4c462b18b12c8efcde9ae862cf0cac6ba6778246e719e3e7940cb20d63b81abe`
- Private `input-design.md`: `90e2c0feb53716e8cfebf9f4d940e4feef19a18dbb5685cb8bbee195c1da8e6d`

Parent integration: verified input hashes; starting inventory is preserved at `history/inventory/2026-09-22-pre-html-refresh.jsonl` and previous design at `history/designs/2026-09-22-pre-refresh-html-datalist-child-grammar.md`. Source qualification checked against the owner's current grammar branch. No independent P3 credit.
