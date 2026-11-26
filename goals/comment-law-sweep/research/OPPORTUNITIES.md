# Opportunities and friction receipts

## 2026-11-22: the delete-comment brief needs the strict T test up front

- Doing: wave 1 classification (semver, npm-spec, csv, spdx, managed-section; 1,199 rows), an Opus 5.5 child and a Codex Sol lane.
- Evidence: round 1 disagreed on 18-51% of the rows either side called T or G (31 H->T, 18 N->T, 14 T->N, 12 H->G); both vote sets were discarded. The causes were blank `//` paragraph lines voted G, and "why this test exists" sentences voted T.
- Prevention: put the round-2 rules in `.claude/skills/delete-comment/references/rubric.md` itself: blank paragraph lines take the paragraph's code, a T vote names what restates it, G only for labels. Round 2 then reached kappa 0.78.

## 2026-11-22: the strip yields about 10% of a package; the rest waits on absorption

- Doing: wave 1 apply.
- Evidence: 116 of 1,199 rows deleted (T 28, G 71, D 17); 1,000+ rows agreed H or N and stay under the pending list.
- Prevention: nothing to prevent; it sizes the work. The SPEC acceptance (pending list empty) needs absorption PRs, which change code and carry tests, far beyond the strip.

## 2026-11-22: `beep decisions check` ignores untracked decision files

- Doing: writing the first package decision file.
- Evidence: `decisions check` printed `decisions: 0` until the file was `git add`ed.
- Prevention: say in the delete-comment skill step 3 that the file must be staged before `decisions check` sees it.

## 2026-11-23: a memory-capped systemd unit makes final-check resolve the worker profile

- Doing: running `yeet final-check` inside `systemd-run --user` so a turn end could not kill it.
- Evidence: the shell reports `beep compute profile` = `workstation`, but the same final-check inside the unit logged `skipped final-check:cheap-gates ... compute-profile=worker`, along with lint-policy, check, docgen and fallow, and printed `final-check pass`. `yeet open` then refused: "the worker profile deferred gates to hosted CI and their check runs could not be read" (the head was not pushed yet). So a "pass" receipt hid five skipped gates, and the first PR body named only the coverage skip.
- Cause: the profile probe reads the process memory ceiling, and the unit carried `MemoryMax=10G`, below the workstation envelope, so `worker` was the correct answer for that process. A heavy-admitted draft cannot then be flipped: the draft never gets the heavy Lint Policy run that `yeet ready` waits for.
- Would have prevented it: print the resolved profile and its source in the final-check pass line, and have `yeet ready` refuse at once, naming the rerun without a memory cap, instead of waiting on a check a draft never gets.
## Turn-end reap kills background proofs (2026-11-23)

- Doing: a background `yeet final-check` (wave 3a) and three sequential Cursor verifier runs (wave 4), both started from an agent shell with run_in_background.
- Evidence: all three cursor-agent runs exited 143 at the same second the turn ended; the final-check log shows `lint:oxlint ... terminated by signal SIGTERM`, `script "beep" was terminated by signal SIGKILL`, docgen exit 130, and a merge-base vitest exit 143 that Yeet then read as `masks-base-red` for an unrelated expectation rewrite.
- Would have prevented it: start any proof or verifier that may outlive the turn as a systemd user unit (`systemd-run --user --unit=<name> --collect`), as the detached Yeet jobs already do; a final-check whose base run died by signal should report "base run killed" instead of `masks-base-red`.
## 2026-11-22: a single absorption author drops information without a second route

- Doing: wave 2 absorption of `@beep/toml` by a Codex lane.
- Evidence: the author's per-row report gave one boilerplate reason ("existing names ... already carry this information") for 375 deletions; an independent Opus verifier cited carriers for 335 and found 39 rows whose information had been lost, which it moved into names, test titles and assertions.
- Prevention: every absorption PR runs an author and a verifier on different routes, and the verifier cites a `file:line` carrier per deleted H, N or D row (SPEC constraint, 2026-11-22).

## 2026-11-22: Codex workspace-write lanes cannot prove package-verify

- Doing: toml and jsonl absorption and verification lanes on `codex exec -s workspace-write`.
- Evidence: `quality package-verify` audit failed in the sandbox with stdout `EPERM: operation not permitted, write`, then vitest worker-start and PGLite image-build failures; the same command passed outside the sandbox.
- Prevention: the orchestrator reruns package-verify outside the sandbox; the runbook's Codex recipe could say so.

## 2026-11-22: a deleted header comment was the evidence for an effect-vitest exception

- Doing: jsonl final-check after absorption.
- Evidence: `lint:effect-vitest` reported one new EV010 finding in `test/integration/Journal.int.test.ts` once its header JSDoc (why the suite needs the real filesystem) was absorbed; the import did not change.
- Prevention: the absorb brief should send a "why this test touches real resources" header to an effect-vitest inventory `reason`, not to deletion.

## 2026-11-23: `yeet reply` drafts need `schemaVersion`, and the error does not say so

- Doing: answering the first review thread on #3494.
- Evidence: a drafts file keyed `schema` failed with "every draft needs a non-empty body and either a PRRT_ thread id or a numeric comment id".
- Prevention: name the missing or unknown top-level key in the decode error.

## 2026-11-23: a new root file with a header comment reds main under the root-scope lock

- Doing: unblocker #3495.
- Evidence: #3458 added `vitest.property-reporter.ts` with a four-line `//` header; once #3483 locked the root scope, main's Repo Sanity failed (`locked-scope-comment`).
- Prevention: the pre-commit `comment-law` hook already blocks this locally; the gap was a PR green before the lock landed and merged after it. A merge-queue style re-check of the base would catch it.

## 2026-11-23: `--skip coverage` also skips Test Unit, so generated-artifact drift shows only in hosted CI

- Doing: w4 (#3509) final-check with coverage skipped under the 11-13 rule.
- Evidence: an absorbed `CompilerOptions.ts` description changed text that `packages/tooling/tool/docgen/schema.json` embeds; local final-check passed, hosted Heavy / Test Unit failed on the stale `schema.json`.
- Prevention: final-check could run the unit tests of downstream packages that embed generated schema output even when coverage is skipped, or a generator-drift lint could own `schema.json`.

## 2026-11-23: the comment law fails closed on a hosted lazy-blob 403

- Doing: #3515 Repo Sanity on a blobless hosted clone.
- Evidence: `lint:comment-law` failed with `GitCommandError` on `git show <base>:<file>` (`fatal: unable to access ... 403`); setup-bun hit the same 403 in that job. A merge of main for a fresh run cleared it.
- Prevention: fetch the base blobs the law needs in one `git fetch --filter` step before the law runs, with a retry, so a transient 403 does not red a required check.

## 2026-11-26: the pre-commit comment-law hook measures against the previous commit, not main

- Doing: committing the w25 (`@beep/memfs` src) verifier's repairs on top of the author's commit.
- Evidence: the verifier restored two original comments as residue; the staged hook reported `introduced=2` against the author's commit, while `laws comments` against the merge base reported `introduced=0`.
- Prevention: the staged hook should measure against the branch's merge base with main, as the full law does, so restored originals are not flagged as new.
