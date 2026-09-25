# Phoenix P2 refresh audit

Source HEAD: `dc852c92efdd7d259e3983ec30cd19cb9b4fd65d`. Owner output only; no tracked edits, implementation, package checks, or independent review.

## Findings

1. Qualification survives: E3 at service 522-529, 4/2 presence classes; derived/internal/Tier1. SDK returns nullable PromptVersion, so D2 is not applicable to the synthesized result.
2. Corrected test/model anchors; ai-metrics source promptVersionId at 4030 belongs to createPrompt writes, not read results.
3. Retained internal tagged encoding change on explicit absence-of-boundary evidence. Rejected an unnecessary compatibility layer after orchestration clarification. Private package alone is insufficient proof, and decoded migration authorization is not blanket encoded authorization.
4. Corrected overstated guard accounting: duplicated projection and unconstrained product are removed; no production coherence guard or explicit coherence comment exists.
5. Existing tests exercise injected SDK forwarding and arbitrary codec round trips, not the real nullable adapter mapping. Required implementation coverage separates these.
6. Proposed row resets historical reviewed status to designed because this owner refresh is not independent review; parent owns canonical status policy.

## Searches and scope

Used exhaustive Graft symbol/getPrompt searches plus callers closure; corroborated all packages/apps references and package export routes. Read both test writers and service forwarding, model documentation, arbitrary schema list and property test. No Phoenix integration directory exists. The installed SDK is supplemental local dependency evidence, not part of tracked source SHA.

## SHA-256 bindings

- `packages/drivers/phoenix/src/Phoenix.models.ts`: `d65c1297be41c3378bae043e6bda17d02f5a8e1bb8acf1067af597935c8bb8f2`
- `packages/drivers/phoenix/src/Phoenix.service.ts`: `79c92d2c3fdaefefd1ce4f9b2296e29095b1dbbed176f1c0acbeeb638d9548e7`
- `packages/drivers/phoenix/src/index.ts`: `b806d75e7f79febc99672e16c5b338f0f5963b061da129b64363bab186733ca3`
- `packages/drivers/phoenix/package.json`: `d443d45484d306cfedfbbe3711a458cbe57bc39bb5682ee7fe3b677bbd2de963`
- `packages/drivers/phoenix/test/Phoenix.service.test.ts`: `6a1d8a7f99d35df77136260627e885181f7cd0f68f27d1d976acac8840dfebeb`
- `packages/tooling/library/ai-metrics/test/agent-effectiveness.test.ts`: `281c45bedcfb4e5ac06a95416a1143d6b169332f395166eb1a3df1559d8392f4`
- `packages/tooling/library/ai-metrics/src/agent-effectiveness.ts`: `693da6ec2a00c1343fa0f800ac29d2fff7d287b829a920ae76275015eae2af3c`
- `goals/boolean-creep/history/designs/2026-09-22-pre-refresh-phoenix-prompt-read-exists.md`: `7de3ce190031e90cce829cd898d15ef6429bb0722182206471d1954509704dcb`
- `node_modules/@arizeai/phoenix-client/src/prompts/getPrompt.ts`: `32f9897c728066341f3c4804d890eac964fb3821b19b95c711f52ea466c6d8a0`
- `node_modules/@arizeai/phoenix-client/src/types/prompts.ts`: `5dfd4842ad248ebcfeffaaa754c8dd9718c1c76dc97daa4cc59ea561eb09aeb7`
- `node_modules/@arizeai/phoenix-client/src/__generated__/api/v1.ts`: `a4a5d9e929aa7f53a6fdfaec29f0b4be86d2cf72b5dfca2a2feda66f69dffe0d`
- `node_modules/@arizeai/phoenix-client/package.json`: `69aeb5af416874d5a61056a095a4dc068ac454d9398939400401a19d657901f5`

## Deliverables

- proposed-design.md
- proposed-inventory-row.jsonl
- audit.md

Graft estimated savings: 139,493 tokens across six calls.

## Schema helper correction

The private status kit is now unannotated before mapMembers. Union annotation precedes toTaggedUnion, preserving cases/guards/match. Inspected current local Effect Schema and withLiteralKitStatics implementation. Extracted updated sketch ran under Bun; both constructors and guards passed and match remained a function. This is runtime shape evidence, not package TypeScript verification.

- `proposed-design.md`: `7541c5ac15591bd7874fdba8c60bd0af26b6958a113ff0a24a4b1525c1a4b060`
- `proposed-inventory-row.jsonl`: `6efc4e116e5b1b6ac02ad129da89b6f92d47c0bd6b89233b83c2d58199762278`
- `schema-probe.txt`: `2b429f33fd404530009e3499ed8f4c094160763372fdb9a885ca1ed459c9283f`
- `packages/foundation/modeling/schema/src/SchemaUtils/withLiteralKitStatics.ts`: `8359e2c68161e01fba2e93bbac6f5fc522cf869ca3c0fa6a20703509d883c707`
- `.repos/effect/packages/effect/src/Schema.ts`: `d72af65f80ee760c51b403fe2859ecf5a9c81b1697db99b71c9f52185bfa7325`
- `packages/foundation/modeling/identity/src/Id.ts`: `635e866e5ea6c93dc69b0be8efba9cfda83ba7e83bcda5c0ffd59431289d141f`

Parent integration: source and proposal hashes checked; predecessor design remains in the bound archive. Refreshed row is designed, not independently reviewed.
