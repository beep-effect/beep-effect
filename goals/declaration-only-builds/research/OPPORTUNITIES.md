# Opportunities & Friction Receipts

Dated receipts recorded while the work happened. Paths are repo-relative; no
machine or session identifiers.

## 2026-11-10 — The packet PR merged while its final-check was still red

- **Doing:** graduating this packet to `main` (#3110) so the goal's own PRs
  had a packet to update.
- **Evidence:**
  - `bun run beep yeet final-check` reported an introduced
    `knowledge:semantic-delta` finding: the exploration's `DECISIONS.md` named
    a package path that does not exist (a planned build-kit package).
  - Before the fix was pushed, another actor flipped the draft ready and
    merged it. `bun run beep yeet publish` then refused with a stale base, and
    the finding landed on `main`. The fix rides PR 1 of this goal.
- **Would have prevented it:** the semantic-delta check in the cheap gate for
  a PR that only changes Markdown, so the finding shows before the first push;
  or a merge gate that refuses a draft its owner has not called final.

## 2026-11-10 — Two final-checks ran in one lane

- **Doing:** waiting on a backgrounded `yeet final-check` whose output was
  piped through `tail`.
- **Evidence:** no output appeared, so a second run was started in the same
  lane. Coverage then failed with "coverage report directory ... already in
  use by another Vitest process".
- **Would have prevented it:** a per-checkout lock in `yeet final-check` that
  refuses a second concurrent run and names the first one's pid and log.

## 2026-11-10 — Removing a stale Turbo output glob is not a no-op

- **Doing:** dropping the pre-#1874 `node_modules/.tmp` tsbuildinfo glob from
  `turbo.json` `build.outputs` in a PR meant to change no behaviour.
- **Evidence:** `bun run beep cache audit` reported 188 `#build` subjects as
  configuration drift; the `@beep/api-transport#build` hash moved from
  `88125a686fd34b63` to `1d0ce7463b38978d`.
- **Would have prevented it:** one line in the Turbo task-contract test or the
  cache runbook saying that `outputs` is part of a task's hash, so an output
  glob edit is planned as a repo-wide cache invalidation.

## 2026-11-12 — A delegated child's report was lost to a reboot

- **Doing:** waiting for a child agent to finish `package-verify` on the
  census build-equivalence mode it wrote.
- **Evidence:** the workstation restarted. The child's edits survived in the
  lane, its final report did not, and the `package:@beep/repo-cli:audit` inbox
  row it left carried a command and an exit code but no failing test name.
- **Would have prevented it:** children write their report to a file before
  they start a long verification; a `local-shard-failed` inbox row keeps the
  tail of the failing command's output.

## 2026-11-12 — Package audit under machine load trips test watchdogs

- **Doing:** re-running `bun run audit --filter=@beep/repo-cli` to attribute
  that inbox row.
- **Evidence:** load average was 87 to 175 from other lanes. Tests this change
  does not touch (`ci-runner-security.test.ts` among them) failed with
  `TestHang ... exceeded its 29750ms watchdog`.
- **Would have prevented it:** `package-verify` running its test step through
  the admission wrapper, so it waits for a token instead of starting on a
  saturated machine.

## 2026-11-12 — The check-census gate had been red on `main` for weeks

- **Doing:** running this packet's verification matrix
  (`bun run beep quality check-census`).
- **Evidence:** `FAIL compiler changed: baseline measured with
  7.0.2+effect-tsgo.0.59.0, this run used 7.0.2+effect-tsgo.0.68.0`. The
  baseline dates from #2288; no hosted lane runs the gate, so later compiler
  bumps never re-measured it. Three packages had also grown past the noise
  floor unseen (`@beep/repo-cli` by 1,092,314 instantiations).
- **Would have prevented it:** the census gate in a hosted lane, or a step in
  the compiler-bump runbook that fails the bump PR until the baseline carries
  the new compiler stamp.

## 2026-11-12 — "Declarations only in the base tsconfig" breaks every overlay

- **Doing:** planning PR 2 as the SPEC worded it: set the emit option in
  `tsconfig.base.json`.
- **Evidence:** `tsrs -p tsconfig.check.json --emitDeclarationOnly` prints
  TS5069. 404 tracked overlays turn `declaration` and `composite` off and
  would all fail. The flag went onto the generated build command instead.
- **Would have prevented it:** one compile of a check overlay with the option
  set, during the exploration that wrote the SPEC line.

## 2026-11-12 — The scripts policy could not retire a key or a value

- **Doing:** removing the `babel` script key and the Babel build value from
  169 manifests through `bun run beep lint package-scripts --write`.
- **Evidence:** the policy only seeds a missing implementation value and never
  touches extra keys, so `--write` changed nothing. A retirement rule
  (retired key names, retired values with their replacement) had to be added
  first.
- **Would have prevented it:** nothing cheaper; recorded so the next generated
  script migration starts from the retirement tables.

## 2026-11-13 — Drafts merged while the owner's final-check was still running

- **Doing:** running `bun run beep yeet final-check` on #3178 and #3192 before
  calling either final.
- **Evidence:** both drafts were flipped ready and merged by the gate 20
  minutes after they opened, on green hosted checks plus one inherited red.
  The local final-check for #3178 was 45 minutes into its coverage gate at
  load average 60 to 110 and had one 90-second test timeout to show for it.
  The same happened to #3110 on 2026-11-10.
- **Would have prevented it:** nothing was lost here, since hosted CI was the
  proof. The waste is the local run: a final-check that stops itself when its
  PR merges, or an owner signal the gate reads before flipping a draft.

## 2026-11-13 — Three introduced reds reached hosted CI on PR 3

- **Doing:** opening PR 3 (#3242) with the local coverage gate skipped for
  compute, after the cheap gates and the touched tests passed.
- **Evidence:** hosted CI failed on three things this change caused, over two
  pushes. `test-tsgo-turbo-inputs.test.ts` expected every package's check
  script to name `tsconfig.check.json`. `architecture-operation-plan.test.ts`
  held the old generated check as a literal. `lint:jsdoc` found eight warnings
  (two code spans broken across lines, two exported predicates without
  `@param` and `@returns`), and a document-relative path in the runbook read
  as a missing tracked file. The JSDoc lane only ran on the second push
  because the first failed earlier in the same job.
- **Would have prevented it:** the touched packages' full unit suites and
  `bun run beep lint policy --affected` before the first push. Both together
  are about ten minutes; each hosted round was thirty.

## 2026-11-13 — A dependency edge without a cache baseline re-record blocked every publish

- **Doing:** publishing PR 2 after merging `main`.
- **Evidence:** `bun run beep quality cache-policy` printed 14
  `BLOCK configuration-drift` lines for three packages that a merged change
  had given a new workspace dependency. The gate is in the cheap tier, so
  `yeet publish` refused in every lane that had merged `main` until #3206.
- **Would have prevented it:** the cache-policy gate as a required hosted
  check on the PR that adds the edge, or a failure message that names the
  re-record command.

## 2026-11-13 — PR 2 merged `main` five times before it could open

- **Doing:** opening PR 2, which regenerates 182 manifests, the root catalog,
  the lockfile, `turbo.json`, the policy seal and the cache baseline.
- **Evidence:** `yeet publish` refused a stale base four times in two hours;
  each merge of `main` conflicted in a generated file (the cache baseline
  twice, the root manifest and lockfile once, the skills lock once) and
  needed the generators re-run.
- **Would have prevented it:** a short announced freeze on generated files
  while a repo-wide regeneration opens, or generated files that merge
  key-by-key.
