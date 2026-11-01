# Inventory slice receipt (2026-10-31)

Branch `feat/hold-ledger-inventory` off `main` at `1620e88733`.

## Records

`hold-ledger/claims.jsonl` holds 30 live holds, one per decision rather than
one per config line:

| Kind | Holds | Sites anchored |
| --- | --- | --- |
| `syncpack-held` and `exact-pin` | 9 (statelyai, jsdom, fallow, ink, tstyche, the lexical family, the XML-validator pair, Biome, the tsgo + tsrs pair) | 12 held-list patterns, their catalog or manifest entries, and the `detailed-xml-validator` override |
| `override` | 14 | the other 16 root overrides (glob + minimatch and the two MCP SDKs share a hold each) |
| `patch` | 3 | all 3 `patchedDependencies` (the platform-node-shared hold also anchors its override) |
| `osv-exception` | 3 | all 3 `osv-scanner.toml` package overrides, leased to their recorded 2027-01-14 recheck |
| `version-group` | 1 | the infra TypeScript 6 syncpack version group |

Reasons and exits come from the 2026-10-17 hold register, the syncpack
comments they replace, and the PRs that added the 9 overrides the register
predates (#1928, #2158, #2176, #2182, #2373). `bun run beep holds lint`
reports `lint ok: 30 live hold(s) cover every site.`

## syncpack derivation

The held list moved from `syncpack.config.ts` to
`hold-ledger/syncpack-held.generated.json`.

- `bunx syncpack update --target=latest --dependency-types=catalog --dry-run`
  printed identical output (27 lines, 25 updates, no held package) with the
  original config and with the derived list.
- Control: the derived list without `statelyai` printed
  `statelyai 0.14.3 (~12d) → 0.19.0 (~1d)`, so the import governs the group.
- Trap found: an empty `dependencies` array matched every dependency (the run
  printed `No issues found` and held the whole catalog). The config now omits
  the group when the list is empty.
- `bunx syncpack lint`: `No issues found`.

## Lint behaviour

Unit and memory-filesystem tests in
`packages/tooling/tool/cli/test/Holds.inventory.test.ts` cover an unrecorded
override (fails with and without `--write`), an override removed from config
(orphaned; `--write` appends a `Retracted` tombstone `glob-hold@2` and the
lint passes after), a stale held list (rewritten by `--write`), malformed
`package.json` and `osv-scanner.toml` (decode errors), and the real
`holds lint` command.
