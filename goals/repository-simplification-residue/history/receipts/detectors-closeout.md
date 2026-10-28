# #1855 residue-detectors closeout: the roadmap-refs repo-root seam and acceptance

Lane `rsc-1855-closeout`, branch `chore/residue-detectors-closeout` off `main` `3c7abe06b2`
(which has #1875 wave 11, #2300). Scope: the last open effect-vitest row,
`roadmap-refs.test.ts:78` EV002, and the #1855 acceptance record. The seam was held while
the effected session published repo-cli source adoptions; on 2026-10-27 the orchestrator
released it, because none of the open PRs (#2294, #2298, #2299, #2301) touches a
roadmap-refs file. Route: S39/S41 Claude chain, `claude-opus-5-5` child, with no
cross-provider lane.

## The seam

`lint roadmap-refs` found its checkout only through `findRepoRoot()`, which walks up from
`process.cwd()`. Its test therefore changed the process working directory with
`withTempWorkingDirectory`, which kept each test on its own `provideScopedLayer` (EV002) and
blocked a shared layer (#1875 wave 7 H3: `chdir` into a memory directory fails with ENOENT).

`packages/tooling/tool/cli/src/commands/Lint/RoadmapRefs.ts` now takes an optional
repository root:

- `lintRoadmapRefsCommand` declares `repoRoot: Flag.String("repo-root").pipe(Flag.withDescription(...), Flag.optional)`.
  This is the existing repo-cli idiom for a repository root: `AIMetrics.command.ts` and
  `Research.command.ts` declare the same `repoRootFlag` (`--repo-root`, `Flag.optional`, an
  `Option<string>`). The `--root` flag in `Refs.command.ts` names the reference-checkout root,
  a different meaning, so the seam reuses `--repo-root` rather than `--root`.
- `runRoadmapRefsLint` takes `repoRootOverride: O.Option<string>`, defaulting to `O.none()`,
  and the command handler passes the flag through (`({ repoRoot }) => runRoadmapRefsLint(repoRoot)`).
  `None` keeps today's behaviour, `findRepoRoot()`; `Some` resolves the given path with
  `Path.resolve` and reads `docs/ROADMAP.md` under it. A first draft took an options object with
  a default object; `lint:schema-first` flagged it (`SFV4-defaults`: a parameter default object
  should move into schema defaults), so the parameter is the `Option` itself, with no default
  object. Every existing
  caller (`bun run beep lint roadmap-refs`, the root `lint:roadmap-refs` script, its Turbo
  task) passes no flag and is unchanged. Its JSDoc gains one `**Details**` line; no export is
  added.

A live run from the worktree with no flag prints `blocking_findings=0` and
`advisory_findings=0`, as before. `--repo-root /nonexistent` fails at once with
`NotFound: FileSystem.readFile (/nonexistent/docs/ROADMAP.md)`.

## The test

`packages/tooling/tool/cli/test/roadmap-refs.test.ts`: the two existing tests now sit in one
`it.layer(testLayer, { timeout: "30 seconds" })` block. `writeFixture` creates its fixture
checkout in `fs.makeTempDirectoryScoped({ prefix: "roadmap-refs-fixture-" })`, writes every
file under that root and returns it, and each test runs
`["roadmap-refs", "--repo-root", root]`. No test changes the working directory, and the
`provideScopedLayer` import is gone. Because the block shares one `TestConsole`, the
dead-link test counts only the error lines its own run adds (`A.drop` of the lines present
before the run). Every assertion is kept unchanged.

The first coverage run showed that the seam left the default branch untested
(`RoadmapRefs.ts` functions 95.65 < 100, lines 94.91 < 95.72, statements 94.95 < 95.76). The
fix is a third test, not a lowered floor: "defaults to the checkout enclosing the working
directory" runs in its own `it.layer(Layer.mergeAll(testLayer, MemoryFileSystem.layer), {
timeout: "30 seconds" })` block (the later memory operand replaces the native filesystem,
the #1875 wave 11 shape). It writes a marked checkout whose roadmap has one dead link at
`process.cwd()` on the memory volume, runs `["roadmap-refs"]` with no flag, and expects
exactly that one blocking finding. Nothing is written to disk (no `bun.lock` appears in the
package directory) and the working directory never changes. `writeFixture` is split into
`writeFixtureAt(root, roadmap)`, which also creates `root`, and the temp-directory wrapper.

`withTempWorkingDirectory` (`test/support/CommandTest.ts`) is still called from 14 other repo-cli test files, so it stays.

## Mutation probe

With the dead-link test's flag pointed at `path.join(root, "wrong-root")`, a directory with no
roadmap, the test fails in 10 ms on Bun (`expectReportedExit` sees an unreported NotFound
exit), 1 of 3 tests failing, with no hang. The file was then restored byte for byte (sha256
`1cf1c492...158e` before and after).

A second probe covers the default branch: with `onNone: () => findRepoRoot("/tmp")` in
`RoadmapRefs.ts`, the default-root test fails in 17 ms (1 of 3 failing) and the other two pass.
The source was restored byte for byte (sha256 `9281733f...8e4e` before and after). Both probes
ran on the final files.

## Census against `3c7abe06b2`

One census, paired by `(ruleId, file, occurrence)` as a multiset, from the inventory at the
base and the inventory after two byte-stable `--write` runs (sha256
`7cc576dbd70a352eec0f2f19305cdfc1b2dc3e9ec6cdc0d55fedf1991a410e71` both times).

| | Rows |
| --- | ---: |
| Base | 546 (545 exceptions, 1 open) |
| Gone | 3 (see below) |
| New | 0 |
| Status changed | 0 |
| Reason changed | 0 |
| After | 543 (543 exceptions, 0 open) |

The three gone rows:

1. `roadmap-refs.test.ts:78` EV002 `unresolved-layer-provide`, open: the target of this lane.
   The per-test `provideScopedLayer` is gone.
2. `roadmap-refs.test.ts:8` EV010 `platform-resource-provenance-review`, exception. Its
   recorded exit was "retire when roadmap-refs takes its root through a --root option or an
   injected working-directory service (the held src seam)". This lane meets it, and the scan
   no longer reports the row.
3. `package-verify.test.ts:25` EV010 `platform-filesystem-candidate`, exception. Inherited,
   not caused by this lane: #2287 (`336b31c500`, merged after #1875 wave 11's base
   `8b4d63b1f3` and before `3c7abe06b2`) added a test that runs `fs.chmod(turbo, 0o755)` on its
   bound FileSystem, which satisfies #1855 wave 7's `nativeFileSystemLayerIntegration` proof
   (every reached harness calls a native link or mode operation). A plain scan at the clean
   base already reports `findings=545 introduced=0 resolved=1`; this row is that one.

That reconciles: 546 − 3 = 543 rows; 1 open − 1 = 0 open; 545 exceptions − 2 = 543.
A plain `lint effect-vitest` after the writes reports `introduced=0 resolved=0`.

## #1855 acceptance

**Paired fixtures and attributable waves** were delivered by waves 1 to 8
(`detectors-wave-{1..8}.md`); this lane changes no detector.

**Fresh zero actionable scan: met.** The fresh scan at this head has 0 open rows of 543 and
`introduced=0`.

**Individually justified surviving exceptions with owner and exit: met.** Counting the 543
exception rows whose `reason` lacks either an `Owner: <name>` or an `Exit: <condition>` clause
gives 0. The reasons are the ones #1855 wave 8 and #1875 wave 11 recorded; no reason changed
here. The wave 8 caveat stands: those rewritten reasons rest on a per-row source check, not a
fresh trial each.

**Unchanged coverage floors: met.** `bun run coverage --filter=@beep/repo-cli` reports
`coverage-ratchet ok: compared 1 package(s) with epsilon 0.001` (376 files, 7906 passed,
5 skipped), and no coverage baseline file is in the diff, so no baseline row was lowered.
Before the default-root test the ratchet failed on `RoadmapRefs.ts` (above), and one run
also failed one unrelated test, `laws-markdown-fences-command` "fails with the law's
execution error without a repository root or a skills lock", which found a repository root
at `/tmp` (a root marker another process briefly left there; the file passes 6 of 6 alone
and in the next full run). That is environment-only.

## Verification

Every heavy command ran alone through `beep-heavy` with stdin from `/dev/null`. Dependency
dists were built first with `bunx turbo run build --filter="@beep/repo-cli^..."` (69 of 69, 68
cached). Coverage and `package-verify` ran with the packet edits parked (restored from `HEAD`,
then put back byte for byte, checked by sha256), because `knowledge-doctor-evaluators`
compares the `HEAD` tree with the working tree.

| Check | Result |
| --- | --- |
| `lint effect-vitest --write` twice | byte-stable, sha256 `7cc576db...0e71`; plain scan `introduced=0 resolved=0`, 543 findings |
| repo-cli `bun run check` (tsconfig.check, scripts, test overlay) | exit 0 |
| `roadmap-refs.test.ts`, Bun and Node | 3 passed on each |
| repo-cli suite on Bun (`bunx --bun vitest run`) | 375 files passed, 1 skipped; 7908 passed, 3 skipped |
| Coverage ratchet `bun run coverage --filter=@beep/repo-cli` (Node) | `coverage-ratchet ok: compared 1 package(s)`, 7906 passed, 5 skipped |
| `quality package-verify @beep/repo-cli` | ok (audit, docgen) |
| Mutation probes | 2 of 2 fail fast (10 ms, 17 ms), none hang |
| `lint:schema-first`; `lint schema-catalog` | `introduced=0`, parity ratchet ok; exit 0 |
| `docgen:local` | exit 0 |
| `jsdoc:inventory:check` then `jsdoc:ratchet:check` | ok, `increased=0`, zero-legacy ok |
| `quality fallow audit --base origin/main --check` | status ok |
| root `lint:oxlint`; root docs oxlint (`oxlint . --config .oxlintrc.docs.json --max-warnings=0`) | exit 0, exit 0 |
| Biome on the touched source, test, manifest and inventory | clean |
| `goals:doctor` | OK, no new blocking findings |
| `lint roadmap-refs` (live, no flag) | 0 blocking, 0 advisory |

## Out of scope

- The held effected seams stay exceptions with an owner and exit, not open rows: the 11
  `@beep/box-provisioning` rows (owner `@beep/box-provisioning`) and the `files-command`
  `withReplacedPath` wrapper, whose real spawner resolves `exiftool` through the process
  `PATH` (exit: Files resolves `exiftool` through `Config`).
- The seven `#1855 wave 4 register` exceptions are untouched.
- #1875 (`residue-vitest-canon`) keeps its own status; this lane only closes #1855.

## Reversal

Revert the PR. `lint roadmap-refs` loses the `--repo-root` flag and `runRoadmapRefsLint` its
`repoRootOverride` parameter; the test returns to `withTempWorkingDirectory` with a per-test
`provideScopedLayer`. The inventory returns to the base: 546 rows, 545 exceptions and 1 open,
with both roadmap-refs rows and the `package-verify.test.ts:25` row back as they were; a
later `--write` drops the `package-verify` row again, because #2287 resolves it on its own. The
#1855 workstream returns to `in-progress` and the SPEC status to in-progress.
