# SyncData target P2 audit

Source HEAD `0be1f13d62fa00cb65e34ff69ec99043380f8d81`; private artifacts only.

## Input hashes
- `input-inventory.jsonl`: `61f1f56bdfe47df11f3a7a916560e7983b04cb8370313d30793d91797bc08ed7`
- `input-design.md`: `1af843b60061f32f73fb74088d910b011d6bd52834bce14437863f6cf253dba5`
- `input-decisions.md`: `b9ad90280aa8b82394d221b6941427100c47536c53cf15496d5b15c12914d4eb`
- `packages/tooling/tool/cli/src/commands/SyncDataToTs/SyncDataToTs.command.ts`: `71d3c461cdad89ec8f771571bbb5b644ad402809c8aa1ed7cb95e1204da593e2`
- `packages/tooling/tool/cli/src/commands/SyncDataToTs/index.ts`: `87774ee432826d678987d9551967a66c95aa4a79d5e5998250379608dc5ae9a1`
- `packages/tooling/tool/cli/src/commands/SyncDataToTs/targets/index.ts`: `52ccadb599690b70c7e29f2e573a3c5ab93ba36c50d29f5d37a0106906c98cf1`
- `packages/tooling/tool/cli/test/sync-data-to-ts.test.ts`: `e819831b9cf0a1ac76f74068dab4b748705848ed22c8d643e74b819b031dfb4d`

## Findings
4/2 correlated pair; full carrier8/4 including independent includeAuthenticated. S.Option(String), not optional-key codec; defaults only raw CLI. Source resolver proves exclusivity and exact ordered errors. Existing tests do not cover full selection matrix; refreshed design expressly requires it.

## Coverage
Graft selection symbol search6hits2symbols1file; source1-145 and545-590, test829-949, wildcard barrel and ordered registry read. No other constructor/public export found. Graft13,765 tokens saved; initial incorrect scope returned no hits and was corrected.

## Validation scope
Eight headings and JSON parsing checked; full8-tuple finite enumeration4legal asserted. No source/canonical mutations, no network/command runtime, no package proof, no P3/census/dry credit.

## Output hashes
- `proposed-design.md`: `1465c0d9ddf9254ff77a7a013fa49e6ca149ebcf61c93201329f15c3f035fc4a`
- `proposed-row.json`: `2e8395a2cec25536e80a6ec09a247645b65a9177683aa9eae1e00bb1dbd30658`
- `finite-projection.json`: `16114d94392fbbcb77253b2c1384dede4e247edde30d5db9ae0a60803dfa0eaa`
