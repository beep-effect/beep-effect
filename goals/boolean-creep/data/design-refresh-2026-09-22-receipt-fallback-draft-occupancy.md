# P2 audit: receipt-fallback-draft-occupancy

Exact source: `f137beedb270a071d4aa2ecc1dd52a9d233044d1`.
Private artifacts only; no canonical packet or product source changes.

## Inputs (SHA-256)

- `goals/boolean-creep/SPEC.md`: `9df7ebe63b9c7c1e253892ff1b36600baa8b22f7c6598617e7e8995575ad5087`
- `goals/boolean-creep/DECISIONS.md`: `e6851a394568acf774d51b2d840635b8f4fbee200dd346d26bc82dbef624ea8d`
- `packages/agents/client/src/Chat.atoms.ts`: `88df970a7c96c51e5c4ab3fbd729135232a1019f657aae6a57fe7c8451170920`
- `packages/agents/client/test/run-turn-reconciliation.test.ts`: `d8e2aa5f7ecff76be42fbfae531e0be62ca039dbe0b0ac3f7bb969da57123e2e`
- `packages/foundation/modeling/utils/src/index.ts`: `bb0dad9961c5d8d878ee930b61e93c87412d53877e1a75638ec507ed70e61d76`
- `packages/foundation/modeling/utils/src/Option.ts`: `9058fcd6349a90f2ae7949250d5e6a1a324c2b140ada7d0f0cfe78e6b1d549c1`
- `.repos/effect/packages/effect/src/Option.ts`: `6304e49e82a88ea2176f0c273013562b3f0ce5a0b39020140a7166a23c78909e`
- `.repos/effect/packages/effect/src/Schema.ts`: `d72af65f80ee760c51b403fe2859ecf5a9c81b1697db99b71c9f52185bfa7325`
- `node_modules/effect/dist/Option.d.ts`: `72f73d9dc5af79a1ab7641ce937a9c48093a552a2b1e76fe2e6e0c27ecc8eeda`
- `node_modules/@typescript/native/package.json`: `3722b30210616a13a3213ded11575ba6b2dbab10c32a5ef67afca8513e27017e`
- `node_modules/typescript/package.json`: `9332e97c30d3e53ed54910b89207ed657fb444066484df6e5b6965bf130865e9`
- Private `inventory.start.jsonl`: `41bd12478546af93581a4ef6d1dc3493aae50930d49c3fcb254d43845f903171`
- Private `design.start.md`: `05d687a01342d185545ada759b82abc152d9187f4dafea5334a06db4cca36a83`

## Findings and proof

Retain6/3 qualification, internal stored Tier1 tagged-union target. Full exact owner and sole caller read; all6local references accounted for. Option helpers are direct upstream reexports through @beep/utils, so the private probe's upstream import matches the actual inferred generic. Both installed native TS7 and TS6 compile-only probes exited0 (strict/exactOptionalPropertyTypes/skipLibCheck/ESNext/NodeNext; native --ignoreConfig). They prove Option<boolean>, Some(false) admissibility, and true-only-control distinction. No emitted files, package tests or full-owner typecheck.

Retain post-I/O snapshot, serial receipt calls, identity (not requestId) association, exact fallback payload/document, first-only selection, later retention, and current-array filtering. No source false guard exists to delete; false is representable but unproduced. Some(false) would drop a candidate without selecting and cannot normalize to None. Remove the two Options and nested occupancy projections/read wall using one finite state, preserving all independent status/identity guards.

Strengthened target construction with private LiteralKit discriminator, annotated class variants, existing StreamingTurn payload, annotated union before toTaggedUnion, and no default-tag constructor input. Strengthened test distinction: current toStrictEqual assertions do not prove reference identity. Removed blanket QA exemption for atom-only edits; implementation must determine affected gestures and fulfill campaign QA requirement.

All8required design headings validated with anchored matches. No independent P3/census/implementation credit. Existing fixtures were inspected, not executed. No source changes and hence no package handoff verification required for this private design job.

## Deliverables (SHA-256)

- `proposed-design.md`: `d4924626241a4f36a66a083ce8b0dca49a885e0948134f1cb0075f57dc045106`
- `proposed-row.json`: `9efc914be5408c903b8b36c5f6108e5a7645c3bf2c39a9998b8a4b335e581b17`
- `probe.mts`: `fb16bc8018688c420e99ed08aebe2e26b060bcf1ed16a0c6b40b42c1317e0df4`

Graft saved50,462tokens across4calls in this job (one missing-path query produced no savings).
