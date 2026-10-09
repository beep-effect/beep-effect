# Workstream C root-script baseline review — 2026-10-09

Reviewed root edit: `knowledge:refs-rewrite` changes from the root TypeScript
script to `bun run beep knowledge refs rewrite`. The reviewed rule JSON stays
at its existing path. No other root script is added or removed in this wave.
The typed dry-run reports the same current counts as the old runner: 3 applied,
225 already-applied. Exact-count, no-write dry-run, drift refusal, and
idempotence fixtures belong to `@beep/repo-cli`.

Before the edit, `bun run beep cache audit` exited 0 with 0 blocking findings
and 1325 unassessed cached computations. After the edit it exited 1 with
27 `configuration-drift` findings, all root `//#` computations. This reproduces
C-ownership-facts and R29. Re-record only the root subject through
`beep cache baseline`; preserve existing scope, profile, epoch, and non-root
reviews. This review grants no new qualification or proof reuse.

There was no `//#knowledge:refs-rewrite` Turbo task to remove or retarget.
The existing uncached `//#knowledge:refs-check` task still runs the census and
retains its existing contract. Root scripts remain hand-owned; no root
PackageKind is introduced. Shared baseline and root-manifest changes require
the orchestrator's serialized gate.

Root-input gap: package verification alone does not select root adapters or
workflow YAML. This port becomes repo-cli source and is explicitly selected
by its package gate and rewrite fixture. The same-PR policy proof is
`beep lint policy --base origin/main`; hosted proof is Heavy / Lint Policy.
The retained rules JSON is covered by that proof and by the CLI dry-run.

Reversal: revert this wave and re-record the prior baseline through its owner.
