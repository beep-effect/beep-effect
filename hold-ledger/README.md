# Hold ledger

A hold records a temporary repo decision that should end one day: a held
dependency, an exact pin, an override, a patch or an OSV exception. Each hold
carries the probe that would show it is no longer needed. Contract:
[`goals/hold-ledger/SPEC.md`](../goals/hold-ledger/SPEC.md).

| File | Contents | Writers |
| --- | --- | --- |
| `claims.jsonl` | Append-only `HoldClaimVersion` rows (`@beep/repo-cli/commands/Holds`). A renewal appends a version that `supersedes` the previous one; the old row gets an `expiredAt`. | Agents, through reviewed PRs |
| `runs.jsonl` | Append-only `ProbeRun` rows, one per `beep holds probe` run. | `bun run beep holds probe <hold-id>` |

```sh
bun run beep holds list
bun run beep holds probe statelyai-model-testing-404 --dry-run
```

`beep holds probe` installs each side in a scratch directory under
`~/.cache/beep/holds/<hold-id>/`. The control must still reproduce the
recorded failure; if it doesn't, the run is `probe-broken`. A hold reads
`Flipped` only after two consecutive passing runs.
