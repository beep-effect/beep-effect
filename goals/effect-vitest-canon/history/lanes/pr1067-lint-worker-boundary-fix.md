# PR1067 lint-worker boundary fix

Owned source change: packages/tooling/tool/cli/test/lint-workers.test.ts only. Production environment/session behavior and canonical artifacts remain unchanged. Vitest 4.1.11 remains outside rc113’s declared >=5 <6 peer range; local proof does not resolve that qualification.

## Boundary evidence and repair

The Bun diagnostic reproduced the original failure: two intercepted `op run` probes with ignored stdio, then one session-wrapped dispatch, produced three mock calls. No secret command executed: the original StepExec mock intercepted every call. The isolated Node diagnostic passed, establishing runtime-dependent setup reachability rather than a universal dispatch failure. Sanitized evidence: `classification-bun.log` and `classification.receipt.json` in the private lane directory.

Only the test changes: a partial mock of EnvConfig preserves all original exports except `turboEnvironmentHealthWarnings` (empty warnings) and `canUseTurboCacheSecretSession` (false). Function types come from the existing source-only `@beep/repo-cli/test/SharedInternals` alias; the mock target follows the existing StepExec pattern. Production checks, caches, session wrapping and execution are untouched. All 58 original assertion expressions remain exact and ordered (`assertion-preservation.json`), including one-spawn arguments and failure propagation. No additional test duplicates these existing boundary assertions.

Initial focused compiler/Biome failures were introduced mock typing/import ordering and were repaired; final focused compiler and Biome pass. The first complete-file commands used repository cwd, causing package-relative `.` expectations to mismatch; these failed receipts remain retained. Correct package-cwd proof follows. Graft cards were consulted first; the known module/function omissions required targeted source reads. No graph refresh or token-saving estimate claimed.

The first root-cwd Bun run also exposed cache-posture drift: disabling the session alone downgraded actual remote-cache arguments while the expected plan retained remote reads. The final test mock additionally replaces the existing `readTurboCacheEnvironmentSync` seam with `readTurboCacheEnvironment({})`, using the real parser and a deterministic empty environment. This keeps the original full argument assertions meaningful and independent of ambient reference-backed cache configuration. No process environment is mutated. The package-cwd intermediate run passed all 21 tests; final-byte runs include the root-cwd standalone case that previously exposed both leaks.

## Final-byte focused receipts

Private evidence root: `~/.cache/beep/effect-vitest-canon/pr1067-resume/lint-worker-rc113/`. Exact argv, cwd, exit, wall time, log SHA256 and before/after hashes are in each named `*.receipt.json`.

- `stable-bun`: exit 0, 50.696s, log SHA256 `7089cb92479ce0065cf360939289ee5803353cc612219d7acb20fbcccdd9af4e`.
- `stable-root-dispatch`: exit 0, 6.731s, log SHA256 `f59dc649fe9936326d0bc45dd0a3e48b0e702029fa4ff6c20ab4f318d5e86f46`.
- `stable-tsgo`: exit 0, 11.849s, log SHA256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- `stable-biome`: exit 0, 3.044s, log SHA256 `ef1234d55dc726d56d07079421e235bfbb69b5d8badf72b97355c3d11aebfa52`.
- `stable-oxlint`: exit 0, 0.322s, log SHA256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

`stable-bun` ran the entire file: 21/21 passed. The root standalone diagnostic ran 1/1 selected case; its 20 name-filtered cases are covered by the complete-file run. Actual runtime versions and peer declarations are retained in `runtime.json`. Full package verification started; no terminal result yet.

## Preservation scope

`test-body-preservation.json` proves the complete file suffix beginning with `const platform = Layer.mergeAll` is byte-identical to the preimage. Thus every existing test, control, negative fixture, assertion, timeout and cleanup remains intact. `owned.patch` contains only imports and the partial environment mock at current lines 32–40. No production edit or ownership extension beyond the granted test file was needed.

The 35-input manifest covers the owned test, all current Lint source modules, Tasks, EnvConfig, StepExec and the canonical primitives graph. Interim comparison has 34 unchanged protected inputs and only the intended test delta. Root’s graph remains `e848ebeaf7ab5691a16a3a2ae450c2b1d2016bfebf1f06aac76d9a0447028bbb`. Original rc113 failed package receipts are separately hashed and retained. The already-green Root Fallow audit was not rerun.

## Terminal handoff

`bun run beep quality package-verify @beep/repo-cli` completed with **exit 0**, 568.437s wall: **audit 546.1s passed; docgen 19.8s passed**. Exact command, terminal exit and all 35 before/after source hashes: `package-verify.receipt.json`; log SHA256 `dc70c708a75ae459445efec6599af3dbc57643721bf96caf278a6c093b992b4f`. Inputs are identical across the complete package run. The successful CLI renderer prints only stage summaries (PackageVerify.ts:704–719); it does not retain successful inner test output. Therefore this receipt proves the full audit/docgen passed, but does not independently supply a new exact package-wide test count. The historical 3512-pass/1-fail count remains historical; the directly retained current complete lint-worker result is **21/21 passed**. No extra package rerun was launched merely to recover suppressed output.

Only changed source: `packages/tooling/tool/cli/test/lint-workers.test.ts`. Preimage SHA256 `0bf9250c12ddae02e055e26ca0ba607b6ad0d420a933c8932eae17442305573a`; final SHA256 `7ad7a15e86ffd29152c262699623c862026ad8fb8d8de2fc692bbbe478e4fcea`. All 34 protected inputs and prior failed package receipts remain unchanged. `final-integrity.json` records empty unexpected/historical drift; `after-hashes.json`, complete before/after test snapshots, `owned.patch`, assertion/body correspondence, command receipts and logs form the handoff. `terminal-manifest.json` hashes every private receipt/script/snapshot/log plus this report.

Remaining qualification: installed Effect/@effect/vitest rc113 with Vitest 4.1.11 is still outside the declared Vitest >=5 <6 peer range. Passing local tests/package checks is compatibility evidence, not a peer-range waiver. Root retains scoped coverage, canonical integration, hosted verification and publication decisions. No baseline, graph, dependency or configuration changes were made; no test/assertion was removed or weakened.
