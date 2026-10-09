---
"@beep/repo-cli": minor
---

`beep accounts` opens a live screen: one panel per provider (Claude, Codex,
SuperGrok Heavy, Muse), each ranked on its own and re-polled every minute,
with `r` to poll now and `q` to quit. Panels say whether to stay on the
account the CLI is signed in to or switch, every percentage means quota left,
a failed poll keeps the last good reading with its age, and a snapshot whose
window reset since capture shows as an estimate. A started week now ranks
before an untouched one. `accounts status` prints the same board once, and
`--json` now emits `accounts-status/v2` with one group per provider.
