> Sanitized retained independent Grok round 2 source review. Its statements about pending proof are dated reviewer observations, not the final qualification state. See [current proof](cli-property-values-proof.md) for subsequently completed R3 evidence. No raw stream or machine/session metadata is published.

# Property-values round 2 review

No new findings. The round-1 major `single-project-emit-drops-launched-compilers` is closed on the round-2 snapshot. This review does not accept the goal. The parent combined proof and the full-package proof were not read and were not treated as a pass.

## Disposition of the round-1 finding

Closed. Severity was major. Area was the single-project emit law.

After file: `review-r2/after/single-project-emit.test.ts` (live path `packages/tooling/tool/cli/test/single-project-emit.test.ts`). The repaired predicate is `compilerArguments` at lines 76–114 and `usesSubgraphBuilder` at lines 119–146. The eight round-1 counterexamples are the fixture strings at lines 223–230. Independent execution of those functions, bound to installed Effect 4.0.1 `Array`, `String`, `Option`, and `pipe`, returns true for each:

| Line | Script | Result |
| --- | --- | --- |
| 223 | `bunx tsc -b project` | true |
| 224 | `env FOO=x tsgo -b project` | true |
| 225 | `FOO=x tsc -b project` | true |
| 226 | `node_modules/.bin/tsc -b project` | true |
| 227 | `/usr/bin/tsc -b project` | true |
| 228 | `bunx tsc --force` | true |
| 229 | `npx --no-install tsc -b packages/foo` | true |
| 230 | `pnpm exec tsc -b .` | true |

The same execution of the round-1 after snapshot (`01fc4e50…`) returns false for all eight. The before-stage control records agree: both Node and Bun receipts exit 1, 46 rows, 28 failures, and those eight rows have `expected: true` and `actual: false` against source `01fc4e503ca743d80ad0dfed634992b278deea94e2278bfbbbb5b6a00a2da64a`.

## Retained guards

The same execution returns false for every string in the false fixtures at lines 201–216 and 260–281 (14 direct guards and 20 launcher guards). That includes the round-1 false-positive drops:

- line 206 `echo "tsc -b"`
- line 207 `echo 'tsgo --force'`
- line 212 `tsgo -p tsconfig.json --forceful`
- line 213 `echo tsc -b`
- line 214 `other-tsc -b`
- line 215 `tsc -- -b`
- line 216 `echo "ready && tsgo -b"`
- line 262 `pnpm exec tsc -- -b`
- line 263 `env FOO=x tsc -- --force`
- line 272 `bun run tsc -b`
- line 275 `bunx nottsc -b`
- line 276 `node_modules/.bin/nottsc -b`
- line 279 `npx --no-install tsc --forceful`

Direct positives that round 1 already required stay true, including `tsgo --build`, `tsc "-b"`, `tsgo '-b'`, `bun run codegen && tsc -b`, `echo ready;tsgo -b`, `echo ready || tsc --force`, a newline-separated `tsgo -b`, and `rm -rf dist && tsc -p tsconfig.json`. `tsgo -b tsconfig.json && bun run beep:check:tests` stays true because `-b` is read before the separator. `echo tsc && echo -b` stays false.

All 78 fixture strings in the four `it` callbacks match the boolean their test title requires: 13, 14, 31, and 20.

## Predicate shape

The repair stays inside the existing file-local seam. `commandBasename` (lines 46–53) strips one pair of matching quotes and keeps the last path segment. `skipLauncherOptions` (lines 57–74) treats a leading `--` as the end of launcher options and consumes a listed value option together with its next token. `compilerArguments` skips `NAME=value` words, then follows `env`, `bunx`, `npx`, `bun x`, `npm exec`, and `pnpm exec` / `pnpm dlx`. Compiler `-b`, `--build`, and `--force` are exact argument tokens before the compiler's own `--`.

`A.contains(valueOptions, word)` and `A.drop(words, index)` match Effect `Array`'s data-first duals. `@beep/utils` `Array.ts` re-exports `effect/Array`, and `Str.ts` re-exports `effect/String`. The local `Str.startsWith` is also dual; `Str.startsWith("-")(word)` is the data-last form and calls Effect `String.startsWith`. `Str.replace` is non-global here, and the quote strip uses `$2`. `tsc "-b"` returning true is the execution check of that group. `Str.matchAll` is called with a global regex.

No shell tokenizer was required. Forms outside this table stay false and are not filed: `nice tsc -b`, `command tsc -b`, `yarn exec tsc -b`, and `$(tsc -b)`. Directory and filter options are consumed before `exec` / `dlx`. `pnpm --filter foo exec tsgo -b` (line 237) returns true. `pnpm exec --filter foo tsc -b` returns false. That second spelling is outside the option table the tests encode. `bun run`, `pnpm run`, and `npm run` stay script names (lines 272–274).

`deletesOwnEmit` (line 151) is still `Str.includes("rm -rf dist")`. `emitScriptsOf` (lines 155–158) still reads only `beep:build` and `beep:check`. `collectViolations` (lines 160–176) still requires more than 100 manifests and still pushes only those two script names. The manifest test remains lines 286–291.

A separate Node walk of `packages/` and `apps/`, using the same `node_modules` and dot-directory skips, found 148 `package.json` files and 282 `beep:build` / `beep:check` scripts. The predicate returned false for every one. `infra/package.json` `beep:check` is still `tsgo -b tsconfig.json && bun run beep:check:tests`, and the predicate returns true for that string. The walker at lines 37–42 still starts at `packages` and `apps` only, so the tripwire does not read `infra/`. That root list is unchanged by this repair and is not a new finding.

`rm -rf distro` still matches the original `rm -rf dist` operand. That operand is unchanged.

## Other seven files and the ratchet contract

Recomputed SHA-256 of the round-2 snapshots matches the round-2 manifest. Seven files are byte-identical to the round-1 after snapshots. Only `single-project-emit.test.ts` differs. The same eight digests match the live property-values checkout. `review-r2/source.diff` is 20694 bytes and contains all eight paths, including the four the round-1 diff omitted (`qa-pure.test.ts`, `codex-findings-normalize.test.ts`, `effect-vitest-contract.test.ts`, `effect-vitest-store.test.ts`).

`RatchetDiff.ts` round-2 SHA-256 equals the round-1 after digest `e52e1e688a1471146643c6633a5f19c7cc02c61107f8e1585c3c46b06f4fb6c4`. A line diff against `review/before/RatchetDiff.ts` adds five lines and removes four, all inside comments. `diffTotals` (lines 242–249) still sorts baseline keys and maps `metricDelta` over those names. The JSDoc at lines 216–226 says current-only keys add to `currentTotalCount` and do not produce deltas, and that an explicit baseline `0` participates. `ratchet-diff.test.ts` is byte-identical to the round-1 after file. The explicit-zero case remains lines 71–80 (`fresh` baseline 0, current 4, delta 4). The empty-baseline case remains lines 82–93. The mixed tracked case remains lines 95–110. The round-1 ratchet conclusion stands: baseline-key walk, no algorithm change.

## Controls and receipts

`a/controls-results.json` parses. It is 11005 bytes and a 14-element array, so the earlier tool-output cut is not an on-disk truncation. Status census: original passed 7 (contract-missing 1, csv-description 2, csv-title 2, normalize-success 1, store-wrong 1); repaired failed 5 (one each of those five files); repaired passed 2 (csv-description, csv-title). These rows are the earlier private copies. They are not the installed suite and they are not a package proof.

Launcher controls, parsed in full:

- `b/r1-control-inputs.json`: 31 positive and 20 negative commands. All eight counterexamples are in the positive list.
- Before Node and Bun JSON: 46 rows, 28 failures, source `01fc4e50…`. Receipts exit 1.
- Final Node and Bun JSON: 51 rows, 0 failures, 31 expected true and 20 expected false, source `cb58660a6cddd8399d6591c9225953f81f62941e5afc1ffc0cf105a4d506d4fe`. Every command string occurs in the round-2 snapshot. Receipts exit 0.
- The intermediate after-stage JSON hashes `4b8a22fba5e0abe33d66d2a4484fba9b2e771131ffcc62554d203b2c83067d1c`. That digest is not the reviewed snapshot.

Writer-completed focused receipts, parsed and not re-run here: `b/r1-final-node.json` and `b/r1-final-bun.json` each record `numTotalTests` 5, `numPassedTests` 5, `numFailedTests` 0, `success` true, for the five titles in this file. That is the writer's focused file run. It is not the parent combined proof and it is not full-package acceptance.

## Independently recomputed SHA-256

Round-2 snapshot digest, then the round-1 after digest. Live checkout digests match the round-2 column for every row.

| File | Round-2 / live | Round-1 after |
| --- | --- | --- |
| `codex-findings-csv.test.ts` | `7793a562fdc76075ceabdc09ac9efbe2304da627f1ebc1d07ae5d22b9122125d` | same |
| `codex-findings-normalize.test.ts` | `10f49c562aac018828fe67de623ec950350028393145f1dbcd58fe5a22b1efa3` | same |
| `effect-vitest-contract.test.ts` | `c9a95e7032048f12ef3d69f8fdac34914a0a1a160905d39bc98dce25f97468b7` | same |
| `effect-vitest-store.test.ts` | `a98843b0f9e577a3e84a1c363c1b3f7359bbc71439b03aca1f0932446526c05e` | same |
| `qa-pure.test.ts` | `f30b444a30676bbdfa4524adf6e5c08197b51e1d9bdee57fd7b3b455fe9456f7` | same |
| `ratchet-diff.test.ts` | `32650494d17f08fe59a12327f5273d7dca9221e1c4305ff374e710793642717b` | same |
| `single-project-emit.test.ts` | `cb58660a6cddd8399d6591c9225953f81f62941e5afc1ffc0cf105a4d506d4fe` | `01fc4e503ca743d80ad0dfed634992b278deea94e2278bfbbbb5b6a00a2da64a` |
| `RatchetDiff.ts` | `e52e1e688a1471146643c6633a5f19c7cc02c61107f8e1585c3c46b06f4fb6c4` | same |

The round-2 manifest's `before` and `r1` columns match the round-1 review manifest. The round-2 `after` column matches the digests recomputed above.

## Scope

Read `b/r1-repair-report.md`, the round-2 after snapshots, `review-r2/source.diff` headers and per-file sizes, `review-r2/source-hashes.json`, and the round-1 after `single-project-emit.test.ts` long enough to extract its predicate. Hashed `review/after` and the live property-values tree. Parsed the control JSON files named above and both final Vitest JSON files. Executed the extracted snapshot predicates with Node 22 and the worktree's Effect dist. Walked `packages/` and `apps/` `package.json` scripts with that predicate. Read `infra/package.json` `beep:build` and `beep:check`. Read Effect `Array.contains`, `Array.drop`, and `@beep/utils` `Str.startsWith` plus the `export *` lines.

Did not edit tracked source, snapshots, round-1 reports, or resource-next files. Did not run Git, network, or another agent. Did not re-run Vitest, `tsgo`, Biome, or package verify. Did not read the in-progress parent proofs.
