# Hold ledger

A hold records a temporary repo decision that should end one day: a held
dependency, an exact pin, an override, a patch or an OSV exception. Each hold
carries the probe that would show it is no longer needed. Contract:
[`goals/hold-ledger/SPEC.md`](../goals/hold-ledger/SPEC.md).

| File | Contents | Writers |
| --- | --- | --- |
| `claims.jsonl` | Append-only `HoldClaimVersion` rows (`@beep/repo-cli/commands/Holds`). A renewal appends a version that `supersedes` the previous one; a tombstone is a superseding version with `review: Retracted`. A hold is live when no later row supersedes it. | Agents, through reviewed PRs; `beep holds lint --write` for tombstones |
| `runs.jsonl` | Append-only `ProbeRun` rows, one per `beep holds probe` run. | `bun run beep holds probe <hold-id>` |
| `syncpack-held.generated.json` | The dependency patterns `deps:update` must not touch: every `SyncpackHeld` anchor of a live hold, sorted. `syncpack.config.ts` imports it. | `bun run beep holds lint --write` |

```sh
bun run beep holds list
bun run beep holds why statelyai
bun run beep holds probe statelyai-model-testing-404 --dry-run
bun run beep holds update --dry-run  # the deps:update pre-step
bun run beep holds lint          # cheap gate: config and ledger agree
bun run beep holds lint --write  # tombstone orphans, regenerate the held list
```

Every root override, patched dependency and OSV package override needs a live
hold whose anchors name it, and every anchor of a live hold must still exist
(a catalog entry, a manifest dependency or a syncpack version-group label).
A new hold-shaped config entry therefore fails the cheap gate until its record
lands in the same PR.

`beep holds probe` installs each side in a scratch directory under
`~/.cache/beep/holds/<hold-id>/`. The control must still reproduce the
recorded failure; if it doesn't, the run is `probe-broken`. A hold reads
`Flipped` only after two consecutive passing runs on the same candidate.
`bun run deps:update` runs `beep holds update` first: due probes run, and a
flipped hold that a catalog bump completes is tombstoned so the bump moves it.
How to admit, renew and escalate a hold: [the hold ledger runbook](../docs/runbooks/hold-ledger.md).
