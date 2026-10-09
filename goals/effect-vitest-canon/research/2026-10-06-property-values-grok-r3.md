> Sanitized retained independent Grok round 3 source review. Its statements about pending proof are dated reviewer observations, not the final qualification state. See [current proof](cli-property-values-proof.md) for subsequently completed R3 evidence. No raw stream or machine/session metadata is published.

# Property-values round 3 review

No new P0 or P1. The still-open launcher-detection P1 is closed on the round-3 snapshot. `compilerArguments` returns `Option`, and an unrecognized command prefix stays a conservative lexical tripwire. This review does not accept the goal. The running full-file, typing, and full-package requalification were not read and are not a pass. The earlier full-package audit remains proof of the round-2 source only.

## P1 disposition

Closed. The round-2 waiver of `nice`, `command`, and `yarn exec` does not stand. Those three, plus `nohup`, `timeout`, `corepack`, and a custom wrapper, are old compiler catches that the round-2 predicate returned false. The round-3 predicate returns true.

After file: `review-r3/after/single-project-emit.test.ts`. `compilerArguments` is lines 76–117. An unrecognized command returns `O.none()` at lines 111–113. `usesSubgraphBuilder` is lines 122–159. `O.match` at lines 125–145 sends `None` through the token-bounded tripwire at lines 127–131 and sends `Some` through the exact `-b` / `--build` / `--force` check, which still stops at the compiler's own `--` (lines 136–138).

Independent execution of the snapshot functions, bound to the worktree's Effect `Array`, `String`, `Option`, and `pipe`, against the round-2 predicate:

| Line | Script | Round 2 | Round 3 |
| --- | --- | --- | --- |
| 239 | `nice tsc -b project` | false | true |
| 240 | `command tsc -b project` | false | true |
| 241 | `yarn exec tsc -b project` | false | true |
| 242 | `nohup tsc -b project` | false | true |
| 243 | `timeout 30s tsc -b project` | false | true |
| 244 | `corepack pnpm exec tsc -b project` | false | true |
| 245 | `custom-compiler-wrapper tsc -b project` | false | true |

`parent-launcher-repair/r1-before-node-predicate-controls.json` parses as 61 rows, 7 failures, and no other failures. Each of those seven has `expected: true` and `actual: false` against round-2 source `cb58660a6cddd8399d6591c9225953f81f62941e5afc1ffc0cf105a4d506d4fe`.

The same execution returns true for the added nested forms at lines 246–249: `sh -c "tsc -b project"`, `sh -c "tsc -b"`, and `custom-compiler-wrapper "tsc" -b project`. The tripwire matches a compiler token and a build flag bounded by whitespace or quotes. It does not evaluate the shell program. That matches the comment at lines 119–121.

## Contract check

`Some` means the command prefix is a known compiler, a known launcher, or a known inert command. `None` means the prefix is unrecognized, and the whole simple command stays under the lexical tripwire. That keeps unknown wrappers on the old conservative side without listing every wrapper.

Known inert commands stay false. Lines 109–110 return `O.some([])` for `echo` and `printf`, so the tripwire does not scan their arguments. Confirmed false: `echo "tsc -b"`, `echo 'tsgo --force'`, `echo tsc -b`, `echo "ready && tsgo -b"`, `printf tsc -b`, and `printf "tsc -b"`.

Known launcher script names and option operands stay false. Confirmed false: `bun run tsc -b`, `pnpm run tsc -b`, `npm run tsc -b`, `bunx echo tsc -b`, `npx --package tsc echo -b`, `pnpm --filter tsc exec echo -b`, `env -u tsc echo -b`, and `env FOO='tsc -b' echo ready`.

Known compilers and known launchers still use exact flags and compiler `--`. Confirmed false: `tsc -- -b`, `bunx tsc -- -b`, `pnpm exec tsc -- -b`, `other-tsc -b`, `nottsc -b`, `tsgo -p tsconfig.json --forceful`, and `npx --no-install tsc --forceful`. Confirmed true: the previous direct forms, including `tsgo --build`, `tsc "-b"`, `tsgo '-b'`, and `tsgo -b tsconfig.json && bun run beep:check:tests`.

`command -v tsc` and `command -V tsc` (lines 221–222) are false because those simple commands have no bounded build flag. `command tsc -b project` is true.

Every round-2 fixture string is still present with the same expected boolean. The round-3 file adds cases. It does not drop or flip a previous assertion. All 91 fixture strings in the four `it` callbacks match their titles: 13 true, 17 false, 41 true, 20 false.

`deletesOwnEmit` (line 164) is still `Str.includes("rm -rf dist")`. `emitScriptsOf` still reads only `beep:build` and `beep:check` (line 170). The manifest test still requires more than 100 manifests (line 178) and remains the `it.effect` at line 312.

A Node walk of `packages/` and `apps/`, using the same `node_modules` and dot-directory skips, found 148 manifests and 282 `beep:build` / `beep:check` scripts. The round-3 predicate returned false for every one. That walk is not the Effect `FileSystem` walk inside the test, and the parent full-file run is still in progress.

Runtime calls match installed Effect. `O.match(option, { onNone, onSome })` is the data-first dual (`Option.ts` example `Option.match(Option.some(1), …)`). `A.join(words, " ")` is the data-first dual (`Array.join(["a", "b", "c"], "-")`). `A.contains`, `A.drop`, and `A.last` are unchanged from the round-2 calls. `@beep/utils` re-exports `effect/Array` and `effect/String`. Execution used the worktree `effect/dist` modules. The quote strip still uses `$2`, and `tsc "-b"` returns true.

## Examined edges, no source follow-up

These match the written split between `Some` and `None`. They are not P0 or P1, and they are not a request to change this source.

- `nice tsc -- -b` is true. `tsc -- -b` and `bunx tsc -- -b` are false. The `None` tripwire does not apply the compiler `--` rule. Known commands still do.
- `sh -c "echo tsc -b"` and `nice echo tsc -b` are true. Bare `echo "tsc -b"` is false. The tripwire scans nested text inside an unrecognized prefix and does not parse an inner inert command.
- `yarn run tsc -b` is true because `yarn` is unrecognized. `bun run`, `pnpm run`, and `npm run` stay false because those launchers return `Some([])` for a script name.
- `$(tsc -b)` stays false. The token has no bounded `tsc` / `-b` pair. That is outside this tripwire.
- `rm -rf distro` still matches the original `rm -rf dist` operand. `infra/package.json` `beep:check` is still `tsgo -b tsconfig.json && bun run beep:check:tests`. The predicate returns true for that string. The walker still starts at `packages` and `apps` only. Neither behavior changed in this repair.

## Controls and hashes

Parsed control records, not a package proof:

- Before Node JSON: 61 rows, 7 failures, all seven commands above, source `cb58660a…` (round 2).
- Intermediate after JSON: 61 rows, 0 failures, source `8a90c5e0c8f771181e9f3366048231b06bbfe684bd9a9ad6ae9ec1f74a54fad5`. That digest is not the reviewed snapshot.
- Final Node and Bun JSON: 64 rows, 64 passed, 0 failed, source `330fd60bf82946bbb81d1b3ed1d7c0846da94f63747992c0a98571fe1b76f25d`.

Recomputed SHA-256. Round-3 snapshot, live property-values checkout, and the round-3 manifest agree. Seven files match the round-2 after bytes. Only `single-project-emit.test.ts` changed.

| File | Round-3 / live | Versus round 2 |
| --- | --- | --- |
| `codex-findings-csv.test.ts` | `7793a562fdc76075ceabdc09ac9efbe2304da627f1ebc1d07ae5d22b9122125d` | same |
| `codex-findings-normalize.test.ts` | `10f49c562aac018828fe67de623ec950350028393145f1dbcd58fe5a22b1efa3` | same |
| `effect-vitest-contract.test.ts` | `c9a95e7032048f12ef3d69f8fdac34914a0a1a160905d39bc98dce25f97468b7` | same |
| `effect-vitest-store.test.ts` | `a98843b0f9e577a3e84a1c363c1b3f7359bbc71439b03aca1f0932446526c05e` | same |
| `qa-pure.test.ts` | `f30b444a30676bbdfa4524adf6e5c08197b51e1d9bdee57fd7b3b455fe9456f7` | same |
| `ratchet-diff.test.ts` | `32650494d17f08fe59a12327f5273d7dca9221e1c4305ff374e710793642717b` | same |
| `single-project-emit.test.ts` | `330fd60bf82946bbb81d1b3ed1d7c0846da94f63747992c0a98571fe1b76f25d` | `cb58660a6cddd8399d6591c9225953f81f62941e5afc1ffc0cf105a4d506d4fe` |
| `RatchetDiff.ts` | `e52e1e688a1471146643c6633a5f19c7cc02c61107f8e1585c3c46b06f4fb6c4` | same |

`review-r3/source.diff` contains all eight paths. The seven unchanged digests mean those paths are the already-reviewed batch. `RatchetDiff.ts` is still the JSDoc-only file from round 2.

## Scope

Read the round-3 `single-project-emit.test.ts`, the round-2 predicate, `review-r3/source-hashes.json`, `review-r3/source.diff` headers, and the parent launcher-repair control JSON named above. Hashed `review-r2/after`, `review-r3/after`, and the live property-values tree. Extracted the snapshot functions with the TypeScript AST and executed them. Walked `packages/` and `apps/` scripts with that predicate. Checked Effect `Option.match` and `Array.join` signatures.

Did not edit tracked source, snapshots, or earlier review reports. Did not run Git, network, or another agent. Did not run the parent probe, because it writes extracted subjects into the cache. Did not re-run Vitest, `tsgo`, or package verify. Did not treat the in-progress parent requalification as a result.
