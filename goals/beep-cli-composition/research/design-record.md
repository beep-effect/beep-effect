# beep CLI composition: design record

Distilled from a read-only investigation (2026-10-21), a design run with an
independent verifier against `main` at 83e7243e9e (2026-10-23), and a
recheck against `main` on 2026-10-28. Figures are as measured on those dates.

## Gate costs that started this

| Cost | Measured | Cause |
| --- | --- | --- |
| `@beep/repo-cli#test` | Two hosted shards of 14 to 15 minutes; 8.8% of fleet Turbo task time; 11% cache hits | 363 test files run one at a time (`fileParallelism: false`, `isolate: true`); imports are 37 to 50% of each run |
| Coverage | One 1,358 s repo-cli shard against 521 s for the next largest; the job takes about 24 minutes | All repo-cli coverage in one shard capped at two workers |
| Lint policy fingerprint | 230 of the last 400 main commits invalidate about 520 policy tasks | Inputs are repo-cli plus its 44-package dependency closure, 19 drivers included |
| CLI startup | 1.7 to 2.4 s and about 450 MB per call; about 470 calls per full policy run | `commands/Root.ts` imports every group eagerly; about 0.9 s floor from the `@beep/schema` and `@beep/repo-utils` barrels |
| Docgen | 73 s, 3,313 examples | About 32 s type-checking JSDoc examples |
| Type check | 8.4 s wall, 3.9 GB peak RSS, 5.2M instantiations | One 746-file project |

No workspace package depends on `@beep/repo-cli`. About 340 consumers
(generated package scripts, workflows, systemd units, hooks, permission grants,
skills) bind to the `beep` or `beep-cli` bin instead.

## Coupling

- Shared internal substrate of about 35k lines: `internal/cli` has 44
  importing groups, `internal/schema` 32, `internal/process` 26, and
  `internal/repo-run` 16.
- Import cycles across groups: Yeet and Quality (26 and 2 imports), Goals and
  Yeet (8 and 3), Lint and Goals (5 and 1), Lint and Knowledge (2 and 2), Ci and
  Quality (3 and 2), Session and Palantiri (3 and 5), Lint and Laws (2 and 1).
- Yeet is also tangled internally; a small vocabulary layer turns it into a
  clean layering.
- Corpus, Drawings, Files, Image and Research are nearly self-contained but
  carry nearly all the native dependencies, and Corpus and Drawings carry
  product semantics.

## Verified package map

Command tools (D7, D8, D9, D19), all `tooling/tool`, composed by the app:

| Tool | Groups | Approx. lines |
| --- | --- | --- |
| `@beep/beep-yeet` | Yeet, Worktree (plus tmpfs-reap and residue-reap moved from quality), Reviewer | 72k |
| `@beep/beep-quality` | Quality, Lint, Laws, Fallow, QA, Codex security scan, instrumentation catalog | 94k |
| `@beep/beep-harness` | Models, Accounts, harness ledger, agent effectiveness, AI metrics, Session, Palantiri, Skills | 51k |
| `@beep/beep-goals` | Goals, Explore, Knowledge, Docs, Codex findings ingest | 43k |
| `@beep/beep-workspace` | create and delete package, topo sort, tsconfig and version sync, architecture, purge, labs, codegen, data sync, Refs, Graft | 37k |
| `@beep/beep-ci` | Ci, Cache, Runners | 30k |
| `@beep/beep-docgen` | the renamed docgen tool plus the Docgen group (D10) | 13k plus the existing package |

New libraries (D17), all `tooling/library`, in dependency order:

| Library | Contents | Approx. lines |
| --- | --- | --- |
| `@beep/repo-cli-kit` | Repo-specific CLI helpers left after adopting `@beep/cli-kit`: JSON codecs, process steps, artifacts, ratchets, systemd units, the shared entry path | under 9.2k |
| `@beep/repo-run` | Scheduler and admission, git exec, workstation state, the session-ledger store, PR identity, worktree context | 14.7k |
| `@beep/repo-github` | GitHub client over the `@beep/github` driver, rulesets | 2.7k |
| `@beep/repo-coverage` | Coverage regression, scope and artifacts; carries the vitest and istanbul dependencies | 7.4k |
| `@beep/repo-gates` | Lane catalog, wave order, task runner, heavy admission, flake quarantine, finding and inventory contracts; a `/proof` subpath for merge readiness, verdicts, review window, the P0 inbox and the proof-job ledger | 22k |
| `@beep/repo-packets` | Goal manifests, packet core, lifecycle readers, portfolio index, knowledge refs | 6k |

`@beep/repo-utils`, `@beep/ai-sync` and `@beep/qa-capture` absorb smaller
shared pieces. The library graph has no cycles, and after W1 no library
reaches a policy pack, a tool, or an app.

Apps for code leaving tooling (D4): practice-corpus (about 24.5k lines),
practice-drawings (9.8k), labs/dataset-curation (Files, Image and the Python
face project, 23k), research (13.7k) and agent-router (3.9k).

## Payoff simulation

Method: the last 400 first-parent `main` commits, mapped to future homes,
with per-file test weights from measured vitest durations (355 of 357 files,
926 s in total). A commit reruns every package whose closure contains a
touched home.

| Measure | Today | Mapped |
| --- | --- | --- |
| Affected repo-cli test CPU | 230,654 s over 249 triggering commits | 131,930 to 144,161 s over 245 (about 37 to 43% less); 114,102 to 125,508 s (46 to 51% less) when the coverage-artifacts test moves with `@beep/repo-coverage` |
| Test CPU per triggering commit | 926 s | about 538 s |
| Policy fingerprint misses | 230 of 400 | 181 of 400 with a sound seed |
| Fixed overhead | none | 17 more workspaces, about 395 to 755 extra CPU-seconds per full gate run |

The number of triggering commits barely falls, because foundation edits still
rerun every piece; the win is per commit. Hosted lint policy runs uncached,
so fingerprint gains show up locally. Seeding the fingerprint from the quality
tool's closure alone is unsound: goals, knowledge, topo-sort and config-sync
tasks would replay stale results on 25 of 400 commits. G4 computes the
fingerprint per task instead.

## Overlap with goals/effected-promotion

| This program | effected-promotion | Resolution (D16) |
| --- | --- | --- |
| CLI failure rendering and helpers | `@beep/cli-kit` owns `CliRuntime.main`, `Fmt` and prompts; 4-C-A moved `bin-main.ts` onto it | `@beep/repo-cli-kit` keeps only repo-specific helpers |
| Workspace discovery | `@beep/repo-workspaces`; waves 4-A1 to 4-A3 move repo-cli and repo-utils discovery onto it | Adopt the kit; no fold into repo-utils |
| Fenced-code extraction | R6: one fence extractor across docgen, EffectImports, TypeScriptFences and Doctest | R6 owns it |
| W1 file splits | R3a, R3b, R4, R5a, 3-A6 and 4-A2 edit the same files | W1 starts after that goal closes |
