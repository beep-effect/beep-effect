# Bin dispatch P2 audit

Source `0be1f13d62fa00cb65e34ff69ec99043380f8d81`

## Input hashes
- `input-inventory.jsonl`: `a855479f1664aa3ec732645113bb91f637095e2115cc65ec9260d76a82965178`
- `input-design.md`: `9adcc317b5a107c5148eedbfdc85d5b2102e14a4a9a6fc30ea1fe0a851505536`
- `input-decisions.md`: `b9ad90280aa8b82394d221b6941427100c47536c53cf15496d5b15c12914d4eb`
- `packages/tooling/tool/cli/src/bin-main.ts`: `7dd304115bcd6c8ac3e48f77e249b041f231e342abbf69dd4b126aef64077474`
- `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts`: `c64ec0e4b0113fe376cdc8a55cff5b0db6f45da6026c8eab6271197a77d92124`
- `packages/tooling/tool/cli/test/lint-subcommand-allowlist.test.ts`: `bd47faf04e65c78ae94e57dca1aefddfdb6cc24570db6701cac3d73d585ae2fb`
- `packages/foundation/modeling/schema/package.json`: `481d5f0f9c26dc8f5a26444dab51faf966522cb48c9c622fa3f01772762262af`

## Findings
4/3 retained by explicit mutual exclusion. Current route anchors225/248/272 moved by new failure/teardown behavior. Preserve that behavior and startup import allowlist, argv literal parsing, parser None only fallback, all layers and scoped execution. Existing schema package narrow LiteralKit export210 verified.

## Validation scope
Exhaustive whole-source search9hits3symbols1file for route predicates/flags. Tasks parser and startup AST tests inspected. Four tuple table3legal; eight headings. No entrypoint import/execution, benchmark, product/canonical edits, package proof or independent P3. Graft44,552 tokens saved.

## Outputs
- `proposed-design.md`: `737bc13042d15d0c62a79fc31d4250c586a44f65a97a75cc00b3f12a98006013`
- `proposed-row.json`: `b98c9452da7e11d533262fa6b2a292340ccbd9a4e135bbe3ba33415672b287b8`
- `finite-projection.json`: `9315c1901338e842012af6a77fada157a1a0b5dc42d237c2992233e829c41799`
