# beep CLI composition Spec

## Objective

Break `@beep/repo-cli` into one composition app (`@beep/beep`), seven
`@beep/beep-<group>` command tools and six new `@beep/repo-*` libraries, and
move product and personal code out of tooling into apps. The purpose is faster
repository checks and quality gates. The gate fixes that need no split land
first, and the `beep` command surface stays unchanged throughout.

## Non-Goals

- Changing what any `beep` command does, its flags, or its output, apart from
  the retirements in D11.
- Renaming the generated `beep-cli` script strings (D20).
- Renaming the ten tooling packages that predate the naming rule (D15).
- Re-extracting substrate that `goals/effected-promotion` owns (D16).
- Cutting finer than the coarse tool set before the W7 checkpoint (D18).

## Source Hierarchy

1. The operator grill of 2026-10-21 to 2026-10-28 that created this packet
   (Decision Log below).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `standards/ARCHITECTURE.md`, `standards/architecture/07-non-slice-families.md`,
   and the 2026-10-28 entry in `standards/architecture/DECISIONS.md`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. `research/design-record.md` and the other `research/`, `ops/`, and
   `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/tool/cli`: the source of every move, deleted in W12.
- The composition app and the seven command tools (`@beep/beep`,
  `@beep/beep-yeet`, `@beep/beep-quality`, `@beep/beep-harness`,
  `@beep/beep-goals`, `@beep/beep-workspace`, `@beep/beep-ci`,
  `@beep/beep-docgen`), created with `bun run beep create-package`.
  `@beep/beep-docgen` is `packages/tooling/tool/docgen` renamed.
- Six new libraries (`@beep/repo-cli-kit`, `@beep/repo-run`,
  `@beep/repo-github`, `@beep/repo-coverage`, `@beep/repo-gates`,
  `@beep/repo-packets`) and extensions to `@beep/repo-utils`, `@beep/ai-sync`
  and `@beep/qa-capture`.
- Five apps for code that leaves tooling: practice-corpus, practice-drawings,
  labs/dataset-curation, research, and agent-router.
- Root wiring: tsconfig paths, vitest aliases, `turbo.json`, the CI lane
  partitions, `.changeset/config.json`, and the baselines under `standards/`.
- Doctrine: `standards/ARCHITECTURE.md`,
  `standards/architecture/07-non-slice-families.md`, and
  `standards/architecture/DECISIONS.md`.

## Constraints

- The Decision Log rows D1 to D20 are binding.
- Every wave keeps `main` green and the `beep` surface byte-identical, except
  for the D11 retirements.
- No command tool imports another tool. No library imports a tool or a policy
  pack. Both rules are checked by a full-edge classifier, not by sampling.
- New workspaces come only from `bun run beep create-package`.
- W1 onward waits for `goals/effected-promotion` to close (wave C) and adopts
  its packages: `@beep/cli-kit`, `@beep/repo-workspaces`, and its shared fence
  extractor.
- Moved files rekey their coverage baseline rows with identical floors.
- Before W2, check whether any persisted artifact (inbox rows, proof jobs,
  receipts, session rows) carries an identity string derived from
  `$RepoCliId`. If one does, keep a legacy identity alias for it.

## Acceptance Criteria

- [ ] The four gate fixes (G1 to G4) have landed, with before and after
      measurements recorded under `research/`.
- [ ] The W0 retirements have landed, each after a zero-consumer check.
- [ ] Inside `@beep/repo-cli`, the full-edge classifier reports zero
      library-to-tool edges after W1 and zero cross-tool command edges after W7.
- [ ] The checkpoint measurement after W7 is recorded, with a continue or stop
      row in the Decision Log.
- [ ] If the checkpoint continues: the composition app owns the `beep` and
      `beep-cli` bins, the seven command tools and the five moved-out apps
      exist, `@beep/repo-cli` is deleted, and the `beep --help` tree matches
      the pre-split snapshot apart from D11.
- [ ] The doctrine text matches the shipped layout, with the transitional
      notes removed.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/beep-cli-composition/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/beep-cli-composition/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/beep-cli-composition` | Passes |
| Edge classifier | A full import-edge census of repo-cli mapped to future homes (W1 and W7 exit gates) | Zero forbidden edges |
| Command surface | `beep --help` tree snapshot before and after each wave | Identical apart from D11 |
| Payoff | The 400-commit invalidation simulation re-run at the checkpoint | Recorded in `research/` |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-23 | D1 The composition root is an app, `@beep/beep`: the `beep` bin, a lazy dispatch manifest (group to dynamic import plus static help), per-group runtime Layers, no TS exports, no docgen surface. | Apps already own runtime wiring, so no new tooling kind and no tool-to-tool exception is needed. Rejected: a tooling app kind; keeping the root in tooling under a naming and aggregator exception. | Move the root back into a tooling tool and restore the exception. |
| 2026-10-23 | D2 Command tools are `@beep/beep-<group>` under `packages/tooling/tool/beep-<group>`, with `src/bin.ts` optional. Libraries and policy packs keep `@beep/repo-*`. | The prefix says run (beep) or import (repo). Rejected: `repo-` for everything; `beep-` for everything; regrouping verbs under pack names. | Rename the tools; one DECISIONS amendment. |
| 2026-10-23 | D3 The gate fixes land and are measured first: parallel vitest projects, lazy dispatch, coverage sharding, a per-task import-graph fingerprint. | Most measured gate time comes from serial tests, one coverage shard, eager startup and a wide fingerprint, not from package size. Rejected: split first; fixes only. | Not needed; each fix is independent. |
| 2026-10-23 | D4 Product and personal code leaves tooling: Corpus to an apps/practice-corpus app, Drawings to an apps/practice-drawings app (approval records to law-practice), Files, Image and the Python face project to a labs dataset-curation app, Research and AgentMessage to their own apps. | Product semantics route to slices and apps, and these groups carry nearly all native dependencies. Rejected: one beep-media tool; moving some out of the repo. | Move the groups back under a command tool. |
| 2026-10-23 | D5 `@beep/beep-harness` holds agent harness ops. | "harness" in this repo means the agent harness. Rejected: the run and admission layer; lane and session ops. | Regroup the harness tool. |
| 2026-10-23 | D6 Command tools never import each other; shared code goes through `@beep/repo-*` libraries. | Forces the import cycles apart and keeps each tool's Turbo hash narrow. Rejected: acyclic tool-to-tool edges. | Allow acyclic tool edges in DECISIONS. |
| 2026-10-23 | D7 Six coarse command tools plus beep-docgen. | The measured wins come from three boundaries, not many small ones. Rejected: a minimal two-plus-one cut; about 11 finer tools. | Split or merge tools after the checkpoint. |
| 2026-10-23 | D8 Session and Palantiri go to beep-harness. | Session continuity and hot parcels are harness concerns, and their cycle stays inside one tool. Rejected: beep-yeet. | Move both groups. |
| 2026-10-23 | D9 Skills goes to beep-harness, and the skills lock schemas move into `@beep/ai-sync`. | Skills sync is harness configuration; Knowledge reads the lock schemas from the library. Rejected: beep-goals. | Move the group and schemas back. |
| 2026-10-23 | D10 `@beep/repo-docgen` is renamed `@beep/beep-docgen` and absorbs the Docgen group. | One docgen home, and the existing repo-cli to repo-docgen tool-to-tool import goes away. Rejected: keep repo-docgen and move the group to beep-quality. | Rename back and split the group out. |
| 2026-10-23 | D11 Retire the finished instruments: the cache qualification lab, the docgen worker evals with the Runpod path, jsdoc-migrate, and the schema-parity codemod, each after a zero-consumer check. | DECISIONS 2026-09-02 removes zero-consumer surfaces on discovery. Rejected: a cold `beep-labs` tool; deciding per instrument. | Restore from git history. |
| 2026-10-23 | D12 The four gate fixes run as parallel lanes. | They touch independent files. Rejected: CI wall time first; lazy dispatch first. | Serialize them. |
| 2026-10-23 | D13 The program lives in this packet; `goals/repo-cli-modularization` is superseded. | The old packet's seam data dates from 92k lines and its lock contradicts D1 to D7. Rejected: an exploration packet first; reviving the old goal. | Reactivate the old packet. |
| 2026-10-23 | D14 One DECISIONS entry records placement, naming and optional tool bins, and supersedes the three no-new-package locks. | One reversible doctrine change instead of three. Rejected: separate entries. | Supersede the 2026-10-28 entry. |
| 2026-10-23 | D15 The tooling packages that already break the naming rule keep their names as exceptions; new drift is not allowed. Counted when the entry was written, there are ten (the grill counted eight before `@beep/memfs` and `@beep/test-utils` were included). | Renames churn imports and, for palantiri, a shipped desktop build. Rejected: renaming in this program. | Rename per package later. |
| 2026-10-28 | D16 The gate fixes and W0 run now. W1 onward starts after `goals/effected-promotion` closes and adopts `@beep/cli-kit`, `@beep/repo-workspaces` and its fence extractor. | That goal's remaining waves (4-A1 to 4-A4, R3a, R3b, R4, R5a, R6, 3-A6, C) edit the same files. Rejected: parallel with file ownership; merging the programs. | Start W1 earlier and rebase across its waves. |
| 2026-10-28 | D17 `repo-proof` folds into `@beep/repo-gates` as a `/proof` subpath, and `@beep/repo-coverage` stays separate, leaving six new libraries. | Proof and gates have nearly the same consumers; coverage carries the vitest and istanbul dependencies. Rejected: seven libraries; four libraries. | Split the subpath into its own package. |
| 2026-10-28 | D18 Checkpoint after W7: re-measure with parallel tests and the per-task fingerprint before any package moves in W8 to W12. | The simulation shows the split pays off on affected-scope runs (about 37 to 51 percent less test CPU) but adds about 395 to 755 CPU-seconds per full gate run. Rejected: run all waves; stop at W7. | Skip the checkpoint. |
| 2026-10-28 | D19 The instrumentation catalog (Observability group) goes to beep-quality, amending D7. | It generates the cheap gate `observability:catalog-check`. Rejected: keep it in beep-harness. | Move the group. |
| 2026-10-28 | D20 The composition app ships both `beep` and `beep-cli` bins; `beep-cli` stays a permanent alias and the generated scripts do not change. | Rewriting 722 generated script strings drifts every package's cache baseline. Rejected: rename to `beep` in W12. | Regenerate the scripts and drop the alias. |
| 2026-10-31 | G4 The lint policy fingerprint is per command-path prefix: generated seal tasks `//#lint:policy-fingerprint:<key>` chained to a `shared` seal (shell, root command, root configs), each holding only what its command adds; policy tasks depend on their seal, and `//#lint:policy-fingerprint` becomes a drift check nothing depends on. The graph is read statically (TypeScript parser, `exports` maps, the `Command.make`/`withSubcommands` tree); imports that only bind a command's subcommands are cut, and `Lint.command.ts` is split into one module per subcommand. | Seeding from one sub-closure was unsound (25 of 400 stale); per-task seals replay 0 stale over 400 commits with a Bun-resolver oracle and halve task-instance invalidations (145,200 to 71,391; 111,000 to 37,191 outside global-input commits). Rejected: per-task inline `$TURBO_ROOT$` inputs (generated entries mixed into hand-written arrays); directory-collapsed globs (unrelated new files fail the check); one seal per task (duplicates each group's imports). | Restore `policy-tools-fingerprint/v1` from git history and point the policy tasks back at `//#lint:policy-fingerprint`. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| `@beep/repo-cli` stays the composition root and holds every command group | `packages/tooling/tool/cli` | this packet | Transitional compatibility recorded in DECISIONS 2026-10-28 | W12 deletes the package |
| Ten tooling names predate the `repo-` and `beep-` rule | tooling family | architecture | D15 | A rename PR per package, if ever |
