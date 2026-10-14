# Practice services: docket intake and mail tagging as user services

The docket intake job (`apps/docket-intake`) and the mail-tagging job
(`apps/practice-mail-tagging`) each loop on their own: `docket-intake run`
polls the mailbox every five minutes, and `practice-mail-tagging watch --yes`
runs a pass every poll interval. To keep them running, install each one as a
systemd user service. The jobs schedule themselves, so there is no timer.

Nothing in the repository installs these units. This runbook is the manual
install. Do the first-run runbooks first:
[docket intake first run](docket-intake-first-run.md) and the first-run sequence in
[practice mail tagging](practice-mail-tagging.md) (steps 1 to 6).

| Unit | Sample | Environment file | Stops for good on |
| --- | --- | --- | --- |
| `docket-intake.service` | `apps/docket-intake/deploy/docket-intake.service` | `~/.config/beep-docket-intake/service.env` | 78 |
| `practice-mail-tagging.service` | `apps/practice-mail-tagging/deploy/practice-mail-tagging.service` | `~/.config/beep-practice-mail-tagging/service.env.refs` | 2, 3, 78 |

Every other non-zero exit is restarted after five minutes.

## 1. A pinned deploy checkout

Run the services from a checkout that nobody works in, detached at a known
`main` commit. Then a merge to `main` or a branch switch in a working clone
cannot change what is running. Upgrades are deliberate (section 4).

```bash
git -C <clone> fetch origin main
git -C <clone> worktree add --detach <clone>-worktrees/practice-services origin/main
cd <clone>-worktrees/practice-services && bun install --frozen-lockfile
```

`beep worktree reap` leaves this worktree alone. It only retires a worktree
whose HEAD is the head commit of a merged pull request, and a detached `main`
commit is not one.

## 2. Environment files hold op:// references

Both environment files hold 1Password references, not values, so each unit
runs its job under `op run --env-file=<file> -- bun run ...`. The `op` shim on
`PATH` (`~/.local/bin/op`) loads the agent credential itself, and `op run`
exits with the job's own exit code. Exit code 78 means the shim could not
resolve the references (run `op-doctor`). A restart does not fix that, so
neither unit restarts on 78.

Do not give such a file to systemd's `EnvironmentFile=`. systemd passes every
`op://...` reference through as a literal string. Docket intake then stops at
start with `Schema validation failed` and
`Graph path identifiers must be non-empty and must not contain '/', '..', or percent-encoded input.`
because the mailbox id it received is the reference text. Nothing is written
in that case.

- **Docket intake.** Copy `first-run.env` to `service.env` (mode `0600`).
  Add `DOCKET_INTAKE_KG_BUNDLE_DIR` for the matter lookup. Without it every
  entry is flagged `matter-lookup-failed`. Keep `DOCKET_INTAKE_STATE_DIR` on
  the first-run directory so the cursor carries on, or point it at a fresh
  directory and set `DOCKET_INTAKE_START_AT`. Entries found again by their
  idempotency key are adopted, not created twice.
- **Mail tagging.** The variables in `apps/practice-mail-tagging/.env.example`,
  with the credentials as `op://` references.

Check each file resolves, with no output:

```bash
op run --env-file=$HOME/.config/beep-docket-intake/service.env -- true >/dev/null
op run --env-file=$HOME/.config/beep-practice-mail-tagging/service.env.refs -- true >/dev/null
```

## 3. Install and start

```bash
cp apps/docket-intake/deploy/docket-intake.service ~/.config/systemd/user/
cp apps/practice-mail-tagging/deploy/practice-mail-tagging.service ~/.config/systemd/user/
# edit the REPLACE_ values in both copies: the deploy checkout, $HOME, the
# environment file, and the bun shim (~/.local/share/mise/shims/bun)
systemd-analyze --user verify ~/.config/systemd/user/docket-intake.service ~/.config/systemd/user/practice-mail-tagging.service
systemctl --user daemon-reload
systemctl --user enable --now docket-intake.service
systemctl --user enable --now practice-mail-tagging.service
```

The two jobs can share the mailbox. Each adds only its own categories and
leaves every other category on a message in place.

`docket-intake run` logs only failures, so check progress through its state:

```bash
journalctl --user -u docket-intake.service -f
journalctl --user -u practice-mail-tagging.service -f
op run --env-file=$HOME/.config/beep-docket-intake/service.env -- bun run apps/docket-intake/src/bin.ts runs
op run --env-file=$HOME/.config/beep-practice-mail-tagging/service.env.refs -- bun run apps/practice-mail-tagging/src/bin.ts report
```

Run both from the deploy checkout. `runs` and `report` call no provider and
are safe while the services run. When the saved cursor is far behind, the
first docket cycle works through the backlog, running the review loop on
each candidate. It can take many minutes before `runs` shows its line.

## 4. Upgrade

```bash
systemctl --user stop practice-mail-tagging.service docket-intake.service
git -C <deploy checkout> fetch origin main
git -C <deploy checkout> checkout --detach origin/main
cd <deploy checkout> && bun install --frozen-lockfile
systemctl --user start docket-intake.service practice-mail-tagging.service
```

To roll back, check out the previous commit the same way.

## 5. Attended writes and undo

Stop the unit before an attended writing command (`poll`, `undo --yes` for
docket intake; `apply --yes`, `undo --yes` for mail tagging), then start it
again. Both jobs hold a lock on their state directory while they write.
Undo is per run, as in the first-run runbooks.

## 6. Remove

```bash
systemctl --user disable --now practice-mail-tagging.service docket-intake.service
rm ~/.config/systemd/user/practice-mail-tagging.service ~/.config/systemd/user/docket-intake.service
systemctl --user daemon-reload
```

Keep both state directories: they hold the journals and ledgers that undo
needs. Remove the deploy checkout with `git -C <clone> worktree remove <path>`.
