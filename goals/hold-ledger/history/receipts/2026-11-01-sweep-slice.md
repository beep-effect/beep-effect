# Sweep slice receipt (2026-11-01)

Branch `feat/hold-ledger-sweep` off `main` at `a37ab294f6` (after #2450 merged
as `9f7dcd01dd`).

## `beep holds update` against the real ledger

`bun run beep holds update --dry-run`:

```text
[holds] would unpin statelyai-model-testing-404: flipped; dropped from the held list for this catalog bump
[holds] update planned (dry run): 0 probed, 1 unpinned.
```

No scripted hold is due: the leases began on 2026-10-31. statelyai already has
two passing runs on candidate 0.19.0 against a reproducing control, so the next
`bun run deps:update` tombstones it, drops it from the held list and lets
`syncpack update` move the catalog from 0.14.3. This PR does not run that
bump; it lands through `deps:update` as designed.

## `beep holds why`

`bun run beep holds why @lexical/react` resolves the `@lexical/**` group pattern
to `lexical-extension-composer-migration` and prints its assertion, probe, exit,
anchors and evidence. `holds why statelyai` prints the live record with its
lease and confirmed verdict.

## Tests

`packages/tooling/tool/cli/test/Holds.service.test.ts` covers a dry run that
records nothing; a real run that tombstones the flipped catalog hold, keeps the
flipped override hold and the unprobed judgement hold, and regenerates the held
list; a due scripted hold that is probed and recorded before deciding; a due
probe that cannot start; and `holds why` through a group pattern, a tombstoned
record and the real command. 53 Holds tests pass on Node and Bun.
