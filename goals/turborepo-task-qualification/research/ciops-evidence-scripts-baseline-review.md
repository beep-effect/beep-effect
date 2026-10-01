# Re-record the baseline after splitting the `@beep/ciops` evidence scripts

`apps/labs/ciops/package.json` gains one package-owned extra script. The bare
`evidence:s7` entry used to re-render the frozen packet record
`explorations/beep-ci-operational-ontology/research/s7-replay-evidence.md`;
it now runs `scripts/generate-replay-evidence.ts --check`, and the new
`evidence:s7:write` entry is the only path that passes `--write`. The generated
task and implementation tiers are untouched (`bun run beep lint package-scripts
--check` reports 0 drifting manifests).

The projection records one `commandDigest` per task, derived from the
package's scripts block, so the re-record moves that digest on all ten
`@beep/ciops` computations. `beep cache audit` blocks on the six that carry a
cache policy (`build`, `check`, `lint`, `lint:deprecated-apis`, `lint:laws`,
`test`); `audit`, `dev`, `lint:fix` and `package-test-typecheck` move with
them. No command text, input glob, output declaration, environment key,
dependency edge or cache flag changed for any of them; no node is added or
removed and no projection source moved.

Accept the re-hashed `@beep/ciops` configuration in the legacy configuration
baseline. This review grants no runtime qualification. Retain the current
identity/types/runner lint scope, `local-linux-x64-bun1.4.2` profile and
`qualification-v2` epoch; the qualification ledger is untouched.
