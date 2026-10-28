# 3-A6 strict tsconfig verdict parity (2026-10-28)

PR 3-A6 moves docgen off the repo-utils strict tsconfig model (`src/schemas/TSConfig.ts`, 2,092 lines, deleted here)
onto `@beep/repo-tsconfig/TsconfigValidator`, built over the `@beep/tsconfig` closed views `ClosedCompilerOptions` and
`ClosedTsconfigJson` (map sites #160, #161, #242, #266). The oracle is the strict verdict itself, over every tracked
tsconfig document, plus docgen's resolved compiler options for every `docgen.json`.

## Method

1. Lane base `931e52792e` (origin/main), `bun install`, dependency closure built.
2. Before: `bun goals/effected-promotion/ops/tsconfig-validator-parity.ts --record` on the unchanged base tree, with
   the script's `MODEL` block bound to the legacy model (`decodeTSConfigFromJsoncTextEffect` for the verdict,
   `encodeTSConfigPrettyEffect` for the examples tsconfig text). That binding is the recording commit's version of
   the script; the switch commit rebinds `MODEL` to `TsconfigValidator` and docgen's `encodeExamplesTsconfig`.
3. After: the same `--record` on the final lane tree.
4. `--compare before after`, which classifies every difference against the intended verdict shifts (each one an
   inverted test in `packages/tooling/library/repo-tsconfig/test/TsconfigValidator.test.ts`) and fails on any
   unclassified difference. All three records are committed, so the comparison reproduces from them alone:

   | Record | sha256 |
   | --- | --- |
   | `tsconfig-validator-parity-3-a6-before.json` | `e277b730f11cec7a51907aece3605a873c9000e643d691250126a17ad0de18eb` |
   | `tsconfig-validator-parity-3-a6-after.json` | `b89e81095f4459d70931760b7dabc3154bc10e315d63bf96d55bfdeb54a53988` |
   | `tsconfig-validator-parity-3-a6-compare.json` | `355995c3fc12103ed0c3819cc563f6274c40f2b78368d1f0574a9d3d03715c73` |

The tsconfig corpus is the corpus-A filter of `repo-tsconfig-differential.ts`: every git-tracked `*tsconfig*.json`
outside `goals/**/research/**`, 686 files. It includes documents that are not tsconfigs (the `package.json` and
`docgen.json` of the two packages named `tsconfig`, review fixtures, extraction verdicts), which both models reject
for their first unknown key; they count as identical verdicts. The docgen corpus is every tracked `docgen.json`, 181
files, of which 170 load (`Configuration.load` from the package directory with no CLI input); the 11 others sit in
goal inventories or test fixtures without a `package.json` and fail identically before and after.

## Result

- tsconfig verdicts: 686 compared, 683 identical, 3 differences, all classified
  `allow-importing-ts-extensions-tsc7-rule` (reject → accept): `tsconfig.base.json`,
  `infra/lambda/turbo-cache/tsconfig.json` and `goals/schema-opaque-default/ops/codemod/tsconfig.json`. The legacy
  rule demanded `moduleResolution: bundler` and one of `noEmit` / `emitDeclarationOnly`; tsc 7 (TS5096, probed with
  the repo's `tsc` on four one-file projects) demands one of `noEmit` / `emitDeclarationOnly` /
  `rewriteRelativeImportExtensions` and nothing about `moduleResolution`. The validator follows tsc, so the repo's own
  base config, which the legacy model had rejected, is accepted.
- docgen: 181 compared. For all 170 loaded `docgen.json` the resolved `parseCompilerOptions` and
  `examplesCompilerOptions` are identical before and after (no `docgen.json` in the repo names a tsconfig file; every
  inline object is checked for its typed shape through `CompilerOptionsShape`, as before). The 170 examples
  `tsconfig.json` texts differ only in schema key order and lower-case enum spelling (`"DOM"` → `"dom"`), classified
  `examples-tsconfig-key-order-and-enum-spelling` after a sorted-key, lower-cased comparison; the file is written
  under `docs/examples/` for the examples `tsc` run and is not committed.
- Unclassified differences: 0.

## Shifts pinned only by inverted tests

No corpus document exercises these, so the compare records no row for them; each is an inverted test (D-56):
`null` options rejected (the legacy `Model.optionalOption` collapsed them to `Option.none`), the legacy `ts-node` and
`buildOptions` sections rejected as unknown top-level keys, the removed `es3` target / `ES2022.SharedMemory` lib /
legacy `fallbackPolling` aliases rejected and every `@beep/tsconfig` enum value accepted, an empty `references[].path`
and a `null` `paths` target rejected, explicit `undefined` rejected (EF-40, W4-j).

## Generated docs

`bun run docgen:local` on the final tree is the proof step for this (not completed in the implementing session: the lane stage ended while the repo-wide lint pipeline was still running); it regenerates the docs of the touched packages: repo-utils loses the
`schemas/TSConfig` module page, repo-tsconfig gains `TsconfigValidator`, `@beep/tsconfig` gains the two closed views
and docgen gains `CompilerOptionsShape` and `encodeExamplesTsconfig`. The examples `tsc` run passes for all four, so
the examples tsconfig the new encoder renders is a valid project for tsc.
