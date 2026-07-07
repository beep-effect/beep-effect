# Local verdict parity fixtures (P0 / Verification Matrix row 2)

Fixture TABLE for the local-vs-CI verdict parity proof: one row per
cli-runnable / workflow-gated lane, no lane skipped. Executed on a
deliberately broken branch (`goals/one-round-loop-p0-parity-fixtures`)
carrying every injection below in seeded commits; `beep ci local`
verdicts are compared against the CI verdicts of a draft PR from that
branch. Run evidence lands in
`goals/one-round-loop/history/p0-parity-evidence.md`.

Approximate lanes (`secrets`, `security`) are included as marked rows —
they prove the local approximation catches the same class, not verdict
identity (their CI bodies are ci-native and unchanged by the thinning).
CI-only residue (`pr-size`, `dependency-review`) has no rows by
definition (`beep ci lane --list` documents it).

| Lane id | Injected failure | Expected local verdict | Expected CI verdict |
|---|---|---|---|
| `lint` | `debugger;` statement in a `packages/**/src` file (biome error) | FAIL | FAIL |
| `lint-policy` | The typo `recieve` in a tracked source comment (`lint:typos` step) | FAIL | FAIL |
| `repo-sanity` | One workspace dependency version desynced in a package.json (syncpack lint) | FAIL | FAIL |
| `check` | A type error (`const n: number = "x"`) in a `packages/**/src` file | FAIL | FAIL |
| `test-unit` | A seeded `expect(1).toBe(2)` unit test | FAIL | FAIL |
| `test-integration` | A seeded failing integration test (`*.integration.test.ts`) | FAIL | FAIL |
| `coverage` | A new branch-heavy uncovered source file in a baselined package | FAIL | FAIL |
| `docgen` | An `@example` block that does not compile in a touched package | FAIL | FAIL |
| `codegen` | A hand edit to `packages/drivers/ecfr/src/_generated/Ecfr.generated.ts` | FAIL | FAIL |
| `desktop-ipc` | A broken assertion in the IPC stdio integration proof (plus a path-filter-matching touch) | FAIL | FAIL |
| `fallow` | A newly dead exported function (dead-code `--check` regression) | FAIL | FAIL |
| `knip` | A new unused exported symbol above the knip baseline | FAIL | FAIL |
| `jsdoc-ratchet` | A removed `@since` tag on a previously documented export | FAIL | FAIL |
| `commitlint` | A seeded commit titled `bad commit message, no type` | FAIL | FAIL |
| `nix` | A syntax error in `flake.nix` | FAIL | FAIL |
| `sast` | A seeded `eval(userControlled)` sink in a changed TS file (semgrep p/security-audit) | FAIL | FAIL |
| `secrets`* | A seeded fake AWS access key ID (`AKIA…`) in a committed file | FAIL | FAIL |
| `security`* | An OSV-flagged pinned dependency without an osv-scanner.toml ignore | FAIL | FAIL |
| `build` | An import of a nonexistent module in a built package | FAIL | FAIL (push-only lane: CI verdict read from the shadow/battery, not the PR run) |

\* approximate replay rows (class ci-native): prove class-level catch,
not byte-level verdict identity.

## Execution recipe

1. Branch `goals/one-round-loop-p0-parity-fixtures` off the P0 branch.
2. Apply every injection in one seeded commit (plus the dedicated
   `bad commit message, no type` commit for the commitlint row).
3. Run `bun run beep ci local` from the branch; record per-lane verdicts
   (the `ci:local:<lane>` failure summary lines).
4. Push the branch, open a DRAFT PR (never merged), record per-lane CI
   verdicts from the check.yml run on the same head SHA.
5. Fill the evidence file with both verdict columns + run IDs; every row
   must match. Delete the fixture branch and close the draft PR after
   recording.
6. Sanity half: revert the injections (or compare against the P0 branch
   itself) — all rows green on both sides.
