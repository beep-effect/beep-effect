> Sanitized retained independent Grok round 1 source review. Its statements about pending proof are dated reviewer observations, not the final qualification state. See [current proof](cli-property-values-proof.md) for subsequently completed R3 evidence. No raw stream or machine/session metadata is published.

# Grok adversarial review, round 1 — property-values batch

Status: complete. Read-only. This batch review is not goal acceptance. The original goal, including an empty final baseline, stays with the parent. Resource-next review files were not changed.

Snapshot: `~/.cache/beep/effect-vitest-canon/property-values-20261006/review`. Checkout named by the assignment: `effect-vitest-canon-property-values` at `64bff0e5`. Findings: `grok-findings-r1.jsonl` (one major).

Role: independent reviewer. No source or snapshot edits, no git mutation, no publication, no network, no delegation.

## Source hashes

From `review/source-hashes.json`. Before and after both present. These are the digests in that file, not recomputed.

| Path | Before | After |
| --- | --- | --- |
| `packages/tooling/tool/cli/test/codex-findings-csv.test.ts` | `2dfec5d06e01b219bebd55849f45ca1cf0b70fce179cdcebea48e5f50f61942c` | `7793a562fdc76075ceabdc09ac9efbe2304da627f1ebc1d07ae5d22b9122125d` |
| `packages/tooling/tool/cli/test/codex-findings-normalize.test.ts` | `9f2b0eb2df6e1916ed025a9429187a04a29fff7b6834416a604430711bc32fae` | `10f49c562aac018828fe67de623ec950350028393145f1dbcd58fe5a22b1efa3` |
| `packages/tooling/tool/cli/test/effect-vitest-contract.test.ts` | `46d072da39ca512b90991b9dcb4a92b73054ec5aa86ea7178c1e3db201a23aed` | `c9a95e7032048f12ef3d69f8fdac34914a0a1a160905d39bc98dce25f97468b7` |
| `packages/tooling/tool/cli/test/effect-vitest-store.test.ts` | `1f1e356b0c46df6a5e967d6c6673cb9821c11aa21604def0b07bf4110cc84ab4` | `a98843b0f9e577a3e84a1c363c1b3f7359bbc71439b03aca1f0932446526c05e` |
| `packages/tooling/tool/cli/test/qa-pure.test.ts` | `7b64a3f00f984c36ab3bf4dd5bc2e75646e48a92666d527e5b6d1ef882c06073` | `f30b444a30676bbdfa4524adf6e5c08197b51e1d9bdee57fd7b3b455fe9456f7` |
| `packages/tooling/tool/cli/test/ratchet-diff.test.ts` | `225ebc311ca07bac667143c8f2acdde63b817e0c3908ab5d4e2422fd17cb9632` | `32650494d17f08fe59a12327f5273d7dca9221e1c4305ff374e710793642717b` |
| `packages/tooling/tool/cli/test/single-project-emit.test.ts` | `0409390ab74962f6befce640b84e3d0c6ca15ff01f36be124179b262ca7b37e7` | `01fc4e503ca743d80ad0dfed634992b278deea94e2278bfbbbb5b6a00a2da64a` |
| `packages/tooling/tool/cli/src/internal/ratchet/RatchetDiff.ts` | `fb63f382247aa01764bf84db963e56ae9706a241ff2af722170149673277f335` | `e52e1e688a1471146643c6633a5f19c7cc02c61107f8e1585c3c46b06f4fb6c4` |

`review/source.diff` contains RatchetDiff, csv, ratchet-diff, and single-project-emit. It does not contain qa-pure, normalize, contract, or store. Those four were compared with `diff -u` on the before and after snapshots. The after files are the reviewed text.

## Examined scope

After snapshots, changed bodies:

- `codex-findings-csv.test.ts` description and title assertions, plus the `row`/`quote` helper that builds the CSV.
- `codex-findings-normalize.test.ts` short-read test, and `Findings.normalize.ts` `planPacket` around the short-read error (lines 330-348).
- `effect-vitest-contract.test.ts` EV012 assertion and the `routingSource` fixture at lines 761-770. Detector `unprovenServiceMock` and `serviceMockTarget` in `EffectVitestDetectors.ts`, `makeFinding` id shape, and `compactEvidence` trim.
- `effect-vitest-store.test.ts` JSONL equality, and `decodeEffectVitestFindingJson` (`Lint.schemas.ts`, `S.fromJsonString`).
- `qa-pure.test.ts` the one added `assertSome` of `maxTotalBytes`.
- `ratchet-diff.test.ts` the four diff cases and the success-path console snapshot. `RatchetDiff.diffTotals`, `metricDelta`, `JSDocRatchet.compareTotals`, `selectRatchetedTotals`, `makeBaseline`, and `RatchetLifecycle.enforceRatchet` log lines.
- `single-project-emit.test.ts` the whole new predicate and the true/false fixture. Compared with the before-file substring predicate. `infra/package.json` `beep:check` script. Search of `packages/tooling/tool/cli/src` for an existing shell tokenizer.

Installed Effect 4.0.1: `effect/String.ts` `matchAll` requires a global regexp and returns the iterator; `replace` is `(search, replacement) => (self) => string`. `TestConsole.logLines` is the `Console.log` buffer only (`TestConsole.ts` `getLines("log")`). `Cause.YieldableError` was not needed here.

`a/controls-results.json` was read through its visible rows. Original copies of the csv, normalize, and graph tests are marked passed. Repaired copies fail when the subject text or the EV012 list is corrupted. The file is truncated in the middle of the store row. Those rows are fault-injection evidence, not suite proof. Writer pass counts and the parent combined proof were not re-run.

## Finding

One major: `single-project-emit-drops-launched-compilers`.

The new predicate returns true as soon as the command word is exactly `tsc` or `tsgo` and a later token is exactly `-b`, `--build`, or `--force`. A separator starts a new command and clears the compiler bit. Direct `tsgo -b tsconfig.json && bun run beep:check:tests` still trips, so the current `infra/package.json` `beep:check` script is still a violation.

The old predicate was true whenever the script contained `tsc ` or `tsgo ` and also ` -b ` or `--force`. These now return false:

- `bunx tsc -b project`
- `env FOO=x tsgo -b project`
- `FOO=x tsc -b project`
- `node_modules/.bin/tsc -b project`
- `/usr/bin/tsc -b project`
- `bunx tsc --force`
- `npx --no-install tsc -b packages/foo`
- `pnpm exec tsc -b .`

The comment at lines 44-49 says wrappers are not interpreted. The true/false fixture does not contain these shapes, so the suite now accepts them. A smaller documented parser is not a reason to drop those catches.

These drops are the right false-positive fixes and should stay: `echo "tsc -b"`, `nottsc -b`, `tsc --forceful`, and `tsc -- -b`. There is no shell tokenizer in `packages/tooling/tool/cli/src`. The fix is to extend this function: skip `env` and `NAME=value` prefixes, treat `bunx`, `npx`, and `pnpm exec` as transparent when the next operand is the compiler, and compare the command basename. Do not add a parser dependency.

`--build`, a bare trailing `-b`, and quoted `"tsc" "-b"` are new catches. The old substring test missed them.

## Ratchet contract

The correction is the tracked-metric policy, not a test bent around a defect.

`diffTotals` walks baseline keys only (`RatchetDiff.ts` `R.forEach` on the baseline record). `metricDelta` uses `R.get` on current, so a baseline key missing from current is `missing`, and a present `0` is a real baseline. Current keys absent from the baseline add to `currentTotalCount` and produce no delta.

`JSDocRatchet.compareTotals` passes the full current inventory and `baseline.tracked_totals`. `makeBaseline` writes `selectRatchetedTotals`, which fills every name in the 21-name `JSDocRatchetedTotalName` literal, using `0` when the inventory omitted it. The other inventory counts stay out of that record. An empty baseline is a direct helper call meaning no tracked names, not the record production writes.

The renamed explicit-zero case still uses `baseline: { fresh: 0 }` and expects `delta: 4`. The missing case expects the baseline key in `missing` and counts the untracked current key. The mixed case expects `increased`, `decreased`, and `missing` together, with `currentTotalCount: 4` and `baselineTotalCount: 3`. The JSDoc-only edit states the same walker. The algorithm is unchanged.

The success-path console expectation matches `enforceRatchet`: one `Console.log` of the ok line, then one `Console.log` of the tighten lines joined by newline. `TestConsole.logLines` reads that log buffer. The failure path still uses `Console.error` and the existing cause-string assertion. That split was already the subject's shape.

## Other changed assertions

- CSV description: `assertSome` of the report whose id is `a`, equal to `First line, with comma.\nSecond line.` The title test expects the same string passed into `row`. `quote` doubles quotes, and the parser undoubles one layer, so `'Say ""hi"" to the parser'` round-trips. Both assertions are exact.
- Short-read: `Effect.flip` runs before the privacy checks. The error must be `CodexFindingsIngestError` with `reason === "short-read"`. The message built in `planPacket` interpolates counts only, so it does not contain the finding id or `/home/`. A successful `planFrom` fails the flipped effect before those checks.
- EV012: the fixture's `vi.mock("@beep/codec", ...)` line is the trimmed evidence. `serviceMockTarget` returns `unproven-module-mock-review` for an `@beep/` string. The id column `@6` matches the six-space indent and `makeFinding`'s `getStart() - getStartLinePos()`. The assertion requires that one hydrated row. It was not re-executed here.
- Store: `assertSome(decodeEffectVitestFindingJson(first), row)` decodes the one JSON value written for that row. `JSON.parse` accepts the trailing newline from a single JSONL line. A second JSON value on the same string would fail the decode. The following raw-text assertions remain.
- Budget: `assertSome` of `maxTotalBytes` is `4096`, the value just written. The previous `O.isSome` check remains.

No reviewed hunk deletes an existing assertion. The one title change is the explicit-zero rename, and the `fresh: 0` inputs and delta stay.

## Unknowns

- The 131/131, 80/80, and 55/55 counts and the parent combined proof were not re-run. Compiler JSON was not opened.
- The EV012 id and the JSONL equality were checked against the detector and schema source. They were not executed in this review.
- `a/controls-results.json` is truncated in the store section. The visible repaired failures are corruption rejections. They are not a substitute for the installed suite.
- Package scripts outside `beep:build` and `beep:check` were not treated as subjects of this law. The scan that matters is the predicate itself.
