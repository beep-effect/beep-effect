# #1855 detector repairs wave 8: the owner/exit register for the remaining rules

Lane `residue-detectors` wave 8, worktree `rsc-detectors-w8`, branch `feat/residue-detectors-wave8`, on
`main` `190572531f`. Scope: the effect-vitest inventory, the detector source
(`EffectVitestDetectors.ts`), the detector tests (`effect-vitest-detectors.test.ts`) and packet files. No
other test file and no other `src/` file is edited. Route: S39/S41 Claude chain, `claude-opus-5-5` child,
no cross-provider lane.

Inputs: the open-row evidence of #1875 waves 7, 9 and 10 (`vitest-canon-wave-7.md`,
`vitest-canon-wave-9.md`, and the wave 10 receipt on the open PR #2277), and fresh trials run in this wave.

## Census at `190572531f`

`bun run beep lint effect-vitest`: 586 rows, 536 exceptions and 50 open, `introduced=0 resolved=0`. 238
exceptions carry both `Owner:` and `Exit:`. 297 carry neither: EV002 94, EV004 86, EV006 56, EV009 28,
EV015 16, EV005 6, EV012 6, EV007 2, EV008 2, EV001 1. One more EV015 exception
(`ContradictionDetection.golden.test.ts:133`) names a non-package owner and no exit, so this wave treats
298 exceptions as unregistered.

The 50 open rows: EV010 38, EV004 10, EV002 1 (`roadmap-refs.test.ts:78`), EV014 1. Four of them
(`ThreadStore` EV004, `practice-kg-mcp` `Host` EV014, `PracticeIdentify.command` and `PdfTools` EV010)
are migrated by the open PR #2277 (#1875 wave 10), so this wave leaves them alone. That leaves the brief's
45 candidates: EV010 36 and EV004 9.

Every count below comes from one census paired by `(ruleId, file, occurrence)` against
`git show 190572531f:standards/effect-vitest.inventory.jsonc`. Two pairs of SQL test-kit rows share an
occurrence hash, so the pairing adds an ordinal within each key.

## Detector repairs

Each repair has paired fixtures in `effect-vitest-detectors.test.ts`, written first. Against the base
detector both new tests failed on their first false-positive assertion, and with only the near-miss loops
enabled both passed, so every near miss already flagged. After the repairs the false positives are silent
and the near misses still flag.

### Repair A (EV015): a nested single-test block whose own layer is a fresh `TestClock.layer()`

`ownsUnsharedTestClock` exempted only top-level single-test `it.layer` blocks, on the premise that nested
blocks share the parent's TestClock. That holds for most nested blocks but not for one whose layer argument
is a `TestClock.layer()` call. Checked against the installed source: `@effect/vitest`
`internal.ts` builds a nested block as `Layer.provideMerge(nestedLayer, withTestEnv)` in a forked memo map,
`Layer.provideMerge` merges with `Context.merge(that, self)`, so the nested layer's services win, and
`effect/testing/TestClock.ts` `layer()` returns a new `Layer.effectContext` per call, so it is built fresh
for that block. A single-case block of that shape owns its clock exactly like a top-level block.

`installsFreshTestClock` reads the block's own registration (`it.layer(L, options)(callback)` or the named
form) and accepts only a direct `TestClock.layer(...)` call with TestClock provenance. A nested block that
does not install one keeps the old rule, and the single-case conditions are unchanged.

Fixtures ("exempts a nested single-test block whose own layer is a fresh TestClock.layer() call"). Silent:
a fresh clock nested in a named parent, the same with options and a sibling test in the parent, and a fresh
clock two levels down. Still EV015: a fresh-clock block with two tests, with `it.effect.each`, a shared
`const clock = TC.layer()` binding, a same-named `layer()` from a local module, and a fresh-clock block that
also holds a nested child block (both adjusts flag, counted).

### Repair B (EV002): a Context built through a pipe chain or a same-file factory

`isContextProvision` recognised `Context.make/empty/add/merge` calls and identifiers bound to them, but not
`Context.make(...).pipe(Context.add(...))` or a call of a same-file function that returns a Context. The
docgen `Parser.test.ts` rows provide `makeParserTestContext(source, config)`, which returns exactly that
pipe of pure `Source` and `Configuration` values: no layer, no lifecycle.

`isContextPipe` accepts a `.pipe` whose receiver is a Context provision and whose every stage is a
data-last `Context.add`/`Context.merge` call. `isContextFactoryCall` resolves the callee binding (a `const`
arrow or function expression, or a function declaration) and requires every value the function returns
(the existing `layerFunctionReturns` helper) to be a Context provision.

Fixtures ("follows Context pipe chains and same-file Context factories into a Context provision"). Silent:
a piped Context binding, the docgen factory shape with `add` and `merge` stages, a function expression,
and a function declaration. Still EV002: a pipe with an unknown stage, an unknown receiver, a factory that
returns `L.effect(...)`, a factory whose second return is a layer, a conditional factory, and a factory
shadowed inside the test body by one that returns a layer.

### Mutation probes

Each probe changed one guard, ran the two fixture tests on Bun, failed without hanging, and was restored
byte-identical from a scratch copy:

| Probe | Result |
| --- | --- |
| B1: drop `isContextPipe` from the disjunction | the silent piped fixtures fail |
| B2: `A.some` instead of `A.every` over factory returns | the mixed-returns near miss fails |
| B3: accept any pipe stage | the unknown-stage near miss fails |
| A1: every nested block owns its clock (`onSome: constTrue`) | the nested near misses fail |
| A2: any layer call counts as a fresh clock | the local `layer()` near miss fails |

### Rows retired by the repairs: 12

| Repair | Rule | Rows |
| --- | --- | --- |
| A | EV015 | `quality-scheduler.test.ts` `:1848`, `:3618`, `:3640`, `:4365`, `:4369`; `ai-metrics` `ingest.test.ts:2759` |
| B | EV002 | docgen `Parser.test.ts` `:246`, `:268`, `:1034`, `:1076`, `:1119`, `:1152` |

All 12 were exceptions. Each file was read: every retired `TestClock.adjust` sits in a single-case
`it.layer(TestClock.layer())` block nested in a wider parent, and every retired provision passes
`makeParserTestContext(...)`.

## Open rows converted to exceptions: 36

Each converted row cites its concrete resource and a failed migration trial, and ends
`Owner: @beep/<package>. Exit: retire when <condition> (#1855 wave 8 register).` Fresh trials ran one test
file on Bun through `beep-heavy` and restored the file byte for byte from `HEAD` (each restore checked with
`git diff --quiet`). An EV010 trial replaced the native layer with
`Layer.mergeAll(MemoryFileSystem.layer, Path.layer, NodeCrypto.layer)`, and, where processes were
involved, a second trial added `NodeChildProcessSpawner.layer` over that memory volume. An EV004 trial
removed the one `Effect.scoped` at the row.

### EV004: 7 (fresh trials)

| Row | Scope-close observation | Trial without the scope |
| --- | --- | --- |
| `lint-security.test.ts:107` | removal error, combined Cause and root presence asserted after the scope inside `Effect.exit` | 4 of 5 fail |
| `purge-security.test.ts:161` | same, over both acquisitions | 4 of 6 fail |
| `regenerate-merge-driver.test.ts:131` | same | 4 of 5 fail |
| `step-git-exec.test.ts:504` | same (archive fixture) | 3 of 32 fail |
| `step-git-exec.test.ts:695` | same (attributes-guard fixture) | 3 of 32 fail |
| `process-attachment.test.ts:61` | rescan after close expects no descriptor | 1 fails (descriptor still found) |
| `worktree-command.test.ts:2270` | retirement succeeds only after the descriptor closes | 1 fails (refused instead of retired) |

### EV010: 29

| Reason class | Rows | Trial |
| --- | ---: | --- |
| Real git or processes | 11 | `step-git-exec`, `worktree-command`, `worktree-remove-fence`, `yeet-monitor-ready`, `proof-job` (#1875 wave 7 H4); `step-capture-lifecycle:16` admission shell (#1875 wave 9: 5 fail); `docs-rules` oxlint CLI (#1875 wave 10); fresh: `yeet-sweep-retire` 37 of 45 fail (no spawner, and with `NodeChildProcessSpawner` the same 37 fail on `posix_spawn 'git'`), `step-capture-lifecycle:15` 4 of 22 fail (with the spawner, the cross-process process-group test hangs past its watchdog in three of three runs), `TsNativeApi` 7 of 7 fail and `effect-drizzle` `import-boundary` fails at layer build with all 7 skipped (both "The TypeScript sync transport requires Node stdio handles", with and without the spawner) |
| `/proc` | 2 | `process-attachment` (#1875 wave 7 H4); fresh: `restoration-archive-coverage` 6 of 14 fail (`/proc/sys/kernel/random/boot_id`, directory sync, capacity probe) |
| Process working directory | 3 | `goals-packet-convention-migration`, `identity-registration-removal`, `roadmap-refs:8` (#1875 wave 7 H3, `chdir` ENOENT) |
| Real checkout or committed files | 4 | `ciops` evidence 3 of 6 fail, `PracticeIdentify.runtime` 1 of 5 (#1875 wave 10); `runners-bake`, `skills-provenance` (#1875 wave 7 H2) |
| Native filesystem wired in `src/` | 1 | `BoxContentMigration` 21 of 25 fail (#1875 wave 10) |
| WASM | 3 | fresh: `Occt.service` 22 of 28, `PrimitiveLineStyle` 11 of 11, `Shading` 40 of 41 fail on the `replicad_single.wasm` read |
| DuckDB | 3 | `research-history-sift` (#1875 wave 7 H5); fresh: `PracticeKg.compare` 1 of 5, `PracticeKg.correspondents` 1 of 9 fail ("Failed to open DuckDB connection") |
| Fonts | 1 | `FigureSet` (#1875 wave 10): 48 pass and the font re-derivation test skips itself, so the migration drops its coverage |
| memfs to utils cycle | 1 | `utils` `FileSystem.test.ts`: the subject is the synchronous `node:fs` wrappers, and `@beep/memfs` depends on `@beep/utils`, so no memory trial can run |
| **Total** | **29** | |

### Candidates not converted: 9

The brief named 45 candidates. Nine have no failed trial, so they stay open:

- **EV004 `step-capture-lifecycle.test.ts:720` and `:742`.** #1875 wave 9 found both tests pass without
  the scopes. Fresh trials agree: 22 of 22 pass on Bun and on Node for each. (One Bun run of the `:742`
  trial failed the unrelated cross-process test on a `/proc/0/stat` race; the rerun passed 22 of 22.)
- **EV010 H1, `ci-lane-timings:34` and `yeet-review-window:26`.** The wave 7 type failure (TS377004) comes
  from dropping `NodeServices`. The migration that keeps the CLI environment type,
  `Layer.mergeAll(NodeServices.layer, MemoryFileSystem.layer)`, passes 68 of 68 and 25 of 25, and wave 7's
  repair 3 already clears that shape.
- **EV010 H6, `yeet-economics:37`, `test-typecheck-coverage:6` and `drawings-intake:24`.** On the memory
  filesystem they pass 31 of 31, 5 of 5 and 17 of 17. The memory volume models links and `realPath`, so no
  observation shows these need the native filesystem. The H6 ruling was a policy, not a failing trial.
- **EV010 `OutboxAttachmentSource:4`.** #1875 wave 10 and a fresh trial both pass 4 of 4 on memory.
- **EV010 `Outbox.live:13`.** The live Graph smoke skips without `M365_OUTBOX_*` credentials, so a trial
  here observes nothing (1 skipped either way).

## Exceptions without an owner and exit: per-family source check

Each of the 298 rows was checked against its source before its reason changed. The check confirmed the
flagged construct still sits on the recorded line and that the file still holds the resource or shape the
old reason names (for example `concurrent: false`, `defaultIdleTTL`, `toMatchObject(`, `Effect.exit`,
`Layer.build(` with `makeHttpServerLayer`, `Exit.isFailure(`). Rows that share one reason were checked as a
family, but every row's file and line were verified. Three token misses turned out to be spelling
(`scoped(` imported bare in `bundle-size`, `defaultIdleTTL`, `Layer.build(` on its own line) and were
re-checked by reading the file.

| Rule | Unregistered | Retired (repair) | Reopened (trial) | Rewritten | Families |
| --- | ---: | ---: | ---: | ---: | --- |
| EV002 | 94 | 6 (B) | 0 | 88 | body-owned layer values 47, built Context in a shorter scope 13, acquisition failure asserted 10, SQL kit freshness or reconnect 9, per-operation ConfigProvider 4, other single shapes 5 |
| EV004 | 86 | 0 | 6 | 80 | assertions after a shorter scope 65, helper scope closed before return 9, process environment restore 6 |
| EV006 | 56 | 0 | 0 | 56 | compound Option oracles, Option-to-Option equality, message-bearing asserts, Exit predicates without a supplied Cause |
| EV009 | 28 | 0 | 0 | 28 | AtomRegistry runtimes, native browser renderers, live clock subjects, native locks |
| EV015 | 17 | 6 (A) | 0 | 11 | serial shared-clock blocks (`concurrent: false` or sequential with joined fibers) |
| EV005 | 6 | 0 | 0 | 6 | Result captures with post-failure reads |
| EV012 | 6 | 0 | 0 | 6 | module mocks without a service seam |
| EV007 | 2 | 0 | 0 | 2 | properties nested in one shared transaction |
| EV008 | 2 | 0 | 0 | 2 | sleeps in separately built runtimes or joined under an owned clock |
| EV001 | 1 | 0 | 0 | 1 | browser fixture clock sample |
| **Total** | **298** | **12** | **6** | **280** | |

Every rewritten reason reads `<why>. Owner: @beep/<package>. Exit: retire when <condition> (#1855 wave 8
register).` The why keeps the reviewed claim and its research reference; run counts and dated
qualifiers were dropped. The two lane-C reasons (`cache-remote-reads`, `setup-effect-ref`) and the
`ContradictionDetection` owner now name their package. Exits are either a detector recognition (for
example "EV004 recognises assertions that run after a shorter scope closes") or a source seam (for example
"the cache command reads TURBO_* through an injected ConfigProvider instead of process.env").

### Reopened: 6 (exception to open)

The six sibling scopes in `step-capture-lifecycle.test.ts` (`:604`, `:624`, `:646`, `:672`, `:693`,
`:770`) were exceptions on the claim that closing at `runCaptured` completion "preserves kill/unref
assertions and fiber interruption ordering" (`goals/effect-vitest-canon/research/step-capture-scope-proof.md`,
which records no control without the scopes). Fresh trials removed each scope in turn: 22 of 22 pass on
Bun and on Node for every one. No assertion observes these scopes, so the source no longer needs the
exception. A detector repair cannot retire a row whose construct is genuinely redundant, and the test file
is outside this lane, so the rows reopen for #1875 to drop the eight scopes (these six plus `:720` and
`:742`).

## After the wave

`lint effect-vitest --write` was run twice; the inventory sha256 was identical both times
(`547315a82c472143cbf3a2f2abd722a5fb905700fd737f31cda871d61202c874`). A plain scan reports
`introduced=0 resolved=0`.

Against `190572531f`, paired by `(ruleId, file, occurrence)`:

| | Rows |
| --- | ---: |
| Base | 586 (536 exceptions, 50 open) |
| Gone | 12 (6 EV002 and 6 EV015, all exceptions, by repairs B and A) |
| New | 0 |
| Status changed | 42 (36 open to exception: EV004 7, EV010 29; 6 exception to open: EV004) |
| Reason changed | 322 (280 rewritten exceptions, 36 conversions, 6 reopened rows whose reason was removed) |
| After | 574 (554 exceptions, 20 open) |

Check: 536 − 12 − 6 + 36 = 554 exceptions; 50 − 36 + 6 = 20 open; 586 − 12 = 574 rows. Every one of the
554 exceptions now carries `Owner: @beep/<package>` and an exit (238 before).

| Rule | Exceptions before | Open before | Exceptions after | Open after |
| --- | ---: | ---: | ---: | ---: |
| EV001 | 1 | 0 | 1 | 0 |
| EV002 | 98 | 1 | 92 | 1 |
| EV003 | 23 | 0 | 23 | 0 |
| EV004 | 89 | 10 | 90 | 9 |
| EV005 | 6 | 0 | 6 | 0 |
| EV006 | 56 | 0 | 56 | 0 |
| EV007 | 2 | 0 | 2 | 0 |
| EV008 | 2 | 0 | 2 | 0 |
| EV009 | 28 | 0 | 28 | 0 |
| EV010 | 208 | 38 | 237 | 9 |
| EV012 | 6 | 0 | 6 | 0 |
| EV014 | 0 | 1 | 0 | 1 |
| EV015 | 17 | 0 | 11 | 0 |
| **Total** | **536** | **50** | **554** | **20** |

## Remaining frontier: 20 open rows

- **#2277 (#1875 wave 10), 4 rows it migrates:** `ThreadStore.test.ts:301` EV004,
  `practice-kg-mcp` `Host.test.ts:171` EV014, `PracticeIdentify.command.test.ts:1` and
  `PdfTools.service.test.ts:22` EV010. After it merges, this lane merges `main` and re-runs `--write`.
- **The named remainder, 1 row:** `roadmap-refs.test.ts:78` EV002 needs a `--root` seam in `src/`, held
  until effected's adoptions settle.
- **#1875 migrations, 15 rows:** the 8 `step-capture-lifecycle` EV004 scopes (drop them); the H1 pair
  (`ci-lane-timings`, `yeet-review-window`: merge `MemoryFileSystem.layer` after `NodeServices.layer`); the
  H6 trio and `OutboxAttachmentSource` (move to `MemoryFileSystem.layer`, which passes); and
  `Outbox.live`, which needs either a credentialed trial or a ruling on live smoke suites.

## The #1855 closeout gap

#1855 accepts on "fresh zero actionable scan, individually justified surviving exceptions with owner and
exit, unchanged coverage floors". After this wave:

- **Owner and exit:** met. All 554 exceptions name a `@beep/` owner and an exit.
- **Zero actionable scan:** not met. 20 rows stay open: 4 that #2277 migrates, the `roadmap-refs` src-seam
  remainder, and 15 #1875 test migrations listed above. The held `src/` seams also gate several exits
  (roadmap-refs `--root`, `BoxContentMigration`'s `src/` filesystem layer, the occt kernel source, the
  Corpus platform probes), but those are exits of justified exceptions, not open rows.
- **Individually justified:** the 36 conversions each rest on a failed trial. The 280 rewrites rest on a
  per-row source check of the reviewed claim, not on a fresh trial each; the one family that was trialled
  (the step-capture scopes) failed its claim and reopened. A trial sweep of the remaining observed-scope and
  live-clock families would be the strict form of this condition.
- **Coverage floors:** met for repo-cli: the ratchet passes and the detector file stays above its floor.

## Verification

See the lane report `.beep/detectors-w8-report.md` for the full gate list; results are summarised here.

| Step | Result |
| --- | --- |
| Base scan | `introduced=0 resolved=0` (586 rows) |
| Repaired scan before `--write` | `introduced=0 resolved=12` |
| `--write` twice | byte-stable, sha256 `547315a8...1202c874` |
| repo-cli `bun run check` (incl. test overlay) | exit 0 (after building dependency dists) |
| detector + contract tests, Bun and Node | 293 passed on each |
| Mutation probes | 5 of 5 fail their paired fixture |
| Biome, schema-first, docs oxlint, root oxlint | clean, `introduced=0` |
| fallow audit `--base origin/main --check` | ok, 0 findings |
| jsdoc inventory and ratchet | ok, `increased=0` |
| `goals:doctor` | `blocking_new=0` |
| `docgen:local` | exit 0 |
| Coverage ratchet (repo-cli) | The first run (packet edits present) gave 7,896 passed, 1 failed, ratchet not reached: `knowledge-doctor-evaluators` "reads the same packets ... as the live filesystem" compares live packet files with committed state, and the diff is this lane's uncommitted packet edits (environment-only, as in wave 7). Rerun with the five packet files temporarily set to `HEAD` and then restored: 375 files, 7,897 passed, 5 skipped, `coverage-ratchet ok`. `EffectVitestDetectors.ts` is above every floor (statements 98.08 vs 97.89, branches 96.12 vs 95.6, functions 98.78 vs 98.2, lines 99.71 vs 99.24). The coverage baseline is untouched |
| `package-verify @beep/repo-cli` | ok (audit 1,173.7 s, docgen 43.4 s), run with the packet files set to `HEAD` for the same reason, then restored |

## Reversal

Revert the PR. Repairs A and B and their two fixture tests go, the 12 retired rows return as exceptions
with their earlier reasons, the 36 conversions reopen, the 6 reopened rows return as exceptions with their
earlier reason, the 280 rewritten reasons return to their earlier text, and the inventory returns to
`190572531f`: 586 rows, 536 exceptions and 50 open. Nothing else is generated.
