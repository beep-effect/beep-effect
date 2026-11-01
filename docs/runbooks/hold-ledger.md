# Hold ledger

A **hold** is a temporary dependency decision that should end one day: a
package held back from `deps:update`, an exact pin, a root override, a patch,
an OSV exception or a syncpack version group. Every hold is a record in
[`hold-ledger/claims.jsonl`](../../hold-ledger/claims.jsonl) that says why it
exists, which config entries enforce it, how to tell when it is no longer
needed, and what to do then. Contract:
[`goals/hold-ledger/SPEC.md`](../../goals/hold-ledger/SPEC.md).

```sh
bun run beep holds list                    # live holds and their confirmed verdicts
bun run beep holds why <package>           # live and tombstoned holds on one package
bun run beep holds probe <hold-id> --dry-run
bun run beep holds update --dry-run        # what deps:update would probe and unpin
bun run beep holds lint                    # cheap gate: config and ledger agree
```

## Admit a hold

You need a hold when you add a root override, a patched dependency, an OSV
package override, a package to the syncpack held list, or a syncpack version
group that pins a version. The cheap gate (`//#lint:holds`) fails on a root
override, patch or OSV override that no live hold names, so the record lands
in the same PR as the config entry.

1. Pick a kebab-case `holdId` that names the reason, not just the package
   (`xml-validator-module-scope-buffer`, not `fast-xml-validator`).
2. Write the proposition (`HoldProposition` in
   `packages/tooling/tool/cli/src/commands/Holds/Holds.schemas.ts`):
   - `kind`: `syncpack-held`, `exact-pin`, `override`, `patch`,
     `osv-exception` or `version-group`.
   - `subject.packages`: every package the decision covers. A lockstep family
     is one hold (`lexical` plus `@lexical/**`).
   - `subject.anchors`: every config entry that enforces it. A
     `SyncpackHeld` anchor puts the pattern in the held list, which
     `syncpack.config.ts` reads from `hold-ledger/syncpack-held.generated.json`.
   - `assertion`: the failure the hold prevents, specific enough to re-check.
   - `falsifier`: `Scripted` when a command reproduces the failure at a known
     bad version (`controlVersion`, `failureSignature`), otherwise `Judgement`
     with the question and the rubric for answering it.
   - `exitAction`: `Unpin`, `Rewrite` (the file to change) or
     `EscalateToGoal` (the goal that owns the work).
3. Append one `HoldClaimVersion` line: id `<holdId>@1`, logical key
   `hold:<holdId>`, a lease of at most 90 days in `validTime`, and the
   evidence you ran in `supportedBy`. Validate the line by decoding it through
   `HoldClaimVersion` (the ledger refuses to read a row that does not decode).
4. Run `bun run beep holds lint --write` to regenerate the held list, then
   `bun run beep holds lint`.

Never write probe output, secrets, home paths or client data into a record:
this repository is public.

## Probe and update

`bun run beep holds probe <hold-id>` installs the control and the candidate in
a scratch directory under `~/.cache/beep/holds/` and appends a run to
`hold-ledger/runs.jsonl`.

- The control must still reproduce the recorded failure. If it passes, the run
  is `probe-broken`: the probe no longer detects the hazard. Fix the probe or
  retire the hold; never read it as a pass.
- An inconclusive run is never a pass.
- A hold reads `Flipped` only after its two newest runs both passed on the
  same candidate version.

`bun run deps:update` runs `beep holds update` before the catalog bump. It
probes every scripted hold whose lease is two-thirds spent, and probes every
flipped hold again so its retirement rests on a run against today's candidate.
It then tombstones each hold whose history, today's run included, is confirmed
`Flipped`, that exits by `Unpin`, that was probed against npm `latest`, and
that is anchored only in the catalog and the held list. The held list is
regenerated, so the same `syncpack update --target=latest` installs the
version the probe just tested. Commit the ledger, the held list and the version
bump together. If `latest` moved since the earlier passes, the new release has
to pass twice before the hold ends. A probe that cannot run keeps its hold. A
flipped hold pinned in a workspace manifest, or anchored to an override, patch,
OSV exception or version group, is reported, not retired: make that change in a
reviewed PR, then let `holds lint --write` tombstone the record once its
anchors are gone. `--dry-run` plans with the fresh runs and writes nothing.

## Renew

Renew only with fresh evidence: a new probe run whose control reproduces, or,
for a `Judgement` hold, a verdict from the `qa.judge` pin bound to the current
diff. Append a new version (`<holdId>@<n+1>`) whose `supersedes` names the
current one, with a new lease and the new evidence in `supportedBy`. The
renewal count is the length of the chain.

## Escalate

A hold is due for escalation when its lease has run out, when its probe is
`probe-broken` and cannot be fixed, or when it has lived 180 days since its
first version. Escalation follows `exitAction`: `EscalateToGoal` opens or
updates the named goal; any other exit becomes a reviewed PR that ends the
hold or renews it with new evidence.

## Retire

A tombstone is a new version with `review: Retracted` that supersedes the live
one; the ledger is append-only, so nothing is ever edited or deleted.
`holds lint --write` writes a tombstone only when every checkable anchor of a
hold is gone; a hold that lost only some anchors stays live and keeps the lint
red until you decide. A hold that comes back later is a new record that cites
the tombstone in its evidence.
