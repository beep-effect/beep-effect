# P0.5 copy contract correction

Status: exact correction applied; focused Node/Bun proof and canonical scratchpad command passed.
Promotion and publication are not authorized by this lane.

Authorization is the user's original D8/P0.5 requirement to pass the exact pinned
rc.112 conformance suite. Root clarified that its additional copy-choice question
was not a user requirement. No consent is inferred from elapsed time.

Only the proposed two-file scratchpad correction, this report and newly owned
private proof artifacts may change. Other source, prior evidence, packet state,
manifest/lockfiles and all PR operations remain outside this lane.
Session filesystem access is unrestricted and approval policy is `never`;
no managed workspace-write/on-request mismatch is present.

## Fresh context and exact correction

- Source worktree: `../effect-vitest-filesystem`; all source/test commands run there explicitly.
- Read Root's proposal patch/JSON; both current source hashes matched its preconditions.
  Proposal SHA256: `158a4f1f69aca9747bd0a764a4b576a5d356afa2718ed21f71fb0bc55b4b9c94`.
  Its historical pending-choice status is superseded by the current D8 clarification, not edited.
- Applied exactly two source-path explanatory comment changes and `alreadyExists(method, fromPath)`
  in `scratchpad/memfs/internal/volume.ts:1352`; no sibling conflict arm changed.
  The sole live call remains public `copy` (now `volume.ts:1439`).
- Changed only the regression title (`MemoryFileSystem.test.ts:132`) and expected source path
  (`:146`). Failure, `AlreadyExists`, and destination-content assertions remain intact.
- New private config `.beep/p05-copy-contract-proof/vitest.config.mjs` selects exactly the
  existing 21-case Memory wrapper, 17-case regression file and unchanged 12-case characterization.
  It uses the established single-worker routing and a new private cache; no timeout/global config change.
- Evidence directory: `~/.cache/beep/effect-vitest-canon/p05-copy-contract-astra-YoHIVi`.
  Fresh before manifest covers 912 files; exact pre-edit source snapshots are retained there.
- Package interface inspected: `Quality.command.ts:3283`, `internal/PackageVerify.ts:288,442,492`.
  Full mode runs available `beep:audit` and `docgen`; scratchpad has only the latter.
  Audit/closure-build are therefore skipped by the canonical implementation, not by a lane option.
  Yeet skill is used only for package handoff; no publication or repair flow is invoked.

## Proof progress and friction

- The first Node run wrote `node-run-1.json`. Its tool-result capture then failed with
  `failed to serialize JavaScript value: expected value at line 1 column 1`.
  This is receipt/harness friction, not an attributed source/test failure. The JSON is preserved;
  no assertions, configuration or source were changed in response. Exact command/worker exit
  receipt will be recovered with an output-safe wrapper if the retained JSON cannot supply it.

- Retained first Node JSON: success, 50/50 passed, zero failed/pending/todo.
  A single unchanged repeat recovered exit 0 and the worker console; first evidence remains intact.
  Cause: orchestration tried to serialize an absent session handle before saving the completed result.
  This was not a Vitest failure. No further focused reruns are needed.

| Actual Vitest worker | Conformance | Existing regressions | Unchanged characterization | Total / skipped | Exit |
| --- | --- | --- | --- | --- | --- |
| Node v24.20.0, Bun absent | 21/21 | 17/17 | 12/12 | 50/50 / 0 | 0 |
| Bun 1.4.2 | 21/21 | 17/17 | 12/12 | 50/50 / 0 | 0 |

- Both run Vitest 4.1.11, not `bun test`, with rc.112 dependencies. Worker console identifies
  Node's executable and Bun's 1.4.2 executable; Bun's `process.version` compatibility string is
  v26.3.0, not a separate Node runtime. Both report locale `en-US`.
- Memory wrapper calls public `testLayer(MemoryFileSystem.layer)` without options;
  `accessOnDirectory` and `tempFileScopedRemovesDirectory` both retain default `true`
  (`FileSystemConformance.ts:62–73`). All 21 case names/results are retained in the JSON.
- Raw verbose output and worker identity: `node-run-2.log`, `bun-run-1.log`; results:
  `node-run-1.json`, `node-run-2.json`, `bun-run-1.json` in the evidence directory.
- Canonical full `package-verify @beep/scratchpad` completed with exit 0; no `--quick` or repair option used.

## Commands and canonical handoff result

All commands below use the source worktree and this command-scoped prefix:
`PATH="$HOME/.local/share/mise/installs/bun/1.4.2/bin:$PATH"`.
The exact expanded commands and hash inventory command are retained in `commands.txt`.

```sh
node --version
bun --version
bun run beep quality package-verify --help
node node_modules/vitest/vitest.mjs run --config .beep/p05-copy-contract-proof/vitest.config.mjs --configLoader native --reporter verbose --reporter json --outputFile "$copyProofDir/node-run-1.json" --no-color
bun node_modules/vitest/vitest.mjs run --config .beep/p05-copy-contract-proof/vitest.config.mjs --configLoader native --reporter verbose --reporter json --outputFile "$copyProofDir/bun-run-1.json" --no-color
node node_modules/vitest/vitest.mjs run --config .beep/p05-copy-contract-proof/vitest.config.mjs --configLoader native --reporter verbose --reporter json --outputFile "$copyProofDir/node-run-2.json" --no-color
bun run beep quality package-verify @beep/scratchpad
```

`copyProofDir` above abbreviates the evidence directory already identified; actual commands use its literal path.
Full canonical command exited **0**: `skip audit   ok docgen 22.4s`.
No `beep:audit` exists in `scratchpad/package.json`, so no audit/upstream closure-build ran.
This is the verifier's actual coverage, not full package audit/check/test proof or a waiver.
No inherited package failure was reported and no P0 acknowledgment, repair or wider package command was made.
Root's prior test-utils/repo-cli verification remains separate.

## Integrity and next prerequisites

| Authorized file | Before SHA256 | After SHA256 (exact proposal match) |
| --- | --- | --- |
| `scratchpad/memfs/internal/volume.ts` | `06db3607f02b7a5434914a6179b5914910c6eb5ee5a1373b872216bdeea6d30f` | `3263694ece7deb17136ac0602e2b93d4cade06393e1d29cac1cadc56701c6084` |
| `scratchpad/test/MemoryFileSystem/MemoryFileSystem.test.ts` | `8854f8286f63808e4a15183aa8a9d9fe50521edba39b5a2bdfc3d38223ea8bb3` | `302436cd5f9d3fee057c76dbf980841d7d6c8b1000ce754ae0c8bfb9ca81dacb` |

- Fresh `source-before.sha256` / `source-after.sha256`: 912 records each, **exactly 2 changed,
  910 unchanged, no added/removed inputs**. Includes remaining memfs source/facade/barrel,
  existing tests, current test-utils/repo-cli trees, manifests/lock/configs, prior private configs/suite,
  pinned conformance file, proposal files, Bun platform patch and installed platform source/dist.
- Pinned 435-line upstream conformance remains `8725010039e5ef2cee8b9b4fbcdb076f4099e8a44fe393a8e032c5fd89808abe`;
  current conformance helper remains `7a088666d2734dbc27089e8d5a4faac36c79787b01f069c20baab7a3d824922e`;
  unchanged 12-case suite remains `ff4f2527d00374b00b2087e32e335dd01c2b59108444dd785a0b75d80cce118b`.
- New cache snapshots retain before/after engine/regression, unchanged characterization/conformance/wrapper,
  private config and machine-readable `proof-summary.json`. Previous raw proof is not rewritten.
- Only the authorized path metadata changes. Typed failure, defaults, destination bytes, all conformance
  assertions, other conflicts and core behavior remain guarded; no suppression/remapping/bypass was added.
- Root must confirm this green current-core proof before separately owning schema/helper extraction and the
  curated public `make`/`layer` promotion. Re-run conformance/regression/characterization on the promoted
  public boundary, then destination package/compiler/architecture/export/docs and PR gates remain required.
  No scratchpad deletion, facade promotion, phase-state change, source adoption elsewhere or merge occurred.
