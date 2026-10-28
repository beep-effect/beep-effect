# Opportunities — friction receipts

## 2026-10-23 — fallow audit counts codemod rename-only drift as introduced duplication

- Doing: publishing the mechanical `exact-optional-keys` migration (106 files,
  identifier rename `optional` -> `optionalKey`).
- Evidence: `bun run beep yeet publish` cheap gate `fallow:audit` red with
  `findingAttributionSummary.introduced = 19`, all `fallow:audit:duplication`.
  The 19 clone groups span 43 files; 0 of them were edited by hand, and the 33
  the branch touches changed only in the codemod commit `9e3aff5de8`. The
  clones pre-date the branch (e.g. the 25-site
  `S.Array(X).pipe(S.withConstructorDefault(...A.empty()), S.withDecodingDefaultKey(...A.empty()))`
  idiom, repeated `Laws.command.ts` wiring).
- Outcome: operator chose push + S11 attribution over ~90 reasoned
  suppressions.
- Would have prevented it: a fallow audit attribution mode (or yeet gate rule)
  that classifies a clone group as inherited when every changed line inside
  it is a same-length identifier rename recorded by a registered codemod
  report (`research/codemod-write.jsonc` lists every site).
- Follow-up: dedupe the empty-array-default idiom behind a named
  `@beep/schema` helper and collapse the `Laws.command.ts` repetition.

## 2026-10-23 — S44 follow-up blocked by inherited scratchpad documentation gate

- Doing: verifying the one-line tar extraction JSDoc correction for issue #2154.
- Evidence: `bun run beep quality package-verify @beep/scratchpad` skips audit
  and fails docgen on existing metadata defects, including
  `effected/xdg/XdgConfig.ts:74 XdgConfig missing @example` and
  `effected/xdg/index.ts:1 <module fileoverview> missing @since`.
  Both files match `origin/main`; the lane changes only the archive-command
  example in this package.
- Outcome: stopped under the S44 brief's outside-scope gate rule, retained
  uncommitted implementation and local proof logs, and published nothing.
- Would have prevented it: repair the scratchpad documentation baseline once
  in the main-green program before requiring package-wide verification of
  narrowly scoped scratchpad edits.

## 2026-10-23 — S44 remediation and inherited-gate disposition

- Resolved: `ArrayKeyDefaultEmpty` centralizes constructor and exact missing-key
  decoding defaults; law command schemas, flags, and diagnostic reporting reuse
  shared definitions. The stale archive example omits `flags`.
- Resolved: Fallow audit verifies zero-context diff hunks against tracked
  `goals/*/research/codemod-write.jsonc` reports. Only identifier tokens at
  recorded file/line/column sites qualify; mixed edits, additions, absent reports,
  malformed evidence, and unregistered changes remain introduced.
- Evidence: `bun run beep quality fallow audit --base origin/main` reports
  `introduced = 0`; focused attribution tests cover registered renames and
  conservative rejection. No inventory, exception, or ratchet baseline changed.
- Disposition: the S44 orchestrator assigns inherited scratchpad metadata defects
  to the effected-promotion session and authorizes this lane to continue without
  repairing those files. Package-scoped `docgen:local` verifies the changed
  archive example and CLI exports; bare planning requires full proof because the
  migrated array default also touches docgen configuration.

## 2026-10-23 — generated schema build output failed Babel parsing

- Doing: rerunning schema package verification after correcting standalone Effect
  diagnostics in the new default-helper test.
- Evidence: Babel rejected `schema/dist/FilePath/FilePath.roots.js:3` with
  `Unexpected token`; the generated file began with a source-map comment joined
  to a partial documentation block. Its TypeScript source matches `origin/main`.
- Recovery: forced TypeScript build emission regenerates the derived output;
  no source fix, baseline edit, or exception is warranted.
- Would have prevented it: isolated build outputs or serialized compiler/Babel
  writers for package verification sharing one checkout.

## 2026-10-28: declared completion evidence lost at retirement

- Doing: resuming this goal and verifying PR #2145 completion.
- Evidence: `beep goals completion refresh --slug exact-optional-keys` returns
  `unknown`; the declared Yeet verdict is absent. The original retirement
  manifest has no archived material. All 17 historical required contexts and
  the passing merge-push rule suite are independently verified.
- Response: preserve the historical gap and obtain a new closeout PR's retained
  exact-head readiness evidence. Keep operative lifecycle active until verified.
- Prevention: archive every declared local completion artifact before retirement.

## 2026-10-28: conventional namespace fixtures missed import ownership defects

- Doing: auditing EF-40 against the any-alias acceptance contract.
- Evidence: the existing focused rule suite passed, but the real Biome harness
  returned zero diagnostics for `Codec.optional` imported from `effect/Schema`
  and one diagnostic for a local object named `S` with an `optional` method.
- Fix: bind namespace references to their `effect/Schema` import and add recall
  and precision fixtures for both cases before publishing the closeout PR.
- Prevention: test arbitrary import aliases and unrelated conventional names
  whenever a structural rule claims to recognize an imported API.

## 2026-10-28: whole-import regex confused source exports with local names

- Doing: completing precision checks on EF-40 before marking PR #2316 final.
- Evidence: the rule flagged `optionalKey as optional` and a function parameter
  named Codec shadowing an effect/Schema namespace. Both are unrelated to the
  banned exports. A combined namespace import also escaped the initial fix.
- Fix: match source specifier nodes, namespace import nodes, and lexical binding
  scopes; add positive and negative fixtures, including type/value namespace
  distinctions and sibling scopes.
- Prevention: fixture both sides of aliased imports and re-exports, and test
  imported APIs inside scopes that reuse the import's local name.

## 2026-10-28: ambient cache configuration changes command-plan test expectations

- Doing: full `quality package-verify @beep/repo-cli` for the migration's package matrix.
- Evidence: 7,930 tests pass, but six unchanged command-plan assertions observe
  `op run` wrappers and a cache-session probe. A focused replay reproduces all
  six. Explicit blank Turbo credential variables and a local-only cache posture
  make all six pass. Unsetting variables alone was insufficient.
- Attribution: environment-dependent; the tests and cache-planner source match
  main. The raw failure and isolated passing control remain separate evidence.
- Prevention: use an explicit local-only posture for native-command assertions,
  while testing secret-session wrappers in their dedicated configured cases.

## 2026-10-28: scratchpad metadata baseline reproduced without migration changes

- Doing: full workspace verification for the goal's package matrix.
- Evidence: scratchpad docgen emits 443 metadata diagnostics on this branch and
  on clean main, with identical sets and no scratchpad source diff.
- Disposition: retain the existing inherited-gate disposition already recorded
  above and the user goal's explicit unrelated-failure allowance. No new baseline,
  suppression or expiring waiver is introduced.

## 2026-10-28: recursive parameter matching hid outer Schema references

- Doing: addressing the P2 review on PR #2316, discussion `4399481243`.
- Evidence: callback parameter types, method-signature types and default arrows
  contain nested `JsFormalParameter` nodes. The old `contains` test treated those
  as outer shadows. Four new regression cases were missed before the fix.
- Fix: match direct `JsParameters.items` with `some`, keeping the bare-arrow
  parameter alternative. All 32 invalid references and allowed cases now pass;
  full lint-rules audit and docgen pass.
- Prevention: scope-sensitive predicates must traverse direct child lists,
  with nested type/default-value counterexamples alongside true-shadow cases.

## 2026-10-28: merge during an interrupted readiness monitor

PR #2316 merged with all 15 required contexts green, but completion refresh
reports `unknown`: the declared closeout verdict lacks `mergeReady.ready`.
`yeet monitor` then refuses because the PR is already merged. The stopped job
and original artifacts are retained in the owning clone. A final documentation
closeout will capture canonical readiness before merge. A merge gate that
checks declared goal evidence before allowing merge would prevent this gap.
