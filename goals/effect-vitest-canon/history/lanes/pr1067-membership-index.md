# PR1067 membership index

Scope: invocation-local exact-key membership indexing in EffectVitestScan and appended contract regressions. Root owns timing and canonical artifacts.

## Implementation and focused evidence

Only `EffectVitestScan.ts` and appended `effect-vitest-contract.test.ts` changed. The scanner replaces the generic nested-search call with two invocation-local Effect HashSets of the existing membership keys. It filters the original keyed arrays against the opposite index, applies the same stable id order and returns original finding objects/counts. Indexing does not deduplicate output payloads. `membershipKeys`, full-key construction, exception, legacy and occurrence handling and the Project/discovery/validation path remain unchanged. The shared RatchetDiff is untouched.

The accepted static source/API/Graft investigation was reused; the installed public HashSet implementation and existing scanner-family usage confirm the exact-key API seam. Applicable Effect/schema guidance remains in force. No new helper, service, role file or public API was introduced.

Two regressions were appended after every existing test. All 274 existing assertion expressions and 91 source registration expressions remain exact ordered prefixes; 13 assertions and two registrations were added. Parametrized runtime total is **113/113 passing**, preserving all 111 prior cases. The entire previous contract source remains an exact byte prefix, preserving existing finding coordinates. `preservation.json` retains expressions and counts for all four suites.

Private `differential.json` records **64 complete ordered output comparisons** against the original comparator, over retained old 5016/adopted 8023/current 8023 arrays plus empty, unmatched/equal-id metadata, duplicate, legacy, changed-anchor and ambiguous cases. Comparisons use deepStrictEqual on entire result objects, not keys/counts alone; input hashes and zero drift are retained. The previous complete scanner module was copied privately with only relative import targets relocated to their original absolute paths; its scanner entrypoint was never invoked. Both directions and original multiplicity/order are compared. Existing and new exception regressions retain fail-closed reason transfer. The differential duration is harness execution including the old comparator, not a scanner benchmark or speedup claim.

Two private harness launches failed before comparison: incorrect Bun tsconfig flag, then an override resolver directory mismatch. Corrected private setup uses a local tsconfig extending the unchanged root and a private node_modules symlink to installed dependencies. No installation or repository configuration change. Initial Biome formatting findings were corrected; all failed receipts remain retained.

## Final-byte focused commands

Evidence root: `~/.cache/beep/effect-vitest-canon/pr1067-resume/membership-index/`. Each receipt preserves exact argv/cwd, terminal exit, elapsed wall time, log hash and all scoped input hashes before/after.

- `tests-final`: exit 0, 17.457s; log SHA256 `0fb6501844da0177e13359a2e16b3e00ca0deb8797a5506d5c1d7ef612c6b72c`.
- `compiler-final`: exit 0, 19.990s; log SHA256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- `biome-final`: exit 0, 2.762s; log SHA256 `9e31615e4d068393481de7c1c921373167763881af78e1b172dd4d77f88e9702`.
- `oxlint-final`: exit 0, 0.255s; log SHA256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- `differential-3`: exit 0, 12.324s; log SHA256 `bd555839506ba0fce16476a2c3b60fb24f4dea7ae1d7072ebe7cccafceddbf9f`.

`protected-functions.json` proves seven declarations byte-identical: membershipKeys, legacyFindingKey, occurrenceGroup, findingGroups, preserveEffectVitestExceptions, reportMembership and runEffectVitestLint. The 36-input candidate manifest has only the two authorized deltas; graph SHA remains `60fdc32c90c86d24db1ad8591a9b2ad602251b0b140db27626c85bdca14c18c6`. Full package verification is running; no package or timing acceptance claimed yet.

## Terminal handoff

Full `bun run beep quality package-verify @beep/repo-cli` **passed, exit 0**, 425.981s. Terminal stages: `ok audit 407.8s   ok docgen 16.5s`. Log SHA256 `e6eb64d0ee2c5f31b316aea5948a60be925a4bab46835ce9bab756b2c1c5a3bf`; exact argv/cwd and terminal status in `package-verify.receipt.json`. The successful CLI prints stage summaries rather than successful inner test output, so the directly retained exact focused count is 113/113; no new package-wide count is invented.

- `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestScan.ts`: before `e2bbe4b0529a4a385cb44b49601804c1b253e9ad4d8c9744487ef365c5b7ad8e`; final `898375646d16a0b849da63f70c675ccc9e6cc5bd41234ae62f7aa2335330554e`.
- `packages/tooling/tool/cli/test/effect-vitest-contract.test.ts`: before `1d36f1233c6b4a3ceb1f7eb4b247892f1333f163a86d005f6259bee224e382d4`; final `51a301a4ccdcd561a4c8c91d3cf39a25984c29e1c5eaf103ab71bbb4f7057807`.

All scoped inputs remained stable during package proof. `integrity.json` records no unexpected source or retained-payload drift. `owned.patch`, complete before/after snapshots, `after-hashes.json`, `preservation.json`, `protected-functions.json` and `manifest.json` provide exact provenance. The private node_modules entry is a resolution symlink only, not an installation.

No timing or scanner run was performed in this lane; no speedup, D4 pass, phase completion or publication acceptance is claimed. Root owns default-command timing, complete rows/census comparison, scoped coverage, Fallow/JSDoc and aggregate/hosted decisions. Installed Vitest 4.1.11 remains outside rc113’s declared >=5 <6 peer range; no dependency or policy qualification was changed.
