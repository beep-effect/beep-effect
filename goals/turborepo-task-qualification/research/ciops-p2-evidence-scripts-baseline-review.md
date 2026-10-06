# Re-record the baseline after adding the `@beep/ciops` lane-plan and live-replay scripts

`apps/labs/ciops/package.json` gains four package-owned extra scripts for the
`ciops-ontology-pipeline` P2 projection work: `evidence:lane-plan` and
`evidence:s7-live` run `scripts/generate-lane-plan-golden.ts --check` and
`scripts/generate-live-replay-evidence.ts --check`, and their `:write`
siblings are the only paths that pass `--write`. They follow the
`evidence:s7` / `evidence:s7:write` split this packet accepted in the previous
`@beep/ciops` re-record. The generated task and implementation tiers are
untouched (`bun run beep lint package-scripts --check` reports 0 drifting
manifests).

The projection records one `commandDigest` per task, derived from the
package's scripts block, so the re-record moves that digest on all ten
`@beep/ciops` computations. `beep quality cache-policy` blocks on the six
that carry a cache policy (`build`, `check`, `lint`, `lint:deprecated-apis`,
`lint:laws`, `test`); `audit`, `dev`, `lint:fix` and `package-test-typecheck`
move with them. No command text, input glob, output declaration, environment
key, dependency edge or cache flag changed for any of them; no node is added
or removed and no projection source moved. The re-record also refreshes the
twelve advisory `configuration-source-drift` digests (the root and per-package
`turbo.json` sources) that `main` had already moved before this branch; no
node reads them differently.

Accept the re-hashed `@beep/ciops` configuration in the legacy configuration
baseline. This review grants no runtime qualification. Retain the current
identity/types/fc-runs/test-runner lint scope, `local-linux-x64-bun1.4.2`
profile and `qualification-v2` epoch; the qualification ledger is untouched.
