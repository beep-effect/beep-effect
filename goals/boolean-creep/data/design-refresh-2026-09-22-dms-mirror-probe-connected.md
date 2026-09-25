# DMS probe P2 audit

HEAD `0be1f13d62fa00cb65e34ff69ec99043380f8d81`

## Input hashes
- `input-inventory.jsonl`: `54567b68b5b6349d42f854462321583f5e626e63639b9835ddeb65f63eb59372`
- `input-design.md`: `e399b4a730d707516cc315d43229687f18eec2e18a558f19abba1a00188b2fb4`
- `input-decisions.md`: `b9ad90280aa8b82394d221b6941427100c47536c53cf15496d5b15c12914d4eb`
- `packages/documents/use-cases/src/aggregates/Sync/DmsMirror.ts`: `4ba8bec7124ed7e4e540c65dc2e256364cd5c7bb9847a0b36dc4776e115542cb`
- `packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts`: `8f2a9d1dfbf1176870c7c52d1f6a31d62c28664e20265d7275f01f3923bba34d`
- `packages/documents/server/src/aggregates/Sync/DmsMirrorFixture.ts`: `9b5a48704ad296daf4506069fbd90b248e22554903e4bce7d488df6c131e6d04`
- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts`: `abba2373867fa544580b30ed6e99b43b21fdbdb47d3c5e49199ebd80244b4249`
- `apps/professional-desktop/src/sync/DmsMirrorDisconnected.ts`: `440ea4b7dbc6b8ecc98c1a1cd59a29f2ee4ed7807b7ebe48bdbb8f608f874716`
- `packages/documents/use-cases/src/aggregates/Sync/server.ts`: `fa1e9218fe5bda16976dd561050eff5dad991bd82356659b067e5d7fd739b160`
- `packages/documents/use-cases/src/public.ts`: `facd6d6e45239448cf38a34b0a8ed0bcd5123035dd610b5a6ac97a6e1e276572`
- `packages/documents/server/test/DmsMirrorBox.test.ts`: `9cc7a8bebc424f13d7c9b3397763728a2913519cd8df10198185c8cce8df6948`
- `packages/documents/use-cases/test/Sync.test.ts`: `0fb11edab64c064c7077732471363d98c4b519cb11780d6d1503270e62bbef23`

## Parent review correction

The exact source says reason when adapter knows why; no explicit exclusion of
disconnected None was found. Root docs only distinguish resolved/unresolved;
no explicit disconnected/root prohibition found. Current producers do not prove
those combinations illegal for the exported port. Parent agreed to qualify only
connected/reason12/7, preserve root independently, full carrier24/14. No owner
hold needed for preserving documented optionality. Supra/Vault agent informed
that Option reason passes unchanged and root remains probe-only metadata.

## Validation scope

All24 carrier strata enumerated;14 legal. Qualified cluster12/7. Eight required
headings checked; JSON parsed. Original proposal/audit/table retained verbatim
with pre-parent-review prefix. No product/canonical writes, runtime/provider
calls, package proof or independent P3. Additional Graft5105 tokens saved.

## Output hashes
- `proposed-design.md`: `617f0bb125503c1d5ab78e4d5b9be36b9831cb0e74851eb3f9ee7a9c85feb68c`
- `proposed-row.json`: `91ac98e825e1e305f3fb2f0f386f4d6902bf8bcf83d7e131ef78366268fe180f`
- `finite-projection.json`: `8c86ee8b3491da46220bab7c0ccb672106b1cc53d13432df8aaad5a87c3bedbe`
- `pre-parent-review-proposed-design.md`: `37a96c9f63c905487a794bcc4447dc3ab4bb2d9b5ec181658ff7012c31617698`
- `pre-parent-review-proposed-row.json`: `f8867c17f378d1a692899bc56c8f7c8a60521b79cc289a5e4626a76b7c246751`
- `pre-parent-review-audit.md`: `c374ce532d089613de6843e1aa5754c7ce6b661fb7c136be0bfe228fcb540968`
- `pre-parent-review-finite-projection.json`: `9a9fbb833743a90e0ac990f6df16cedd3b60f7028ed454adb25f86a29bf270d5`
