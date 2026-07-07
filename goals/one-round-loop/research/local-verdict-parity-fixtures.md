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
| `repo-sanity` | `@beep/chalk` dep range changed from `workspace:^` to a literal version in repo-cli package.json (syncpack/sherif; the osv-ignore removal below also trips bun-audit) | FAIL | FAIL |
| `check` | Seeded type error + missing-module import in `repo-cli/src/internal/ParityFixture.ts` | FAIL | FAIL |
| `test-unit` | A seeded `expect(1).toBe(2)` unit test | FAIL | FAIL |
| `test-integration` | A seeded failing integration test (`*.integration.test.ts`) | FAIL | FAIL |
| `coverage` | Deleted `test/yeet.test.ts` in the baselined @beep/repo-cli package (large covered-line drop vs baseline) | FAIL | FAIL |
| `docgen` | An `@example` block that does not compile in a touched package | FAIL | FAIL |
| `codegen` | A hand edit to `packages/drivers/ecfr/src/_generated/Ecfr.generated.ts` | FAIL | FAIL |
| `desktop-ipc` | Ungated seeded failing test appended to `sidecar-ipc-stdio.test.ts` (file itself matches the path filter) | FAIL | FAIL |
| `fallow` | A newly dead exported function (dead-code `--check` regression) | FAIL | FAIL |
| `knip` | A new unused exported symbol above the knip baseline | FAIL | FAIL |
| `jsdoc-ratchet` | A removed `@since` tag on a previously documented export | FAIL | FAIL |
| `commitlint` | Seeded commit titled `bad commit message, no type` (hooks bypassed with --no-verify) | FAIL | FAIL |
| `nix` | A syntax error in `flake.nix` | FAIL | FAIL |
| `sast` | A seeded `eval(userControlled)` sink in a changed TS file (semgrep p/security-audit) | FAIL | FAIL |
| `secrets`* | A seeded fake AWS access key ID (`AKIA…`) in a committed file | FAIL | FAIL |
| `security`* | Removed the `GHSA-h67p-54hq-rp68` `[[IgnoredVulns]]` block from osv-scanner.toml (existing advisory un-suppressed; no lockfile change) | FAIL | FAIL |
| `build` | Missing-module import in `ParityFixture.ts` (shared with `check`) | FAIL | FAIL (push-only lane: CI verdict read from the local battery, not the PR run) |

\* approximate replay rows (class ci-native): prove class-level catch,
not byte-level verdict identity.

## Execution recipe

1. EXECUTED 2026-07-07: branch `goals/one-round-loop-p0-parity-fixtures`
   off the P0 branch (base 098abe2e4a), built in a `beep worktree new`
   worktree (bootstrap incl. bun install: 7.3s — S3 data point).
2. One seeded fixtures commit (f12bd3cf96) + the dedicated
   `bad commit message, no type` commit (a9a5f2c147); hooks bypassed
   with `--no-verify` (gitleaks/typos/commitlint pre-commit hooks catch
   several injections at commit time — itself evidence they work).
3. `bun run beep ci local --affected` run from the worktree (PR shape,
   matching what CI judges the draft PR by).
4. Draft PR #322 (never merged) provides the hosted-CI verdict column.
5. Evidence: both verdict columns + run IDs land in
   `../history/p0-parity-evidence.md` §2; every row must match. Close
   the draft PR and delete the branch after recording.
6. Sanity half: the P0 branch itself (same lanes green on both sides —
   round-2 battery + PR A's CI run).
