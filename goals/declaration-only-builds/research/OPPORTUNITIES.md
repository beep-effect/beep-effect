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
